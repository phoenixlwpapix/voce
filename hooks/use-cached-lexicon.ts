"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useOwnerSession } from "./use-owner-session";
import { getCachedWords, setCachedWords, type LexiconCache } from "@/lib/lexicon-cache";
import { logPerf } from "@/lib/perf";

export function useCachedLexicon() {
  const session = useOwnerSession();
  const userId = session?.userId;
  const liveWords = useQuery(api.words.getWordsByMonth, userId ? {} : "skip");
  const [cache, setCache] = useState<LexiconCache | null>(null);
  const loggedLive = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void getCachedWords(userId).then((result) => {
      if (!active) return;
      setCache(result);
      logPerf("cache loaded");
      logPerf("cache words", result?.words.length ?? 0);
      if (result) logPerf("cache age", `${((Date.now() - result.updatedAt) / 3600000).toFixed(1)}h`);
    });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId || liveWords === undefined) return;
    if (!loggedLive.current) {
      logPerf("convex query ready");
      logPerf("live words", liveWords.length);
      loggedLive.current = true;
    }
    void setCachedWords(userId, liveWords);
  }, [userId, liveWords]);

  // A live empty array is authoritative too. Never resurrect deleted cached words.
  const words = userId ? (liveWords ?? (cache?.userId === userId ? cache.words : undefined)) : undefined;
  return { words, isInitialLoading: words === undefined, isRefreshing: words !== undefined && liveWords === undefined };
}
