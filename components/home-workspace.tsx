"use client";

import { LookupForm } from "@/components/lookup-form";
import { SiteHeader } from "@/components/site-header";
import { Timeline, type TimelineHandle } from "@/components/timeline";
import { useOwnerSession } from "@/hooks/use-owner-session";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getUserErrorMessage } from "@/lib/errors";
import type { Language } from "@/lib/types";

function BackToTop({ headerRef }: { headerRef: RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries.at(-1);
      if (entry) setVisible(!entry.isIntersecting);
    }, { rootMargin: "560px 0px 0px 0px" });

    observer.observe(header);
    return () => observer.disconnect();
  }, [headerRef]);

  function backToTop() {
    headerRef.current?.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  if (!visible) return null;

  return (
    <Button
      type="button"
      size="icon"
      className="fixed right-[calc(1.25rem+env(safe-area-inset-right))] bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-30 shadow-md"
      onClick={backToTop}
      aria-label="返回顶部"
      title="返回顶部"
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </Button>
  );
}

function HomeWorkspaceContent({ initialLanguage }: { initialLanguage: Language }) {
  const account = useOwnerSession();
  const savePreferredLanguage = useMutation(api.account.setPreferredLanguage);
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [switchingLanguage, setSwitchingLanguage] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<TimelineHandle>(null);

  async function switchLanguage(nextLanguage: Language) {
    if (!account || switchingLanguage || nextLanguage === language) return;
    const previousLanguage = language;
    setLanguage(nextLanguage);
    setSwitchingLanguage(true);
    try {
      await savePreferredLanguage({ language: nextLanguage });
    } catch (error) {
      setLanguage(previousLanguage);
      toast.error(getUserErrorMessage(error));
    } finally {
      setSwitchingLanguage(false);
    }
  }

  return (
    <>
      <SiteHeader language={language} ref={headerRef} />
      <main>
        <LookupForm
          language={language}
          languageSwitching={switchingLanguage}
          onLanguageChange={(nextLanguage) => void switchLanguage(nextLanguage)}
          onViewWord={(id) => timelineRef.current?.jumpToWord(id)}
        />
        <Timeline ref={timelineRef} language={language} />
      </main>
      <BackToTop headerRef={headerRef} />
    </>
  );
}

export function HomeWorkspace() {
  const account = useOwnerSession();
  const initialLanguage = account?.preferredLanguage ?? "EN";
  return (
    <HomeWorkspaceContent
      key={account ? `${account.userId}:${account.preferredLanguage}` : "pending"}
      initialLanguage={initialLanguage}
    />
  );
}
