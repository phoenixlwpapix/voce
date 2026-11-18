"use client";

import { ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-5 text-center">
      <div className="w-full max-w-md border-y border-border py-10">
        <h1 className="font-serif text-3xl leading-tight tracking-[-0.04em] sm:text-4xl">页面加载失败</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">请检查网络连接，再试一次。</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset}><RotateCcw className="size-4" aria-hidden="true" />重新加载</Button>
          <Button asChild variant="ghost"><Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />返回生词本</Link></Button>
        </div>
      </div>
    </main>
  );
}
