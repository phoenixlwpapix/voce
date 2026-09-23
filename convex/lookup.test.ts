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

const spanishVocabulary = {
  status: "valid",
  language: "ES",
  word: "cepillarse",
  phonetic: "θepiˈʎarse",
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
    await ctx.db.insert("userPreferences", {
      userId,
      preferredLanguage: "EN",
      updatedAt: 1,
    });
    return userId;
  });
  return t.withIdentity({ subject: `${owner}|session` });
}

test("a word from another language is not saved or suggested", async () => {
  const t = await setup();
  generateContent.mockResolvedValue({ text: JSON.stringify(spanishVocabulary) });
  const result = await t.action(api.lookup.lookupAndSave, {
    inputWord: "cepillarse",
    language: "EN",
    monthGroup: "2026-09",
  });
  expect(result).toEqual({ status: "invalid", inputWord: "cepillarse" });
  expect(await t.query(api.words.getWordsByMonth, { language: "EN" })).toEqual([]);
  expect(await t.query(api.words.getWordsByMonth, { language: "ES" })).toEqual([]);
});

test("a valid ambiguous word stays in the selected language", async () => {
  const t = await setup();
  generateContent.mockResolvedValue({ text: JSON.stringify({
    status: "valid",
    language: "EN",
    word: "pain",
    phonetic: "peɪn",
    definitions: [{ partOfSpeech: "noun", meaningZh: "疼痛" }],
    examples: [
      { target: "The pain has gone.", translationZh: "疼痛消失了。" },
      { target: "She felt a sharp pain.", translationZh: "她感到一阵剧痛。" },
    ],
  }) });
  expect(await t.action(api.lookup.lookupAndSave, {
    inputWord: "pain",
    language: "EN",
    monthGroup: "2026-09",
  })).toMatchObject({ language: "EN", status: "created" });
});

test("same-language duplicates preserve review progress and original month", async () => {
  const t = await setup();
  await t.mutation(api.account.setPreferredLanguage, { language: "ES" });
  generateContent.mockResolvedValueOnce({ text: JSON.stringify(spanishVocabulary) });
  const first = await t.action(api.lookup.lookupAndSave, {
    inputWord: "cepillarse",
    language: "ES",
    monthGroup: "2026-08",
  });
  if (first.status !== "created") throw new Error("Expected a saved word");
  await t.mutation(api.words.updateReviewState, { id: first.id, outcome: "remembered" });
  generateContent.mockClear();
  expect(await t.action(api.lookup.lookupAndSave, {
    inputWord: "cepillarse",
    language: "ES",
    monthGroup: "2026-09",
  })).toMatchObject({ id: first.id, status: "existing", language: "ES" });
  const words = await t.query(api.words.getWordsByMonth, { language: "ES" });
  expect(words).toHaveLength(1);
  expect(words[0]).toMatchObject({ repetitions: 1, monthGroup: "2026-08" });
  expect(generateContent).not.toHaveBeenCalled();
});

test("spelling suggestions are restricted to the selected language", async () => {
  const t = await setup();
  generateContent.mockResolvedValueOnce({ text: JSON.stringify({
    status: "spelling",
    suggestions: [
      { word: "beautiful", language: "EN", meaningZh: "美丽的" },
      { word: "belle", language: "FR", meaningZh: "美丽的" },
    ],
  }) });
  expect(await t.action(api.lookup.lookupAndSave, {
    inputWord: "beautifull",
    language: "EN",
    monthGroup: "2026-09",
  })).toMatchObject({
    status: "needs_confirmation",
    suggestions: [{ word: "beautiful", language: "EN" }],
  });

  generateContent.mockResolvedValueOnce({ text: JSON.stringify({
    status: "spelling",
    suggestions: [{ word: "belle", language: "FR", meaningZh: "美丽的" }],
  }) });
  expect(await t.action(api.lookup.lookupAndSave, {
    inputWord: "belle",
    language: "EN",
    monthGroup: "2026-09",
  })).toEqual({ status: "invalid", inputWord: "belle" });
});

