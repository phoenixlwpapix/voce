/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import rateLimiter from "@convex-dev/rate-limiter/test";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { generateContent }; },
}));

const modules = import.meta.glob("./**/*.ts");
afterEach(() => { vi.unstubAllEnvs(); generateContent.mockReset(); });

async function setup() {
  vi.stubEnv("GEMINI_API_KEY", "test-only");
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const owner = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "owner@example.test" });
    await ctx.db.insert("appOwners", { key: "primary", userId, createdAt: 1 });
    await ctx.db.insert("userPreferences", {
      userId,
      preferredLanguage: "EN",
      updatedAt: 1,
    });
    return userId;
  });
  return t.withIdentity({ subject: `${owner}|session` });
}

test("returns one to three ranked candidates without writing words", async () => {
  const t = await setup();
  generateContent.mockResolvedValue({ text: JSON.stringify({
    status: "candidates",
    language: "EN",
    candidates: [
      { word: "awkward", partOfSpeech: "adjective", meaningZh: "场面或行为令人尴尬", usageZh: "常形容处境或互动" },
      { word: "embarrassed", partOfSpeech: "adjective", meaningZh: "人感到难为情", usageZh: "主语通常是感到尴尬的人" },
      { word: "awkward", partOfSpeech: "adjective", meaningZh: "尴尬的", usageZh: "重复候选" },
    ],
  }) });

  expect(await t.action(api.translation.findCandidates, { queryZh: "尴尬", language: "EN" }))
    .toEqual({
      status: "candidates",
      queryZh: "尴尬",
      candidates: [
        { word: "awkward", partOfSpeech: "adjective", meaningZh: "场面或行为令人尴尬", usageZh: "常形容处境或互动。" },
        { word: "embarrassed", partOfSpeech: "adjective", meaningZh: "人感到难为情", usageZh: "主语通常是感到尴尬的人。" },
      ],
    });
  expect(await t.query(api.words.getWordsByMonth, { language: "EN" })).toEqual([]);
});

test("rejects meaningless input and a model response in another language", async () => {
  const t = await setup();
  generateContent.mockResolvedValueOnce({ text: JSON.stringify({ status: "invalid" }) });
  expect(await t.action(api.translation.findCandidates, { queryZh: "阿巴阿巴", language: "EN" }))
    .toEqual({ status: "invalid", queryZh: "阿巴阿巴" });

  generateContent.mockResolvedValueOnce({ text: JSON.stringify({
    status: "candidates",
    language: "FR",
    candidates: [
      { word: "gênant", partOfSpeech: "adjective", meaningZh: "尴尬的", usageZh: "法语表达" },
    ],
  }) });
  expect(await t.action(api.translation.findCandidates, { queryZh: "尴尬", language: "EN" }))
    .toEqual({ status: "invalid", queryZh: "尴尬" });
});

test("rejects non-Chinese input before calling Gemini", async () => {
  const t = await setup();
  expect(await t.action(api.translation.findCandidates, { queryZh: "awkward", language: "EN" }))
    .toEqual({ status: "invalid", queryZh: "awkward" });
  expect(generateContent).not.toHaveBeenCalled();
});

test("rejects a target language that differs from the saved preference", async () => {
  const t = await setup();
  await expect(t.action(api.translation.findCandidates, { queryZh: "尴尬", language: "JA" }))
    .rejects.toThrow("learning language changed");
  expect(generateContent).not.toHaveBeenCalled();
});
