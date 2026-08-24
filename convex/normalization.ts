export type Language = "EN" | "FR" | "ES" | "JA";

const localeByLanguage: Record<Language, string> = {
  EN: "en-US",
  FR: "fr-FR",
  ES: "es-ES",
  JA: "ja-JP",
};

export function sanitizeInput(value: string) {
  return value.trim().replace(/\s+/g, " ").normalize("NFC");
}

export function normalizeWord(value: string, language: Language) {
  return sanitizeInput(value).toLocaleLowerCase(localeByLanguage[language]);
}
