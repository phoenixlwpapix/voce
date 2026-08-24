import type { Language } from "./types";

export function normalizePhonetic(value: string) {
  let normalized = value.trim();

  while (
    (normalized.startsWith("/") && normalized.endsWith("/")) ||
    (normalized.startsWith("[") && normalized.endsWith("]"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
}

export function formatPhonetic(value: string, language: Language) {
  const normalized = normalizePhonetic(value);
  if (!normalized) return "";
  return language === "JA" ? normalized : `/${normalized}/`;
}
