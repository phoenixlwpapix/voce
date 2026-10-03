import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function JoinPage() {
  return <main className="mx-auto max-w-xl px-5 py-28 text-center">
    <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Voce 邀请</p>
    <h1 className="mt-5 font-serif text-5xl">你已拥有词库账号。</h1>
    <p className="mt-5 text-sm text-muted-foreground">你的账号已就绪，可直接使用。</p>
    <Button asChild className="mt-8"><Link href="/">进入生词本</Link></Button>
  </main>;
}
