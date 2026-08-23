"use client";

import { useAction } from "convex/react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { languageNames, localeByLanguage, lookupPlaceholderByLanguage, maxWordLength } from "@/lib/constants";
import { getUserErrorMessage } from "@/lib/errors";
import { getLocalMonthGroup } from "@/lib/month";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/types";

const inputSchema = z.string().trim().min(1, "Enter a word to look up.").max(maxWordLength, `Enter no more than ${maxWordLength} characters.`);

const languagePillClasses: Record<Language, string> = {
  EN: "data-[active=true]:border-en data-[active=true]:text-en",
  FR: "data-[active=true]:border-fr data-[active=true]:text-fr",
  ES: "data-[active=true]:border-es data-[active=true]:text-es",
};

type LookupFormProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
};

export function LookupForm({ language, onLanguageChange }: LookupFormProps) {
  const lookupAndSave = useAction(api.lookup.lookupAndSave);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current) return;

    const validation = inputSchema.safeParse(value);
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
        language,
        monthGroup: getLocalMonthGroup(),
      });
      setValue("");
      toast.success(result.status === "created" ? `Added ${result.word}` : `Refreshed ${result.word}`, {
        description: result.status === "created" ? "Added to this month's collection." : "Your review progress was preserved.",
      });
    } catch (caughtError) {
      setError(getUserErrorMessage(caughtError));
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20" aria-labelledby="lookup-title">
      <div className="mb-9 text-center">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">A quiet place for words</p>
        <h1 id="lookup-title" className="font-serif text-[clamp(2.35rem,8vw,5.25rem)] font-normal leading-[0.95] tracking-[-0.055em]">
          What will you<br />remember today?
        </h1>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <fieldset className="mb-4 flex justify-center gap-2" disabled={submitting}>
          <legend className="sr-only">Choose vocabulary language</legend>
          {(["EN", "FR", "ES"] as const).map((item) => (
            <button
              key={item}
              type="button"
              data-active={language === item}
              onClick={() => onLanguageChange(item)}
              className={cn(
                "min-h-10 border-b border-transparent px-4 font-mono text-[11px] tracking-[0.16em] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:text-foreground motion-reduce:transition-none",
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
          <Button type="submit" size="icon" className="size-10 min-h-10 shrink-0" disabled={submitting} aria-label={submitting ? "Looking up" : "Look up and save"}>
            {submitting ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowUpRight className="size-4" aria-hidden="true" />}
          </Button>
        </div>
        <div className="mt-3 min-h-5 text-center text-xs">
          {error ? <p id="lookup-error" role="alert" className="text-destructive">{error}</p> : null}
        </div>
      </form>
    </section>
  );
}
