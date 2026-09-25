/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { generateContent }; },
}));
const modules = import.meta.glob("./**/*.ts");
afterEach(() => { vi.unstubAllEnvs(); generateContent.mockReset(); });

const base = {
  inputWord: "", normalizedWord: "", examples: [], monthGroup: "2026-09",
  repetitions: 2, intervalDays: 3, easeFactor: 2.5, nextReviewAt: 5, createdAt: 1, updatedAt: 1,
};

async function seed() {
  vi.stubEnv("GEMINI_API_KEY", "test-only");
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const bobo = await ctx.db.insert("words", {
      ...base, ownerId, word: "bobo", language: "ES", phonetic: "ˈboβo",
      definitions: [{ partOfSpeech: "adj.", meaningZh: "愚蠢的；傻的。" }, { partOfSpeech: "m.", meaningZh: "傻瓜" }],
    });
    const colgar = await ctx.db.insert("words", {
      ...base, ownerId, word: "colgar", language: "ES", phonetic: "koɹgaɹ",
      definitions: [{ partOfSpeech: "verbo", meaningZh: "挂" }],
      grammar: { infinitive: "colgar" },
    });
    const clean = await ctx.db.insert("words", {
      ...base, ownerId, word: "help", language: "EN", phonetic: "help",
      definitions: [{ partOfSpeech: "verb", meaningZh: "帮助" }],
    });
    return { bobo, colgar, clean };
  });
  return { t, ids };
}

test("a dry run reports changes without writing or calling Gemini", async () => {
  const { t, ids } = await seed();
  const summary = await t.action(internal.migrationActions.normalizeExistingWords, { dryRun: true });
  expect(summary).toMatchObject({ scanned: 3, changed: 2, phoneticsRegenerated: 0, isDone: true });
  expect(summary.phoneticsStillInvalid).toEqual(["ES colgar /koɹɡaɹ/"]);
  expect(generateContent).not.toHaveBeenCalled();
  expect((await t.run((ctx) => ctx.db.get(ids.bobo)))?.phonetic).toBe("ˈboβo");
});

test("normalizes legacy entries and regenerates invalid transcriptions only", async () => {
  const { t, ids } = await seed();
  generateContent.mockResolvedValueOnce({ text: JSON.stringify({ phonetic: "kolˈɡaɾ" }) });
  await t.action(internal.migrationActions.normalizeExistingWords, {});

  const [bobo, colgar, clean] = await t.run(async (ctx) =>
    Promise.all([ctx.db.get(ids.bobo), ctx.db.get(ids.colgar), ctx.db.get(ids.clean)]));
  expect(bobo).toMatchObject({
    phonetic: "ˈbobo",
    definitions: [{ partOfSpeech: "adjetivo", meaningZh: "愚蠢的，傻的" }, { partOfSpeech: "sustantivo", meaningZh: "傻瓜" }],
    grammar: { gender: "masculine" },
    repetitions: 2,
    nextReviewAt: 5,
  });
  expect(colgar).toMatchObject({ phonetic: "kolˈɡaɾ" });
  expect(colgar?.grammar).toBeUndefined();
  expect(clean?.updatedAt).toBe(1);
  expect(generateContent).toHaveBeenCalledTimes(1);
});
