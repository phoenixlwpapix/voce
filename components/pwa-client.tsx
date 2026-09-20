"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function PwaClient() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const updateConnectionStatus = () => setIsOffline(!navigator.onLine);

    updateConnectionStatus();
    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);

    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        void navigator.serviceWorker
          .register("/sw.js", {
            scope: "/",
            updateViaCache: "none",
          })
          .catch(() => undefined);
      } else {
        // A worker installed by a previous production-mode localhost run keeps
        // controlling development pages until it is explicitly removed. Its
        // cache-first chunks can then conflict with Turbopack's current graph.
        void navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(registrations.map((registration) => registration.unregister())),
          )
          .catch(() => undefined);

        if ("caches" in window) {
          void caches
            .keys()
            .then((keys) =>
              Promise.all(
                keys
                  .filter((key) => key.startsWith("voce-"))
                  .map((key) => caches.delete(key)),
              ),
            )
            .catch(() => undefined);
        }
      }
    }

    return () => {
      window.removeEventListener("online", updateConnectionStatus);
      window.removeEventListener("offline", updateConnectionStatus);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex min-h-9 items-center justify-center gap-2 border-b border-border bg-background/95 px-4 py-2 text-center text-xs text-muted-foreground shadow-sm backdrop-blur"
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
      Offline — saved screens remain available; syncing and lookups will resume when you reconnect.
    </div>
  );
}
