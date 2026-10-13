import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import schema from "./schema";
import { lookupResultValidator } from "./validators";

export const englishWordsPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("words")),
  handler: async (ctx, args) => await ctx.db.query("words")
    .withIndex("by_language_normalizedWord", (q) => q.eq("language", "EN"))
    .paginate(args.paginationOpts),
});

export const applyAmericanPhonetics = internalMutation({
  args: { updates: v.array(v.object({ id: v.id("words"), previous: v.string(), phonetic: v.string() })) },
  returns: v.number(),
  handler: async (ctx, args) => {
    let changed = 0;
    for (const update of args.updates) {
      const word = await ctx.db.get(update.id);
      if (!word || word.language !== "EN" || word.phonetic !== update.previous || word.phonetic === update.phonetic) continue;
      await ctx.db.patch(update.id, { phonetic: update.phonetic, updatedAt: Date.now() });
      changed += 1;
    }
    return changed;
  },
});

// Internal only: used by migrationActions.normalizeExistingWords.
export const wordsPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("words")),
  handler: async (ctx, args) => await ctx.db.query("words").paginate(args.paginationOpts),
});

export const applyWordFixes = internalMutation({
  args: {
    updates: v.array(v.object({
      id: v.id("words"),
      phonetic: v.string(),
      definitions: lookupResultValidator.fields.definitions,
      // null removes grammar that only repeated the headword.
      grammar: v.union(v.object(lookupResultValidator.fields.grammar.fields), v.null()),
    })),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let patched = 0;
    for (const update of args.updates) {
      const word = await ctx.db.get(update.id);
      if (!word) continue;
      await ctx.db.patch(update.id, {
        phonetic: update.phonetic,
        definitions: update.definitions,
        grammar: update.grammar ?? undefined,
        updatedAt: Date.now(),
      });
      patched += 1;
    }
    return patched;
  },
});
