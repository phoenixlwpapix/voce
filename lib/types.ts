import type { Doc, Id } from "../convex/_generated/dataModel";

export const languages = ["EN", "FR", "ES", "JA"] as const;
export type Language = (typeof languages)[number];
export type WordDocument = Doc<"words">;
export type WordId = Id<"words">;

export type LookupResult = {
  id: WordId;
  status: "created" | "refreshed";
  word: string;
};
