import { expect, test } from "vitest";
import { genderLabel, isPronominalVerb, partOfSpeechLabel } from "./parts-of-speech";

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
