/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { generateContent }; },
}));
const modules = import.meta.glob("./**/*.ts");
afterEach(() => { vi.unstubAllEnvs(); generateContent.mockReset(); });

const vocabulary = {
  status: "valid",
  word: "cepillarse", phonetic: "θepiˈʎarse",
  definitions: [{ partOfSpeech: "verb", meaningZh: "刷洗自己" }],
  examples: [
    { target: "Debes cepillarte los dientes.", translationZh: "你应该刷牙。" },
    { target: "Me cepillo los dientes.", translationZh: "我刷牙。" },
  ],
};

async function setup() {
  vi.stubEnv("GEMINI_API_KEY", "test-only");
  const t = convexTest(schema, modules);
  const owner = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "owner@example.test" });
    await ctx.db.insert("appOwners", { key: "primary", userId, createdAt: 1 });
    return userId;
  });
  return t.withIdentity({ subject: `${owner}|session` });
}

test("saves a Spanish correction under ES with a single generation request", async () => {
  const t = await setup();
  generateContent.mockResolvedValue({ text: JSON.stringify({ ...vocabulary, language: "ES", languageDecision: "corrected" }) });
  const result = await t.action(api.lookup.lookupAndSave, { inputWord: "cepillarse", language: "EN", monthGroup: "2026-09" });
  expect(result).toMatchObject({ language: "ES", status: "created" });
  const words = await t.query(api.words.getWordsByMonth, {});
  expect(words).toHaveLength(1);
  expect(words[0]).toMatchObject({ language: "ES", normalizedWord: "cepillarse" });
  expect(generateContent).toHaveBeenCalledTimes(1);
});

test("a selected language decision preserves an ambiguous word", async () => {
  const t = await setup();
  generateContent.mockResolvedValue({ text: JSON.stringify({
    status: "valid", word: "pain", phonetic: "peɪn", language: "EN", languageDecision: "selected",
    definitions: [{ partOfSpeech: "noun", meaningZh: "疼痛" }],
    examples: [
      { target: "The pain has gone.", translationZh: "疼痛消失了。" },
      { target: "She felt a sharp pain.", translationZh: "她感到一阵剧痛。" },
    ],
  }) });
  expect(await t.action(api.lookup.lookupAndSave, { inputWord: "pain", language: "EN", monthGroup: "2026-09" })).toMatchObject({ language: "EN" });
});

test("correction deduplicates against the destination language and preserves progress", async () => {
  const t = await setup();
  generateContent.mockResolvedValueOnce({ text: JSON.stringify({ ...vocabulary, language: "ES", languageDecision: "selected" }) });
  const first = await t.action(api.lookup.lookupAndSave, { inputWord: "cepillarse", language: "ES", monthGroup: "2026-08" });
  if (first.status !== "created") throw new Error("Expected a saved word");
  await t.mutation(api.words.updateReviewState, { id: first.id, outcome: "remembered" });
  generateContent.mockResolvedValueOnce({ text: JSON.stringify({ ...vocabulary, language: "ES", languageDecision: "corrected" }) });
  expect(await t.action(api.lookup.lookupAndSave, { inputWord: "cepillarse", language: "EN", monthGroup: "2026-09" })).toMatchObject({ id: first.id, status: "existing", language: "ES" });
  const words = await t.query(api.words.getWordsByMonth, {});
  expect(words).toHaveLength(1);
  expect(words[0]).toMatchObject({ repetitions: 1, monthGroup: "2026-08" });
  generateContent.mockClear();
  await t.action(api.lookup.lookupAndSave, { inputWord: "cepillarse", language: "ES", monthGroup: "2026-09" });
  expect(generateContent).not.toHaveBeenCalled();
});

test.each([
  { language: "ES", languageDecision: "selected" },
  { language: "EN", languageDecision: "corrected" },
  { language: "DE", languageDecision: "corrected" },
  { language: "JA", languageDecision: "corrected" },
])("rejects inconsistent/unsupported language or invalid Japanese phonetics %#", async (decision) => {
  const t = await setup();
  generateContent.mockResolvedValue({ text: JSON.stringify({ ...vocabulary, ...decision }) });
  await expect(t.action(api.lookup.lookupAndSave, { inputWord: "cepillarse", language: "EN", monthGroup: "2026-09" })).rejects.toThrow();
  expect(await t.query(api.words.getWordsByMonth, {})).toEqual([]);
});

