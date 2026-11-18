import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SettingsPage({ title, description, children }: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16 pt-5 sm:px-8 sm:pt-8">
      <header className="border-b border-border pb-6 sm:pb-8">
        <Button asChild variant="ghost" className="-ml-2 border-0 px-2 text-xs">
          <Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />返回生词本</Link>
        </Button>
        <h1 className="mt-3 font-serif text-[clamp(2rem,1.45rem+2.75vw,3.75rem)] leading-tight tracking-[-0.045em]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      {children}
    </main>
  );
}
