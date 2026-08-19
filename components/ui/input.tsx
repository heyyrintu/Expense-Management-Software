import * as React from "react";

import { cn } from "@/lib/utils";
import { FIELD_HEIGHT, fieldSurface } from "./field";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldSurface,
        FIELD_HEIGHT,
        "flex file:text-text-secondary file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-label file:font-medium",
        className
      )}
      {...props}
    />
  );
}

/**
 * Amount input (§6.1): right-aligned, tabular, currency prefix as a static
 * adornment. The prefix sits inside the border so the field reads as one
 * control, and the input keeps its own focus ring.
 */
function AmountInput({
  className,
  currencySymbol = "₹",
  ...props
}: React.ComponentProps<"input"> & { currencySymbol?: string }) {
  return (
    <div
      data-slot="amount-input"
      className={cn(
        "flex items-center gap-1 rounded-sm border border-line-strong bg-bg-surface pl-3",
        "focus-within:border-accent focus-within:ring-2 focus-within:ring-focus-ring focus-within:ring-offset-2 focus-within:ring-offset-bg-app",
        "transition-[border-color,box-shadow] duration-instant ease-out",
        FIELD_HEIGHT,
        className
      )}
    >
      <span aria-hidden="true" className="text-body text-text-tertiary tabular">
        {currencySymbol}
      </span>
      <input
        inputMode="decimal"
        data-slot="amount-input-control"
        className={cn(
          "amount h-full w-full min-w-0 rounded-sm bg-transparent pr-3 text-right outline-none",
          "placeholder:font-normal placeholder:text-text-tertiary",
          "disabled:cursor-not-allowed disabled:text-text-tertiary"
        )}
        {...props}
      />
    </div>
  );
}

export { Input, AmountInput };
