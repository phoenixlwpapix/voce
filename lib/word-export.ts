import type { WordDocument } from "@/lib/types";

export type ExportableWord = Pick<
  WordDocument,
  | "word"
  | "language"
  | "phonetic"
  | "definitions"
  | "grammar"
  | "examples"
  | "createdAt"
  | "updatedAt"
>;

const headers = [
  "Language",
  "Word",
  "Pronunciation",
  "Part of speech",
  "Chinese definition",
  "Gender",
  "Infinitive",
  "Base form",
  "Grammar note",
  "Example",
  "Example translation",
  "Added",
  "Updated",
] as const;

function protectSpreadsheetFormula(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string) {
  const safeValue = protectSpreadsheetFormula(value);
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toISOString();
}

export function createVocabularyCsv(words: ExportableWord[]) {
  const rows = words.map((word) => [
    word.language,
    word.word,
    word.phonetic,
    word.definitions.map((definition) => definition.partOfSpeech).join("\n"),
    word.definitions.map((definition) => definition.meaningZh).join("\n"),
    word.grammar?.gender ?? "",
    word.grammar?.infinitive ?? "",
    word.grammar?.baseForm ?? "",
    word.grammar?.noteZh ?? "",
    word.examples.map((example) => example.target).join("\n"),
    word.examples.map((example) => example.translationZh).join("\n"),
    formatTimestamp(word.createdAt),
    formatTimestamp(word.updatedAt),
  ]);

  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

export function vocabularyExportFilename(scope: string, now = new Date()) {
  return `voce-${scope.toLocaleLowerCase()}-words-${now.toISOString().slice(0, 10)}.csv`;
}
