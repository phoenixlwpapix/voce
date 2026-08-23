import { v } from "convex/values";

export const languageValidator = v.union(
  v.literal("EN"),
  v.literal("FR"),
  v.literal("ES"),
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
