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
