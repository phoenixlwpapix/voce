"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, Link2, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useOwnerSession } from "@/hooks/use-owner-session";
import { getUserErrorMessage } from "@/lib/errors";

export function InvitationManager() {
  const session = useOwnerSession();
  const invitations = useQuery(api.invitations.list, session?.role === "admin" ? {} : "skip");
  const create = useAction(api.invitationActions.create);
  const revoke = useMutation(api.invitations.revoke);
  const [link, setLink] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  if (session?.role !== "admin") {
    return <main className="mx-auto max-w-2xl px-5 py-20"><h1 className="font-serif text-4xl">Invitations</h1><p className="mt-4 text-muted-foreground">Only the account owner can invite people.</p></main>;
  }

  async function handleCreate() {
    setGenerating(true);
    try {
      const result = await create();
      setLink(`${window.location.origin}/join/${result.token}`);
      setCopied(false);
      toast.success("Invitation created");
    } catch (error) {
      toast.error(getUserErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed. Select the link manually.");
    }
  }

  return <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
    <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
      <section>
        <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground"><Link2 className="size-5" /> Private invitations</p>
        <h1 className="mt-7 font-serif text-[clamp(3.25rem,8vw,6.5rem)] leading-[0.92] tracking-[-0.055em]">A space for their own words.</h1>
        <p className="mt-8 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">Create a link and send it to a friend. They can register with their own email and password. Their words, reviews, and settings stay separate from yours.</p>
      </section>
      <aside className="self-start border-y border-border py-8 lg:mt-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">New invitation</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Each link works once and expires after seven days. Send it privately to the person you want to invite.</p>
        <Button className="mt-7 w-full" disabled={generating} onClick={() => void handleCreate()}>
          {generating ? <LoaderCircle className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          {generating ? "Creating…" : "Create invitation link"}
        </Button>
        {link ? <div className="mt-6"><label htmlFor="invite-link" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Your link</label><div className="mt-2 flex border border-border"><input id="invite-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 bg-transparent px-3 text-xs outline-none" /><Button variant="ghost" size="icon" aria-label="Copy invitation link" onClick={() => void handleCopy()}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</Button></div><p className="mt-2 text-xs text-muted-foreground">Copy it now. For security, the full link is shown only once.</p></div> : null}
      </aside>
    </div>
    <section className="mt-16 max-w-3xl border-t border-border pt-8">
      <h2 className="font-serif text-3xl">Recent invitations</h2>
      {invitations === undefined ? <p className="mt-5 text-sm text-muted-foreground">Loading…</p> : invitations.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No invitations yet.</p> :
        <ul className="mt-5 divide-y divide-border">{invitations.map((item) => {
          const status = item.acceptedAt ? "Accepted" : item.revokedAt ? "Revoked" : "Unused";
          return <li key={item.id} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">{status}</p><p className="mt-1 text-xs text-muted-foreground">Created {new Date(item.createdAt).toLocaleDateString()} · Expires {new Date(item.expiresAt).toLocaleDateString()}</p></div>{status === "Unused" ? <Button variant="ghost" size="icon" aria-label="Revoke invitation" onClick={() => void revoke({ id: item.id }).catch((error: unknown) => toast.error(getUserErrorMessage(error)))}><X className="size-4" /></Button> : null}</li>;
        })}</ul>}
    </section>
  </main>;
}
