"use client";

import { useAction } from "convex/react";
import { useOwnerSession } from "@/hooks/use-owner-session";
import { ArrowLeftRight, ArrowUpRight, Languages, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import * as z from "zod/mini";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { LookupActionResult } from "@/convex/lookupCore";
import type { TranslationCandidateResult } from "@/convex/translation";
import {
  chineseLookupPlaceholderByLanguage,
  languageNames,
  localeByLanguage,
  lookupPlaceholderByLanguage,
  maxChineseQueryLength,
  maxWordLength,
} from "@/lib/constants";
import { getUserErrorMessage } from "@/lib/errors";
import { getLocalMonthGroup } from "@/lib/month";
import { cn } from "@/lib/utils";
import { languages, type Language } from "@/lib/types";

const inputSchema = z.string().check(
  z.trim(),
  z.minLength(1, "Enter a word to look up."),
  z.maxLength(maxWordLength, `Enter no more than ${maxWordLength} characters.`),
);
const chineseInputSchema = z.string().check(
  z.trim(),
  z.minLength(1, "请输入一个中文词语或短语。"),
  z.maxLength(maxChineseQueryLength, `请输入不超过 ${maxChineseQueryLength} 个字符。`),
  z.refine((value) => /\p{Script=Han}/u.test(value), "请输入包含中文的词语或短语。"),
);

type LookupMode = "foreign" | "chinese";

const languagePillClasses: Record<Language, string> = {
  EN: "data-[active=true]:border-en data-[active=true]:bg-en/20",
  FR: "data-[active=true]:border-fr data-[active=true]:bg-fr/20",
  ES: "data-[active=true]:border-es data-[active=true]:bg-es/20",
  JA: "data-[active=true]:border-ja data-[active=true]:bg-ja/20",
};

type LookupFormProps = {
  language: Language;
  languageSwitching: boolean;
  onLanguageChange: (language: Language) => void;
};

export function LookupForm({ language, languageSwitching, onLanguageChange }: LookupFormProps) {
  const account = useOwnerSession();
  const lookupAndSave = useAction(api.lookup.lookupAndSave);
  const findTranslationCandidates = useAction(api.translation.findCandidates);
  const [mode, setMode] = useState<LookupMode>("foreign");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [spelling, setSpelling] = useState<Extract<LookupActionResult, { status: "needs_confirmation" }> | null>(null);
  const [formChoice, setFormChoice] = useState<Extract<LookupActionResult, { status: "form_choice" }> | null>(null);
  const [translation, setTranslation] = useState<Extract<TranslationCandidateResult, { status: "candidates" }> | null>(null);
  // Until the session arrives, `language` is only a placeholder; don't present it as the user's choice.
  const languageKnown = account !== null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "chinese") {
      await findFromChinese(value, language);
    } else {
      await submitWord(value, language);
    }
  }

  function changeMode(nextMode: LookupMode) {
    if (submitting || nextMode === mode) return;
    setMode(nextMode);
    setValue("");
    setError(null);
    setSpelling(null);
    setFormChoice(null);
    setTranslation(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function findFromChinese(queryZh: string, selectedLanguage: Language) {
    if (submissionLock.current || !account || languageSwitching) return;
    const validation = chineseInputSchema.safeParse(queryZh);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "请输入有效的中文词语。");
      return;
    }
    if (!navigator.onLine) {
      setError("You're offline. Reconnect and try again.");
      return;
    }

    submissionLock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await findTranslationCandidates({
        queryZh: validation.data,
        language: selectedLanguage,
      });
      if (result.status === "invalid") {
        setTranslation(null);
        setError("没有找到可靠表达，请检查输入或换一个更具体的说法。");
        return;
      }
      setTranslation(result);
    } catch (caughtError) {
      setError(getUserErrorMessage(caughtError));
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  async function submitWord(
    inputWord: string,
    selectedLanguage: Language,
    valueOnFailure = inputWord,
    saveInflected = false,
  ) {
    if (submissionLock.current || !account || languageSwitching) return;

    const validation = inputSchema.safeParse(inputWord);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Invalid input.");
      return;
    }
    if (!navigator.onLine) {
      setError("You're offline. Reconnect and try again.");
      return;
    }

    submissionLock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await lookupAndSave({
        inputWord: validation.data,
        language: selectedLanguage,
        monthGroup: getLocalMonthGroup(),
        saveInflected,
      });
      if (result.status === "form_choice") {
        setFormChoice(result);
        return;
      }
      if (result.status === "needs_confirmation") {
        setFormChoice(null);
        setSpelling(result);
        return;
      }
      if (result.status === "invalid") {
        setSpelling(null);
        setValue(valueOnFailure);
        setError(`We couldn't find this word in ${languageNames[selectedLanguage]}. Check the spelling and try again.`);
        return;
      }
      setSpelling(null);
      setFormChoice(null);
      setValue("");
      toast.success(result.status === "created" ? `Added ${result.word}` : `${result.word} is already saved`, {
        description: result.status === "created"
          ? "Added to this month's collection."
          : "The existing entry was left unchanged.",
      });
    } catch (caughtError) {
      setError(getUserErrorMessage(caughtError));
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-5 pt-4 sm:px-8 sm:pb-9 sm:pt-9 lg:pb-10 lg:pt-10" aria-labelledby="lookup-title">
      <div className="grid gap-5 border-b border-border/70 pb-5 sm:gap-7 sm:pb-9 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(26rem,1.2fr)] lg:items-end lg:gap-16">
        <div>
          <p className="mb-3 hidden font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground sm:block">Words worth keeping</p>
          <h1 id="lookup-title" className="max-w-xl font-serif text-[clamp(1.9rem,8vw,2.75rem)] font-normal leading-[0.98] tracking-[-0.055em] sm:text-[clamp(2.35rem,6vw,4.25rem)] sm:leading-[0.94]">
            What will you<br />remember today?
          </h1>
        </div>

        <form onSubmit={handleSubmit} noValidate className="self-end">
          <fieldset className="mb-2 flex gap-1 sm:mb-3" disabled={submitting || languageSwitching || !account}>
            <legend className="sr-only">Choose vocabulary language</legend>
            {languages.map((item) => (
              <button
                key={item}
                type="button"
                data-active={languageKnown && language === item}
                onClick={() => onLanguageChange(item)}
                className={cn(
                  "min-h-10 border border-transparent px-3 font-mono text-[11px] tracking-[0.16em] text-muted-foreground outline-none transition-[color,background-color,border-color] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:font-medium data-[active=true]:text-foreground motion-reduce:transition-none sm:px-4",
                  languagePillClasses[item],
                )}
                aria-pressed={languageKnown && language === item}
                aria-label={languageNames[item]}
              >
                {item}
              </button>
            ))}
          </fieldset>

          <div className="relative flex items-center gap-2 border-y border-border/70 py-1.5 transition-colors focus-within:border-foreground motion-reduce:transition-none sm:gap-4">
            <label htmlFor="word-input" className="sr-only">
              {mode === "chinese" ? `Enter Chinese to find ${languageNames[language]} vocabulary` : `Enter a word in ${languageNames[language]}`}
            </label>
            <Input
              ref={inputRef}
              id="word-input"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
              placeholder={!languageKnown ? "" : mode === "chinese" ? chineseLookupPlaceholderByLanguage[language] : lookupPlaceholderByLanguage[language]}
              lang={mode === "chinese" ? "zh-CN" : localeByLanguage[language]}
              autoComplete="off"
              spellCheck={false}
              maxLength={(mode === "chinese" ? maxChineseQueryLength : maxWordLength) + 1}
              aria-describedby={error ? "lookup-error" : undefined}
              aria-invalid={Boolean(error)}
              disabled={submitting || languageSwitching}
              className="min-w-0 flex-1 border-b-0 font-serif text-lg focus:border-transparent sm:text-2xl"
            />
            <button
              type="button"
              onClick={() => changeMode(mode === "foreign" ? "chinese" : "foreign")}
              disabled={submitting || languageSwitching}
              className="flex min-h-10 shrink-0 items-center gap-1 border-l border-border/70 px-2 font-mono text-[10px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
              aria-label={`Switch lookup direction to ${mode === "foreign" ? `Chinese to ${languageNames[language]}` : `${languageNames[language]} to Chinese`}`}
              title="Switch lookup direction"
            >
              <span>{!languageKnown ? "→ 中文" : mode === "foreign" ? `${language} → 中文` : `中文 → ${language}`}</span>
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
            </button>
            <Button type="submit" size="icon" className="size-10 min-h-10 shrink-0" disabled={submitting || languageSwitching || !account} aria-label={submitting ? "Looking up" : mode === "chinese" ? "Find vocabulary" : "Look up and save"}>
              {submitting ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : mode === "chinese" ? <Languages className="size-4" aria-hidden="true" /> : <ArrowUpRight className="size-4" aria-hidden="true" />}
            </Button>
          </div>

          <div className="mt-1 min-h-5 text-left text-xs">
            {error ? <p id="lookup-error" role="alert" className="text-destructive">{error}</p> : null}
          </div>
        </form>
      </div>
      <Dialog open={spelling !== null} onOpenChange={(open) => { if (!open && !submitting) setSpelling(null); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto" onCloseAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}>
          <DialogTitle>Check the spelling</DialogTitle>
          <DialogDescription>
            Nothing has been saved for “{spelling?.inputWord}”. Did you mean one of these words?
          </DialogDescription>
          <div className="mt-6 space-y-3">
            {spelling?.suggestions.map((candidate, index) => (
              <div key={index} className="border border-border p-4">
                <p className="font-serif text-2xl" lang={localeByLanguage[candidate.language]}>{candidate.word}</p>
                <p className="mt-1 text-xs text-muted-foreground">{languageNames[candidate.language]}</p>
                <p className="mt-2 text-sm" lang="zh-CN">{candidate.meaningZh}</p>
                <Button className="mt-3 w-full" disabled={submitting} onClick={() => void submitWord(candidate.word, candidate.language)}>
                  {submitting ? "Checking and saving…" : `Save ${candidate.word}`}
                </Button>
              </div>
            ))}
          </div>
          {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
          <Button variant="ghost" className="mt-4" disabled={submitting} onClick={() => setSpelling(null)}>Back to editing</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={formChoice !== null} onOpenChange={(open) => { if (!open && !submitting) setFormChoice(null); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto" onCloseAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}>
          <DialogTitle>Found a dictionary form</DialogTitle>
          <DialogDescription>
            “{formChoice?.inputWord}” is a valid form of “{formChoice?.baseForm}”. Nothing has been saved yet.
          </DialogDescription>
          <p className="mt-5 text-sm" lang="zh-CN">{formChoice?.meaningZh}</p>
          <div className="mt-5 space-y-3">
            <Button className="w-full" disabled={submitting} onClick={() => { if (formChoice) void submitWord(formChoice.baseForm, formChoice.language); }}>
              {submitting ? "Checking…" : `Save dictionary form · ${formChoice?.baseForm}`}
            </Button>
            <Button variant="outline" className="w-full" disabled={submitting} onClick={() => { if (formChoice) void submitWord(formChoice.inputWord, formChoice.language, formChoice.inputWord, true); }}>
              {submitting ? "Checking…" : `Save this form · ${formChoice?.inputWord}`}
            </Button>
          </div>
          {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
          <Button variant="ghost" className="mt-4" disabled={submitting} onClick={() => setFormChoice(null)}>Back to editing</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={translation !== null} onOpenChange={(open) => { if (!open && !submitting) setTranslation(null); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto" onCloseAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}>
          <DialogTitle>Choose a {translation ? languageNames[language] : "target"} expression</DialogTitle>
          <DialogDescription>
            Common expressions for “{translation?.queryZh}”. Nothing is saved until you choose one.
          </DialogDescription>
          <div className="mt-6 space-y-3">
            {translation?.candidates.map((candidate, index) => (
              <div key={`${candidate.word}-${index}`} className="border border-border p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-serif text-2xl" lang={localeByLanguage[language]}>{candidate.word}</p>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{candidate.partOfSpeech}</span>
                </div>
                <p className="mt-3 text-sm" lang="zh-CN">{candidate.meaningZh}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground" lang="zh-CN">{candidate.usageZh}</p>
                <Button
                  className="mt-4 w-full"
                  disabled={submitting}
                  onClick={() => {
                    const originalQuery = translation?.queryZh ?? value;
                    setTranslation(null);
                    void submitWord(candidate.word, language, originalQuery);
                  }}
                >
                  {submitting ? "Checking and saving…" : `Save ${candidate.word}`}
                </Button>
              </div>
            ))}
          </div>
          {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
          <Button variant="ghost" className="mt-4" disabled={submitting} onClick={() => setTranslation(null)}>Back to editing</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
