import type { Metadata } from "next";
import { ReviewSession } from "@/components/review-session";
import { languages, type Language } from "@/lib/types";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ language?: string | string[] }>;
}) {
  const languageParam = (await searchParams).language;
  const candidate = Array.isArray(languageParam) ? languageParam[0] : languageParam;
  const initialLanguage: Language = languages.includes(candidate as Language)
    ? (candidate as Language)
    : "EN";

  return <ReviewSession initialLanguage={initialLanguage} />;
}
