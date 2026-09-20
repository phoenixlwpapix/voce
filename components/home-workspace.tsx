"use client";

import { LookupForm } from "@/components/lookup-form";
import { SiteHeader } from "@/components/site-header";
import { Timeline } from "@/components/timeline";
import { useOwnerSession } from "@/hooks/use-owner-session";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/errors";
import type { Language } from "@/lib/types";

function HomeWorkspaceContent({ initialLanguage }: { initialLanguage: Language }) {
  const account = useOwnerSession();
  const savePreferredLanguage = useMutation(api.account.setPreferredLanguage);
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [switchingLanguage, setSwitchingLanguage] = useState(false);

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
      <SiteHeader />
      <main>
        <LookupForm
          language={language}
          languageSwitching={switchingLanguage}
          onLanguageChange={(nextLanguage) => void switchLanguage(nextLanguage)}
        />
        <Timeline language={language} />
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
