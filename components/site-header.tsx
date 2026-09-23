"use client";

import { useContext, useEffect, useRef } from "react";
import { SignOutContext, useOwnerSession } from "@/hooks/use-owner-session";
import Link from "next/link";
import { BookOpenText, LogOut, Puzzle, Settings2, UserPlus } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { VocabularyExport } from "@/components/vocabulary-export";
import { Button } from "@/components/ui/button";
import type { Language } from "@/lib/types";

export function SiteHeader({ language }: { language?: Language }) {
  const signOut = useContext(SignOutContext);
  const account = useOwnerSession();
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) menuRef.current?.removeAttribute("open");
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.removeAttribute("open");
        menuRef.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function closeMenu() {
    menuRef.current?.removeAttribute("open");
  }

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 sm:px-8 sm:py-6">
      <Link href="/" className="group flex items-baseline gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="font-serif text-2xl font-medium tracking-[-0.03em]">Voce</span>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">Personal lexicon</span>
      </Link>
      <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main navigation">
        <Button asChild variant="ghost" size="default" className="px-2 text-xs sm:px-3">
          <Link href="/review">
            <BookOpenText className="size-4" aria-hidden="true" />
            <span>Review</span>
          </Link>
        </Button>
        <details ref={menuRef} className="group relative">
          <summary className="flex size-11 cursor-pointer list-none items-center justify-center text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden" aria-label="Settings">
            <Settings2 className="size-4" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-full z-40 mt-2 w-56 border border-border bg-background p-2 shadow-[0_16px_48px_rgba(0,0,0,0.16)]">
            <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Settings</p>
            <Link href="/extension" onClick={closeMenu} className="flex min-h-11 items-center gap-3 px-3 text-sm outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
              <Puzzle className="size-4" aria-hidden="true" /> Extension setup
            </Link>
            {account?.role === "admin" ? <Link href="/invitations" onClick={closeMenu} className="flex min-h-11 items-center gap-3 px-3 text-sm outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"><UserPlus className="size-4" aria-hidden="true" /> Invite people</Link> : null}
            <div onClick={closeMenu}><ThemeToggle showLabel /></div>
            <div onClick={closeMenu}><VocabularyExport language={language ?? account?.preferredLanguage ?? "EN"} menuItem /></div>
            <div className="my-1 border-t border-border" />
            <button type="button" onClick={() => { closeMenu(); void signOut?.(); }} className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label={account?.email ? `Sign out ${account.email}` : "Sign out"}>
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </button>
          </div>
        </details>
      </nav>
    </header>
  );
}
