import * as z from "zod/mini";
import type { OwnerSession } from "@/hooks/use-owner-session";
import { languages } from "./types";

// The last ready session lets the workspace start its lexicon cache read and
// live query while the session query is still in flight. It only seeds UI
// state for an already-authenticated subject; the live query replaces it and
// every server function still enforces ownership.
const storageKey = `voce-session:${process.env.NEXT_PUBLIC_CONVEX_URL}`;

const cachedSessionShape = z.object({
  subject: z.string(),
  session: z.object({
    userId: z.string(),
    email: z.nullable(z.string()),
    preferredLanguage: z.enum(languages),
    role: z.enum(["admin", "member"]),
  }),
});

export function readCachedSession(subject: string): OwnerSession | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = cachedSessionShape.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.subject !== subject) return null;
    return parsed.data.session as OwnerSession;
  } catch {
    return null;
  }
}

export function writeCachedSession(subject: string, session: OwnerSession) {
  const { userId, email, preferredLanguage, role } = session;
  try {
    localStorage.setItem(storageKey, JSON.stringify({ subject, session: { userId, email, preferredLanguage, role } }));
  } catch {
    // Optional optimization; storage may be blocked or full.
  }
}

export function clearCachedSession() {
  try { localStorage.removeItem(storageKey); } catch { /* Optional cache. */ }
}
