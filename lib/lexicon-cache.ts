import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { z } from "zod";
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
  grammar: z.object({
    gender: z.enum(["masculine", "feminine", "neutral"]).optional(),
    infinitive: z.string().optional(), baseForm: z.string().optional(), noteZh: z.string().optional(),
  }).optional(),
  examples: z.array(z.object({ target: z.string(), translationZh: z.string() })),
  monthGroup: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  repetitions: z.number(), intervalDays: z.number(), easeFactor: z.number(),
  nextReviewAt: z.number(), lastReviewedAt: z.number().optional(),
  createdAt: z.number(), updatedAt: z.number(),
});
const cacheShape = z.object({
  version: z.literal(2), userId: z.string(), language: z.enum(languages), updatedAt: z.number().finite(),
  words: z.array(z.custom<WordDocument>((word) => wordShape.safeParse(word).success)).max(500),
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
