export type Language = "EN" | "FR" | "ES";

const localeByLanguage: Record<Language, string> = {
  EN: "en-US",
  FR: "fr-FR",
  ES: "es-ES",
};

export function sanitizeInput(value: string) {
  return value.trim().replace(/\s+/g, " ").normalize("NFC");
}

export function normalizeWord(value: string, language: Language) {
  return sanitizeInput(value).toLocaleLowerCase(localeByLanguage[language]);
}
