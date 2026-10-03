import { QuizSession } from "@/components/quiz-session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "测验" };

export default function QuizPage() {
  return <QuizSession />;
}
