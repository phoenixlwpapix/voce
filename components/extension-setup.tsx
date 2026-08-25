"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, Laptop, LoaderCircle, Puzzle, ShieldCheck, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { getUserErrorMessage } from "@/lib/errors";

type PairingCode = { code: string; expiresAt: number };
type Device = {
  id: Id<"extensionDevices"> | "legacy";
  name: string;
  connectedAt: number;
};

export function ExtensionSetup() {
  const devices = useQuery(api.extensionAccess.listDevices);
  const createPairingCode = useAction(api.extensionAuth.createPairingCodeForOwner);
  const revoke = useMutation(api.extensionAccess.revoke);
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<Device | null>(null);

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setCopied(false);
    try {
      setPairing(await createPairingCode());
    } catch (error) {
      toast.error(getUserErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.code);
      setCopied(true);
      toast.success("Pairing code copied");
    } catch {
      toast.error("Couldn't copy the code. Select it manually.");
    }
  }

  async function handleRevoke() {
    if (revoking || !disconnectTarget) return;
    setRevoking(true);
    try {
      await revoke({
        deviceId: disconnectTarget.id === "legacy" ? "legacy" : disconnectTarget.id,
      });
      setDisconnectTarget(null);
      toast.success(`${disconnectTarget.name} disconnected`);
    } catch (error) {
      toast.error(getUserErrorMessage(error));
    } finally {
      setRevoking(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
      <section className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:gap-20" aria-labelledby="extension-title">
        <div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Puzzle className="size-5" aria-hidden="true" />
            <p className="font-mono text-[10px] uppercase tracking-[0.22em]">Browser companion</p>
          </div>
          <h1 id="extension-title" className="mt-7 max-w-[11ch] font-serif text-[clamp(3.25rem,8vw,6.5rem)] leading-[0.92] tracking-[-0.055em]">
            Keep a word without leaving the page.
          </h1>
          <p className="mt-8 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            Select a word anywhere in Chrome, right-click, and send it straight to this lexicon. The extension uses the same Gemini lookup, duplicate handling, and review schedule as Voce.
          </p>

          <ol className="mt-12 border-t border-border">
            {[
              ["01", "Open chrome://extensions and enable Developer mode."],
              ["02", "Choose Load unpacked and select this repository's extension folder."],
              ["03", "Open the Voce extension, paste a pairing code, and connect."],
            ].map(([number, instruction]) => (
              <li key={number} className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-border py-5 text-sm leading-6">
                <span className="font-mono text-[10px] text-muted-foreground">{number}</span>
                <span>{instruction}</span>
              </li>
            ))}
          </ol>
        </div>

        <aside className="self-start border-y border-border py-8 lg:mt-16" aria-label="Extension connection">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Connection</p>
              <p className="mt-2 text-sm font-medium">
                {devices === undefined
                  ? "Checking…"
                  : devices.length === 0
                    ? "No devices connected"
                    : `${devices.length} ${devices.length === 1 ? "device" : "devices"} connected`}
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-full border border-border" aria-hidden="true">
              {devices === undefined ? (
                <LoaderCircle className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
              ) : devices.length > 0 ? (
                <ShieldCheck className="size-4 text-ja" />
              ) : (
                <Puzzle className="size-4 text-muted-foreground" />
              )}
            </span>
          </div>

          <div className="mt-8 border-t border-border pt-8">
            <p className="text-xs leading-5 text-muted-foreground">
              Generate a one-time code after installing the extension. It expires in 10 minutes and can only be redeemed once.
            </p>
            {pairing ? (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="flex min-h-16 w-full items-center justify-between gap-3 border border-border px-4 text-left outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                  aria-label="Copy pairing code"
                >
                  <code className="font-mono text-sm tracking-[0.12em]">{pairing.code}</code>
                  {copied ? <Check className="size-4 text-ja" aria-hidden="true" /> : <Copy className="size-4 text-muted-foreground" aria-hidden="true" />}
                </button>
                <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  Expires {new Date(pairing.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ) : null}

            <Button type="button" className="mt-6 w-full" onClick={() => void handleGenerate()} disabled={generating}>
              {generating ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Puzzle className="size-4" aria-hidden="true" />}
              {generating ? "Generating…" : pairing ? "Generate a new code" : "Generate pairing code"}
            </Button>
          </div>

          {devices && devices.length > 0 ? (
            <div className="mt-8 border-t border-border pt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Connected devices</p>
              <ul className="mt-3 divide-y divide-border">
                {devices.map((device) => (
                  <li key={device.id} className="flex items-center gap-3 py-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary" aria-hidden="true">
                      <Laptop className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{device.name}</p>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                        Connected {new Date(device.connectedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDisconnectTarget(device)}
                      aria-label={`Disconnect ${device.name}`}
                    >
                      <Unplug className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Dialog open={disconnectTarget !== null} onOpenChange={(open) => { if (!open) setDisconnectTarget(null); }}>
            <DialogContent>
              <DialogTitle>Disconnect {disconnectTarget?.name}?</DialogTitle>
              <DialogDescription>
                Only this device will lose access. Your other connected computers will keep working.
              </DialogDescription>
              <div className="mt-7 flex justify-end gap-3">
                <DialogClose asChild><Button type="button" variant="ghost" disabled={revoking}>Keep connected</Button></DialogClose>
                <Button type="button" variant="danger" onClick={() => void handleRevoke()} disabled={revoking}>
                  {revoking ? "Disconnecting…" : "Disconnect device"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </aside>
      </section>
    </main>
  );
}
