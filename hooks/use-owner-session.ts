"use client";

import { createContext, useContext } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { Language } from "@/lib/types";

export type OwnerSession = {
  userId: Id<"users">;
  email: string | null;
  preferredLanguage: Language;
};
export const OwnerSessionContext = createContext<OwnerSession | null>(null);
export const SignOutContext = createContext<(() => Promise<void>) | null>(null);
export function useOwnerSession() {
  return useContext(OwnerSessionContext);
}
