"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { useMemo } from "react";
import { Toaster } from "sonner";
import { AuthGate } from "@/components/auth-gate";

export function Providers({ children }: { children: React.ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const convex = useMemo(
    () => (convexUrl ? new ConvexReactClient(convexUrl) : null),
    [convexUrl],
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {convex ? (
        <ConvexAuthProvider client={convex}>
          <AuthGate>{children}</AuthGate>
        </ConvexAuthProvider>
      ) : (
        <main className="grid min-h-dvh place-items-center px-5 text-center">
          <div className="max-w-lg border-y border-border py-14">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Setup required</p>
            <h1 className="mt-4 font-serif text-4xl tracking-[-0.04em]">Voce needs a connection.</h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Set <code className="font-mono text-foreground">NEXT_PUBLIC_CONVEX_URL</code> in <code className="font-mono text-foreground">.env.local</code>, then restart the development server.
            </p>
          </div>
        </main>
      )}
      <Toaster
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: "!rounded-none !border-border !bg-background !text-foreground !shadow-lg",
            description: "!text-muted-foreground",
          },
        }}
      />
    </ThemeProvider>
  );
}
