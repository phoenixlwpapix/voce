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
  z.minLength(1, "请输入要查询的词语。"),
  z.maxLength(maxWordLength, `请输入不超过 ${maxWordLength} 个字符。`),
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
  const [submittingTarget, setSubmittingTarget] = useState<string | null>(null);
  const submitting = submittingTarget !== null;
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
    setSubmittingTarget("lookup");
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
      setSubmittingTarget(null);
    }
  }

  async function submitWord(
    inputWord: string,
    selectedLanguage: Language,
    valueOnFailure = inputWord,
    saveInflected = false,
    targetKey = "lookup",
  ) {
    if (submissionLock.current || !account || languageSwitching) return;

    const validation = inputSchema.safeParse(inputWord);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "输入无效。");
      return;
    }
    if (!navigator.onLine) {
      setError("当前处于离线状态，请检查网络连接后重试。");
      return;
    }

    submissionLock.current = true;
    setSubmittingTarget(targetKey);
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
        setError(`未在${languageNames[selectedLanguage]}中找到该词，请检查拼写后重试。`);
        return;
      }
      setSpelling(null);
      setFormChoice(null);
      setValue("");
      toast.success(result.status === "created" ? `已添加 ${result.word}` : `${result.word} 已在生词本中`, {
        description: result.status === "created"
          ? "已收录至本月词汇。"
          : "已有词条保持不变。",
      });
    } catch (caughtError) {
      setError(getUserErrorMessage(caughtError));
    } finally {
      submissionLock.current = false;
      setSubmittingTarget(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-5 pt-4 sm:px-8 sm:pb-9 sm:pt-9 lg:pb-10 lg:pt-10" aria-labelledby="lookup-title">
      <div className="grid gap-5 border-b border-border/70 pb-5 sm:gap-7 sm:pb-9 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(26rem,1.2fr)] lg:items-end lg:gap-16">
        <div>
          <h1 id="lookup-title" className="max-w-xl font-serif text-[clamp(1.9rem,8vw,2.75rem)] font-normal leading-[0.98] tracking-[-0.055em] sm:text-[clamp(2.35rem,6vw,4.25rem)] sm:leading-[0.94]">
            今天想记点什么？
          </h1>
        </div>

        <form onSubmit={handleSubmit} noValidate className="self-end">
          <fieldset className="mb-2 flex gap-1 sm:mb-3" disabled={submitting || languageSwitching || !account}>
            <legend className="sr-only">选择词汇语种</legend>
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
              {mode === "chinese" ? `输入中文反查${languageNames[language]}表达` : `输入${languageNames[language]}词语`}
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
              className={cn(
                "min-w-0 flex-1 border-b-0 font-serif text-lg focus:border-transparent sm:text-2xl placeholder:text-base sm:placeholder:text-lg",
                mode === "chinese" && "placeholder:font-sans",
              )}
            />
            <button
              type="button"
              onClick={() => changeMode(mode === "foreign" ? "chinese" : "foreign")}
              disabled={submitting || languageSwitching}
              className="flex min-h-10 shrink-0 items-center gap-1 border-l border-border/70 px-2 font-mono text-[10px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
              aria-label={`切换查词方向为 ${mode === "foreign" ? `中文 → ${languageNames[language]}` : `${languageNames[language]} → 中文`}`}
              title="切换查词方向"
            >
              <span>{!languageKnown ? "→ 中文" : mode === "foreign" ? `${language} → 中文` : `中文 → ${language}`}</span>
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
            </button>
            <Button type="submit" size="icon" className="size-10 min-h-10 shrink-0" disabled={submitting || languageSwitching || !account} aria-label={submitting ? "查询中" : mode === "chinese" ? "反查词汇" : "查询并保存"}>
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
          <DialogTitle>检查拼写</DialogTitle>
          <DialogDescription>
            尚未为“{spelling?.inputWord}”保存任何内容。你想查的是不是以下词语？
          </DialogDescription>
          <div className="mt-6 space-y-3">
            {spelling?.suggestions.map((candidate, index) => {
              const targetKey = `spelling:${candidate.word}-${index}`;
              const isTargetSubmitting = submittingTarget === targetKey;
              return (
                <div key={index} className="border border-border p-4">
                  <p
                    className={cn(
                      "font-serif text-2xl",
                      candidate.language === "JA" && "font-ja",
                    )}
                    lang={localeByLanguage[candidate.language]}
                  >
                    {candidate.word}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{languageNames[candidate.language]}</p>
                  <p className="mt-2 text-sm" lang="zh-CN">{candidate.meaningZh}</p>
                  <Button
                    className="mt-3 w-full"
                    disabled={submitting}
                    onClick={() => void submitWord(candidate.word, candidate.language, undefined, false, targetKey)}
                  >
                    {isTargetSubmitting ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        <span>正在保存…</span>
                      </>
                    ) : (
                      `保存 ${candidate.word}`
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
          {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
          <Button variant="ghost" className="mt-4" disabled={submitting} onClick={() => setSpelling(null)}>返回修改</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={formChoice !== null} onOpenChange={(open) => { if (!open && !submitting) setFormChoice(null); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto" onCloseAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}>
          <DialogTitle>发现词典原形</DialogTitle>
          <DialogDescription>
            尚未为“{formChoice?.inputWord}”保存任何内容。是否保存该词的词典原形？
          </DialogDescription>
          <div className="mt-6 space-y-3">
            <div className="border border-border bg-secondary/35 p-4">
              <div className="flex items-baseline justify-between gap-4">
                <p
                  className={cn(
                    "font-serif text-2xl",
                    formChoice?.language === "JA" && "font-ja",
                  )}
                  lang={formChoice ? localeByLanguage[formChoice.language] : undefined}
                >
                  {formChoice?.baseForm}
                </p>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground border border-border bg-background px-2 py-0.5">
                  词典原形
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formChoice ? languageNames[formChoice.language] : ""}
              </p>
              <p className="mt-2 text-sm" lang="zh-CN">
                {formChoice?.meaningZh}
              </p>
              <Button
                className="mt-3 w-full"
                disabled={submitting}
                onClick={() => {
                  if (formChoice) void submitWord(formChoice.baseForm, formChoice.language, undefined, false, "form:base");
                }}
              >
                {submittingTarget === "form:base" ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    <span>正在保存…</span>
                  </>
                ) : (
                  `保存原形 · ${formChoice?.baseForm}`
                )}
              </Button>
            </div>

            <div className="border border-border/70 p-4">
              <div className="flex items-baseline justify-between gap-4">
                <p
                  className={cn(
                    "font-serif text-xl text-muted-foreground",
                    formChoice?.language === "JA" && "font-ja",
                  )}
                  lang={formChoice ? localeByLanguage[formChoice.language] : undefined}
                >
                  {formChoice?.inputWord}
                </p>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  输入原样
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                保留你输入的当前变体形式
              </p>
              <Button
                variant="outline"
                className="mt-3 w-full"
                disabled={submitting}
                onClick={() => {
                  if (formChoice) void submitWord(formChoice.inputWord, formChoice.language, formChoice.inputWord, true, "form:input");
                }}
              >
                {submittingTarget === "form:input" ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    <span>正在保存…</span>
                  </>
                ) : (
                  `保存当前形式 · ${formChoice?.inputWord}`
                )}
              </Button>
            </div>
          </div>
          {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
          <Button variant="ghost" className="mt-4" disabled={submitting} onClick={() => setFormChoice(null)}>返回修改</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={translation !== null} onOpenChange={(open) => { if (!open && !submitting) setTranslation(null); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto" onCloseAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}>
          <DialogTitle>选择{translation ? languageNames[language] : "目标"}表达</DialogTitle>
          <DialogDescription>
            “{translation?.queryZh}”的常用表达。在你选择前不会保存任何内容。
          </DialogDescription>
          <div className="mt-6 space-y-3">
            {translation?.candidates.map((candidate, index) => {
              const targetKey = `translation:${candidate.word}-${index}`;
              const isTargetSubmitting = submittingTarget === targetKey;
              return (
                <div key={`${candidate.word}-${index}`} className="border border-border p-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <p
                      className={cn(
                        "font-serif text-2xl",
                        language === "JA" && "font-ja",
                      )}
                      lang={localeByLanguage[language]}
                    >
                      {candidate.word}
                    </p>
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
                      void submitWord(candidate.word, language, originalQuery, false, targetKey);
                    }}
                  >
                    {isTargetSubmitting ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        <span>正在保存…</span>
                      </>
                    ) : (
                      `保存 ${candidate.word}`
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
          {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
          <Button variant="ghost" className="mt-4" disabled={submitting} onClick={() => setTranslation(null)}>返回修改</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