test("a same-language spelling suggestion writes nothing until resubmitted", async () => {
  const t = await setup();
  const candidate = { word: "beautiful", language: "EN" as const, meaningZh: "美丽的" };
  generateContent.mockResolvedValueOnce({ text: JSON.stringify({ status: "spelling", suggestions: [candidate] }) });
  expect(await t.action(api.lookup.lookupAndSave, {
    inputWord: "beautifull",
    language: "EN",
    monthGroup: "2026-09",
  })).toMatchObject({ status: "needs_confirmation", suggestions: [candidate] });
  expect(await t.query(api.words.getWordsByMonth, { language: "EN" })).toEqual([]);

  generateContent.mockResolvedValueOnce({ text: JSON.stringify({
    status: "valid",
    language: "EN",
    word: "beautiful",
    phonetic: "ˈbjuːtɪfəl",
    definitions: [{ partOfSpeech: "adjective", meaningZh: "美丽的" }],
    examples: [
      { target: "It is beautiful.", translationZh: "它很美。" },
      { target: "What a beautiful day.", translationZh: "多么美好的一天。" },
    ],
  }) });
  expect((await t.action(api.lookup.lookupAndSave, {
    inputWord: candidate.word,
    language: "EN",
    monthGroup: "2026-09",
  })).status).toBe("created");
});

test("invalid inputs and misspelling definitions never create entries", async () => {
  const t = await setup();
  generateContent.mockResolvedValueOnce({ text: JSON.stringify({ status: "invalid" }) });
  expect((await t.action(api.lookup.lookupAndSave, {
    inputWord: "xyzqqq",
    language: "EN",
    monthGroup: "2026-09",
  })).status).toBe("invalid");

  generateContent.mockResolvedValueOnce({ text: JSON.stringify({
    ...spanishVocabulary,
    language: "EN",
    word: "beautifull",
    definitions: [{ partOfSpeech: "adjective", meaningZh: "beautiful 的错误拼写形式" }],
  }) });
  expect((await t.action(api.lookup.lookupAndSave, {
    inputWord: "beautifull",
    language: "EN",
    monthGroup: "2026-09",
  })).status).toBe("invalid");
  expect(await t.query(api.words.getWordsByMonth, { language: "EN" })).toEqual([]);
});

test("a silent same-language spelling correction still requires confirmation", async () => {
  const t = await setup();
  generateContent.mockResolvedValue({ text: JSON.stringify({
    ...spanishVocabulary,
    language: "EN",
    word: "beautiful",
    definitions: [{ partOfSpeech: "adjective", meaningZh: "美丽的" }],
  }) });
  expect((await t.action(api.lookup.lookupAndSave, {
    inputWord: "beautifull",
    language: "EN",
    monthGroup: "2026-09",
  })).status).toBe("needs_confirmation");
});

test("a valid Spanish reflexive conjugation offers its infinitive before saving", async () => {
  const t = await setup();
  await t.mutation(api.account.setPreferredLanguage, { language: "ES" });
  generateContent.mockResolvedValue({ text: JSON.stringify({
    ...spanishVocabulary,
    word: "me quejo",
    grammar: { infinitive: "quejarse", baseForm: "quejarse" },
  }) });
  expect(await t.action(api.lookup.lookupAndSave, {
    inputWord: "me quejo",
    language: "ES",
    monthGroup: "2026-09",
  })).toMatchObject({ status: "form_choice", baseForm: "quejarse" });
  expect(await t.query(api.words.getWordsByMonth, { language: "ES" })).toEqual([]);

  expect((await t.action(api.lookup.lookupAndSave, {
    inputWord: "me quejo",
    language: "ES",
    monthGroup: "2026-09",
    saveInflected: true,
  })).status).toBe("created");
  expect((await t.query(api.words.getWordsByMonth, { language: "ES" }))[0].grammar?.baseForm).toBe("quejarse");
  generateContent.mockClear();
  expect((await t.action(api.lookup.lookupAndSave, {
    inputWord: "me quejo", language: "ES", monthGroup: "2026-09",
  })).status).toBe("form_choice");
  expect(generateContent).not.toHaveBeenCalled();
});