test("a spelling suggestion writes nothing until the corrected word is submitted", async () => {
  const t = await setup();
  const candidate = { word: "beautiful", language: "EN", meaningZh: "美丽的" };
  generateContent.mockResolvedValueOnce({ text: JSON.stringify({ status: "spelling", suggestions: [candidate] }) });
  expect(await t.action(api.lookup.lookupAndSave, { inputWord: "beautifull", language: "EN", monthGroup: "2026-09" })).toMatchObject({ status: "needs_confirmation", suggestions: [candidate] });
  expect(await t.query(api.words.getWordsByMonth, {})).toEqual([]);
  generateContent.mockResolvedValueOnce({ text: JSON.stringify({ ...vocabulary, word: "beautiful", language: "EN", languageDecision: "selected", definitions: [{ partOfSpeech: "adjective", meaningZh: "美丽的" }] }) });
  const saved = await t.action(api.lookup.lookupAndSave, { inputWord: candidate.word, language: "EN", monthGroup: "2026-09" });
  expect(saved.status).toBe("created");
  expect((await t.query(api.words.getWordsByMonth, {}))[0]).toMatchObject({ inputWord: "beautiful", normalizedWord: "beautiful", word: "beautiful" });
});

test("multiple candidates and unrecognized inputs never create entries", async () => {
  const t = await setup();
  generateContent.mockResolvedValueOnce({ text: JSON.stringify({ status: "spelling", suggestions: [
    { word: "form", language: "EN", meaningZh: "形式" },
    { word: "from", language: "EN", meaningZh: "来自" },
  ] }) });
  const result = await t.action(api.lookup.lookupAndSave, { inputWord: "frm", language: "EN", monthGroup: "2026-09" });
  expect(result.status).toBe("needs_confirmation");
  generateContent.mockResolvedValueOnce({ text: JSON.stringify({ status: "invalid" }) });
  expect((await t.action(api.lookup.lookupAndSave, { inputWord: "xyzqqq", language: "EN", monthGroup: "2026-09" })).status).toBe("invalid");
  expect(await t.query(api.words.getWordsByMonth, {})).toEqual([]);
});

test("a definition describing a misspelling cannot be saved as valid", async () => {
  const t = await setup();
  generateContent.mockResolvedValue({ text: JSON.stringify({ ...vocabulary, word: "beautifull", language: "EN", languageDecision: "selected", definitions: [{ partOfSpeech: "adjective", meaningZh: "beautiful 的错误拼写形式" }] }) });
  expect((await t.action(api.lookup.lookupAndSave, { inputWord: "beautifull", language: "EN", monthGroup: "2026-09" })).status).toBe("invalid");
  expect(await t.query(api.words.getWordsByMonth, {})).toEqual([]);
});

test("silently corrected model output still requires confirmation", async () => {
  const t = await setup();
  generateContent.mockResolvedValue({ text: JSON.stringify({ ...vocabulary, word: "beautiful", language: "EN", languageDecision: "selected" }) });
  expect((await t.action(api.lookup.lookupAndSave, { inputWord: "beautifull", language: "EN", monthGroup: "2026-09" })).status).toBe("needs_confirmation");
  expect(await t.query(api.words.getWordsByMonth, {})).toEqual([]);
});

test("a valid Spanish conjugation is saved without spelling confirmation", async () => {
  const t = await setup();
  generateContent.mockResolvedValue({ text: JSON.stringify({ ...vocabulary, word: "hablamos", language: "ES", languageDecision: "selected", grammar: { infinitive: "hablar" } }) });
  expect((await t.action(api.lookup.lookupAndSave, { inputWord: "hablamos", language: "ES", monthGroup: "2026-09" })).status).toBe("created");
});
