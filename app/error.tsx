"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-5 text-center">
      <div className="max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">页面加载出错</p>
        <h1 className="mt-4 font-serif text-4xl tracking-[-0.04em]">页面未能正常打开</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">网络连接或数据服务可能暂时不可用。你的词汇数据安全无虞。</p>
        <Button type="button" className="mt-8" onClick={reset}><RotateCcw className="size-4" aria-hidden="true" />重试</Button>
      </div>
    </main>
  );
}
