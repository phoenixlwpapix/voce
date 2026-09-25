import { expect, test } from "vitest";
import { blankExample, buildQuiz, quizBlank } from "./quiz";
import type { WordDocument } from "./types";

let seed = 1;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function word(id: string, text: string, meaning: string, partOfSpeech = "sustantivo", example = `Veo ${text} aquí.`): WordDocument {
  return {
    _id: id, _creationTime: 1, ownerId: "owner", inputWord: text, normalizedWord: text, word: text,
    language: "ES", phonetic: "", definitions: [{ partOfSpeech, meaningZh: meaning }],
    examples: [{ target: example, translationZh: `我在这里看到${meaning}。` }],
    monthGroup: "2026-09", repetitions: 1, intervalDays: 1, easeFactor: 2.5, nextReviewAt: 10,
    createdAt: 1, updatedAt: 1,
  } as unknown as WordDocument;
}

const lexicon = [
  word("1", "reina", "女王"), word("2", "garganta", "喉咙"), word("3", "cantidad", "数量"),
  word("4", "follón", "混乱"), word("5", "colgar", "挂", "verbo"), word("6", "bobo", "傻瓜"),
];

test("builds the requested number of four-option questions with one correct answer", () => {
  seed = 7;
  const questions = buildQuiz(lexicon, lexicon, { count: 5, mode: "mixed", now: 0, random });
  expect(questions).toHaveLength(5);
  expect(new Set(questions.map((question) => question.word._id)).size).toBe(5);
  for (const question of questions) {
    expect(question.options).toHaveLength(4);
    expect(new Set(question.options).size).toBe(4);
    const answer = question.kind === "meaning" ? question.word.definitions[0].meaningZh : question.word.word;
    expect(question.options[question.answerIndex]).toBe(answer);
  }
});

test("each mode asks the matching kind of question", () => {
  seed = 3;
  expect(buildQuiz(lexicon, lexicon, { count: 3, mode: "meaning", random }).every((q) => q.prompt === q.word.word)).toBe(true);
  expect(buildQuiz(lexicon, lexicon, { count: 3, mode: "word", random }).every((q) => q.prompt === q.word.definitions[0].meaningZh)).toBe(true);
  const context = buildQuiz(lexicon, lexicon, { count: 3, mode: "context", random });
  expect(context.every((q) => q.prompt.includes(quizBlank) && !q.prompt.includes(q.word.word) && q.hint)).toBe(true);
});

test("needs enough words for distinct options", () => {
  expect(buildQuiz(lexicon.slice(0, 3), lexicon.slice(0, 3), { count: 3, mode: "mixed", random })).toEqual([]);
});

test("missed-word retries still draw wrong options from the whole lexicon", () => {
  seed = 11;
  const retry = buildQuiz([lexicon[0]], lexicon, { count: 20, mode: "meaning", random });
  expect(retry).toHaveLength(1);
  expect(retry[0].word.word).toBe("reina");
});

test("blanks only whole-word occurrences of the headword", () => {
  expect(blankExample(word("x", "mar", "海", "sustantivo", "El mar está en calma. Mariana nada."))?.sentence)
    .toBe(`El ${quizBlank} está en calma. Mariana nada.`);
  expect(blankExample(word("y", "mar", "海", "sustantivo", "Mariana nada."))).toBeNull();
});
