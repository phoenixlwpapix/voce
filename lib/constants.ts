import type { Language } from "@/lib/types";

export const localeByLanguage: Record<Language, string> = {
  EN: "en-US",
  FR: "fr-FR",
  ES: "es-ES",
  JA: "ja-JP",
};

export const languageNames: Record<Language, string> = {
  EN: "English",
  FR: "French",
  ES: "Spanish",
  JA: "Japanese",
};

export const lookupPlaceholderByLanguage: Record<Language, string> = {
  EN: "Enter an English word…",
  FR: "Saisissez un mot français…",
  ES: "Escribe una palabra en español…",
  JA: "日本語の単語を入力…",
};

export const chineseLookupPlaceholderByLanguage: Record<Language, string> = {
  EN: "输入中文词语，查找常用英语表达…",
  FR: "输入中文词语，查找常用法语表达…",
  ES: "输入中文词语，查找常用西班牙语表达…",
  JA: "输入中文词语，查找常用日语表达…",
};

export const maxWordLength = 80;
export const maxChineseQueryLength = 60;
