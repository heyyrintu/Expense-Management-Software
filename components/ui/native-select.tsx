import * as React from "react";

import { cn } from "@/lib/utils";

// Styled native <select> — accessible, keyboard/mobile friendly, no extra deps.
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "border-input dark:bg-input/30 flex h-9 w-full min-w-0 appearance-none rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { NativeSelect };
