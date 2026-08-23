"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, CalendarRange, Check, CornerDownLeft, LoaderCircle, RotateCcw, Volume2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { LanguageBadge } from "@/components/language-badge";
import { Button } from "@/components/ui/button";
import { useSpeech } from "@/hooks/use-speech";
import { getUserErrorMessage } from "@/lib/errors";
import { getLocalMonthGroup } from "@/lib/month";
import { formatPhonetic } from "@/lib/phonetics";
import { cn } from "@/lib/utils";
import type { Language, WordDocument } from "@/lib/types";

const genderLabel = { masculine: "Masculine", feminine: "Feminine", neutral: "Neutral" } as const;

type ReviewRange = "currentMonth" | "threeMonths" | "all";
type ReviewConfig = { language: Language; range: ReviewRange };

const reviewRangeOptions: Array<{
  value: ReviewRange;
  label: string;
  description: string;
}> = [
  { value: "currentMonth", label: "This month", description: "Due words added this month" },
  { value: "threeMonths", label: "Last 3 months", description: "Due words added during the last three calendar months" },
  { value: "all", label: "All time", description: "All due words in your collection" },
];

const reviewRangeLabels: Record<ReviewRange, string> = {
  currentMonth: "This month",
  threeMonths: "Last 3 months",
  all: "All time",
};

const languageSelectionClasses: Record<Language, string> = {
  EN: "data-[active=true]:text-en",
  FR: "data-[active=true]:text-fr",
  ES: "data-[active=true]:text-es",
};

function getRangeCutoff(range: ReviewRange, timestamp: number) {
  if (range === "all") return null;
  const cutoffDate = new Date(timestamp);
  cutoffDate.setDate(1);
  if (range === "threeMonths") cutoffDate.setMonth(cutoffDate.getMonth() - 2);
  return getLocalMonthGroup(cutoffDate);
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
}

