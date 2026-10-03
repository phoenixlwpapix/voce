import { ReviewSession } from "@/components/review-session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "复习" };

export default function ReviewPage() {
  return <ReviewSession />;
}
