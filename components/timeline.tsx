"use client";

import { useQuery } from "convex/react";
import { BookDashed, CalendarDays, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { WordRow } from "@/components/word-row";
import { useSpeech } from "@/hooks/use-speech";
import { formatMonthGroup } from "@/lib/month";
import type { Language, WordDocument } from "@/lib/types";

type MonthSection = { monthGroup: string; words: WordDocument[] };

function groupWords(words: WordDocument[]) {
  const grouped = new Map<string, WordDocument[]>();
  for (const word of words) {
    const existing = grouped.get(word.monthGroup);
    if (existing) existing.push(word);
    else grouped.set(word.monthGroup, [word]);
  }
  return Array.from(grouped, ([monthGroup, monthWords]) => ({ monthGroup, words: monthWords })).sort((a, b) =>
    b.monthGroup.localeCompare(a.monthGroup),
  );
}

export function Timeline({ language }: { language: Language }) {
  const words = useQuery(api.words.getWordsByMonth, {});
  const { available: speechAvailable, speak } = useSpeech();
  const [filterMonth, setFilterMonth] = useState("");
  const { languageWords, sections } = useMemo<{
    languageWords: WordDocument[];
    sections: MonthSection[];
  }>(() => {
    if (!words) return { languageWords: [], sections: [] };
    const matchingLanguage = words.filter((word) => word.language === language);
    const visibleWords = filterMonth
      ? matchingLanguage.filter((word) => word.monthGroup === filterMonth)
      : matchingLanguage;
    return { languageWords: matchingLanguage, sections: groupWords(visibleWords) };
  }, [filterMonth, language, words]);

  if (words === undefined) {
    return (
      <section className="mx-auto min-h-72 max-w-5xl px-5 py-20 text-center sm:px-8" aria-busy="true">
        <LoaderCircle className="mx-auto size-5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
        <p className="mt-4 text-sm text-muted-foreground">正在翻开你的词汇簿…</p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-24 sm:px-8 sm:pb-32" aria-labelledby="timeline-title">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b border-border pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Archive · {language} · {languageWords.length} words</p>
          <h2 id="timeline-title" className="mt-2 font-serif text-3xl tracking-[-0.03em]">词汇时间线</h2>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="month-filter" className="sr-only">按月份筛选</label>
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            id="month-filter"
            type="month"
            value={filterMonth}
            onChange={(event) => setFilterMonth(event.target.value)}
            className="h-10 border-0 border-b border-border bg-transparent px-1 font-mono text-xs text-foreground outline-none focus:border-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          {filterMonth ? <Button type="button" variant="ghost" size="sm" onClick={() => setFilterMonth("")}>全部</Button> : null}
        </div>
      </div>

      {languageWords.length === 0 ? (
        <div className="grid min-h-72 place-items-center border-b border-border text-center">
          <div className="max-w-sm py-14">
            <BookDashed className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
            <h3 className="mt-5 font-serif text-2xl">{language} 的第一页还空着</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">切换到上方输入框，收录这个语种的第一个单词。</p>
          </div>
        </div>
      ) : sections.length === 0 ? (
        <div className="grid min-h-64 place-items-center border-b border-border text-center">
          <div>
            <p className="font-serif text-xl">{formatMonthGroup(filterMonth)} 没有 {language} 词条</p>
            <Button type="button" variant="ghost" className="mt-3" onClick={() => setFilterMonth("")}>查看所有月份</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-16">
          {sections.map((section) => (
            <section key={section.monthGroup} aria-labelledby={`month-${section.monthGroup}`}>
              <div className="mb-1 flex items-baseline justify-between">
                <h3 id={`month-${section.monthGroup}`} className="font-mono text-sm tracking-[0.14em]">{formatMonthGroup(section.monthGroup)}</h3>
                <span className="font-mono text-[10px] text-muted-foreground">{section.words.length.toString().padStart(2, "0")}</span>
              </div>
              <div className="border-t border-foreground/70">
                {section.words.map((word) => (
                  <WordRow key={word._id} word={word} speechAvailable={speechAvailable} onSpeak={speak} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
