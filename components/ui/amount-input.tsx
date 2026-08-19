"use client";

// AmountInput (D2.1) — DESIGN-PRD §6.1, §7.1.
//
// The single most important field in the product: §2.1 measures the whole
// design on submitting an expense in under 60 seconds on a phone, and this is
// the field that decides it.
//
// Display-size, right-aligned, tabular, with the currency as a static
// adornment at the same weight as the number (§5.3 — a small currency symbol
// makes the amount look like a different amount).
//
// FORMATTED ON BLUR, RAW ON FOCUS. Grouping separators help you read a
// number and fight you while you type it: a cursor that jumps because a comma
// appeared mid-word is the classic broken money field. So the field groups
// while at rest and shows plain digits the moment you touch it.
//
// It NEVER SILENTLY ROUNDS. Paste "10.555" and it keeps your text and says
// what is wrong, rather than storing ₹10.56 and letting you find out at
// reconciliation. The parsing lives in lib/money.ts and is unit-tested there.
import * as React from "react";

import {
  formatAmountForDisplay,
  normalizeAmountInput,
  parseToMinorUnits,
} from "@/lib/money";
import { cn } from "@/lib/utils";

export type AmountInputProps = {
  /** The form's plain decimal string ("1234.56"). */
  value: string;
  /** Receives the plain decimal string; minor units come along for free. */
  onValueChange: (text: string, minor: number | null) => void;
  /** Symbol shown as the adornment. */
  currencySymbol?: string;
  /** Currency code, announced to screen readers so "500" isn't ambiguous. */
  currencyCode?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  onBlur?: () => void;
  className?: string;
};

export function AmountInput({
  value,
  onValueChange,
  currencySymbol = "₹",
  currencyCode,
  id,
  name,
  placeholder = "0.00",
  disabled,
  autoFocus,
  onBlur,
  className,
  ...aria
}: AmountInputProps) {
  const [focused, setFocused] = React.useState(false);
  // What the user sees while typing. Diverges from `value` only while the
  // input holds something not yet parseable — "10." on the way to "10.5".
  const [draft, setDraft] = React.useState(value);
  const [tooPrecise, setTooPrecise] = React.useState(false);

  // Keep up with changes from outside (OCR fills the field, a form reset).
  React.useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const minor = parseToMinorUnits(value);
  const resting = !focused && minor !== null ? formatAmountForDisplay(minor) : draft;

  function handleChange(raw: string) {
    setDraft(raw);
    const parsed = normalizeAmountInput(raw);
    setTooPrecise(parsed.tooPrecise);
    // A half-typed "10." parses as 10 — commit that, so the policy preview
    // and split totals stay live while typing, and keep the raw text on
    // screen so the trailing dot the user is mid-way through doesn't vanish.
    if (parsed.tooPrecise || parsed.invalid) {
      onValueChange(raw.trim(), null);
      return;
    }
    onValueChange(parsed.text, parsed.minor);
  }

  return (
    <div className="grid gap-1">
      <div
        data-slot="amount-input"
        className={cn(
          "border-line-strong bg-bg-surface flex items-baseline gap-2 rounded-md border px-4 py-3",
          "focus-within:border-accent focus-within:ring-2 focus-within:ring-focus-ring focus-within:ring-offset-2 focus-within:ring-offset-bg-app",
          "transition-[border-color,box-shadow] duration-instant ease-out",
          aria["aria-invalid"] && "border-status-danger",
          disabled && "bg-bg-subtle",
          className
        )}
      >
        {/* Same weight and size as the number (§5.3). aria-hidden because the
            code is announced through the input's own label instead. */}
        <span aria-hidden="true" className="text-display text-text-tertiary tabular">
          {currencySymbol}
        </span>
        <input
          id={id}
          name={name}
          // `decimal` gives iOS a keypad WITH a decimal point; `numeric`
          // does not, and this field needs paise.
          inputMode="decimal"
          // Not type="number": it silently drops pasted "1,234.56", refuses a
          // trailing dot mid-typing, and adds spinners nobody wants on money.
          type="text"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          value={resting}
          onFocus={() => {
            setFocused(true);
            // Raw on focus — plain digits, no grouping to fight the cursor.
            setDraft(value);
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          onChange={(e) => handleChange(e.target.value)}
          className={cn(
            "amount text-display w-full min-w-0 bg-transparent text-right outline-none",
            "placeholder:text-text-tertiary placeholder:font-normal",
            "disabled:cursor-not-allowed disabled:text-text-tertiary"
          )}
          {...aria}
        />
        {currencyCode ? <span className="sr-only">{currencyCode}</span> : null}
      </div>

      {tooPrecise ? (
        // Says what happened and what to do, and does NOT round on the user's
        // behalf. aria-live so it is announced rather than merely displayed.
        <p role="status" aria-live="polite" className="text-meta text-status-warning-text">
          Money has two decimal places — round it yourself so the figure is
          yours, not ours.
        </p>
      ) : null}
    </div>
  );
}
