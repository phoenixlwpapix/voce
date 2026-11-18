"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, KeyRound, Laptop, LoaderCircle, Puzzle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SettingsPage } from "@/components/settings-page";
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
  const disconnectTrigger = useRef<HTMLButtonElement>(null);
  const devicesHeading = useRef<HTMLHeadingElement>(null);

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
      toast.success("配对码已复制");
    } catch {
      toast.error("无法复制配对码，请手动选择复制。");
    }
  }

  async function handleRevoke() {
    if (revoking || !disconnectTarget) return;
    setRevoking(true);
    try {
      await revoke({ deviceId: disconnectTarget.id });
      disconnectTrigger.current = null;
      setDisconnectTarget(null);
      toast.success(`已断开与 ${disconnectTarget.name} 的连接`);
    } catch (error) {
      toast.error(getUserErrorMessage(error));
    } finally {
      setRevoking(false);
    }
  }

  return (
    <SettingsPage title="Chrome 划词扩展" description="连接浏览器后，选中网页里的词语，用右键菜单将它保存到生词本。">
      <div className="mt-6 grid items-start gap-8 md:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-12">
        <section className="min-w-0 border border-border bg-secondary/45 p-5 sm:p-7" aria-labelledby="pairing-title">
          <h2 id="pairing-title" className="flex items-center gap-2.5 text-base font-semibold">
            <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />配对新设备
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">在扩展弹窗输入配对码。每个码仅可使用一次，10 分钟内有效。</p>
          <div aria-live="polite" className={pairing ? "mt-5" : undefined}>
            {pairing ? (
              <>
                <div className="flex items-center justify-between gap-2 border border-border bg-background p-1.5 pl-3 sm:pl-4">
                  <code className="min-w-0 select-all font-mono text-base font-medium tracking-wider sm:text-xl">{pairing.code}</code>
                  <Button type="button" variant="ghost" className="shrink-0 border-0 px-2.5 text-xs" onClick={() => void handleCopy()} aria-label={copied ? "已复制配对码，再复制一次" : "复制配对码"}>
                    {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                    {copied ? "已复制" : "复制"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  有效期至 <time dateTime={new Date(pairing.expiresAt).toISOString()}>{new Date(pairing.expiresAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>
                </p>
              </>
            ) : null}
          </div>
          <Button type="button" variant={pairing ? "outline" : "default"} className="mt-5 w-full sm:w-auto" onClick={() => void handleGenerate()} disabled={generating}>
            {generating ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {generating ? "正在生成…" : pairing ? "生成新配对码" : "生成配对码"}
          </Button>
        </section>

        <section className="min-w-0 md:col-start-1 md:row-start-2" aria-labelledby="devices-title">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <h2 id="devices-title" ref={devicesHeading} tabIndex={-1} className="text-base font-semibold focus:outline-none">已连接设备</h2>
            {devices ? <p className="shrink-0 text-xs tabular-nums text-muted-foreground" role="status">{devices.length} 台</p> : null}
          </div>
          {devices === undefined ? (
            <p role="status" className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />正在加载设备…
            </p>
          ) : devices.length === 0 ? (
            <p className="flex items-center gap-3 py-4 text-sm leading-6 text-muted-foreground">
              <Laptop className="size-4 shrink-0" aria-hidden="true" />配对成功后，设备会显示在这里。
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {devices.map((device) => (
                <li key={device.id} className="flex items-center gap-2 py-3 sm:gap-3">
                  <span className="grid size-9 shrink-0 place-items-center bg-secondary" aria-hidden="true">
                    <Laptop className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium wrap-anywhere">{device.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">连接于 {new Date(device.connectedAt).toLocaleDateString("zh-CN")}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0 border-0 px-2 text-xs hover:text-destructive"
                    onClick={(event) => { disconnectTrigger.current = event.currentTarget; setDisconnectTarget(device); }}
                    aria-label={`断开与 ${device.name} 的连接`}
                  >
                    断开
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 md:col-start-2 md:row-span-2 md:row-start-1" aria-labelledby="install-title">
          <h2 id="install-title" className="flex items-center gap-2.5 text-base font-semibold">
            <Puzzle className="size-4 text-muted-foreground" aria-hidden="true" />安装扩展
          </h2>
          <ol role="list" className="mt-3 divide-y divide-border border-y border-border text-sm leading-6">
            <li className="flex gap-3 py-3">
              <span className="font-mono text-xs leading-6 text-muted-foreground" aria-hidden="true">1</span>
              <span>在 Chrome 地址栏打开 <code className="font-mono text-xs break-all">chrome://extensions</code>，开启「开发者模式」。</span>
            </li>
            <li className="flex gap-3 py-3">
              <span className="font-mono text-xs leading-6 text-muted-foreground" aria-hidden="true">2</span>
              <span>点击「加载已解压的扩展程序」，选择项目里的 <code className="font-mono text-xs">extension</code> 文件夹。</span>
            </li>
            <li className="flex gap-3 py-3">
              <span className="font-mono text-xs leading-6 text-muted-foreground" aria-hidden="true">3</span>
              <span>点击浏览器工具栏里的 Voce 图标，粘贴配对码完成连接。</span>
            </li>
          </ol>
        </section>
      </div>

      <Dialog open={disconnectTarget !== null} onOpenChange={(open) => { if (!open && !revoking) setDisconnectTarget(null); }}>
        <DialogContent onCloseAutoFocus={(event) => {
          event.preventDefault();
          const trigger = disconnectTrigger.current;
          (trigger?.isConnected ? trigger : devicesHeading.current)?.focus();
        }}>
          <DialogTitle className="pr-9 wrap-anywhere">断开与 {disconnectTarget?.name} 的连接？</DialogTitle>
          <DialogDescription>该设备需要重新配对才能继续保存生词。</DialogDescription>
          <div className="mt-7 flex flex-wrap justify-end gap-3">
            <DialogClose asChild><Button type="button" variant="ghost" disabled={revoking}>保持连接</Button></DialogClose>
            <Button type="button" variant="danger" onClick={() => void handleRevoke()} disabled={revoking}>
              {revoking ? "正在断开…" : "断开连接"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsPage>
  );
}
