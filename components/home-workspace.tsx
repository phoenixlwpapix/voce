"use client";

import { LookupForm } from "@/components/lookup-form";
import { Timeline } from "@/components/timeline";
import { useState } from "react";
import type { Language } from "@/lib/types";

export function HomeWorkspace() {
  const [language, setLanguage] = useState<Language>("EN");

  return (
    <main>
      <LookupForm language={language} onLanguageChange={setLanguage} />
      <Timeline language={language} />
    </main>
  );
}
