"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Check, CornerDownLeft, LoaderCircle, RotateCcw, Volume2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { LanguageBadge } from "@/components/language-badge";
import { Button } from "@/components/ui/button";
import { useOwnerSession } from "@/hooks/use-owner-session";
import { useSpeech } from "@/hooks/use-speech";
import { languageNames } from "@/lib/constants";
import { getUserErrorMessage } from "@/lib/errors";
import { formatPhonetic } from "@/lib/phonetics";
import { genderLabel } from "@/lib/parts-of-speech";
import { cn } from "@/lib/utils";
import type { WordDocument } from "@/lib/types";

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
}

function ReviewCardBack({ word }: { word: WordDocument }) {
  const isJapanese = word.language === "JA";

  return (
    <div className="w-full text-left">
      <p lang={isJapanese ? "ja-JP" : undefined} className={cn("mb-7 text-center font-ipa text-sm text-muted-foreground", isJapanese && "font-ja")}>{formatPhonetic(word.phonetic, word.language)}</p>
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
          {word.grammar.gender ? <span>{genderLabel(word.language, word.grammar.gender)}</span> : null}
          {word.grammar.infinitive ? <span>动词不定式 · <b className="font-serif font-normal text-foreground">{word.grammar.infinitive}</b></span> : null}
          {word.grammar.baseForm && word.grammar.baseForm !== word.grammar.infinitive ? <span>词典原形 · <b className="font-serif font-normal text-foreground">{word.grammar.baseForm}</b></span> : null}
          {word.grammar.noteZh ? <span lang="zh-CN" className="basis-full">{word.grammar.noteZh}</span> : null}
        </div>
      ) : <div className="my-7 border-t border-border" />}
      <div className="space-y-5">
        {word.examples.map((example, index) => (
          <blockquote key={`${example.target}-${index}`} className="border-l border-border pl-4">
            <p lang={isJapanese ? "ja-JP" : undefined} className={cn("font-serif text-lg leading-6", isJapanese && "font-ja tracking-normal")}>{example.target}</p>
            <p lang="zh-CN" className="mt-1 text-xs leading-5 text-muted-foreground">{example.translationZh}</p>
          </blockquote>
        ))}
      </div>
    </div>
  );
}

