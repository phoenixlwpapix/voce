import type { Language } from "./types";

// Mirrors phoneticConvention in lib/entry-format.ts.
const phoneticInventory: Record<Exclude<Language, "JA">, { symbols: string; vowels: string }> = {
  EN: { symbols: "abdefhijklmnprstuvwzæðŋɑɒɔəɜɪʃʊʌʒθɡˈˌː", vowels: "aeiouæɑɒɔəɜɪʊʌ" },
  FR: { symbols: "abdefijklmnopstuvwyzøœɑɔəɛɡɥɲŋʁʃʒ̃", vowels: "aeiouyøœɑɔəɛ" },
  ES: { symbols: "abdefijklmnoprstuwxθɡɲʝɾʃˈ", vowels: "aeiou" },
};

const hiraganaReadingPattern = /^[\p{Script=Hiragana}ー・\s]+$/u;

function stripDelimiters(value: string) {
  let normalized = value.trim();

  while (
    (normalized.startsWith("/") && normalized.endsWith("/")) ||
    (normalized.startsWith("[") && normalized.endsWith("]"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
}

// Deterministic spelling fixes for the convention. Safe to run on stored
// values at display time, so older entries render in the same style.
export function normalizePhonetic(value: string, language?: Language) {
  const normalized = stripDelimiters(value).normalize("NFC");
  if (language === "JA") return normalized.replace(/\s+/g, " ");

  let result = normalized
    .replace(/['’‘ʹ′]/g, "ˈ")
    .replace(/[:ˑ]/g, "ː")
    .replace(/g/g, "ɡ")
    .replace(/[.‿]/g, "")
    .replace(/\s+/g, " ");

  if (language === "EN") {
    result = result.replace(/ɹ/g, "r").replace(/ɫ/g, "l").replace(/ɛ/g, "e");
  } else if (language === "FR") {
    result = result.replace(/[ˈˌː]/g, "").replace(/r/g, "ʁ");
  } else if (language === "ES") {
    result = result
      .replace(/β/g, "b").replace(/ð/g, "d").replace(/ɣ/g, "ɡ")
      .replace(/ʎ/g, "ʝ").replace(/[ŋɱ]/g, "n").replace(/v/g, "b").replace(/z/g, "s")
      .replace(/ˌ/g, "");
  }
  return result.trim();
}

// Returns why a normalized transcription breaks the convention, or null.
export function phoneticProblem(value: string, language: Language): string | null {
  if (!value) return "The transcription is empty.";
  if (language === "JA") {
    return hiraganaReadingPattern.test(value) ? null : "The reading must be Hiragana only.";
  }

  const { symbols, vowels } = phoneticInventory[language];
  const decomposed = value.normalize("NFD");
  const invalid = [...new Set([...decomposed].filter((character) => character !== " " && !symbols.includes(character)))];
  if (invalid.length) return `Symbols outside the convention: ${invalid.join(" ")}.`;
  if (language === "ES" && /(?<!t)ʃ/u.test(decomposed)) return "ʃ is only allowed in tʃ.";

  // Checked per transcription rather than per word: function words in a phrase may be unstressed.
  const nuclei = decomposed.match(new RegExp(`[${vowels}]+`, "gu"))?.length ?? 0;
  if (language !== "FR" && nuclei >= 2 && !decomposed.includes("ˈ")) {
    return "A word with two or more syllables has no ˈ stress mark.";
  }
  return null;
}

export function formatPhonetic(value: string, language: Language) {
  const normalized = normalizePhonetic(value, language);
  if (!normalized) return "";
  return language === "JA" ? normalized : `/${normalized}/`;
}
