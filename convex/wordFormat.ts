import type { Doc } from "./_generated/dataModel";
import { normalizeWord, type Language } from "./normalization";
import { normalizeDefinitions, normalizeNoteZh } from "../lib/entry-format";
import { legacyPartOfSpeech, partOfSpeechLabel } from "../lib/parts-of-speech";
import { normalizePhonetic } from "../lib/phonetics";

type Grammar = Doc<"words">["grammar"];

// Drops forms that only repeat the headword and normalizes the usage note.
export function normalizeGrammar(grammar: Grammar, word: string, language: Language): Grammar {
  if (!grammar) return undefined;
  const headword = normalizeWord(word, language);
  const { infinitive, baseForm, noteZh, ...rest } = grammar;
  const normalized = {
    ...rest,
    ...(infinitive && normalizeWord(infinitive, language) !== headword ? { infinitive } : {}),
    ...(baseForm && normalizeWord(baseForm, language) !== headword ? { baseForm } : {}),
    ...(noteZh ? { noteZh: normalizeNoteZh(noteZh) } : {}),
  };
  return Object.keys(normalized).length ? normalized : undefined;
}

export type StoredWordFixes = {
  phonetic: string;
  definitions: Doc<"words">["definitions"];
  grammar: Grammar;
  unknownLabels: string[];
};

// Brings an entry saved by an earlier version to the current house style
// without calling the model. Phonetics that still break the convention after
// this are left for the caller to regenerate.
export function normalizeStoredWord(word: Doc<"words">): StoredWordFixes {
  const unknownLabels: string[] = [];
  let gender = word.grammar?.gender;
  const definitions = normalizeDefinitions(word.definitions.map((definition) => {
    const legacy = legacyPartOfSpeech(definition.partOfSpeech);
    if (!legacy) {
      unknownLabels.push(definition.partOfSpeech);
      return definition;
    }
    if (legacy.gender && (word.language === "FR" || word.language === "ES")) gender ??= legacy.gender;
    return { ...definition, partOfSpeech: partOfSpeechLabel(word.language, legacy.code) };
  }));
  const grammar = normalizeGrammar(
    gender && !word.grammar?.gender ? { ...word.grammar, gender } : word.grammar,
    word.word,
    word.language,
  );
  return { phonetic: normalizePhonetic(word.phonetic, word.language), definitions, grammar, unknownLabels };
}