export function ReviewSession() {
  const account = useOwnerSession();
  const router = useRouter();
  const language = account?.preferredLanguage;
  const [dayStartMs] = useState(() => new Date().setHours(0, 0, 0, 0));
  const queue = useQuery(
    api.words.getDueQueue,
    language ? { language, dayStartMs } : "skip",
  );
  const gradeWord = useMutation(api.words.gradeWord);
  const { available: speechAvailable, speak } = useSpeech();
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
  );
  const attemptCounts = useRef<Record<string, number>>({});
  const cardRenderTime = useRef<number>(0);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set());
  // Forgotten cards come back at the end of the session for practice.
  const [relearning, setRelearning] = useState<WordDocument[]>([]);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [rating, setRating] = useState(false);
  const dueCard = queue?.find((word) => !reviewedIds.has(word._id));
  const current = dueCard ?? relearning[0];
  const isRelearning = dueCard === undefined && current !== undefined;
  const flipped = current !== undefined && flippedId === current._id;

  useEffect(() => {
    cardRenderTime.current = Date.now();
  }, [current?._id]);

  const playCurrent = useCallback(() => {
    if (current) speak(current.word, current.language);
  }, [current, speak]);

  const rateCurrent = useCallback(
    async (outcome: "forgot" | "remembered") => {
      if (!current || !flipped || rating) return;
      const wordId = current._id;
      const isCorrect = outcome === "remembered";
      const attemptNo = (attemptCounts.current[wordId] ?? 0) + 1;
      attemptCounts.current[wordId] = attemptNo;
      const questionId = `${sessionId}:${wordId}:${attemptNo}`;
      const responseMs = cardRenderTime.current > 0 ? Math.max(100, Date.now() - cardRenderTime.current) : 1000;

      setRating(true);
      try {
        await gradeWord({
          id: wordId,
          sessionId,
          questionId,
          correct: isCorrect,
          questionType: "recall",
          responseMs,
          dayStartMs,
        });

        if (isRelearning) {
          setRelearning((cards) => (outcome === "forgot" ? [...cards.slice(1), cards[0]] : cards.slice(1)));
        } else {
          setReviewedIds((existing) => new Set(existing).add(wordId));
          if (outcome === "forgot") setRelearning((cards) => [...cards, current]);
        }
        setFlippedId(null);
      } catch (error) {
        toast.error(getUserErrorMessage(error));
      } finally {
        setRating(false);
      }
    },
    [current, dayStartMs, flipped, gradeWord, isRelearning, rating, sessionId],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        router.push("/");
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
  }, [current, playCurrent, rateCurrent, router]);

  if (!language || queue === undefined) {
    return <main className="grid min-h-dvh place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-5 animate-spin text-muted-foreground motion-reduce:animate-none" /><p className="mt-4 text-sm text-muted-foreground">正在准备今日复习卡片…</p></div></main>;
  }

  if (!current) {
    const reviewedCount = reviewedIds.size;
    return (
      <main className="grid min-h-dvh place-items-center px-5 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid size-12 place-items-center rounded-full border border-border"><Check className="size-5" aria-hidden="true" /></span>
          <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{languageNames[language]}复习完成</p>
          <h1 className="mt-3 font-serif text-4xl tracking-[-0.04em]">今天的所有复习已完成</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{reviewedCount > 0 ? `本次已复习 ${reviewedCount} 个词汇。` : `当前没有需要复习的${languageNames[language]}词汇。`}</p>
          <Button asChild className="mt-8"><Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />返回生词本</Link></Button>
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
  const progress = isRelearning ? 100 : total > 0 ? ((position - 1) / total) * 100 : 100;

  return (
    <main className="flex min-h-dvh flex-col px-5 py-5 sm:px-8 sm:py-7">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />退出</Link></Button>
        <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
          {isRelearning
            ? `${languageNames[language]} · 重新强化 · 剩余 ${relearning.length} 词`
            : `${languageNames[language]} · 待复习 · ${String(position).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}
        </p>
        <Button type="button" variant="ghost" size="icon" onClick={playCurrent} disabled={!speechAvailable} aria-label={`朗读 ${current.word}`} title={speechAvailable ? "按空格键播放发音" : "当前浏览器不支持语音朗读"}><Volume2 className="size-4" /></Button>
      </header>

      <div className="mx-auto mt-4 h-px w-full max-w-5xl bg-border"><div className="h-px bg-foreground transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center py-10" aria-live="polite">
        <button
          type="button"
          onClick={() => setFlippedId(flipped ? null : current._id)}
          className="group flex min-h-[26rem] w-full items-center justify-center border-y border-border px-4 py-12 text-center outline-none transition-colors hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[30rem] sm:px-14 motion-reduce:transition-none"
          aria-label={flipped ? "显示卡片正面" : "显示卡片背面"}
          aria-pressed={flipped}
        >
          {flipped ? (
            <ReviewCardBack word={current} />
          ) : (
            <div>
              <LanguageBadge language={current.language} />
              <h1
                lang={current.language === "JA" ? "ja-JP" : undefined}
                className={cn(
                  "mt-8 font-serif text-[clamp(3.5rem,12vw,7.5rem)] font-normal leading-none tracking-[-0.055em]",
                  current.language === "JA" && "font-ja py-[0.08em] leading-[1.18] tracking-normal",
                )}
              >
                {current.word}
              </h1>
              <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground"><CornerDownLeft className="size-3.5" aria-hidden="true" />Enter · 翻转卡片</p>
            </div>
          )}
        </button>

        <div className={cn("mt-7 grid w-full grid-cols-2 gap-3 transition-opacity motion-reduce:transition-none", !flipped && "pointer-events-none opacity-35")} aria-hidden={!flipped}>
          <Button type="button" variant="outline" className="h-14" onClick={() => void rateCurrent("forgot")} disabled={!flipped || rating}><RotateCcw className="size-4" aria-hidden="true" />没记住 <kbd className="ml-auto font-mono text-[10px] text-muted-foreground">1</kbd></Button>
          <Button type="button" className="h-14" onClick={() => void rateCurrent("remembered")} disabled={!flipped || rating}><Check className="size-4" aria-hidden="true" />记住了 <kbd className="ml-auto font-mono text-[10px] opacity-65">2</kbd></Button>
        </div>
      </section>

      <footer className="mx-auto hidden w-full max-w-5xl justify-center gap-6 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:flex">
        <span>空格 · 朗读</span><span>Enter · 翻转</span><span>Esc · 退出</span>
      </footer>
    </main>
  );
}
