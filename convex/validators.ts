import { v } from "convex/values";

export const languageValidator = v.union(
  v.literal("EN"),
  v.literal("FR"),
  v.literal("ES"),
  v.literal("JA"),
);

export const lookupActionResultValidator = v.union(
  v.object({ status: v.union(v.literal("created"), v.literal("existing")), id: v.id("words"), word: v.string(), language: languageValidator }),
  v.object({ status: v.literal("needs_confirmation"), inputWord: v.string(), suggestions: v.array(v.object({ word: v.string(), language: languageValidator, meaningZh: v.string() })) }),
  v.object({ status: v.literal("invalid"), inputWord: v.string() }),
);

export const lookupResultValidator = v.object({
  word: v.string(),
  phonetic: v.string(),
  definitions: v.array(
    v.object({
      partOfSpeech: v.string(),
      meaningZh: v.string(),
    }),
  ),
  grammar: v.optional(
    v.object({
      gender: v.optional(
        v.union(v.literal("masculine"), v.literal("feminine"), v.literal("neutral")),
      ),
      infinitive: v.optional(v.string()),
      noteZh: v.optional(v.string()),
    }),
  ),
  examples: v.array(
    v.object({
      target: v.string(),
      translationZh: v.string(),
    }),
  ),
});
