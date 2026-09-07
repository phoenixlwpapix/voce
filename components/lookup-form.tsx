"use client";

import { useAction } from "convex/react";
import { useOwnerSession } from "@/hooks/use-owner-session";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { LookupActionResult } from "@/convex/lookupCore";
import { languageNames, localeByLanguage, lookupPlaceholderByLanguage, maxWordLength } from "@/lib/constants";
import { getUserErrorMessage } from "@/lib/errors";
import { getLocalMonthGroup } from "@/lib/month";
import { cn } from "@/lib/utils";
import { languages, type Language } from "@/lib/types";

const inputSchema = z.string().trim().min(1, "Enter a word to look up.").max(maxWordLength, `Enter no more than ${maxWordLength} characters.`);

const languagePillClasses: Record<Language, string> = {
  EN: "data-[active=true]:border-en data-[active=true]:text-en",
  FR: "data-[active=true]:border-fr data-[active=true]:text-fr",
  ES: "data-[active=true]:border-es data-[active=true]:text-es",
  JA: "data-[active=true]:border-ja data-[active=true]:text-ja",
};

type LookupFormProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
};

export function LookupForm({ language, onLanguageChange }: LookupFormProps) {
  const account = useOwnerSession();
  const lookupAndSave = useAction(api.lookup.lookupAndSave);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [spelling, setSpelling] = useState<Extract<LookupActionResult, { status: "needs_confirmation" }> | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitWord(value, language);
  }

  async function submitWord(inputWord: string, selectedLanguage: Language) {
    if (submissionLock.current || !account) return;

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
      });
      if (result.status === "needs_confirmation") {
        setSpelling(result);
        return;
      }
      if (result.status === "invalid") {
        setSpelling(null);
        setValue(inputWord);
        setError("We couldn't verify this word. Check the spelling and try again. Nothing was saved.");
        return;
      }
      setSpelling(null);
      setValue("");
      const corrected = result.language !== language;
      if (corrected) onLanguageChange(result.language);
      toast.success(result.status === "created" ? `Added ${result.word}` : `${result.word} is already saved`, {
        description: corrected
          ? `Detected ${languageNames[result.language]}. ${result.status === "created" ? "Saved" : "Already saved"} under ${result.language}; language switched.`
          : result.status === "created" ? "Added to this month's collection." : "The existing entry was left unchanged.",
      });
    } catch (caughtError) {
      setError(getUserErrorMessage(caughtError));
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-9 pt-7 sm:px-8 sm:pb-11 sm:pt-9 lg:pb-12 lg:pt-10" aria-labelledby="lookup-title">
      <div className="grid gap-7 border-b border-border/70 pb-8 sm:pb-9 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(26rem,1.2fr)] lg:items-end lg:gap-16">
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Words worth keeping</p>
          <h1 id="lookup-title" className="max-w-xl font-serif text-[clamp(2.35rem,6vw,4.25rem)] font-normal leading-[0.94] tracking-[-0.055em]">
            What will you<br />remember today?
          </h1>
        </div>

        <form onSubmit={handleSubmit} noValidate className="self-end">
          <fieldset className="mb-3 flex gap-1" disabled={submitting}>
            <legend className="sr-only">Choose vocabulary language</legend>
            {languages.map((item) => (
              <button
                key={item}
                type="button"
                data-active={language === item}
                onClick={() => onLanguageChange(item)}
                className={cn(
                  "min-h-9 border-b border-transparent px-3 font-mono text-[11px] tracking-[0.16em] text-muted-foreground outline-none transition-colors first:pl-0 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:text-foreground motion-reduce:transition-none sm:px-4",
                  languagePillClasses[item],
                )}
                aria-pressed={language === item}
                aria-label={languageNames[item]}
              >
                {item}
              </button>
            ))}
          </fieldset>

          <div className="relative flex items-center gap-4 border-y border-border/70 py-1.5 transition-colors focus-within:border-foreground motion-reduce:transition-none">
            <label htmlFor="word-input" className="sr-only">Enter a word in {languageNames[language]}</label>
            <Input
              ref={inputRef}
              id="word-input"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
              placeholder={lookupPlaceholderByLanguage[language]}
              lang={localeByLanguage[language]}
              autoComplete="off"
              spellCheck={false}
              maxLength={maxWordLength + 1}
              aria-describedby={error ? "lookup-error" : undefined}
              aria-invalid={Boolean(error)}
              disabled={submitting}
              className="border-b-0 font-serif text-xl focus:border-transparent sm:text-2xl"
            />
            <Button type="submit" size="icon" className="size-10 min-h-10 shrink-0" disabled={submitting || !account} aria-label={submitting ? "Looking up" : "Look up and save"}>
              {submitting ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowUpRight className="size-4" aria-hidden="true" />}
            </Button>
          </div>
          <div className="mt-2 min-h-5 text-left text-xs">
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
    </section>
  );
}
