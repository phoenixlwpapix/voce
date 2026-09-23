import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function JoinPage() {
  return <main className="mx-auto max-w-xl px-5 py-28 text-center">
    <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Voce invitation</p>
    <h1 className="mt-5 font-serif text-5xl">You already have a lexicon.</h1>
    <p className="mt-5 text-sm text-muted-foreground">Your account is ready to use.</p>
    <Button asChild className="mt-8"><Link href="/">Open your lexicon</Link></Button>
  </main>;
}
