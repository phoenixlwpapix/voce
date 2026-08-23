"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { localeByLanguage } from "@/lib/constants";
import type { Language } from "@/lib/types";

const subscribeToSpeechAvailability = () => () => undefined;
const getSpeechAvailability = () =>
  "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const getServerSpeechAvailability = () => false;

export function useSpeech() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const available = useSyncExternalStore(
    subscribeToSpeechAvailability,
    getSpeechAvailability,
    getServerSpeechAvailability,
  );

  useEffect(() => {
    if (!available) return;
    const synth = window.speechSynthesis;
    const updateVoices = () => setVoices(synth.getVoices());
    updateVoices();
    synth.addEventListener("voiceschanged", updateVoices);
    return () => {
      synth.removeEventListener("voiceschanged", updateVoices);
      synth.cancel();
    };
  }, [available]);

  const speak = useCallback(
    (text: string, language: Language) => {
      if (!available) return;
      const synth = window.speechSynthesis;
      const locale = localeByLanguage[language];
      const prefix = locale.slice(0, 2).toLowerCase();
      const exactVoice = voices.find((voice) => voice.lang.toLowerCase() === locale.toLowerCase());
      const prefixVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix));
      const defaultVoice = voices.find((voice) => voice.default);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale;
      utterance.voice = exactVoice ?? prefixVoice ?? defaultVoice ?? null;
      synth.cancel();
      synth.speak(utterance);
    },
    [available, voices],
  );

  return { available, speak };
}
