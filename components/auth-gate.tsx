"use client";

import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { ArrowRight, KeyRound, LoaderCircle, LockKeyhole } from "lucide-react";
import Image from "next/image";
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
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await signIn("password", { email, password, flow: mode });
    } catch {
      setError(
        mode === "signIn"
          ? "Incorrect email or password. Try again."
          : "Couldn't create the account. If this email is already registered, switch to sign in.",
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
      <section className="hidden border-r border-border bg-secondary/35 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-4">
          <Image
            src="/icon.svg"
            alt=""
            width={44}
            height={44}
            priority
            className="size-11 rounded-[0.7rem]"
          />
          <div>
            <p className="font-serif text-3xl leading-none tracking-[-0.04em]">Voce</p>
            <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Personal lexicon
            </p>
          </div>
        </div>

        <div className="max-w-xl pb-[6vh]">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            A place for words to stay
          </p>
          <h2 className="mt-7 max-w-[9ch] font-serif text-[clamp(3.5rem,5.5vw,6rem)] leading-[0.88] tracking-[-0.06em]">
            Words worth returning to.
          </h2>
          <p className="mt-9 text-base leading-7 text-muted-foreground">
            Collect it. Revisit it. Make it yours.
          </p>
        </div>

        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          English · French · Spanish
        </p>
      </section>

      <section className="flex min-h-dvh items-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-12 flex items-center gap-3 lg:hidden">
            <Image src="/icon.svg" alt="" width={36} height={36} priority className="size-9 rounded-[0.6rem]" />
            <div>
              <p className="font-serif text-3xl leading-none tracking-[-0.04em]">Voce</p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Personal lexicon
              </p>
            </div>
          </div>

          <KeyRound className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Private access
          </p>
          <h1 className="mt-3 font-serif text-5xl tracking-[-0.05em] sm:text-6xl">
            {mode === "signIn" ? "Welcome back." : "Create your account."}
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {mode === "signIn"
              ? "Sign in to keep collecting and reviewing your words."
              : "The first account created becomes the sole owner of this lexicon."}
          </p>

          <div className="mt-10 grid grid-cols-2 border-y border-border" role="tablist" aria-label="Account options">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signIn"}
              onClick={() => changeMode("signIn")}
              className="h-11 border-r border-border text-sm text-muted-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-selected:bg-secondary aria-selected:text-foreground motion-reduce:transition-none"
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signUp"}
              onClick={() => changeMode("signUp")}
              className="h-11 text-sm text-muted-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-selected:bg-secondary aria-selected:text-foreground motion-reduce:transition-none"
            >
              Create account
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
                placeholder="At least 8 characters"
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
              {submitting ? "Checking…" : mode === "signIn" ? "Sign in to Voce" : "Create and enter Voce"}
            </Button>
          </form>

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
    return <LoadingScreen label="Opening your lexicon…" />;
  }

  if (status === "denied") {
    return (
      <main className="grid min-h-dvh place-items-center px-5 text-center">
        <div className="max-w-md border-y border-border py-14">
          <LockKeyhole className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Access restricted
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-[-0.04em]">This lexicon already has an owner.</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            This account can&apos;t access the vocabulary or use Gemini lookups.
          </p>
          <Button type="button" variant="outline" className="mt-8" onClick={() => void signOut()}>
            Sign out
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
    return <LoadingScreen label="Checking your session…" />;
  }
  if (!isAuthenticated) {
    return <SignInScreen />;
  }
  return <OwnerGate>{children}</OwnerGate>;
}
