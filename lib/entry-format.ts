import type { Language } from "./types";

// One transcription convention per language. normalizePhonetic and
// phoneticProblem in lib/phonetics.ts enforce the same convention.
export const phoneticConvention: Record<Language, string> = {
  EN: "General American English broad phonemic IPA in the Cambridge US dictionary style, matching en-US speech. Vowels: iː ɪ e æ ʌ ɑː ɔː ʊ uː ə ɚ ɝː eɪ aɪ ɔɪ oʊ aʊ, and i for the unstressed happy vowel. Use rhotic pronunciation: retain r after vowels (car kɑːr, near nɪr), use ɚ for unstressed r-coloured vowels (butter ˈbʌtɚ) and ɝː for stressed ones (bird bɝːd). Use American word-specific vowels (bath bæθ, hot hɑːt, hello həˈloʊ); do not merely replace symbols in a British transcription. Consonants: p b t d k ɡ f v θ ð s z ʃ ʒ h tʃ dʒ m n ŋ l r j w. Put ˈ before the primary-stressed syllable and ˌ before a secondary-stressed syllable of every word with two or more syllables; use ː for long vowels. Never use syllable dots, British ɒ, ɜː or əʊ, flaps (ɾ), or ɹ.",
  FR: "Standard French broad phonemic IPA. Vowels: i e ɛ a ɑ ɔ o u y ø œ ə ɛ̃ ɑ̃ ɔ̃ œ̃. Semivowels: j w ɥ. Consonants: p b t d k ɡ f v s z ʃ ʒ m n ɲ ŋ l ʁ. Transcribe the citation form only. Never use stress marks, length marks, syllable dots, or liaison marks.",
  ES: "Castilian Spanish (Spain) broad phonemic IPA. Use θ for z and for c before e or i (bautizar bawtiˈθaɾ), x for j and for g before e or i, ʝ for both y and ll, ɲ for ñ, tʃ for ch. Use ɾ for a single r between vowels or at the end of a syllable, and r for rr and for r at the start of a word or after n, l or s (herramienta eraˈmjenta, colgar kolˈɡaɾ). Always write b d ɡ, never β ð ɣ. Vowels: a e i o u; write diphthong glides as j and w (bueno ˈbweno). Never write h, v, z, ŋ, ɱ or ɹ. Put ˈ before the stressed syllable of every word with two or more syllables. Never use syllable dots.",
  JA: "Hiragana reading only, also for katakana loanwords (コーヒー → こーひー). Never use kanji, katakana, romaji, IPA, or pitch-accent marks.",
};

// Shared style rules for generated Chinese glosses, so every entry reads the same.
export const definitionStyleInstruction =
  "Definition style: return one definitions entry per distinct sense, most common sense first, with all senses of the same part of speech listed consecutively and at most four entries in total. Each meaningZh is a concise Simplified Chinese gloss: one to three near-synonymous equivalents separated only by the full-width comma ，, each a word or short phrase rather than a sentence. Never use ；, /, 、 or a trailing punctuation mark in meaningZh, and never repeat the headword, pinyin, part of speech, or gender there. Gloss verbs as verbs, adjectives as adjectives (usually ending in 的), and nouns as nouns. When a register or domain label is essential, put it first in full-width parentheses, for example （口语）混乱 or （法律）继承人. Use Simplified Chinese characters only, never Traditional characters. Every translationZh is one natural Simplified Chinese sentence ending with the same sentence punctuation as its target. A grammar.noteZh, when given, is one or two complete Simplified Chinese sentences ending with 。.";

export function normalizeMeaningZh(value: string) {
  return value
    .normalize("NFC")
    .replace(/\s*[;；/／、]\s*/g, "，")
    .replace(/\s*,\s*/g, "，")
    .replace(/\(/g, "（")
    .replace(/\)/g, "）")
    .replace(/\s+/g, " ")
    .replace(/，{2,}/g, "，")
    .replace(/^[，\s]+|[。．.，,;；、\s]+$/g, "")
    .trim();
}

export function normalizeNoteZh(value: string) {
  const trimmed = value.normalize("NFC").replace(/\s+/g, " ").trim().replace(/[.,;；，、]+$/, "");
  return /[。！？]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

// Removes exact duplicate senses and groups senses by part of speech while
// keeping the model's frequency order within and across groups.
export function normalizeDefinitions<T extends { partOfSpeech: string; meaningZh: string }>(definitions: T[]): T[] {
  const seen = new Set<string>();
  const unique = definitions
    .map((definition) => ({ ...definition, meaningZh: normalizeMeaningZh(definition.meaningZh) }))
    .filter((definition) => {
      const key = `${definition.partOfSpeech}\u0000${definition.meaningZh}`;
      if (!definition.meaningZh || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const order = [...new Set(unique.map((definition) => definition.partOfSpeech))];
  return order.flatMap((partOfSpeech) => unique.filter((definition) => definition.partOfSpeech === partOfSpeech));
}
