"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-5 text-center">
      <div className="max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">The page slipped</p>
        <h1 className="mt-4 font-serif text-4xl tracking-[-0.04em]">词汇簿暂时没有翻开。</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">可能是网络中断或数据服务暂时不可用。你的既有词条不会受到影响。</p>
        <Button type="button" className="mt-8" onClick={reset}><RotateCcw className="size-4" aria-hidden="true" />重新尝试</Button>
      </div>
    </main>
  );
}
