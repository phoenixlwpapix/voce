"use client";

import { ArrowLeft, ArrowRight, Check, LoaderCircle, RotateCcw, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { useCachedLexicon } from "@/hooks/use-cached-lexicon";
import { useOwnerSession } from "@/hooks/use-owner-session";
import { useSpeech } from "@/hooks/use-speech";
import { languageNames, localeByLanguage } from "@/lib/constants";
import { formatPhonetic } from "@/lib/phonetics";
import { buildQuiz, minimumQuizWords, quizEligibleWords, type QuizMode, type QuizQuestion } from "@/lib/quiz";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { Language, WordDocument } from "@/lib/types";

const questionCounts = [10, 20, 30] as const;
const modes: { value: QuizMode; label: string; description: string }[] = [
  { value: "mixed", label: "混合模式", description: "涵盖所有题型" },
  { value: "meaning", label: "看词识义", description: "外语 → 中文释义" },
  { value: "word", label: "看义选词", description: "中文 → 外语单词" },
  { value: "context", label: "例句填空", description: "根据语境补全例句" },
];
const kindLabels = { meaning: "选择正确的中文释义", word: "选择对应的外语单词", context: "根据语境完成填空" } as const;

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
  const dueCount = useMemo(() => {
    const dayStart = new Date().setHours(0, 0, 0, 0);
    const dayEnd = new Date().setHours(23, 59, 59, 999);
    return words.filter((word) => word.pendingRetryDay === dayStart || word.nextReviewAt <= dayEnd).length;
  }, [words]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-5 sm:px-8 sm:py-7">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />返回</Link></Button>
        <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">{languageNames[language]} · {words.length} 词</p>
      </header>
      <section className="flex flex-1 flex-col justify-center py-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{languageNames[language]}测验</p>
        <h1 className="mt-3 font-serif text-[clamp(2.5rem,9vw,4rem)] leading-[0.95] tracking-[-0.05em]">检验你的词汇积累</h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">基于你个人生词本生成的四选一练习题。优先抽取待复习词汇，边练边推进记忆周期。</p>
        {dueCount > 0 ? (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {dueCount} 个待复习词汇 · 优先测验
          </p>
        ) : null}

        {tooFew ? (
          <p className="mt-10 border-y border-border py-6 text-sm text-muted-foreground">生词本中至少需要保存 {minimumQuizWords} 个{languageNames[language]}词汇才能开始测验。</p>
        ) : (
          <>
            <fieldset className="mt-10">
              <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">题目数量</legend>
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
              <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">题型设置</legend>
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
              开始 {Math.min(count, available)} 题测验<ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            {available < count ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {available === 0
                  ? "已保存的例句中没有包含原形未变的词汇，暂无可用填空题。"
                  : `仅有 ${available} 个词汇符合当前题型要求。`}
              </p>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

function QuizResults({
  language,
  answers,
  gradeResults,
  onRetryMissed,
  onNewQuiz,
}: {
  language: Language;
  answers: Answer[];
  gradeResults: Record<string, { applied: boolean; pendingRetry: boolean; nextReviewAt: number }>;
  onRetryMissed: () => void;
  onNewQuiz: () => void;
}) {
  const missed = answers.filter((answer) => answer.chosenIndex !== answer.question.answerIndex);
  const score = answers.length - missed.length;
  const percent = answers.length ? Math.round((score / answers.length) * 100) : 0;
  const appliedCount = Object.values(gradeResults).filter((r) => r.applied).length;
  const pendingCount = Object.values(gradeResults).filter((r) => r.pendingRetry).length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-5 sm:px-8 sm:py-7">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />返回</Link></Button>
        <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">{languageNames[language]} · 测验完成</p>
      </header>
      <section className="flex flex-1 flex-col justify-center py-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{languageNames[language]}测验完成</p>
        <h1 className="mt-3 font-serif text-6xl tracking-[-0.05em]">{score} <span className="text-muted-foreground">/ {answers.length}</span></h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {percent}% 正确率{missed.length === 0 ? " — 全部答对！" : "。"}
        </p>

        {(appliedCount > 0 || pendingCount > 0) ? (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
            {appliedCount > 0 ? (
              <span>✓ {appliedCount} 个词汇已推进记忆周期 (FSRS)</span>
            ) : null}
            {pendingCount > 0 ? (
              <span className="text-destructive">⚠ {pendingCount} 个词汇需重新复习</span>
            ) : null}
          </div>
        ) : null}

        {missed.length > 0 ? (
          <section className="mt-10 border-t border-border pt-6" aria-labelledby="missed-title">
            <h2 id="missed-title" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">答错词汇</h2>
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
          {missed.length > 0 ? <Button onClick={onRetryMissed}><RotateCcw className="size-4" aria-hidden="true" />重做错题 ({missed.length})</Button> : null}
          <Button variant={missed.length > 0 ? "outline" : "default"} onClick={onNewQuiz}>再来一组</Button>
          <Button asChild variant="ghost"><Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />返回生词本</Link></Button>
        </div>
      </section>
    </main>
  );
}

export function QuizSession() {
  const account = useOwnerSession();
  const router = useRouter();
  const language = account?.preferredLanguage;
  const { words } = useCachedLexicon(language ?? "EN");
  const gradeWord = useMutation(api.words.gradeWord);
  const { available: speechAvailable, speak } = useSpeech();
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [lastMode, setLastMode] = useState<QuizMode>("mixed");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const spokenQuestionId = useRef<string | null>(null);
  const sessionId = useRef<string>("");
  const attemptCounts = useRef<Record<string, number>>({});
  const questionRenderTime = useRef<number>(0);
  const [gradeResults, setGradeResults] = useState<
    Record<string, { applied: boolean; pendingRetry: boolean; nextReviewAt: number }>
  >({});

  const languageWords = useMemo(
    () => (words ?? []).filter((word) => word.language === language),
    [language, words],
  );
  const index = answers.length;
  const current = questions?.[index];
  const finished = questions !== null && current === undefined;

  function start(pool: WordDocument[], count: number, mode: QuizMode, isRetry = false) {
    if (!isRetry) {
      sessionId.current =
        typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      attemptCounts.current = {};
      setGradeResults({});
    }
    setLastMode(mode);
    setQuestions(buildQuiz(pool, languageWords, { count, mode }));
    setAnswers([]);
    setChosenIndex(null);
    spokenQuestionId.current = null;
    questionRenderTime.current = Date.now();
  }

  useEffect(() => {
    questionRenderTime.current = Date.now();
  }, [current?.id]);

  const choose = useCallback((optionIndex: number) => {
    if (!current || chosenIndex !== null) return;
    setChosenIndex(optionIndex);
    const isCorrect = optionIndex === current.answerIndex;
    const responseMs =
      questionRenderTime.current > 0 ? Math.max(100, Date.now() - questionRenderTime.current) : 1000;
    const wordId = current.word._id;
    const attemptNo = (attemptCounts.current[wordId] ?? 0) + 1;
    attemptCounts.current[wordId] = attemptNo;
    const questionId = `${sessionId.current}:${wordId}:${attemptNo}`;
    const dayStartMs = new Date().setHours(0, 0, 0, 0);

    void gradeWord({
      id: wordId,
      sessionId: sessionId.current,
      questionId,
      correct: isCorrect,
      questionType: "choice",
      responseMs,
      dayStartMs,
    })
      .then((res) => {
        setGradeResults((prev) => ({ ...prev, [wordId]: res }));
      })
      .catch((error) => {
        toast.error(getUserErrorMessage(error));
      });
  }, [chosenIndex, current, gradeWord]);

  const next = useCallback(() => {
    if (!current || chosenIndex === null) return;
    setAnswers((existing) => [...existing, { question: current, chosenIndex }]);
    setChosenIndex(null);
  }, [chosenIndex, current]);

  useEffect(() => {
    if (!current || !speechAvailable) return;
    if (current.kind === "meaning" && spokenQuestionId.current !== current.id) {
      spokenQuestionId.current = current.id;
      speak(current.word.word, current.word.language);
    }
  }, [current, speak, speechAvailable]);

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
    return <main className="grid min-h-dvh place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" /><p className="mt-4 text-sm text-muted-foreground">正在准备题目…</p></div></main>;
  }

  if (questions === null) {
    return <QuizSetup language={language} words={languageWords} onStart={(count, mode) => start(languageWords, count, mode)} />;
  }

  if (questions.length === 0) {
    return (
      <main className="grid min-h-dvh place-items-center px-5 text-center">
        <div className="max-w-md">
          <p className="text-sm text-muted-foreground">你的{languageNames[language]}生词暂未包含足够多的不同释义来生成四选一选项。</p>
          <Button variant="outline" className="mt-6" onClick={() => setQuestions(null)}>返回测验设置</Button>
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
        gradeResults={gradeResults}
        onRetryMissed={() => start(missedWords, missedWords.length, lastMode, true)}
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
        <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />退出</Link></Button>
        <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">{languageNames[language]} · 测验 · {String(index + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}</p>
        <Button type="button" variant="ghost" size="icon" onClick={() => speak(question.word.word, question.word.language)}
          disabled={!speechAvailable || (question.kind !== "meaning" && !answered)}
          aria-label={`朗读 ${question.kind === "meaning" || answered ? question.word.word : "正确答案"}`}
          title={question.kind !== "meaning" && !answered ? "答题后可播放发音" : "播放发音"}>
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
                  aria-label={`${optionIndex + 1}. ${option}${answered && isAnswer ? " (正确答案)" : ""}${answered && isChosen && !isAnswer ? " (你的选择)" : ""}`}
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
            {answered ? (correct ? "回答正确。" : <>正确答案是 <b className="font-medium text-foreground">{question.options[question.answerIndex]}</b>。</>) : null}
          </p>
          {answered ? (
            <Button onClick={next} autoFocus>
              {index + 1 === questions.length ? "查看成绩" : "下一题"}<ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </section>

      <footer className="mx-auto hidden w-full max-w-3xl justify-center gap-6 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:flex">
        <span>1–4 · 选择</span><span>Enter · 下一题</span><span>Esc · 退出</span>
      </footer>
    </main>
  );
}
