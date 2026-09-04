import { internalMutation, internalQuery } from "./_generated/server";
import { languageValidator, lookupResultValidator } from "./validators";
import { v } from "convex/values";
import { normalizePhonetic } from "../lib/phonetics";

export const findExistingWord = internalQuery({
  args: {
    ownerId: v.id("users"),
    language: languageValidator,
    normalizedWord: v.string(),
  },
  returns: v.union(
    v.object({ id: v.id("words"), word: v.string() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("words")
      .withIndex("by_ownerId_language_normalizedWord", (query) =>
        query
          .eq("ownerId", args.ownerId)
          .eq("language", args.language)
          .eq("normalizedWord", args.normalizedWord),
      )
      .unique();

    return existing === null ? null : { id: existing._id, word: existing.word };
  },
});

export const upsertLookupResult = internalMutation({
  args: {
    ownerId: v.id("users"),
    inputWord: v.string(),
    normalizedWord: v.string(),
    language: languageValidator,
    monthGroup: v.string(),
    result: lookupResultValidator,
  },
  returns: v.object({
    id: v.id("words"),
    status: v.union(v.literal("created"), v.literal("existing")),
    word: v.string(),
  }),
  handler: async (ctx, args) => {
    const phonetic = normalizePhonetic(args.result.phonetic);
    const existing = await ctx.db
      .query("words")
      .withIndex("by_ownerId_language_normalizedWord", (query) =>
        query
          .eq("ownerId", args.ownerId)
          .eq("language", args.language)
          .eq("normalizedWord", args.normalizedWord),
      )
      .unique();

    const now = Date.now();

    if (existing) {
      return { id: existing._id, status: "existing" as const, word: existing.word };
    }

    const id = await ctx.db.insert("words", {
      ownerId: args.ownerId,
      inputWord: args.inputWord,
      normalizedWord: args.normalizedWord,
      word: args.result.word,
      language: args.language,
      phonetic,
      definitions: args.result.definitions,
      grammar: args.result.grammar,
      examples: args.result.examples,
      monthGroup: args.monthGroup,
      repetitions: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      nextReviewAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { id, status: "created" as const, word: args.result.word };
  },
});
