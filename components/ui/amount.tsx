import * as React from "react";

import { TONE_CLASSES } from "@/lib/design/status";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Amount (D1.1) — THE way money is rendered. DESIGN-PRD §4.3: the number is
 * the hero, §5.3: tabular figures, right-aligned in tables, currency symbol
 * at the same weight as the number.
 *
 * No component formats money itself. The string comes from lib/money.ts and
 * this component only presents it — which is what makes "the same amount
 * renders identically in a table, a card, a WhatsApp message and a PDF"
 * (§4.7) enforceable rather than aspirational.
 *
 * TAKES MINOR UNITS. Passing 45.5 instead of 4550 is a bug the type system
 * can't catch, so lib/money.ts throws on non-integers rather than silently
 * rendering ₹0.46.
 */

export type AmountSize = "display" | "body" | "meta";

/**
 * Size classes. All three carry `tabular`, so a column of amounts lines up
 * whatever size it is rendered at.
 *
 * `display` and `body` are 600 weight — the hero treatment. `meta` stays at
 * 400: it is used for the secondary converted line and for amounts inside
 * running prose, neither of which should out-shout the primary figure.
 */
const SIZE_CLASSES: Record<AmountSize, string> = {
  display: "tabular text-display",
  body: "tabular text-body-strong",
  meta: "tabular text-meta",
};

export type AmountProps = {
  /** Integer MINOR units (paise/cents). null or undefined renders a dash. */
  value: number | null | undefined;
  /** ISO 4217 code. Unknown codes fall back to "CODE 1234.56". */
  currency: string;
  size?: AmountSize;
  /**
   * The same money in the org's base currency, shown on a second line.
   * For multi-currency expenses (6.4): primary is what was actually spent,
   * secondary is what it converts to — that ordering is deliberate, since
   * the employee recognises the amount they paid, not its conversion.
   */
  converted?: { value: number; currency: string } | null;
  /** Right-align for table columns (§5.3). */
  align?: "left" | "right";
  /**
   * `muted` drops the amount to secondary text — for totals that are context
   * rather than the point of the row. Negative values still take the danger
   * token: that is not decoration, it is the sign.
   */
  tone?: "default" | "muted";
  /** Replaces the dash when there is no value. */
  emptyLabel?: string;
  className?: string;
};

function Amount({
  value,
  currency,
  size = "body",
  converted,
  align = "left",
  tone = "default",
  emptyLabel = "—",
  className,
}: AmountProps) {
  const alignment = align === "right" ? "text-right" : "text-left";

  // Missing is not zero. A blank advance balance and a settled one mean very
  // different things, and rendering both as ₹0.00 hides the difference.
  if (value === null || value === undefined) {
    return (
      <span
        data-slot="amount"
        className={cn(SIZE_CLASSES[size], alignment, "text-text-tertiary font-normal", className)}
      >
        <span aria-hidden="true">{emptyLabel}</span>
        <span className="sr-only">No amount</span>
      </span>
    );
  }

  const negative = value < 0;
  const toneClass = negative
    ? TONE_CLASSES.danger.text
    : tone === "muted"
      ? "text-text-secondary"
      : "text-text-primary";

  const primary = (
    <span
      data-slot="amount"
      data-negative={negative ? "" : undefined}
      className={cn(SIZE_CLASSES[size], alignment, toneClass, className)}
    >
      {formatMoney(value, currency)}
    </span>
  );

  if (!converted) return primary;

  // Two lines, right-aligned together when the column is. The arrow is
  // decorative — a screen reader gets the relationship from the label.
  return (
    <span
      data-slot="amount-group"
      className={cn("grid gap-0", align === "right" && "justify-items-end", className)}
    >
      {primary}
      <span className={cn(SIZE_CLASSES.meta, alignment, "text-text-tertiary")}>
        <span aria-hidden="true">→ </span>
        <span className="sr-only">converts to </span>
        {formatMoney(converted.value, converted.currency)}
      </span>
    </span>
  );
}

export { Amount };
