"use client";

import { useQuery } from "convex/react";
import { BookDashed, CalendarDays, LoaderCircle, Search, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WordRow } from "@/components/word-row";
import { useSpeech } from "@/hooks/use-speech";
import { languageNames, localeByLanguage } from "@/lib/constants";
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

function matchesSearch(word: WordDocument, query: string, language: Language) {
  const normalizedQuery = query.trim().normalize("NFC").toLocaleLowerCase(localeByLanguage[language]);
  if (!normalizedQuery) return true;

  const searchableValues = [
    word.word,
    word.inputWord,
    word.phonetic,
    word.grammar?.infinitive,
    word.grammar?.noteZh,
    ...word.definitions.flatMap((definition) => [definition.partOfSpeech, definition.meaningZh]),
  ];
  return searchableValues.some((value) =>
    value?.normalize("NFC").toLocaleLowerCase(localeByLanguage[language]).includes(normalizedQuery),
  );
}

export function Timeline({ language }: { language: Language }) {
  const words = useQuery(api.words.getWordsByMonth, {});
  const { available: speechAvailable, speak } = useSpeech();
  const [filterMonth, setFilterMonth] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const { languageWords, visibleWordCount, sections } = useMemo<{
    languageWords: WordDocument[];
    visibleWordCount: number;
    sections: MonthSection[];
  }>(() => {
    if (!words) return { languageWords: [], visibleWordCount: 0, sections: [] };
    const matchingLanguage = words.filter((word) => word.language === language);
    const matchingSearch = matchingLanguage.filter((word) =>
      matchesSearch(word, deferredSearchQuery, language),
    );
    const visibleWords = filterMonth
      ? matchingSearch.filter((word) => word.monthGroup === filterMonth)
      : matchingSearch;
    return {
      languageWords: matchingLanguage,
      visibleWordCount: visibleWords.length,
      sections: groupWords(visibleWords),
    };
  }, [deferredSearchQuery, filterMonth, language, words]);
  if (words === undefined) {
    return (
      <section className="mx-auto min-h-72 max-w-5xl px-5 py-20 text-center sm:px-8" aria-busy="true">
        <LoaderCircle className="mx-auto size-5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
        <p className="mt-4 text-sm text-muted-foreground">Opening your lexicon…</p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-24 sm:px-8 sm:pb-32" aria-labelledby="timeline-title">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b border-border pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Archive · {language} · {searchQuery.trim() || filterMonth ? `${visibleWordCount} of ` : ""}{languageWords.length} words
          </p>
          <h2 id="timeline-title" className="mt-2 font-serif text-3xl tracking-[-0.03em]">Vocabulary timeline</h2>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="saved-word-search" className="sr-only">Search saved {languageNames[language]} words</label>
            <Input
              id="saved-word-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={`Search saved ${language} words`}
              maxLength={80}
              autoComplete="off"
              className="h-10 pl-7 pr-8 font-mono text-xs [&::-webkit-search-cancel-button]:appearance-none"
            />
            {searchQuery ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-1/2 size-8 min-h-8 -translate-y-1/2 text-muted-foreground"
                onClick={() => setSearchQuery("")}
                aria-label="Clear saved word search"
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="month-filter" className="sr-only">Filter by month</label>
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
            <input
              id="month-filter"
              type="month"
              lang="en-US"
              value={filterMonth}
              onChange={(event) => setFilterMonth(event.target.value)}
              className="h-10 min-w-0 flex-1 border-0 border-b border-border bg-transparent px-1 font-mono text-xs text-foreground outline-none focus:border-foreground focus-visible:ring-2 focus-visible:ring-ring sm:flex-none"
            />
            {filterMonth ? <Button type="button" variant="ghost" size="sm" onClick={() => setFilterMonth("")}>All</Button> : null}
          </div>
        </div>
      </div>

      {languageWords.length === 0 ? (
        <div className="grid min-h-72 place-items-center border-b border-border text-center">
          <div className="max-w-sm py-14">
            <BookDashed className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
            <h3 className="mt-5 font-serif text-2xl">The first {language} page is still blank</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Use the field above to add your first word in this language.</p>
          </div>
        </div>
      ) : sections.length === 0 ? (
        <div className="grid min-h-64 place-items-center border-b border-border text-center">
          <div>
            {deferredSearchQuery.trim() ? (
              <>
                <p className="font-serif text-xl">No saved {language} words match “{deferredSearchQuery.trim()}”</p>
                <Button type="button" variant="ghost" className="mt-3" onClick={() => setSearchQuery("")}>Clear search</Button>
              </>
            ) : (
              <>
                <p className="font-serif text-xl">No {language} words in {formatMonthGroup(filterMonth)}</p>
                <Button type="button" variant="ghost" className="mt-3" onClick={() => setFilterMonth("")}>View all months</Button>
              </>
            )}
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
