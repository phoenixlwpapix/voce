"use client";

import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { ArrowRight, BookOpen, KeyRound, LoaderCircle, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthMode = "signIn" | "signUp";

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="text-center">
        <LoaderCircle
          className="mx-auto size-5 animate-spin text-muted-foreground motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      </div>
    </main>
  );
}

function SignInScreen() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email || !email.includes("@")) {
      setError("请输入有效的邮箱地址。");
      return;
    }
    if (password.length < 8) {
      setError("密码至少需要 8 个字符。");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await signIn("password", { email, password, flow: mode });
    } catch {
      setError(
        mode === "signIn"
          ? "邮箱或密码不正确，请重新输入。"
          : "账号创建失败；如果邮箱已注册，请切换到登录。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.12fr)_minmax(28rem,0.88fr)]">
      <section className="relative hidden overflow-hidden border-r border-border bg-secondary/35 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-x-0 top-[38%] h-px bg-border" aria-hidden="true" />
        <div className="absolute bottom-[24%] left-0 h-px w-2/3 bg-border" aria-hidden="true" />
        <div className="relative flex items-baseline gap-3">
          <span className="font-serif text-3xl tracking-[-0.04em]">Voce</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Personal lexicon
          </span>
        </div>
        <blockquote className="relative max-w-xl">
          <BookOpen className="mb-8 size-5 text-muted-foreground" aria-hidden="true" />
          <p className="font-serif text-[clamp(3rem,5vw,5.8rem)] leading-[0.92] tracking-[-0.055em]">
            Words become yours when you return to them.
          </p>
          <p className="mt-8 max-w-md text-sm leading-7 text-muted-foreground">
            一个安静、私密的多语言词汇簿。你的词条、复习进度与查询权限都只属于这个账号。
          </p>
        </blockquote>
        <p className="relative font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          English · Français · Español
        </p>
      </section>

      <section className="flex min-h-dvh items-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-12 flex items-baseline gap-3 lg:hidden">
            <span className="font-serif text-3xl tracking-[-0.04em]">Voce</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Personal lexicon
            </span>
          </div>

          <KeyRound className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Private access
          </p>
          <h1 className="mt-3 font-serif text-5xl tracking-[-0.05em] sm:text-6xl">
            {mode === "signIn" ? "欢迎回来。" : "创建你的账号。"}
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {mode === "signIn"
              ? "登录后继续收录与复习你的词汇。"
              : "第一个创建的账号会成为这个词汇簿的唯一所有者。"}
          </p>

          <div className="mt-10 grid grid-cols-2 border-y border-border" role="tablist" aria-label="账号操作">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signIn"}
              onClick={() => changeMode("signIn")}
              className="h-11 border-r border-border text-sm text-muted-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-selected:bg-secondary aria-selected:text-foreground motion-reduce:transition-none"
            >
              登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signUp"}
              onClick={() => changeMode("signUp")}
              className="h-11 text-sm text-muted-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-selected:bg-secondary aria-selected:text-foreground motion-reduce:transition-none"
            >
              创建账号
            </button>
          </div>

          <form className="mt-8" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="auth-email" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Email
              </label>
              <Input
                id="auth-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                disabled={submitting}
                className="mt-2"
              />
            </div>
            <div className="mt-6">
              <label htmlFor="auth-password" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Password
              </label>
              <Input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                placeholder="至少 8 个字符"
                minLength={8}
                required
                disabled={submitting}
                className="mt-2"
                aria-describedby={error ? "auth-error" : undefined}
                aria-invalid={Boolean(error)}
              />
            </div>

            <div className="mt-3 min-h-6">
              {error ? (
                <p id="auth-error" role="alert" className="text-xs leading-5 text-destructive">
                  {error}
                </p>
              ) : null}
            </div>

            <Button type="submit" className="mt-4 w-full" disabled={submitting}>
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <ArrowRight className="size-4" aria-hidden="true" />
              )}
              {submitting ? "正在验证…" : mode === "signIn" ? "登录 Voce" : "创建并进入 Voce"}
            </Button>
          </form>

          <p className="mt-8 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            密码只会以安全哈希保存；Gemini API Key 不会发送到浏览器。
          </p>
        </div>
      </section>
    </main>
  );
}

function OwnerGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuthActions();
  const claimOwnership = useMutation(api.account.claimOwnership);
  const [status, setStatus] = useState<"checking" | "ready" | "denied">("checking");

  useEffect(() => {
    let active = true;
    void claimOwnership()
      .then(() => {
        if (active) setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("denied");
      });
    return () => {
      active = false;
    };
  }, [claimOwnership]);

  if (status === "checking") {
    return <LoadingScreen label="正在打开你的词汇簿…" />;
  }

  if (status === "denied") {
    return (
      <main className="grid min-h-dvh place-items-center px-5 text-center">
        <div className="max-w-md border-y border-border py-14">
          <LockKeyhole className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Access restricted
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-[-0.04em]">这个词汇簿已有主人。</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            当前账号不能访问词汇，也不能调用 Gemini 查询。
          </p>
          <Button type="button" variant="outline" className="mt-8" onClick={() => void signOut()}>
            退出当前账号
          </Button>
        </div>
      </main>
    );
  }

  return children;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return <LoadingScreen label="正在确认登录状态…" />;
  }
  if (!isAuthenticated) {
    return <SignInScreen />;
  }
  return <OwnerGate>{children}</OwnerGate>;
}
