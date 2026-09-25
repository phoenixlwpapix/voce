import { expect, test } from "vitest";
import { formatPhonetic, normalizePhonetic, phoneticProblem } from "./phonetics";

test.each([
  ["ES", "eɾe'deɾo", "eɾeˈdeɾo"],
  ["ES", "ro'ðeo", "roˈdeo"],
  ["ES", "ˈboβo", "ˈbobo"],
  ["ES", "foˈʎon", "foˈʝon"],
  ["ES", "ˈasta ˈlwego", "ˈasta ˈlweɡo"],
  ["EN", "ˈbʌt.ə.flaɪ", "ˈbʌtəflaɪ"],
  ["EN", "/ˌsɛrənˈdɪpɪti/", "ˌserənˈdɪpɪti"],
  ["EN", "ɹʌn", "rʌn"],
  ["FR", "ˈtɛm", "tɛm"],
  ["FR", "rɑ̃", "ʁɑ̃"],
  ["JA", " ほんばん ", "ほんばん"],
] as const)("normalizes %s %s to the house convention", (language, input, expected) => {
  expect(normalizePhonetic(input, language)).toBe(expected);
  expect(phoneticProblem(expected, language)).toBeNull();
});

test.each([
  ["ES", "bawtikar"],
  ["ES", "eraɱanɸta"],
  ["ES", "koɹgaɹ"],
  ["EN", "ˈbɝd"],
  ["EN", "bʌtəflaɪ"],
  ["FR", "tɛmə̆"],
  ["JA", "honban"],
] as const)("rejects %s %s after normalization", (language, input) => {
  expect(phoneticProblem(normalizePhonetic(input, language), language)).not.toBeNull();
});

test("formats stored legacy transcriptions in the current style", () => {
  expect(formatPhonetic("ro'ðeo", "ES")).toBe("/roˈdeo/");
  expect(formatPhonetic("ほんばん", "JA")).toBe("ほんばん");
});
