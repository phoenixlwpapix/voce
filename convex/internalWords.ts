import { internalMutation } from "./_generated/server";
import { languageValidator, lookupResultValidator } from "./validators";
import { v } from "convex/values";

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
    status: v.union(v.literal("created"), v.literal("refreshed")),
    word: v.string(),
  }),
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

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        inputWord: args.inputWord,
        word: args.result.word,
        phonetic: args.result.phonetic,
        definitions: args.result.definitions,
        grammar: args.result.grammar,
        examples: args.result.examples,
        updatedAt: now,
      });

      return { id: existing._id, status: "refreshed" as const, word: args.result.word };
    }

    const id = await ctx.db.insert("words", {
      ownerId: args.ownerId,
      inputWord: args.inputWord,
      normalizedWord: args.normalizedWord,
      word: args.result.word,
      language: args.language,
      phonetic: args.result.phonetic,
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
