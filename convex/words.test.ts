/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("timeline and review queries only return the requested language", async () => {
  const t = convexTest(schema, modules);
  const owner = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "owner@example.test" });
    await ctx.db.insert("appOwners", { key: "primary", userId, createdAt: 1 });
    const baseWord = {
      ownerId: userId,
      inputWord: "hello",
      normalizedWord: "hello",
      word: "hello",
      phonetic: "həˈləʊ",
      definitions: [{ partOfSpeech: "interjection", meaningZh: "你好" }],
      examples: [
        { target: "Hello there.", translationZh: "你好。" },
        { target: "She said hello.", translationZh: "她打了招呼。" },
      ],
      monthGroup: "2026-09",
      repetitions: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      nextReviewAt: 1,
      createdAt: 1,
      updatedAt: 1,
    };
    await ctx.db.insert("words", { ...baseWord, language: "EN" });
    await ctx.db.insert("words", {
      ...baseWord,
      inputWord: "bonjour",
      normalizedWord: "bonjour",
      word: "bonjour",
      language: "FR",
    });
    return userId;
  });
  const signedIn = t.withIdentity({ subject: `${owner}|session` });

  expect(await signedIn.query(api.words.getWordsByMonth, { language: "EN" }))
    .toMatchObject([{ language: "EN", word: "hello" }]);
  expect(await signedIn.query(api.words.getReviewQueue, { language: "FR", now: 2 }))
    .toMatchObject([{ language: "FR", word: "bonjour" }]);

  const timelinePage = await signedIn.query(api.words.listWords, {
    language: "FR",
    paginationOpts: { cursor: null, numItems: 10 },
  });
  expect(timelinePage.page).toMatchObject([{ language: "FR", word: "bonjour" }]);
  expect(timelinePage.isDone).toBe(true);

  const englishExport = await signedIn.query(api.words.getWordsForExport, {
    language: "EN",
    paginationOpts: { cursor: null, numItems: 10 },
  });
  expect(englishExport.page).toMatchObject([{ language: "EN", word: "hello" }]);
  expect(englishExport.isDone).toBe(true);

  const firstExportPage = await signedIn.query(api.words.getWordsForExport, {
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(firstExportPage.page).toHaveLength(1);
  expect(firstExportPage.isDone).toBe(false);
  const secondExportPage = await signedIn.query(api.words.getWordsForExport, {
    paginationOpts: { cursor: firstExportPage.continueCursor, numItems: 1 },
  });
  expect([...firstExportPage.page, ...secondExportPage.page].map((word) => word.language).sort()).toEqual(["EN", "FR"]);
});

test("rating a card that is no longer due does not advance it again", async () => {
  const t = convexTest(schema, modules);
  const [owner, wordId] = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "owner@example.test" });
    await ctx.db.insert("appOwners", { key: "primary", userId, createdAt: 1 });
    const wordId = await ctx.db.insert("words", {
      ownerId: userId, inputWord: "hello", normalizedWord: "hello", word: "hello", language: "EN",
      phonetic: "həˈləʊ", definitions: [], examples: [], monthGroup: "2026-09",
      repetitions: 0, intervalDays: 0, easeFactor: 2.5, nextReviewAt: 1, createdAt: 1, updatedAt: 1,
    });
    return [userId, wordId] as const;
  });
  const signedIn = t.withIdentity({ subject: `${owner}|session` });

  const first = await signedIn.mutation(api.words.updateReviewState, { id: wordId, outcome: "remembered" });
  const second = await signedIn.mutation(api.words.updateReviewState, { id: wordId, outcome: "remembered" });
  expect(first.repetitions).toBe(1);
  expect(second).toEqual(first);
});

test("gradeWord handles idempotency, lapses, and retry lifecycle correctly", async () => {
  const t = convexTest(schema, modules);
  const dayStartMs = new Date().setHours(0, 0, 0, 0);
  const [owner, wordId] = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "owner@example.test" });
    await ctx.db.insert("appOwners", { key: "primary", userId, createdAt: 1 });
    const wordId = await ctx.db.insert("words", {
      ownerId: userId,
      inputWord: "mundo",
      normalizedWord: "mundo",
      word: "mundo",
      language: "ES",
      phonetic: "",
      definitions: [{ partOfSpeech: "noun", meaningZh: "世界" }],
      examples: [],
      monthGroup: "2026-10",
      repetitions: 1,
      intervalDays: 1,
      easeFactor: 2.5,
      lastReviewedAt: dayStartMs - 86400000,
      nextReviewAt: dayStartMs - 1000, // Due
      createdAt: 1,
      updatedAt: 1,
    });
    return [userId, wordId] as const;
  });
  const signedIn = t.withIdentity({ subject: `${owner}|session` });
  const sessionId = "test-session-1";

  // 1. First attempt: Wrong (Lapse)
  const attempt1 = await signedIn.mutation(api.words.gradeWord, {
    id: wordId,
    sessionId,
    questionId: `${sessionId}:${wordId}:1`,
    correct: false,
    questionType: "choice",
    responseMs: 3000,
    dayStartMs,
  });
  expect(attempt1.applied).toBe(true);
  expect(attempt1.pendingRetry).toBe(true);

  // 2. Idempotent call with identical questionId should return same result without double-grading
  const attempt1Duplicate = await signedIn.mutation(api.words.gradeWord, {
    id: wordId,
    sessionId,
    questionId: `${sessionId}:${wordId}:1`,
    correct: false,
    questionType: "choice",
    responseMs: 3000,
    dayStartMs,
  });
  expect(attempt1Duplicate).toEqual(attempt1);

  // Check DB state: lapses should be 1, pendingRetryDay should be set
  const wordAfterLapse = await t.run(async (ctx) => ctx.db.get(wordId));
  expect(wordAfterLapse?.lapses).toBe(1);
  expect(wordAfterLapse?.pendingRetryDay).toBe(dayStartMs);

  // 3. Retry attempt: Wrong again. Should NOT add another lapse!
  const attempt2 = await signedIn.mutation(api.words.gradeWord, {
    id: wordId,
    sessionId,
    questionId: `${sessionId}:${wordId}:2`,
    correct: false,
    questionType: "choice",
    responseMs: 2500,
    dayStartMs,
  });
  expect(attempt2.applied).toBe(false);
  expect(attempt2.pendingRetry).toBe(true);
  const wordAfterSecondFail = await t.run(async (ctx) => ctx.db.get(wordId));
  expect(wordAfterSecondFail?.lapses).toBe(1); // Still 1 lapse!

  // 4. Retry attempt: Correct! Should clear pendingRetry without re-advancing FSRS schedule
  const attempt3 = await signedIn.mutation(api.words.gradeWord, {
    id: wordId,
    sessionId,
    questionId: `${sessionId}:${wordId}:3`,
    correct: true,
    questionType: "choice",
    responseMs: 2000,
    dayStartMs,
  });
  expect(attempt3.applied).toBe(false);
  expect(attempt3.pendingRetry).toBe(false);

  const wordAfterRetrySuccess = await t.run(async (ctx) => ctx.db.get(wordId));
  expect(wordAfterRetrySuccess?.pendingRetryDay).toBeUndefined();
  expect(wordAfterRetrySuccess?.lapses).toBe(1);
});

