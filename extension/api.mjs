/* global chrome */

export const languages = ["EN", "FR", "ES", "JA"];
export const languageNames = {
  EN: "English",
  FR: "French",
  ES: "Spanish",
  JA: "Japanese",
};

const apiBase = "https://grateful-caterpillar-393.convex.site";
const tokenKey = "voceAccessToken";
const languageKey = "voceDefaultLanguage";

export class VoceApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "VoceApiError";
    this.status = status;
  }
}

async function readJson(response) {
  const value = await response.json().catch(() => null);
  if (!response.ok) {
    const message = value && typeof value.error === "string"
      ? value.error
      : "The request couldn't be completed.";
    throw new VoceApiError(message, response.status);
  }
  return value;
}

export async function preparePrivateStorage() {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}

export async function getSettings() {
  const stored = await chrome.storage.local.get([tokenKey, languageKey]);
  const defaultLanguage = languages.includes(stored[languageKey]) ? stored[languageKey] : "EN";
  return {
    token: typeof stored[tokenKey] === "string" ? stored[tokenKey] : null,
    defaultLanguage,
  };
}

export async function setDefaultLanguage(language) {
  if (!languages.includes(language)) return;
  await chrome.storage.local.set({ [languageKey]: language });
}

export async function clearToken() {
  await chrome.storage.local.remove(tokenKey);
}

export async function pairExtension(code) {
  const response = await fetch(`${apiBase}/api/extension/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  });
  const result = await readJson(response);
  if (!result || typeof result.token !== "string") {
    throw new VoceApiError("The pairing response was invalid.", 502);
  }
  await chrome.storage.local.set({ [tokenKey]: result.token });
  return result.token;
}

export function getLocalMonthGroup(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function normalizeWord(value) {
  return value.trim().replace(/\s+/g, " ").normalize("NFC");
}

export function detectLanguage(value, fallback) {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value) ? "JA" : fallback;
}

export async function lookupWord(word, language) {
  const normalizedWord = normalizeWord(word);
  if (!normalizedWord) {
    throw new VoceApiError("Enter a word to look up.", 400);
  }
  if (normalizedWord.length > 80) {
    throw new VoceApiError("Words can't exceed 80 characters.", 400);
  }

  const { token } = await getSettings();
  if (!token) {
    throw new VoceApiError("Connect the extension to Voce first.", 401);
  }

  const response = await fetch(`${apiBase}/api/extension/lookup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      word: normalizedWord,
      language,
      monthGroup: getLocalMonthGroup(),
    }),
  });
  try {
    return await readJson(response);
  } catch (error) {
    if (error instanceof VoceApiError && error.status === 401) {
      await clearToken();
    }
    throw error;
  }
}
