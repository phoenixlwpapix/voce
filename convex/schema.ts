import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const definition = v.object({
  partOfSpeech: v.string(),
  meaningZh: v.string(),
});

const grammar = v.object({
  gender: v.optional(
    v.union(v.literal("masculine"), v.literal("feminine"), v.literal("neutral")),
  ),
  infinitive: v.optional(v.string()),
  noteZh: v.optional(v.string()),
});

const example = v.object({
  target: v.string(),
  translationZh: v.string(),
});

export default defineSchema({
  ...authTables,
  appOwners: defineTable({
    key: v.literal("primary"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_userId", ["userId"]),
  extensionAccess: defineTable({
    key: v.literal("primary"),
    ownerId: v.id("users"),
    pairingCodeHash: v.union(v.string(), v.null()),
    pairingExpiresAt: v.union(v.number(), v.null()),
    tokenHash: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  extensionDevices: defineTable({
    ownerId: v.id("users"),
    deviceId: v.string(),
    name: v.string(),
    tokenHash: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_updatedAt", ["ownerId", "updatedAt"])
    .index("by_ownerId_and_deviceId", ["ownerId", "deviceId"])
    .index("by_tokenHash", ["tokenHash"]),
  words: defineTable({
    ownerId: v.optional(v.id("users")),
    inputWord: v.string(),
    normalizedWord: v.string(),
    word: v.string(),
    language: v.union(
      v.literal("EN"),
      v.literal("FR"),
      v.literal("ES"),
      v.literal("JA"),
    ),
    phonetic: v.string(),
    definitions: v.array(definition),
    grammar: v.optional(grammar),
    examples: v.array(example),
    monthGroup: v.string(),
    repetitions: v.number(),
    intervalDays: v.number(),
    easeFactor: v.number(),
    nextReviewAt: v.number(),
    lastReviewedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_monthGroup", ["monthGroup"])
    .index("by_nextReviewAt", ["nextReviewAt"])
    .index("by_language_normalizedWord", ["language", "normalizedWord"])
    .index("by_createdAt", ["createdAt"])
    .index("by_ownerId_createdAt", ["ownerId", "createdAt"])
    .index("by_ownerId_monthGroup", ["ownerId", "monthGroup"])
    .index("by_ownerId_nextReviewAt", ["ownerId", "nextReviewAt"])
    .index("by_ownerId_language_normalizedWord", [
      "ownerId",
      "language",
      "normalizedWord",
    ]),
});
