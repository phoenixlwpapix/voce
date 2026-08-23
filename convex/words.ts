import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { languageValidator } from "./validators";
import { requireOwner } from "./ownership";
import schema from "./schema";

const dayInMilliseconds = 24 * 60 * 60 * 1000;
const maxWordsPerQuery = 500;

export const getWordsByMonth = query({
  args: { monthGroup: v.optional(v.string()) },
  returns: v.array(schema.doc("words")),
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    if (args.monthGroup !== undefined) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(args.monthGroup)) {
        throw new ConvexError("Invalid month format.");
      }
      const words = await ctx.db
        .query("words")
        .withIndex("by_ownerId_monthGroup", (index) =>
          index.eq("ownerId", ownerId).eq("monthGroup", args.monthGroup!),
        )
        .take(maxWordsPerQuery);
      return words.sort((first, second) => second.createdAt - first.createdAt);
    }

    return await ctx.db
      .query("words")
      .withIndex("by_ownerId_createdAt", (index) => index.eq("ownerId", ownerId))
      .order("desc")
      .take(maxWordsPerQuery);
  },
});

export const getReviewQueue = query({
  args: { now: v.number() },
  returns: v.array(schema.doc("words")),
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    if (!Number.isFinite(args.now) || args.now <= 0) {
      throw new ConvexError("Invalid review time.");
    }
    return await ctx.db
      .query("words")
      .withIndex("by_ownerId_nextReviewAt", (index) =>
        index.eq("ownerId", ownerId).lte("nextReviewAt", args.now),
      )
      .order("asc")
      .take(maxWordsPerQuery);
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