test("choosing an already saved base form returns the existing entry without changing review progress", async () => {
  const t = await setup();
  await t.mutation(api.account.setPreferredLanguage, { language: "ES" });
  generateContent.mockResolvedValueOnce({ text: JSON.stringify({
    ...spanishVocabulary,
    word: "quejarse",
    definitions: [{ partOfSpeech: "verb", meaningZh: "抱怨" }],
  }) });
  const saved = await t.action(api.lookup.lookupAndSave, {
    inputWord: "quejarse", language: "ES", monthGroup: "2026-08",
  });
  if (saved.status !== "created") throw new Error("Expected a saved base form");
  await t.mutation(api.words.updateReviewState, { id: saved.id, outcome: "remembered" });

  generateContent.mockResolvedValueOnce({ text: JSON.stringify({
    ...spanishVocabulary,
    word: "me quejo",
    grammar: { infinitive: "quejarse", baseForm: "quejarse" },
  }) });
  expect(await t.action(api.lookup.lookupAndSave, {
    inputWord: "me quejo", language: "ES", monthGroup: "2026-09",
  })).toMatchObject({ status: "form_choice", baseForm: "quejarse" });

  generateContent.mockClear();
  expect(await t.action(api.lookup.lookupAndSave, {
    inputWord: "quejarse", language: "ES", monthGroup: "2026-09",
  })).toMatchObject({ status: "existing", id: saved.id, word: "quejarse" });
  expect(generateContent).not.toHaveBeenCalled();
  const words = await t.query(api.words.getWordsByMonth, { language: "ES" });
  expect(words).toHaveLength(1);
  expect(words[0]).toMatchObject({ _id: saved.id, repetitions: 1, monthGroup: "2026-08" });
});

test("an English plural offers its singular and can save the singular", async () => {
  const t = await setup();
  const plural = {
    status: "valid", language: "EN", word: "children", phonetic: "ˈtʃɪldrən",
    definitions: [{ partOfSpeech: "noun", meaningZh: "孩子们" }],
    grammar: { baseForm: "child" },
    examples: [
      { target: "The children are playing.", translationZh: "孩子们正在玩。" },
      { target: "The children are here.", translationZh: "孩子们在这里。" },
    ],
  };
  generateContent.mockResolvedValueOnce({ text: JSON.stringify(plural) });
  expect(await t.action(api.lookup.lookupAndSave, {
    inputWord: "children", language: "EN", monthGroup: "2026-09",
  })).toMatchObject({ status: "form_choice", baseForm: "child" });
  expect(await t.query(api.words.getWordsByMonth, { language: "EN" })).toEqual([]);

  generateContent.mockResolvedValueOnce({ text: JSON.stringify({
    ...plural, word: "child", phonetic: "tʃaɪld", grammar: undefined,
  }) });
  expect((await t.action(api.lookup.lookupAndSave, {
    inputWord: "child", language: "EN", monthGroup: "2026-09",
  })).status).toBe("created");
  const words = await t.query(api.words.getWordsByMonth, { language: "EN" });
  expect(words.map((word) => word.word)).toEqual(["child"]);
});

test("the web lookup rejects a language that is not the saved preference", async () => {
  const t = await setup();
  await expect(t.action(api.lookup.lookupAndSave, {
    inputWord: "bonjour",
    language: "FR",
    monthGroup: "2026-09",
  })).rejects.toThrow("learning language changed");
  expect(generateContent).not.toHaveBeenCalled();
});
