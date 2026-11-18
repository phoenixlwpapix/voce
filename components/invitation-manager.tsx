"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, Link2, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { SettingsPage } from "@/components/settings-page";
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
    return <SettingsPage title="邀请管理" description="只有管理员可以生成邀请链接。" />;
  }

  async function handleCreate() {
    setGenerating(true);
    try {
      const result = await create();
      setLink(`${window.location.origin}/join/${result.token}`);
      setCopied(false);
      toast.success("邀请链接已创建");
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
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败，请手动选择复制。");
    }
  }

  return (
    <SettingsPage title="邀请管理" description="邀请好友加入 Voce。每个人都有自己的生词本和复习进度。">
      <div className="mt-6 grid items-start gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
        <section className="min-w-0 border border-border bg-secondary/45 p-5 sm:p-7" aria-labelledby="create-invite-title">
          <h2 id="create-invite-title" className="flex items-center gap-2.5 text-base font-semibold">
            <Link2 className="size-4 text-muted-foreground" aria-hidden="true" />创建邀请
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">链接在 7 天内有效，可使用一次。请私下发给受邀人。</p>
          <Button type="button" variant={link ? "outline" : "default"} className="mt-5 w-full sm:w-auto" disabled={generating} onClick={() => void handleCreate()}>
            {generating ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {generating ? "正在生成…" : link ? "生成新邀请链接" : "生成邀请链接"}
          </Button>
          {link ? (
            <div className="mt-5">
              <label htmlFor="invite-link" className="text-sm font-medium">邀请链接</label>
              <div className="mt-2 flex gap-1 border border-border bg-background p-1.5">
                <input id="invite-link" type="url" readOnly value={link} onFocus={(event) => event.currentTarget.select()} aria-describedby="invite-link-hint" className="min-w-0 flex-1 bg-transparent px-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm" />
                <Button type="button" variant="ghost" className="shrink-0 border-0 px-2.5 text-xs" aria-label={copied ? "已复制邀请链接，再复制一次" : "复制邀请链接"} onClick={() => void handleCopy()}>
                  {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                  {copied ? "已复制" : "复制"}
                </Button>
              </div>
              <p id="invite-link-hint" className="mt-2 text-xs leading-5 text-muted-foreground">完整链接仅在生成后显示，请先复制。</p>
            </div>
          ) : null}
        </section>
        <section className="min-w-0" aria-labelledby="invite-history-title">
          <h2 id="invite-history-title" className="border-b border-border pb-3 text-base font-semibold">近期邀请</h2>
          {invitations === undefined ? (
            <p role="status" className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />正在加载邀请…</p>
          ) : invitations.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">生成的邀请会显示在这里。</p>
          ) : (
            <ul className="divide-y divide-border">
              {invitations.map((item) => {
                const status = item.acceptedAt ? "已接受" : item.revokedAt ? "已撤销" : "未使用";
                return (
                  <li key={item.id} className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{status}</p>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs leading-5 text-muted-foreground">
                        <span>创建于 {new Date(item.createdAt).toLocaleDateString("zh-CN")}</span>
                        <span>有效期至 {new Date(item.expiresAt).toLocaleDateString("zh-CN")}</span>
                      </p>
                    </div>
                    {status === "未使用" ? (
                      <Button type="button" variant="ghost" className="shrink-0 border-0 px-2 text-xs hover:text-destructive" onClick={() => void revoke({ id: item.id }).catch((error: unknown) => toast.error(getUserErrorMessage(error)))}>
                        撤销邀请
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </SettingsPage>
  );
}
