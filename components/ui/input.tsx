import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-12 w-full border-0 border-b border-border bg-transparent px-0 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/65 focus:border-foreground focus-visible:ring-0 disabled:opacity-50 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
