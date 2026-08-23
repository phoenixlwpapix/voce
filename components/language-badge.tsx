import { cn } from "@/lib/utils";
import type { Language } from "@/lib/types";

const languageClasses: Record<Language, string> = {
  EN: "border-en/25 bg-en/8 text-en dark:text-[#9eabbc]",
  FR: "border-fr/25 bg-fr/8 text-fr dark:text-[#b8948d]",
  ES: "border-es/25 bg-es/8 text-es dark:text-[#aaa681]",
};

export function LanguageBadge({ language, className }: { language: Language; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center border px-2 font-mono text-[10px] font-medium tracking-[0.14em]",
        languageClasses[language],
        className,
      )}
    >
      {language}
    </span>
  );
}