function ReviewSetup({ onStart }: { onStart: (config: ReviewConfig) => void }) {
  const [language, setLanguage] = useState<Language>("EN");
  const [range, setRange] = useState<ReviewRange>("currentMonth");

  return (
    <main className="flex min-h-dvh flex-col px-5 py-5 sm:px-8 sm:py-7">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />Back to lexicon</Link>
        </Button>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Review setup</p>
      </header>

      <section className="mx-auto flex w-full max-w-xl flex-1 items-center py-12" aria-labelledby="review-setup-title">
        <div className="w-full">
          <div className="mb-10 text-center">
            <CalendarRange className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <h1 id="review-setup-title" className="mt-5 font-serif text-4xl tracking-[-0.045em] sm:text-5xl">Choose today&apos;s review set</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Only due words matching both choices will be included.</p>
          </div>

          <fieldset>
            <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Language</legend>
            <div className="grid grid-cols-3 border-y border-border">
              {(["EN", "FR", "ES"] as const).map((item, index) => (
                <button
                  key={item}
                  type="button"
                  data-active={language === item}
                  onClick={() => setLanguage(item)}
                  className={cn(
                    "h-12 border-border font-mono text-xs tracking-[0.16em] text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[active=true]:bg-secondary data-[active=true]:font-medium motion-reduce:transition-none",
                    index < 2 && "border-r",
                    languageSelectionClasses[item],
                  )}
                  aria-pressed={language === item}
                >
                  {item}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-8">
            <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Time range</legend>
            <div className="border-t border-border">
              {reviewRangeOptions.map((option) => {
                const selected = range === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRange(option.value)}
                    className="grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-1 text-left outline-none transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
                    aria-pressed={selected}
                  >
                    <span>
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                    </span>
                    <span className={cn("grid size-5 place-items-center border border-border", selected && "border-foreground bg-foreground text-background")} aria-hidden="true">
                      {selected ? <Check className="size-3" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button type="button" className="mt-8 w-full" onClick={() => onStart({ language, range })}>
            Start review · {language} · {reviewRangeLabels[range]}
          </Button>
        </div>
      </section>
    </main>
  );
}

function ReviewCardBack({ word }: { word: WordDocument }) {
  return (
    <div className="w-full text-left">
      <p className="mb-7 text-center font-mono text-sm text-muted-foreground">{formatPhonetic(word.phonetic)}</p>
      <div className="space-y-3">
        {word.definitions.map((definition, index) => (
          <div key={`${definition.partOfSpeech}-${index}`} className="grid grid-cols-[2rem_1fr] gap-2 text-sm leading-6 sm:text-base">
            <span className="font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
            <p><i className="mr-2 text-muted-foreground">{definition.partOfSpeech}</i><span lang="zh-CN">{definition.meaningZh}</span></p>
          </div>
        ))}
      </div>
      {word.grammar ? (
        <div className="my-7 flex flex-wrap gap-x-5 gap-y-2 border-y border-border py-4 text-xs text-muted-foreground">
          {word.grammar.gender ? <span>{genderLabel[word.grammar.gender]}</span> : null}
          {word.grammar.infinitive ? <span>Infinitive · <b className="font-serif font-normal text-foreground">{word.grammar.infinitive}</b></span> : null}
          {word.grammar.noteZh ? <span lang="zh-CN" className="basis-full">{word.grammar.noteZh}</span> : null}
        </div>
      ) : <div className="my-7 border-t border-border" />}
      <div className="space-y-5">
        {word.examples.map((example, index) => (
          <blockquote key={`${example.target}-${index}`} className="border-l border-border pl-4">
            <p className="font-serif text-lg leading-6">{example.target}</p>
            <p lang="zh-CN" className="mt-1 text-xs leading-5 text-muted-foreground">{example.translationZh}</p>
          </blockquote>
        ))}
      </div>
    </div>
  );
}

export function ReviewSession() {
  const router = useRouter();
  const [reviewConfig, setReviewConfig] = useState<ReviewConfig | null>(null);
  const [queryTime, setQueryTime] = useState(() => Date.now());
  const rawQueue = useQuery(
    api.words.getReviewQueue,
    reviewConfig ? { now: queryTime } : "skip",
  );
  const updateReviewState = useMutation(api.words.updateReviewState);
  const { available: speechAvailable, speak } = useSpeech();
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set());
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [rating, setRating] = useState(false);
  const queue = useMemo(() => {
    if (!rawQueue || !reviewConfig) return rawQueue;
    const cutoff = getRangeCutoff(reviewConfig.range, queryTime);
    return rawQueue.filter(
      (word) =>
        word.language === reviewConfig.language &&
        (cutoff === null || word.monthGroup >= cutoff),
    );
  }, [queryTime, rawQueue, reviewConfig]);
  const current = queue?.find((word) => !reviewedIds.has(word._id));
  const flipped = current !== undefined && flippedId === current._id;

  const startReview = useCallback((config: ReviewConfig) => {
    setQueryTime(Date.now());
    setReviewedIds(new Set());
    setFlippedId(null);
    setReviewConfig(config);
  }, []);

  const resetSelection = useCallback(() => {
    setReviewedIds(new Set());
    setFlippedId(null);
    setReviewConfig(null);
  }, []);

  const playCurrent = useCallback(() => {
    if (current) speak(current.word, current.language);
  }, [current, speak]);

  const rateCurrent = useCallback(
    async (outcome: "forgot" | "remembered") => {
      if (!current || !flipped || rating) return;
      setRating(true);
      try {
        await updateReviewState({ id: current._id, outcome });
        setReviewedIds((existing) => new Set(existing).add(current._id));
        setFlippedId(null);
      } catch (error) {
        toast.error(getUserErrorMessage(error));
      } finally {
        setRating(false);
      }
    },
    [current, flipped, rating, updateReviewState],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        router.push("/");
      } else if (!reviewConfig) {
        return;
      } else if (event.code === "Space") {
        event.preventDefault();
        playCurrent();
      } else if (event.key === "Enter" && current) {
        event.preventDefault();
        setFlippedId((value) => (value === current._id ? null : current._id));
      } else if (!event.repeat && event.key === "1") {
        event.preventDefault();
        void rateCurrent("forgot");
      } else if (!event.repeat && event.key === "2") {
        event.preventDefault();
        void rateCurrent("remembered");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [current, playCurrent, rateCurrent, reviewConfig, router]);

  if (!reviewConfig) {
    return <ReviewSetup onStart={startReview} />;
  }

  if (queue === undefined) {
    return <main className="grid min-h-dvh place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-5 animate-spin text-muted-foreground motion-reduce:animate-none" /><p className="mt-4 text-sm text-muted-foreground">Preparing today&apos;s cards…</p></div></main>;
  }

  if (!current) {
    const reviewedCount = reviewedIds.size;
    return (
      <main className="grid min-h-dvh place-items-center px-5 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid size-12 place-items-center rounded-full border border-border"><Check className="size-5" aria-hidden="true" /></span>
          <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Review complete</p>
          <h1 className="mt-3 font-serif text-4xl tracking-[-0.04em]">That&apos;s all for today.</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{reviewedCount > 0 ? `You reviewed ${reviewedCount} ${reviewedCount === 1 ? "word" : "words"}.` : "No due words match this language and time range."}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button type="button" variant="outline" onClick={resetSelection}>Choose again</Button>
            <Button asChild><Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />Back to lexicon</Link></Button>
          </div>
        </div>
      </main>
    );
  }

  const remainingCount = queue.reduce(
    (count, word) => count + (reviewedIds.has(word._id) ? 0 : 1),
    0,
  );
  const total = reviewedIds.size + remainingCount;
  const position = Math.min(reviewedIds.size + 1, Math.max(total, 1));
  const progress = total > 0 ? ((position - 1) / total) * 100 : 100;

  return (
    <main className="flex min-h-dvh flex-col px-5 py-5 sm:px-8 sm:py-7">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />Exit</Link></Button>
        <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">{reviewConfig.language} · {reviewRangeLabels[reviewConfig.range]} · {String(position).padStart(2, "0")} / {String(total).padStart(2, "0")}</p>
        <Button type="button" variant="ghost" size="icon" onClick={playCurrent} disabled={!speechAvailable} aria-label={`Pronounce ${current.word}`} title={speechAvailable ? "Press Space to pronounce" : "Speech is unavailable in this browser"}><Volume2 className="size-4" /></Button>
      </header>

      <div className="mx-auto mt-4 h-px w-full max-w-5xl bg-border"><div className="h-px bg-foreground transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center py-10" aria-live="polite">
        <button
          type="button"
          onClick={() => setFlippedId(flipped ? null : current._id)}
          className="group flex min-h-[26rem] w-full items-center justify-center border-y border-border px-4 py-12 text-center outline-none transition-colors hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[30rem] sm:px-14 motion-reduce:transition-none"
          aria-label={flipped ? "Show card front" : "Show card back"}
          aria-pressed={flipped}
        >
          {flipped ? (
            <ReviewCardBack word={current} />
          ) : (
            <div>
              <LanguageBadge language={current.language} />
              <h1 className="mt-8 font-serif text-[clamp(3.5rem,12vw,7.5rem)] font-normal leading-none tracking-[-0.055em]">{current.word}</h1>
              <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground"><CornerDownLeft className="size-3.5" aria-hidden="true" />Enter · Flip</p>
            </div>
          )}
        </button>

        <div className={cn("mt-7 grid w-full grid-cols-2 gap-3 transition-opacity motion-reduce:transition-none", !flipped && "pointer-events-none opacity-35")} aria-hidden={!flipped}>
          <Button type="button" variant="outline" className="h-14" onClick={() => void rateCurrent("forgot")} disabled={!flipped || rating}><RotateCcw className="size-4" aria-hidden="true" />Forgot <kbd className="ml-auto font-mono text-[10px] text-muted-foreground">1</kbd></Button>
          <Button type="button" className="h-14" onClick={() => void rateCurrent("remembered")} disabled={!flipped || rating}><Check className="size-4" aria-hidden="true" />Remembered <kbd className="ml-auto font-mono text-[10px] opacity-65">2</kbd></Button>
        </div>
      </section>

      <footer className="mx-auto hidden w-full max-w-5xl justify-center gap-6 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:flex">
        <span>Space · Pronounce</span><span>Enter · Flip</span><span>Esc · Exit</span>
      </footer>
    </main>
  );
}
