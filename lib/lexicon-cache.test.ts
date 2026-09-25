import "fake-indexeddb/auto";
import { openDB } from "idb";
import { afterEach, expect, test, vi } from "vitest";
import { clearCachedWords, getCachedWords, getCacheMetadata, mergeLiveWithCache, setCachedWords } from "./lexicon-cache";
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
  await clearCachedWords("A", "EN");
  await clearCachedWords("A", "ES");
  await clearCachedWords("B", "EN");
  vi.unstubAllEnvs();
});

test("a cache miss is distinct from an authoritative empty lexicon", async () => {
  expect(await getCachedWords("A", "EN")).toBeNull();
  await setCachedWords("A", "EN", []);
  expect((await getCachedWords("A", "EN"))?.words).toEqual([]);
});

test("isolates users and languages while persisting live changes", async () => {
  await setCachedWords("A", "EN", [word]);
  expect(await getCachedWords("B", "EN")).toBeNull();
  expect(await getCachedWords("A", "ES")).toBeNull();
  await setCachedWords("A", "EN", [{ ...word, repetitions: 3, updatedAt: 20 }]);
  expect((await getCachedWords("A", "EN"))?.words[0].repetitions).toBe(3);
  expect(await getCacheMetadata("A", "EN")).toMatchObject({ userId: "A", language: "EN", wordCount: 1 });
  await setCachedWords("A", "EN", []);
  expect((await getCachedWords("A", "EN"))?.words).toEqual([]);
});

test("refuses words owned by another user or assigned to another language", async () => {
  await setCachedWords("B", "EN", [word]);
  await setCachedWords("A", "ES", [word]);
  expect(await getCachedWords("B", "EN")).toBeNull();
  expect(await getCachedWords("A", "ES")).toBeNull();
});

test("isolates deployments on the same browser origin", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "dev");
  await setCachedWords("A", "EN", [word]);
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "prod");
  expect(await getCachedWords("A", "EN")).toBeNull();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "dev");
});

test.each([
  { version: 1, userId: "A", language: "EN", words: [word], updatedAt: 1 },
  { version: 2, userId: "B", language: "EN", words: [word], updatedAt: 1 },
  { version: 2, userId: "A", language: "ES", words: [word], updatedAt: 1 },
  { version: 2, userId: "A", language: "EN", words: [{ ...word, ownerId: "B" }], updatedAt: 1 },
  { version: 2, userId: "A", language: "EN", words: [{ ...word, definitions: null }], updatedAt: 1 },
])("ignores corrupt, outdated or misattributed records %#", async (record) => {
  await setCachedWords("A", "EN", []);
  const db = await openDB("voce-lexicon-cache", 1);
  await db.put("lexicons", record, `${process.env.NEXT_PUBLIC_CONVEX_URL}:lexicon:A:EN`);
  db.close();
  expect(await getCachedWords("A", "EN")).toBeNull();
});

test("storage failure never escapes the optional cache layer", async () => {
  vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(() => {
    throw new DOMException("Storage denied", "SecurityError");
  });
  await expect(getCachedWords("A", "EN")).resolves.toBeNull();
  await expect(setCachedWords("A", "EN", [word])).resolves.toBeUndefined();
});

const at = (id: string, createdAt: number) => ({ ...word, _id: id as Id<"words">, createdAt });

test("cached words only fill the tail that live pages have not reached", () => {
  const live = [at("new", 30), at("b", 20)];
  const cached = [at("b", 20), at("deleted", 25), at("a", 10), at("old", 5)];
  expect(mergeLiveWithCache(live, cached).map((item) => item._id)).toEqual(["new", "b", "a", "old"]);
});

test("the cache stands in until the first live page arrives", () => {
  const cached = [at("a", 10)];
  expect(mergeLiveWithCache([], cached)).toBe(cached);
});
