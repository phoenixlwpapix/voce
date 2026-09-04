"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { BookOpenText, LogOut, Puzzle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import type { Language } from "@/lib/types";

export function SiteHeader({ reviewLanguage }: { reviewLanguage?: Language }) {
  const { signOut } = useAuthActions();
  const account = useQuery(api.account.currentUser);

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
      <Link href="/" className="group flex items-baseline gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="font-serif text-2xl font-medium tracking-[-0.03em]">Voce</span>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">Personal lexicon</span>
      </Link>
      <nav className="flex items-center gap-1" aria-label="Main navigation">
        <Button asChild variant="ghost" size="default" className="px-3 text-xs">
          <Link href={reviewLanguage ? `/review?language=${reviewLanguage}` : "/review"}>
            <BookOpenText className="size-4" aria-hidden="true" />
            <span>Review</span>
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon">
          <Link href="/extension" aria-label="Extension setup" title="Extension setup">
            <Puzzle className="size-4" aria-hidden="true" />
          </Link>
        </Button>
        <ThemeToggle />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void signOut()}
          aria-label={account?.email ? `Sign out ${account.email}` : "Sign out"}
          title={account?.email ? `Sign out ${account.email}` : "Sign out"}
        >
          <LogOut className="size-4" aria-hidden="true" />
        </Button>
      </nav>
    </header>
  );
}
