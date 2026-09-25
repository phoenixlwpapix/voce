import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import * as z from "zod/mini";
import { languages, type Language, type WordDocument } from "./types";

export type LexiconCache = {
  version: 2;
  userId: string;
  language: Language;
  updatedAt: number;
  words: WordDocument[];
};

// IndexedDB is untrusted, versioned input. Validate every field consumed by the UI.
const wordShape = z.object({
  _id: z.string(), _creationTime: z.number(), ownerId: z.string(),
  inputWord: z.string(), normalizedWord: z.string(), word: z.string(),
  language: z.enum(languages), phonetic: z.string(),
  definitions: z.array(z.object({ partOfSpeech: z.string(), meaningZh: z.string() })),
  grammar: z.optional(z.object({
    gender: z.optional(z.enum(["masculine", "feminine", "neutral"])),
    infinitive: z.optional(z.string()), baseForm: z.optional(z.string()), noteZh: z.optional(z.string()),
  })),
  examples: z.array(z.object({ target: z.string(), translationZh: z.string() })),
  monthGroup: z.string().check(z.regex(/^\d{4}-(0[1-9]|1[0-2])$/)),
  repetitions: z.number(), intervalDays: z.number(), easeFactor: z.number(),
  nextReviewAt: z.number(), lastReviewedAt: z.optional(z.number()),
  createdAt: z.number(), updatedAt: z.number(),
});
// A sanity bound for untrusted storage, far above any real lexicon.
const maxCachedWords = 50_000;
// Zod 4 numbers already reject Infinity and NaN.
const cacheShape = z.object({
  version: z.literal(2), userId: z.string(), language: z.enum(languages), updatedAt: z.number(),
  words: z.array(z.custom<WordDocument>((word) => wordShape.safeParse(word).success)).check(z.maxLength(maxCachedWords)),
});

interface CacheDatabase extends DBSchema {
  lexicons: { key: string; value: LexiconCache };
}

async function database() {
  return openDB<CacheDatabase>("voce-lexicon-cache", 1, {
    upgrade(db) { db.createObjectStore("lexicons"); },
    blocking() {
      void connection?.then((db) => db.close());
      connection = undefined;
    },
    terminated() { connection = undefined; },
  });
}

// Lazy opening also makes storage denial a recoverable optimization failure.
let connection: Promise<IDBPDatabase<CacheDatabase>> | undefined;
function getDatabase() {
  connection ??= database().catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

function cacheKey(userId: string, language: Language) {
  return `${process.env.NEXT_PUBLIC_CONVEX_URL}:lexicon:${userId}:${language}`;
}

export async function getCachedWords(userId: string, language: Language): Promise<LexiconCache | null> {
  try {
    const db = await getDatabase();
    const parsed = cacheShape.safeParse(await db.get("lexicons", cacheKey(userId, language)));
    if (!parsed.success || parsed.data.userId !== userId || parsed.data.language !== language ||
        parsed.data.words.some((word) => word.ownerId !== userId || word.language !== language)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export async function setCachedWords(userId: string, language: Language, words: WordDocument[]): Promise<void> {
  if (words.some((word) => word.ownerId !== userId || word.language !== language)) return;
  try {
    const db = await getDatabase();
    await db.put(
      "lexicons",
      { version: 2, userId, language, words, updatedAt: Date.now() },
      cacheKey(userId, language),
    );
  } catch {
    // Convex remains usable when storage is blocked, full, or unavailable.
  }
}

export async function clearCachedWords(userId: string, language: Language): Promise<void> {
  try { await (await getDatabase()).delete("lexicons", cacheKey(userId, language)); } catch { /* Optional cache. */ }
}

export async function getCacheMetadata(userId: string, language: Language) {
  const cache = await getCachedWords(userId, language);
  return cache
    ? { userId: cache.userId, language: cache.language, updatedAt: cache.updatedAt, wordCount: cache.words.length }
    : null;
}

// While live pages stream in, older words come from the last complete cache.
// Everything at or after the oldest live word is live, so deletions there are
// already reflected; the cache only fills the not-yet-loaded tail.
export function mergeLiveWithCache(live: WordDocument[], cached: WordDocument[]) {
  if (live.length === 0) return cached;
  const oldestLive = live[live.length - 1].createdAt;
  return [...live, ...cached.filter((word) => word.createdAt < oldestLive)];
}
