/* global chrome */

import {
  detectLanguage,
  getSettings,
  lookupWord,
  normalizeWord,
  preparePrivateStorage,
} from "./api.mjs";

const menuId = "voce-add-selection";

async function installMenu() {
  await preparePrivateStorage();
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: menuId,
    title: "Add “%s” to Voce",
    contexts: ["selection"],
  });
  await chrome.action.setBadgeBackgroundColor({ color: "#557568" });
}

async function setBadge(text, title, color = "#557568") {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  await chrome.action.setTitle({ title });
}

async function addSelection(selectionText) {
  const word = normalizeWord(selectionText);
  if (!word || word.length > 80) {
    await setBadge("!", "Select a single word of up to 80 characters", "#a33f35");
    return;
  }

  const settings = await getSettings();
  if (!settings.token) {
    await setBadge("!", "Open Voce and connect this extension", "#a33f35");
    return;
  }

  const language = detectLanguage(word, settings.defaultLanguage);
  await setBadge("…", `Adding ${word} to Voce`);
  try {
    const result = await lookupWord(word, language);
    if (result.status === "needs_confirmation" || result.status === "invalid") {
      const hint = result.status === "needs_confirmation"
        ? `Did you mean ${result.suggestions.map((candidate) => candidate.word).join(" / ")}?`
        : "Check the spelling.";
      await setBadge("?", `Nothing saved. ${hint} Open the popup to look up the correct word.`, "#a33f35");
      return;
    }
    const message = result.status === "created"
      ? `Added ${result.word}`
      : `${result.word} is already saved`;
    await setBadge("✓", `${message} · ${result.language ?? language}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The lookup failed.";
    await setBadge("!", message, "#a33f35");
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void installMenu();
});

chrome.runtime.onStartup.addListener(() => {
  void preparePrivateStorage();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== menuId || typeof info.selectionText !== "string") return;
  void addSelection(info.selectionText);
});
