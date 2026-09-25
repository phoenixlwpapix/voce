import { expect, test } from "vitest";
import { genderLabel, isPronominalVerb, legacyPartOfSpeech, partOfSpeechLabel } from "./parts-of-speech";

test("the same category has a fixed label in each learning language", () => {
  expect(partOfSpeechLabel("EN", "noun")).toBe("noun");
  expect(partOfSpeechLabel("FR", "noun")).toBe("nom");
  expect(partOfSpeechLabel("ES", "noun")).toBe("sustantivo");
  expect(partOfSpeechLabel("JA", "noun")).toBe("名詞");
  expect(partOfSpeechLabel("ES", "pronominal_verb")).toBe("verbo pronominal");
  expect(partOfSpeechLabel("JA", "adjectival_noun")).toBe("形容動詞");
  expect(genderLabel("ES", "masculine")).toBe("Género · masculino");
  expect(genderLabel("FR", "feminine")).toBe("Genre · féminin");
  expect(isPronominalVerb("ES", ["cepillarse"])).toBe(true);
  expect(isPronominalVerb("FR", ["se laver"])).toBe(true);
});

test.each([
  ["adj.", { code: "adjective" }],
  ["n.", { code: "noun" }],
  ["v.", { code: "verb" }],
  ["m.", { code: "noun", gender: "masculine" }],
  ["n.m.", { code: "noun", gender: "masculine" }],
  ["sustantivo masculino", { code: "noun", gender: "masculine" }],
  ["sustantivo", { code: "noun" }],
  ["名词", { code: "noun" }],
  ["动词", { code: "verb" }],
  ["自动词五段", { code: "verb" }],
  ["他動詞", { code: "verb" }],
  ["動詞", { code: "verb" }],
  ["形容动词", { code: "adjectival_noun" }],
  ["verbe pronominal", { code: "pronominal_verb" }],
  ["interjection", { code: "interjection" }],
  ["phrasal verb", { code: "verb" }],
  ["形", { code: "adjective" }],
  ["adjective / adverb", { code: "adjective" }],
  // Labels found in the production lexicon.
  ["noun m", { code: "noun", gender: "masculine" }],
  ["noun m.", { code: "noun", gender: "masculine" }],
  ["noun f.", { code: "noun", gender: "feminine" }],
  ["noun feminine", { code: "noun", gender: "feminine" }],
  ["noun (feminine)", { code: "noun", gender: "feminine" }],
  ["nombre femenino", { code: "noun", gender: "feminine" }],
  ["m. pl.", { code: "noun", gender: "masculine" }],
  ["sustantivo masculino plural", { code: "noun", gender: "masculine" }],
  ["sustantivo común", { code: "noun" }],
  ["noun phrase", { code: "phrase" }],
  ["verb phrase", { code: "phrase" }],
  ["locución verbal", { code: "phrase" }],
  ["locución adjetiva", { code: "phrase" }],
  ["locución adverbial", { code: "phrase" }],
  ["locución preposicional", { code: "phrase" }],
  ["verbo intransitivo", { code: "verb" }],
] as const)("maps the legacy label %s", (label, expected) => {
  expect(legacyPartOfSpeech(label)).toEqual(expected);
});

test("leaves unrecognized labels for review", () => {
  expect(legacyPartOfSpeech("something else")).toBeNull();
});
