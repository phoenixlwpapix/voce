import { QuizSession } from "@/components/quiz-session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Quiz" };

export default function QuizPage() {
  return <QuizSession />;
}
