"use client";

import { ArrowLeft, ArrowRight, Check, LoaderCircle, RotateCcw, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCachedLexicon } from "@/hooks/use-cached-lexicon";
import { useOwnerSession } from "@/hooks/use-owner-session";
import { useSpeech } from "@/hooks/use-speech";
import { languageNames, localeByLanguage } from "@/lib/constants";
import { formatPhonetic } from "@/lib/phonetics";
import { buildQuiz, minimumQuizWords, quizEligibleWords, type QuizMode, type QuizQuestion } from "@/lib/quiz";
import { cn } from "@/lib/utils";
import type { Language, WordDocument } from "@/lib/types";

const questionCounts = [10, 20, 30] as const;
const modes: { value: QuizMode; label: string; description: string }[] = [
  { value: "mixed", label: "Mixed", description: "All question types" },
  { value: "meaning", label: "Word → 中文", description: "Choose the meaning" },
  { value: "word", label: "中文 → Word", description: "Choose the word" },
  { value: "context", label: "Fill the blank", description: "Complete an example" },
];
const kindLabels = { meaning: "Choose the meaning", word: "Choose the word", context: "Fill in the blank" } as const;

type Answer = { question: QuizQuestion; chosenIndex: number };

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
}

function QuizSetup({ language, words, onStart }: {
  language: Language;
  words: WordDocument[];
  onStart: (count: number, mode: QuizMode) => void;
}) {
  const [count, setCount] = useState<number>(20);
  const [mode, setMode] = useState<QuizMode>("mixed");
  const available = quizEligibleWords(words, mode).length;
  const tooFew = words.length < minimumQuizWords;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-5 sm:px-8 sm:py-7">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />Back</Link></Button>
        <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">{language} · {words.length} words</p>
      </header>
      <section className="flex flex-1 flex-col justify-center py-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{languageNames[language]} quiz</p>
        <h1 className="mt-3 font-serif text-[clamp(2.5rem,9vw,4rem)] leading-[0.95] tracking-[-0.05em]">Test what you&apos;ve kept.</h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Multiple-choice questions from your own lexicon. Quizzes are practice only and don&apos;t change your review schedule.</p>

        {tooFew ? (
          <p className="mt-10 border-y border-border py-6 text-sm text-muted-foreground">Save at least {minimumQuizWords} {languageNames[language]} words to start a quiz.</p>
        ) : (
          <>
            <fieldset className="mt-10">
              <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Questions</legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {questionCounts.map((value) => (
                  <button key={value} type="button" onClick={() => setCount(value)} aria-pressed={count === value}
                    className="h-11 border border-border font-mono text-sm outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-foreground aria-pressed:bg-secondary motion-reduce:transition-none">
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-7">
              <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Question type</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {modes.map((option) => (
                  <button key={option.value} type="button" onClick={() => setMode(option.value)} aria-pressed={mode === option.value}
                    className="flex min-h-14 flex-col items-start justify-center border border-border px-4 text-left outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-foreground aria-pressed:bg-secondary motion-reduce:transition-none">
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <Button className="mt-10 h-12" disabled={available === 0} onClick={() => onStart(count, mode)}>
              Start {Math.min(count, available)}-question quiz<ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            {available < count ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {available === 0
                  ? "None of your saved examples contain their headword unchanged, so there are no blanks to fill yet."
                  : `Only ${available} of your words fit this question type.`}
              </p>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

function QuizResults({ language, answers, onRetryMissed, onNewQuiz }: {
  language: Language;
  answers: Answer[];
  onRetryMissed: () => void;
  onNewQuiz: () => void;
}) {
  const missed = answers.filter((answer) => answer.chosenIndex !== answer.question.answerIndex);
  const score = answers.length - missed.length;
  const percent = answers.length ? Math.round((score / answers.length) * 100) : 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{languageNames[language]} quiz complete</p>
      <h1 className="mt-3 font-serif text-6xl tracking-[-0.05em]">{score} <span className="text-muted-foreground">/ {answers.length}</span></h1>
      <p className="mt-3 text-sm text-muted-foreground">{percent}% correct{missed.length === 0 ? " — a clean sheet." : "."}</p>

      {missed.length > 0 ? (
        <section className="mt-10 border-t border-border pt-6" aria-labelledby="missed-title">
          <h2 id="missed-title" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Missed words</h2>
          <ul className="mt-3 divide-y divide-border">
            {missed.map(({ question }) => (
              <li key={question.id} className="flex items-baseline justify-between gap-4 py-3">
                <span lang={localeByLanguage[question.word.language]} className={cn("font-serif text-xl", question.word.language === "JA" && "font-ja")}>{question.word.word}</span>
                <span lang="zh-CN" className="text-right text-sm text-muted-foreground">{question.word.definitions[0]?.meaningZh}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-10 flex flex-wrap gap-3">
        {missed.length > 0 ? <Button onClick={onRetryMissed}><RotateCcw className="size-4" aria-hidden="true" />Retry missed ({missed.length})</Button> : null}
        <Button variant={missed.length > 0 ? "outline" : "default"} onClick={onNewQuiz}>New quiz</Button>
        <Button asChild variant="ghost"><Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />Back to lexicon</Link></Button>
      </div>
    </main>
  );
}

export function QuizSession() {
  const account = useOwnerSession();
  const router = useRouter();
  const language = account?.preferredLanguage;
  const { words } = useCachedLexicon(language ?? "EN");
  const { available: speechAvailable, speak } = useSpeech();
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [lastMode, setLastMode] = useState<QuizMode>("mixed");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);

  const languageWords = useMemo(
    () => (words ?? []).filter((word) => word.language === language),
    [language, words],
  );
  const index = answers.length;
  const current = questions?.[index];
  const finished = questions !== null && current === undefined;

  function start(pool: WordDocument[], count: number, mode: QuizMode) {
    setLastMode(mode);
    setQuestions(buildQuiz(pool, languageWords, { count, mode }));
    setAnswers([]);
    setChosenIndex(null);
  }

  const choose = useCallback((optionIndex: number) => {
    if (!current || chosenIndex !== null) return;
    setChosenIndex(optionIndex);
    if (current.kind !== "word" && optionIndex === current.answerIndex && speechAvailable) {
      speak(current.word.word, current.word.language);
    }
  }, [chosenIndex, current, speak, speechAvailable]);

  const next = useCallback(() => {
    if (!current || chosenIndex === null) return;
    setAnswers((existing) => [...existing, { question: current, chosenIndex }]);
    setChosenIndex(null);
  }, [chosenIndex, current]);

  useEffect(() => {
    if (!current) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target) || event.repeat) return;
      if (event.key === "Escape") {
        event.preventDefault();
        router.push("/");
      } else if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        choose(Number(event.key) - 1);
      } else if (event.key === "Enter" && chosenIndex !== null) {
        event.preventDefault();
        next();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [choose, chosenIndex, current, next, router]);

  if (!language || words === undefined) {
    return <main className="grid min-h-dvh place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" /><p className="mt-4 text-sm text-muted-foreground">Gathering your words…</p></div></main>;
  }

  if (questions === null) {
    return <QuizSetup language={language} words={languageWords} onStart={(count, mode) => start(languageWords, count, mode)} />;
  }

  if (questions.length === 0) {
    return (
      <main className="grid min-h-dvh place-items-center px-5 text-center">
        <div className="max-w-md">
          <p className="text-sm text-muted-foreground">Your {languageNames[language]} words don&apos;t have enough distinct meanings for four-option questions yet.</p>
          <Button variant="outline" className="mt-6" onClick={() => setQuestions(null)}>Back to quiz setup</Button>
        </div>
      </main>
    );
  }

  if (finished) {
    const missedWords = answers
      .filter((answer) => answer.chosenIndex !== answer.question.answerIndex)
      .map((answer) => answer.question.word);
    return (
      <QuizResults
        language={language}
        answers={answers}
        onRetryMissed={() => start(missedWords, missedWords.length, lastMode)}
        onNewQuiz={() => setQuestions(null)}
      />
    );
  }

  const question = current!;
  const answered = chosenIndex !== null;
  const correct = chosenIndex === question.answerIndex;
  const isJapanese = question.word.language === "JA";
  const optionsAreWords = question.kind !== "meaning";
  const progress = (index / questions.length) * 100;

  return (
    <main className="flex min-h-dvh flex-col px-5 py-5 sm:px-8 sm:py-7">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />Exit</Link></Button>
        <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">{language} · Quiz · {String(index + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}</p>
        <Button type="button" variant="ghost" size="icon" onClick={() => speak(question.word.word, question.word.language)}
          disabled={!speechAvailable || (question.kind !== "meaning" && !answered)}
          aria-label={`Pronounce ${question.kind === "meaning" || answered ? question.word.word : "the answer"}`}
          title={question.kind !== "meaning" && !answered ? "Available after you answer" : "Play pronunciation"}>
          <Volume2 className="size-4" aria-hidden="true" />
        </Button>
      </header>

      <div className="mx-auto mt-4 h-px w-full max-w-3xl bg-border"><div className="h-px bg-foreground transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-10" aria-live="polite">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{kindLabels[question.kind]}</p>
        <h1
          lang={question.kind === "word" ? "zh-CN" : localeByLanguage[question.word.language]}
          className={cn(
            "mt-5 text-center font-serif leading-tight tracking-[-0.03em]",
            question.kind === "meaning" ? "text-[clamp(2.75rem,10vw,5.5rem)] leading-none tracking-[-0.05em]" : "text-[clamp(1.6rem,5vw,2.5rem)]",
            isJapanese && question.kind !== "word" && "font-ja tracking-normal",
          )}
        >
          {question.prompt}
        </h1>
        {question.kind === "meaning" ? (
          <p className={cn("mt-4 text-center font-ipa text-sm text-muted-foreground", isJapanese && "font-ja")}>{formatPhonetic(question.word.phonetic, question.word.language)}</p>
        ) : null}
        {question.hint ? <p lang="zh-CN" className="mt-4 text-center text-sm text-muted-foreground">{question.hint}</p> : null}

        <ol className="mt-10 grid gap-2 sm:grid-cols-2">
          {question.options.map((option, optionIndex) => {
            const isAnswer = optionIndex === question.answerIndex;
            const isChosen = optionIndex === chosenIndex;
            return (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => choose(optionIndex)}
                  disabled={answered}
                  aria-label={`${optionIndex + 1}. ${option}${answered && isAnswer ? " (correct answer)" : ""}${answered && isChosen && !isAnswer ? " (your answer)" : ""}`}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 border border-border px-4 py-3 text-left outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent motion-reduce:transition-none",
                    answered && isAnswer && "border-success bg-success/10 disabled:hover:bg-success/10",
                    answered && isChosen && !isAnswer && "border-destructive bg-destructive/8 disabled:hover:bg-destructive/8",
                    answered && !isAnswer && !isChosen && "opacity-50",
                  )}
                >
                  <kbd className="font-mono text-[10px] text-muted-foreground">{optionIndex + 1}</kbd>
                  <span
                    lang={optionsAreWords ? localeByLanguage[question.word.language] : "zh-CN"}
                    className={cn("flex-1", optionsAreWords ? "font-serif text-xl" : "text-sm leading-6", optionsAreWords && isJapanese && "font-ja")}
                  >
                    {option}
                  </span>
                  {answered && isAnswer ? <Check className="size-4 text-success" aria-hidden="true" /> : null}
                  {answered && isChosen && !isAnswer ? <X className="size-4 text-destructive" aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-7 flex min-h-12 items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground" role="status">
            {answered ? (correct ? "Correct." : <>The answer is <b className="font-medium text-foreground">{question.options[question.answerIndex]}</b>.</>) : null}
          </p>
          {answered ? (
            <Button onClick={next} autoFocus>
              {index + 1 === questions.length ? "See results" : "Next"}<ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </section>

      <footer className="mx-auto hidden w-full max-w-3xl justify-center gap-6 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:flex">
        <span>1–4 · Answer</span><span>Enter · Next</span><span>Esc · Exit</span>
      </footer>
    </main>
  );
}
