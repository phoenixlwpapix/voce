"use client";

import { LookupForm } from "@/components/lookup-form";
import { SiteHeader } from "@/components/site-header";
import { Timeline, type TimelineHandle } from "@/components/timeline";
import { useOwnerSession } from "@/hooks/use-owner-session";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errors";
import type { Language } from "@/lib/types";

function HomeWorkspaceContent({ initialLanguage }: { initialLanguage: Language }) {
  const account = useOwnerSession();
  const savePreferredLanguage = useMutation(api.account.setPreferredLanguage);
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [switchingLanguage, setSwitchingLanguage] = useState(false);
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
      <SiteHeader language={language} />
      <main>
        <LookupForm
          language={language}
          languageSwitching={switchingLanguage}
          onLanguageChange={(nextLanguage) => void switchLanguage(nextLanguage)}
          onViewWord={(id) => timelineRef.current?.jumpToWord(id)}
        />
        <Timeline ref={timelineRef} language={language} />
      </main>
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
