/* global chrome */

import {
  getSettings,
  languageNames,
  languages,
  lookupWord,
  pairExtension,
  setDefaultLanguage,
} from "./api.mjs";

const pairingView = document.getElementById("pairing-view");
const lookupView = document.getElementById("lookup-view");
const connectionDot = document.getElementById("connection-dot");
const pairingForm = document.getElementById("pairing-form");
const pairingCode = document.getElementById("pairing-code");
const pairingError = document.getElementById("pairing-error");
const pairingSubmit = document.getElementById("pairing-submit");
const lookupForm = document.getElementById("lookup-form");
const wordInput = document.getElementById("word-input");
const lookupSubmit = document.getElementById("lookup-submit");
const lookupMessage = document.getElementById("lookup-message");
const languageOptions = document.getElementById("language-options");

let selectedLanguage = "EN";

function setConnected(connected) {
  pairingView.hidden = connected;
  lookupView.hidden = !connected;
  connectionDot.dataset.connected = String(connected);
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = label;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
    delete button.dataset.label;
  }
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
  element.classList.toggle("success", !isError && Boolean(message));
}

function renderLanguages() {
  languageOptions.replaceChildren();
  for (const language of languages) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = language;
    button.title = languageNames[language];
    button.dataset.active = String(language === selectedLanguage);
    button.setAttribute("aria-pressed", String(language === selectedLanguage));
    button.addEventListener("click", () => {
      selectedLanguage = language;
      void setDefaultLanguage(language);
      renderLanguages();
    });
    languageOptions.append(button);
  }
}

pairingCode.addEventListener("input", () => {
  pairingCode.value = pairingCode.value.toUpperCase();
  setMessage(pairingError, "");
});

pairingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = pairingCode.value.trim();
  if (!code) {
    setMessage(pairingError, "Enter the code shown in Voce.", true);
    return;
  }

  setBusy(pairingSubmit, true, "Connecting…");
  setMessage(pairingError, "");
  void pairExtension(code)
    .then(() => {
      setConnected(true);
      wordInput.focus();
    })
    .catch((error) => {
      setMessage(pairingError, error instanceof Error ? error.message : "Pairing failed.", true);
    })
    .finally(() => setBusy(pairingSubmit, false, ""));
});

lookupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const word = wordInput.value;
  setBusy(lookupSubmit, true, "…");
  setMessage(lookupMessage, "Looking up and saving…");
  void lookupWord(word, selectedLanguage)
    .then((result) => {
      const message = result.status === "created"
        ? `Added ${result.word}`
        : `${result.word} is already saved`;
      setMessage(lookupMessage, message);
      wordInput.value = "";
      wordInput.focus();
    })
    .catch((error) => {
      setMessage(lookupMessage, error instanceof Error ? error.message : "The lookup failed.", true);
      if (error && error.status === 401) setConnected(false);
    })
    .finally(() => setBusy(lookupSubmit, false, ""));
});

const extensionRuntimeAvailable = Boolean(globalThis.chrome?.storage?.local && globalThis.chrome?.action);
if (extensionRuntimeAvailable) {
  void chrome.action.setBadgeText({ text: "" });
  void getSettings().then((settings) => {
    selectedLanguage = settings.defaultLanguage;
    renderLanguages();
    setConnected(Boolean(settings.token));
    if (settings.token) wordInput.focus();
    else pairingCode.focus();
  });
} else {
  selectedLanguage = "JA";
  renderLanguages();
  setConnected(new URLSearchParams(window.location.search).get("view") !== "pairing");
}
