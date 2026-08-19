import * as React from "react";

import { cn } from "@/lib/utils";
import { FIELD_HEIGHT, fieldSurface } from "./field";

/**
 * Styled native <select>.
 *
 * Deliberately native rather than a Radix listbox: it is keyboard- and
 * screen-reader-correct for free, uses the platform picker on mobile (which
 * beats any custom sheet), needs no portal, and the whole §6.1 visual spec
 * is reachable with CSS. The chevron is a real element so its colour comes
 * from a token like everything else.
 */
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full" data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className={cn(fieldSurface, FIELD_HEIGHT, "flex appearance-none pr-9", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        className="text-text-secondary pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      >
        <path
          d="M4 6l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export { NativeSelect, NativeSelect as Select };
