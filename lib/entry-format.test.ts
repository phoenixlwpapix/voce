import { expect, test } from "vitest";
import { normalizeDefinitions, normalizeMeaningZh, normalizeNoteZh } from "./entry-format";

test("glosses use full-width commas and no trailing punctuation", () => {
  expect(normalizeMeaningZh("机缘巧合；意外发现珍奇事物的运气。")).toBe("机缘巧合，意外发现珍奇事物的运气");
  expect(normalizeMeaningZh(" 帮助 / 协助, 援助 ")).toBe("帮助，协助，援助");
  expect(normalizeMeaningZh("(口语)混乱")).toBe("（口语）混乱");
});

test("notes are complete sentences", () => {
  expect(normalizeNoteZh("多用于正式场合")).toBe("多用于正式场合。");
  expect(normalizeNoteZh("多用于正式场合！")).toBe("多用于正式场合！");
});

test("definitions drop duplicates and group senses by part of speech", () => {
  expect(normalizeDefinitions([
    { partOfSpeech: "verb", meaningZh: "帮助。" },
    { partOfSpeech: "noun", meaningZh: "帮助" },
    { partOfSpeech: "verb", meaningZh: "帮助" },
    { partOfSpeech: "verb", meaningZh: "有助于" },
  ])).toEqual([
    { partOfSpeech: "verb", meaningZh: "帮助" },
    { partOfSpeech: "verb", meaningZh: "有助于" },
    { partOfSpeech: "noun", meaningZh: "帮助" },
  ]);
});
