import { describe, expect, it } from "vitest";
import { createVocabularyCsv, vocabularyExportFilename, type ExportableWord } from "./word-export";

const word: ExportableWord = {
  language: "JA",
  word: "学ぶ",
  phonetic: "まなぶ",
  definitions: [{ partOfSpeech: "verb", meaningZh: "学习" }],
  grammar: { noteZh: "五段动词" },
  examples: [{ target: "毎日学ぶ。", translationZh: "每天学习。" }],
  createdAt: Date.UTC(2026, 8, 20),
  updatedAt: Date.UTC(2026, 8, 21),
};

describe("vocabulary CSV export", () => {
  it("keeps Unicode content and emits an Excel-friendly BOM", () => {
    const csv = createVocabularyCsv([word]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"学ぶ"');
    expect(csv).toContain('"每天学习。"');
  });

  it("escapes quotes and spreadsheet formulas", () => {
    const csv = createVocabularyCsv([{ ...word, word: '=HYPERLINK("bad")' }]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
  });

  it("includes the base form for an inflected entry", () => {
    const csv = createVocabularyCsv([{ ...word, word: "children", grammar: { baseForm: "child" } }]);
    expect(csv).toContain('"Base form"');
    expect(csv).toContain('"child"');
  });

  it("creates a stable dated filename", () => {
    expect(vocabularyExportFilename("EN", new Date("2026-09-21T08:00:00Z"))).toBe("voce-en-words-2026-09-21.csv");
  });
});
