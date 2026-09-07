"use client";

import { createContext, useContext } from "react";
import type { Id } from "@/convex/_generated/dataModel";

export type OwnerSession = { userId: Id<"users">; email: string | null };
export const OwnerSessionContext = createContext<OwnerSession | null>(null);
export const SignOutContext = createContext<(() => Promise<void>) | null>(null);
export function useOwnerSession() {
  return useContext(OwnerSessionContext);
}
