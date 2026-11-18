"use client";

import { useAuthActions, useAuthToken, useConvexAuth } from "@convex-dev/auth/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { decodeJwt } from "jose";
import { usePathname } from "next/navigation";
import { OwnerSessionContext, SignOutContext } from "@/hooks/use-owner-session";
import { logPerf } from "@/lib/perf";
import { clearCachedSession, readCachedSession, writeCachedSession } from "@/lib/session-cache";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageBadge } from "@/components/language-badge";
import { ThemeToggle } from "@/components/theme-toggle";

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

function SignInScreen({ inviteToken }: { inviteToken: string | null }) {
  const invited = inviteToken !== null;
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<AuthMode>(invited ? "signUp" : "signIn");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const signingIn = mode === "signIn";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email || !email.includes("@")) {
      setError("请输入有效的电子邮箱地址。");
      return;
    }
    if (password.length < 8) {
      setError("密码长度至少需要 8 个字符。");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await signIn("password", {
        email,
        password,
        flow: mode,
        ...(mode === "signUp" && inviteToken ? { inviteToken } : {}),
      });
    } catch (caughtError) {
      const serverMessage = caughtError && typeof caughtError === "object" && "data" in caughtError && typeof caughtError.data === "string"
        ? caughtError.data
        : null;
      setError(
        mode === "signIn"
          ? "邮箱或密码错误，请重试。"
          : serverMessage ?? "无法创建账户。如果该邮箱已被注册，请切换至登录。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setPasswordVisible(false);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between border-b border-border py-3 sm:py-6">
        <div className="flex items-center gap-3">
          <Image src="/icon.svg" alt="" width={36} height={36} className="size-9" />
          <span className="font-serif text-2xl font-medium tracking-[-0.03em]">Voce</span>
          <span className="text-xs text-muted-foreground">极简词典</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="mx-auto grid w-full max-w-sm items-center gap-12 pb-12 pt-10 sm:my-auto sm:py-16 md:max-w-5xl md:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-20 lg:px-8">
        <section className="min-w-0" aria-labelledby="auth-title">
          <h1 id="auth-title" ref={headingRef} tabIndex={-1} className="font-serif text-[clamp(2rem,1.45rem+2.75vw,3.75rem)] leading-tight tracking-[-0.045em] outline-none">
            {signingIn ? "登录 Voce" : "创建账户"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {signingIn
              ? invited ? "登录已有账户以接受邀请。" : "打开你的生词本，继续查词和复习。"
              : invited ? "接受邀请，开启你的生词本。" : "Voce 采用邀请制。受邀用户请从邀请链接注册。"}
          </p>

          <form className="mt-7 space-y-5" onSubmit={handleSubmit} onInput={() => { if (error) setError(null); }}>
            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium">电子邮箱</label>
              <Input
                id="auth-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="you@example.com"
                required
                disabled={submitting}
                className="mt-2"
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="block text-sm font-medium">密码</label>
              <div className="relative mt-2">
                <Input
                  id="auth-password"
                  name="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete={signingIn ? "current-password" : "new-password"}
                  spellCheck={false}
                  autoCapitalize="none"
                  enterKeyHint="done"
                  minLength={8}
                  required
                  disabled={submitting}
                  className="pr-12"
                  aria-describedby={signingIn ? undefined : "password-hint"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0.5 border-0"
                  aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
                  aria-controls="auth-password"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                >
                  {passwordVisible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </Button>
              </div>
              {signingIn ? null : <p id="password-hint" className="mt-2 text-xs text-muted-foreground">至少 8 个字符。</p>}
            </div>

            {error ? <p role="alert" className="border-l-2 border-destructive/50 pl-3 text-sm leading-5 text-destructive">{error}</p> : null}
            <Button type="submit" className="h-12 w-full justify-between" disabled={submitting}>
              {submitting ? signingIn ? "正在登录…" : "正在创建账户…" : signingIn ? "登录" : "创建账户"}
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <ArrowRight className="size-4" aria-hidden="true" />
              )}
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-x-1.5 text-sm">
            <span className="text-muted-foreground">{signingIn ? "还没有账户？" : "已有账户？"}</span>
            <Button type="button" variant="ghost" className="border-0 px-2 text-foreground underline decoration-border underline-offset-4 hover:decoration-current" disabled={submitting} onClick={() => changeMode(signingIn ? "signUp" : "signIn")}>
              {signingIn ? "创建账户" : "返回登录"}
            </Button>
          </div>
        </section>

        <figure className="hidden min-w-0 border border-border bg-secondary/50 p-8 md:block lg:p-12">
          <figcaption className="flex items-center justify-between gap-4 border-b border-border pb-4 text-xs text-muted-foreground">
            生词本预览
            <LanguageBadge language="EN" />
          </figcaption>
          <p lang="en" className="mt-7 font-serif text-[clamp(2.25rem,1rem+3.1vw,4rem)] leading-none tracking-[-0.05em]">serendipity</p>
          <p className="mt-3 font-ipa text-sm text-muted-foreground">/ˌser.ənˈdɪp.ə.t̬i/</p>
          <p className="mt-6 text-sm leading-6"><i lang="en" className="mr-3 text-muted-foreground">noun</i>机缘巧合，意外发现美好事物</p>
          <blockquote className="mt-7 border-l border-border pl-4">
            <p lang="en" className="font-serif text-lg leading-snug">It was pure serendipity that we found the bookshop.</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">我们找到那家书店纯属机缘巧合。</p>
          </blockquote>
        </figure>
      </div>
    </main>
  );
}

function AccountSetup() {
  const claimOwnership = useMutation(api.account.claimOwnership);
  const [error, setError] = useState(false);
  const started = useRef(false);
  async function initialize() {
    setError(false);
    try {
      await claimOwnership();
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void initialize();
    }
    // Initialization runs only when the server reports an unclaimed account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <h1 className="font-serif text-3xl">正在加载极简词典</h1>
        {error ? <Button className="mt-6" onClick={() => void initialize()}>重试设置</Button> : <p className="mt-4 text-sm text-muted-foreground">正在初始化账户及词汇数据…</p>}
      </div>
    </main>
  );
}

function InvitationAcceptance({ token }: { token: string }) {
  const accept = useAction(api.invitationActions.accept);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void accept({ token }).then(() => window.location.replace("/"))
      .catch(() => setError("邀请无效、已过期或已被使用。请索取新的邀请链接。"));
  }, [accept, token]);
  return <main className="grid min-h-dvh place-items-center px-5 text-center">
    <div className="max-w-md border-y border-border py-14">
      <h1 className="font-serif text-4xl">加入 Voce</h1>
      <p className="mt-4 text-sm text-muted-foreground">{error ?? "正在加载极简词典…"}</p>
    </div>
  </main>;
}

