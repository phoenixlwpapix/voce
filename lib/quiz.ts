import type { Language, WordDocument } from "./types";
import { localeByLanguage } from "./constants";

export type QuizMode = "mixed" | "meaning" | "word" | "context";
export type QuestionKind = Exclude<QuizMode, "mixed">;

export type QuizQuestion = {
  id: string;
  kind: QuestionKind;
  word: WordDocument;
  prompt: string;
  // Chinese translation shown under a fill-in-the-blank sentence.
  hint?: string;
  options: string[];
  answerIndex: number;
};

export const optionsPerQuestion = 4;
export const minimumQuizWords = optionsPerQuestion;
export const quizBlank = "＿＿＿";

type Random = () => number;

function shuffle<T>(items: T[], random: Random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function primaryMeaning(word: WordDocument) {
  return word.definitions[0]?.meaningZh ?? "";
}

function primaryPartOfSpeech(word: WordDocument) {
  return word.definitions[0]?.partOfSpeech ?? "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Blanks the headword in one of the word's own examples. Only literal
// occurrences count: guessing at an inflected form could blank the wrong text.
export function blankExample(word: WordDocument): { sentence: string; translation: string } | null {
  const headword = word.word.trim();
  if (!headword) return null;
  for (const example of word.examples) {
    if (word.language === "JA") {
      if (example.target.includes(headword)) {
        return { sentence: example.target.replace(headword, quizBlank), translation: example.translationZh };
      }
      continue;
    }
    const pattern = new RegExp(`(?<![\\p{L}\\p{M}])${escapeRegExp(headword)}(?![\\p{L}\\p{M}])`, "iu");
    if (pattern.test(example.target)) {
      return { sentence: example.target.replace(pattern, quizBlank), translation: example.translationZh };
    }
  }
  return null;
}

// Due, new, and never-reviewed words come up more often.
function quizWeight(word: WordDocument, now: number) {
  return 1 + (word.nextReviewAt <= now ? 2 : 0) + (word.repetitions === 0 ? 1 : 0);
}

// Weighted sampling without replacement (Efraimidis–Spirakis).
function sampleWeighted(words: WordDocument[], count: number, now: number, random: Random) {
  return words
    .map((word) => ({ word, key: Math.pow(random() || Number.MIN_VALUE, 1 / quizWeight(word, now)) }))
    .sort((first, second) => second.key - first.key)
    .slice(0, count)
    .map((entry) => entry.word);
}

function optionValue(word: WordDocument, kind: QuestionKind) {
  return kind === "meaning" ? primaryMeaning(word) : word.word;
}

function optionKey(value: string, language: Language) {
  return value.normalize("NFC").trim().toLocaleLowerCase(localeByLanguage[language]);
}

function pickDistractors(word: WordDocument, kind: QuestionKind, allWords: WordDocument[], random: Random) {
  const answerKey = optionKey(optionValue(word, kind), word.language);
  const seen = new Set([answerKey]);
  const partOfSpeech = primaryPartOfSpeech(word);
  const others = shuffle(allWords.filter((other) => other._id !== word._id), random);
  // Same part of speech first, so options cannot be ruled out by grammar alone.
  const ordered = [
    ...others.filter((other) => primaryPartOfSpeech(other) === partOfSpeech),
    ...others.filter((other) => primaryPartOfSpeech(other) !== partOfSpeech),
  ];
  const distractors: string[] = [];
  for (const other of ordered) {
    const value = optionValue(other, kind);
    const key = optionKey(value, word.language);
    if (!value.trim() || seen.has(key)) continue;
    seen.add(key);
    distractors.push(value);
    if (distractors.length === optionsPerQuestion - 1) break;
  }
  return distractors;
}

function questionKinds(word: WordDocument, mode: QuizMode): QuestionKind[] {
  const canBlank = blankExample(word) !== null;
  if (mode === "context") return canBlank ? ["context"] : [];
  if (mode !== "mixed") return [mode];
  return canBlank ? ["meaning", "word", "context"] : ["meaning", "word"];
}

export function quizEligibleWords(words: WordDocument[], mode: QuizMode) {
  return words.filter((word) => primaryMeaning(word) && questionKinds(word, mode).length > 0);
}

// Builds up to `count` multiple-choice questions about `pool`, drawing wrong
// options from `allWords` (the whole lexicon in the same language).
export function buildQuiz(
  pool: WordDocument[],
  allWords: WordDocument[],
  { count, mode, now = Date.now(), random = Math.random }: { count: number; mode: QuizMode; now?: number; random?: Random },
): QuizQuestion[] {
  if (allWords.length < minimumQuizWords) return [];
  const chosen = sampleWeighted(quizEligibleWords(pool, mode), count, now, random);
  const questions: QuizQuestion[] = [];

  for (const word of chosen) {
    const kinds = questionKinds(word, mode);
    const kind = kinds[Math.floor(random() * kinds.length)];
    const distractors = pickDistractors(word, kind, allWords, random);
    if (distractors.length < optionsPerQuestion - 1) continue;

    const answer = optionValue(word, kind);
    const options = shuffle([answer, ...distractors], random);
    const blanked = kind === "context" ? blankExample(word) : null;
    questions.push({
      id: `${word._id}:${kind}`,
      kind,
      word,
      prompt: kind === "meaning" ? word.word : kind === "word" ? primaryMeaning(word) : blanked!.sentence,
      hint: blanked?.translation,
      options,
      answerIndex: options.indexOf(answer),
    });
  }
  return questions;
}
