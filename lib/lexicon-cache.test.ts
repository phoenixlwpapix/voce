import "fake-indexeddb/auto";
import { openDB } from "idb";
import { afterEach, expect, test, vi } from "vitest";
import { clearCachedWords, getCachedWords, getCacheMetadata, setCachedWords } from "./lexicon-cache";
import type { WordDocument } from "./types";
import type { Id } from "../convex/_generated/dataModel";

const word: WordDocument = {
  _id: "word" as Id<"words">, _creationTime: 1, ownerId: "A" as Id<"users">, inputWord: "hello", normalizedWord: "hello",
  word: "hello", language: "EN", phonetic: "həˈləʊ", definitions: [], examples: [],
  monthGroup: "2026-09", repetitions: 0, intervalDays: 0, easeFactor: 2.5,
  nextReviewAt: 1, createdAt: 1, updatedAt: 1,
};

afterEach(async () => {
  vi.restoreAllMocks();
  await clearCachedWords("A");
  await clearCachedWords("B");
  vi.unstubAllEnvs();
});

test("a cache miss is distinct from an authoritative empty lexicon", async () => {
  expect(await getCachedWords("A")).toBeNull();
  await setCachedWords("A", []);
  expect((await getCachedWords("A"))?.words).toEqual([]);
});

test("isolates users and persists live deletions and review changes", async () => {
  await setCachedWords("A", [word]);
  expect(await getCachedWords("B")).toBeNull();
  await setCachedWords("A", [{ ...word, repetitions: 3, updatedAt: 20 }]);
  expect((await getCachedWords("A"))?.words[0].repetitions).toBe(3);
  expect(await getCacheMetadata("A")).toMatchObject({ userId: "A", wordCount: 1 });
  await setCachedWords("A", []);
  expect((await getCachedWords("A"))?.words).toEqual([]);
});

test("refuses a write with another user's words", async () => {
  await setCachedWords("B", [word]);
  expect(await getCachedWords("B")).toBeNull();
});

test("isolates deployments on the same browser origin", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "dev");
  await setCachedWords("A", [word]);
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "prod");
  expect(await getCachedWords("A")).toBeNull();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "dev");
});

test.each([
  { version: 2, userId: "A", words: [word], updatedAt: 1 },
  { version: 1, userId: "B", words: [word], updatedAt: 1 },
  { version: 1, userId: "A", words: [{ ...word, ownerId: "B" }], updatedAt: 1 },
  { version: 1, userId: "A", words: [{ ...word, definitions: null }], updatedAt: 1 },
])("ignores corrupt, outdated or misattributed records %#", async (record) => {
  await setCachedWords("A", []);
  const db = await openDB("voce-lexicon-cache", 1);
  await db.put("lexicons", record, `${process.env.NEXT_PUBLIC_CONVEX_URL}:lexicon:A`);
  db.close();
  expect(await getCachedWords("A")).toBeNull();
});

test("storage failure never escapes the optional cache layer", async () => {
  vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(() => {
    throw new DOMException("Storage denied", "SecurityError");
  });
  await expect(getCachedWords("A")).resolves.toBeNull();
  await expect(setCachedWords("A", [word])).resolves.toBeUndefined();
});