function SessionGate({ children, subject, signOut, inviteToken }: {
  children: React.ReactNode;
  subject: string;
  signOut: () => Promise<void>;
  inviteToken: string | null;
}) {
  const session = useQuery(api.account.session, { subject });
  const pathname = usePathname();
  // SessionGate is keyed by subject and only mounts on the client after auth resolves.
  const [cachedSession] = useState(() => readCachedSession(subject));
  useEffect(() => {
    if (session?.status === "ready") {
      logPerf("owner ready");
      writeCachedSession(subject, session);
    } else if (session !== undefined) {
      clearCachedSession();
    }
  }, [session, subject]);

  if (session === undefined) {
    return pathname === "/" || pathname === "/review" || pathname === "/quiz"
      ? <OwnerSessionContext value={cachedSession}>{children}</OwnerSessionContext>
      : <LoadingScreen label="正在验证账户…" />;
  }
  if (session.status === "setup") return <AccountSetup />;
  if (session.status === "invitationRequired" && inviteToken) return <InvitationAcceptance token={inviteToken} />;
  if (session.status === "invitationRequired") {
    return <main className="grid min-h-dvh place-items-center px-5 text-center"><div className="max-w-md border-y border-border py-14"><LockKeyhole className="mx-auto size-5 text-muted-foreground" aria-hidden="true" /><h1 className="mt-6 font-serif text-4xl">需要邀请链接</h1><p className="mt-4 text-sm text-muted-foreground">请向邀请人索取 Voce 邀请链接，并在登录后打开。</p><Button variant="outline" className="mt-8" onClick={() => void signOut()}>退出登录</Button></div></main>;
  }
  if (session.status === "denied") {
    return (
      <main className="grid min-h-dvh place-items-center px-5 text-center">
        <div className="max-w-md border-y border-border py-14">
          <LockKeyhole className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-6 font-serif text-4xl">访问受限</h1>
          <p className="mt-4 text-sm text-muted-foreground">该账户无法访问极简词典。</p>
          <Button variant="outline" className="mt-8" onClick={() => void signOut()}>退出登录</Button>
        </div>
      </main>
    );
  }
  return <OwnerSessionContext value={session}>{children}</OwnerSessionContext>;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const token = useAuthToken();
  const pathname = usePathname();
  const inviteToken = pathname?.startsWith("/join/") ? pathname.slice("/join/".length) : null;
  const [signingOut, setSigningOut] = useState(false);
  let subject: string | undefined;
  try {
    // This only keys UI state. The server verifies the subject before allowing cache access.
    subject = token ? decodeJwt(token).sub : undefined;
  } catch {
    subject = undefined;
  }
  useEffect(() => {
    if (!isLoading && isAuthenticated) logPerf("auth ready");
  }, [isLoading, isAuthenticated]);

  async function handleSignOut() {
    setSigningOut(true);
    clearCachedSession();
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }
  if (signingOut) return <LoadingScreen label="正在退出登录…" />;
  if (isLoading) {
    // The workspace renders its own loading states without a session, so the
    // home page paints its real layout (including in server HTML) instead of a spinner.
    return pathname === "/"
      ? <OwnerSessionContext value={null}>{children}</OwnerSessionContext>
      : <LoadingScreen label="正在检查登录状态…" />;
  }
  if (!isAuthenticated || !subject) return <SignInScreen key={inviteToken ?? "regular"} inviteToken={inviteToken} />;
  return (
    <SignOutContext value={handleSignOut}>
      <SessionGate key={subject} subject={subject} signOut={handleSignOut} inviteToken={inviteToken}>{children}</SessionGate>
    </SignOutContext>
  );
}
