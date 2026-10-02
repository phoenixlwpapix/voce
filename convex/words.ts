import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { languageValidator } from "./validators";
import { requireOwner } from "./ownership";
import schema from "./schema";
import { DAY, toCard, cardPatch, toRating, scheduler } from "./lib/fsrs";

const dayInMilliseconds = 24 * 60 * 60 * 1000;
const maxWordsPerQuery = 500;

export const getWordsForExport = query({
  args: {
    language: v.optional(languageValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(schema.doc("words")),
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const language = args.language;
    if (language !== undefined) {
      return await ctx.db
        .query("words")
        .withIndex("by_ownerId_language_createdAt", (index) =>
          index.eq("ownerId", ownerId).eq("language", language),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("words")
      .withIndex("by_ownerId_createdAt", (index) => index.eq("ownerId", ownerId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

// The timeline pages through a whole lexicon; each page is its own
// subscription, so an edit only re-sends the page that contains it.
export const listWords = query({
  args: { language: languageValidator, paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("words")),
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    return await ctx.db
      .query("words")
      .withIndex("by_ownerId_language_createdAt", (index) =>
        index.eq("ownerId", ownerId).eq("language", args.language),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getWordsByMonth = query({
  args: { language: languageValidator, monthGroup: v.optional(v.string()) },
  returns: v.array(schema.doc("words")),
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    if (args.monthGroup !== undefined) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(args.monthGroup)) {
        throw new ConvexError("Invalid month format.");
      }
      const words = await ctx.db
        .query("words")
        .withIndex("by_ownerId_language_monthGroup", (index) =>
          index
            .eq("ownerId", ownerId)
            .eq("language", args.language)
            .eq("monthGroup", args.monthGroup!),
        )
        .take(maxWordsPerQuery);
      return words.sort((first, second) => second.createdAt - first.createdAt);
    }

    return await ctx.db
      .query("words")
      .withIndex("by_ownerId_language_createdAt", (index) =>
        index.eq("ownerId", ownerId).eq("language", args.language),
      )
      .order("desc")
      .take(maxWordsPerQuery);
  },
});

export const getDueQueue = query({
  args: {
    language: languageValidator,
    dayStartMs: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(schema.doc("words")),
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const dayEnd = args.dayStartMs + DAY;
    const limit = args.limit ?? maxWordsPerQuery;
    const now = new Date();

    const due = await ctx.db
      .query("words")
      .withIndex("by_ownerId_language_nextReviewAt", (q) =>
        q.eq("ownerId", ownerId).eq("language", args.language).lte("nextReviewAt", dayEnd),
      )
      .collect();

    const pending = await ctx.db
      .query("words")
      .withIndex("by_ownerId_language_pendingRetryDay", (q) =>
        q
          .eq("ownerId", ownerId)
          .eq("language", args.language)
          .eq("pendingRetryDay", args.dayStartMs),
      )
      .collect();

    const isNew = (w: (typeof due)[number]) => w.lastReviewedAt === undefined;
    const reviewDue = due.filter(
      (w) => !isNew(w) && !(w.lastReviewedAt !== undefined && w.lastReviewedAt >= args.dayStartMs),
    );

    // Sort review words by retrievability R ascending (most forgotten first)
    const scored = reviewDue
      .map((w) => ({
        w,
        r: scheduler.get_retrievability(toCard(w), now, false) as number,
      }))
      .sort((x, y) => x.r - y.r)
      .map((x) => x.w);

    // New words (never reviewed): capped at 15 per day to prevent backlog explosion
    const newWords = due.filter(isNew).slice(0, 15);

    // Prioritize pending retry words, then review due words, then new words
    const pendingIds = new Set(pending.map((p) => p._id));
    const scoredWithoutPending = scored.filter((w) => !pendingIds.has(w._id));
    const newWithoutPending = newWords.filter(
      (w) => !pendingIds.has(w._id) && !scoredWithoutPending.some((s) => s._id === w._id),
    );

    return [...pending, ...scoredWithoutPending, ...newWithoutPending].slice(0, limit);
  },
});

export const gradeWord = mutation({
  args: {
    id: v.id("words"),
    sessionId: v.string(),
    questionId: v.string(), // unique per attempt: `${sessionId}:${wordId}:${attemptNo}`
    correct: v.boolean(),
    questionType: v.union(v.literal("choice"), v.literal("recall")),
    responseMs: v.number(),
    dayStartMs: v.number(), // client's local day start (00:00:00) timestamp
  },
  returns: v.object({
    applied: v.boolean(),
    pendingRetry: v.boolean(),
    nextReviewAt: v.number(),
  }),
  handler: async (ctx, a) => {
    const ownerId = await requireOwner(ctx);
    const word = await ctx.db.get(a.id);
    if (!word) throw new ConvexError("This word no longer exists.");
    if (word.ownerId !== ownerId) throw new ConvexError("You don't have permission to update this word.");

    const now = Date.now();
    if (a.dayStartMs > now || now - a.dayStartMs > 36 * 3600_000) {
      throw new ConvexError("Invalid day start.");
    }
    const dayEnd = a.dayStartMs + DAY;

    // 1) Idempotency check: same question in same session processed only once
    const dup = await ctx.db
      .query("reviewLogs")
      .withIndex("by_sessionId_questionId", (q) =>
        q.eq("sessionId", a.sessionId).eq("questionId", a.questionId),
      )
      .first();
    if (dup) {
      return {
        applied: dup.applied,
        pendingRetry: word.pendingRetryDay === a.dayStartMs,
        nextReviewAt: word.nextReviewAt,
      };
    }

    const gradedToday =
      word.lastReviewedAt !== undefined && word.lastReviewedAt >= a.dayStartMs;
    const isDue = word.nextReviewAt <= dayEnd;
    const inRetry = word.pendingRetryDay === a.dayStartMs;

    let applied = false;
    let rating: number | undefined;
    let pendingRetry = inRetry;
    let nextReviewAt = word.nextReviewAt;

    if (inRetry) {
      // Retry phase: correct answers clear retry queue without advancing schedule.
      // Incorrect answers keep word in retry queue without accumulating additional lapses.
      if (a.correct) {
        await ctx.db.patch(a.id, { pendingRetryDay: undefined });
        pendingRetry = false;
      }
    } else if (!gradedToday && (isDue || !a.correct)) {
      // First rating:
      // Due words: rated whether correct or wrong.
      // Non-due words: only rated if wrong (lapse).
      const grade = toRating(a);
      const { card } = scheduler.next(toCard(word), new Date(now), grade);
      rating = grade;
      applied = true;
      nextReviewAt = card.due.getTime();
      pendingRetry = !a.correct;
      await ctx.db.patch(a.id, {
        ...cardPatch(card, now),
        pendingRetryDay: a.correct ? undefined : a.dayStartMs,
      });
    }

    await ctx.db.insert("reviewLogs", {
      ownerId,
      wordId: a.id,
      sessionId: a.sessionId,
      questionId: a.questionId,
      questionType: a.questionType,
      correct: a.correct,
      rating,
      applied,
      responseMs: a.responseMs,
      reviewedAt: now,
    });

    return { applied, pendingRetry, nextReviewAt };
  },
});

export const getReviewQueue = query({
  args: { language: languageValidator, now: v.number() },
  returns: v.array(schema.doc("words")),
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    if (!Number.isFinite(args.now) || args.now <= 0) {
      throw new ConvexError("Invalid review time.");
    }
    const dayStart = new Date(args.now).setHours(0, 0, 0, 0);
    const pending = await ctx.db
      .query("words")
      .withIndex("by_ownerId_language_pendingRetryDay", (index) =>
        index
          .eq("ownerId", ownerId)
          .eq("language", args.language)
          .eq("pendingRetryDay", dayStart),
      )
      .collect();

    const due = await ctx.db
      .query("words")
      .withIndex("by_ownerId_language_nextReviewAt", (index) =>
        index
          .eq("ownerId", ownerId)
          .eq("language", args.language)
          .lte("nextReviewAt", args.now),
      )
      .order("asc")
      .take(maxWordsPerQuery);

    const pendingIds = new Set(pending.map((w) => w._id));
    return [...pending, ...due.filter((w) => !pendingIds.has(w._id))].slice(0, maxWordsPerQuery);
  },
});

export const updateReviewState = mutation({
  args: {
    id: v.id("words"),
    outcome: v.union(v.literal("forgot"), v.literal("remembered")),
  },
  returns: v.object({
    repetitions: v.number(),
    intervalDays: v.number(),
    easeFactor: v.number(),
    nextReviewAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const word = await ctx.db.get(args.id);
    if (!word) {
      throw new ConvexError("This word no longer exists.");
    }
    if (word.ownerId !== ownerId) {
      throw new ConvexError("You don't have permission to update this word.");
    }
    // A card that is no longer due was already rated (for example in another
    // tab); rating it again must not advance the schedule a second time.
    if (word.nextReviewAt > Date.now()) {
      return {
        repetitions: word.repetitions,
        intervalDays: word.intervalDays,
        easeFactor: word.easeFactor,
        nextReviewAt: word.nextReviewAt,
      };
    }

    let repetitions: number;
    let intervalDays: number;
    let easeFactor: number;

    if (args.outcome === "forgot") {
      repetitions = 0;
      intervalDays = 1;
      easeFactor = Math.max(1.3, word.easeFactor - 0.2);
    } else {
      repetitions = word.repetitions + 1;
      if (repetitions === 1) {
        intervalDays = 1;
      } else if (repetitions === 2) {
        intervalDays = 3;
      } else {
        intervalDays = Math.max(1, Math.round(word.intervalDays * word.easeFactor));
      }
      easeFactor = Math.min(3, word.easeFactor + 0.1);
    }

    const now = Date.now();
    const nextReviewAt = now + intervalDays * dayInMilliseconds;
    await ctx.db.patch(args.id, {
      repetitions,
      intervalDays,
      easeFactor,
      lastReviewedAt: now,
      nextReviewAt,
      updatedAt: now,
    });

    return { repetitions, intervalDays, easeFactor, nextReviewAt };
  },
});

export const deleteWord = mutation({
  args: { id: v.id("words") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const word = await ctx.db.get(args.id);
    if (!word) {
      throw new ConvexError("This word no longer exists.");
    }
    if (word.ownerId !== ownerId) {
      throw new ConvexError("You don't have permission to delete this word.");
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

export const validateLanguage = query({
  args: { language: languageValidator },
  returns: languageValidator,
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    return args.language;
  },
});
