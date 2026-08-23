import type { Language } from "@/lib/types";

export const localeByLanguage: Record<Language, string> = {
  EN: "en-US",
  FR: "fr-FR",
  ES: "es-ES",
};

export const languageNames: Record<Language, string> = {
  EN: "English",
  FR: "Français",
  ES: "Español",
};

export const lookupPlaceholderByLanguage: Record<Language, string> = {
  EN: "Enter an English word…",
  FR: "Saisissez un mot français…",
  ES: "Escribe una palabra en español…",
};

export const maxWordLength = 80;
