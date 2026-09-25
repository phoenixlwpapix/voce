"use client";

import { usePaginatedQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useOwnerSession } from "./use-owner-session";
import { getCachedWords, mergeLiveWithCache, setCachedWords, type LexiconCache } from "@/lib/lexicon-cache";
import { logPerf } from "@/lib/perf";
import type { Language } from "@/lib/types";

const firstPageSize = 100;
const nextPageSize = 250;

export function useCachedLexicon(language: Language) {
  const session = useOwnerSession();
  const userId = session?.userId;
  const { results, status, loadMore } = usePaginatedQuery(
    api.words.listWords,
    userId ? { language } : "skip",
    { initialNumItems: firstPageSize },
  );
  const [cache, setCache] = useState<LexiconCache | null>(null);
  const loggedLive = useRef(false);

  useEffect(() => {
    loggedLive.current = false;
    if (!userId) return;
    let active = true;
    void getCachedWords(userId, language).then((result) => {
      if (!active) return;
      setCache(result);
      logPerf("cache loaded");
      logPerf("cache words", result?.words.length ?? 0);
      if (result) logPerf("cache age", `${((Date.now() - result.updatedAt) / 3600000).toFixed(1)}h`);
    });
    return () => { active = false; };
  }, [language, userId]);

  // The timeline filters and searches the whole lexicon, so keep loading.
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(nextPageSize);
  }, [status, loadMore]);

  const complete = Boolean(userId) && status === "Exhausted";
  useEffect(() => {
    if (!userId || !complete) return;
    if (!loggedLive.current) {
      logPerf("convex lexicon complete");
      logPerf("live words", results.length);
      loggedLive.current = true;
    }
    void setCachedWords(userId, language, results);
  }, [complete, language, userId, results]);

  const cachedWords = userId && cache?.userId === userId && cache.language === language ? cache.words : undefined;
  const words = useMemo(() => {
    if (!userId) return undefined;
    // A complete live list is authoritative, including an empty one.
    if (complete) return results;
    if (cachedWords) return mergeLiveWithCache(results, cachedWords);
    return status === "LoadingFirstPage" ? undefined : results;
  }, [cachedWords, complete, results, status, userId]);

  return { words, isInitialLoading: words === undefined, isRefreshing: words !== undefined && !complete };
}
