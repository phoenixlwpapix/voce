"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? "default" : "icon"}
      className={showLabel ? "w-full justify-start px-3 text-sm" : "relative"}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={showLabel ? (resolvedTheme === "dark" ? "Switch to light appearance" : "Switch to dark appearance") : "Toggle color theme"}
    >
      <Sun className={showLabel ? "size-4 dark:hidden" : "size-[18px] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90 motion-reduce:transition-none"} aria-hidden="true" />
      <Moon className={showLabel ? "hidden size-4 dark:block" : "absolute size-[18px] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0 motion-reduce:transition-none"} aria-hidden="true" />
      {showLabel ? <span>{resolvedTheme === "dark" ? "Light appearance" : "Dark appearance"}</span> : null}
    </Button>
  );
}
