"use client";

// PolicyFlagChip (D2.1) — DESIGN-PRD §6.2.
//
// "Warning token, tooltip with rule text. Appears with a 150ms fade — NEVER
// blocks or shakes the form."
//
// That last clause is the whole component. A policy flag is information, not
// a refusal: CLAUDE.md's domain rules say violations flag and never block, and
// an approver can approve one with a logged justification. So the chip fades
// in beside the field it concerns and does nothing else — no shake, no scroll,
// no focus steal, no disabled submit. It is a colleague pointing at the form,
// not a bouncer.
//
// Replaces the raw-amber FlagChips this file supersedes: colour now comes
// from the status tokens, and the rule text moves out of a `title` attribute
// (invisible to keyboard users) into a real Tooltip.
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DURATION, EASE, seconds } from "@/lib/motion";
import { TONE_CLASSES } from "@/lib/design/status";
import { cn } from "@/lib/utils";

export type FlagLike = { rule: string; message: string };

/** Short labels for the chip; the full rule text lives in the tooltip. */
const RULE_LABELS: Record<string, string> = {
  per_expense_limit: "Over limit",
  monthly_limit: "Monthly limit",
  receipt_required: "Receipt needed",
  expense_age: "Too old",
  duplicate: "Possible duplicate",
  auto_created: "Auto-created",
  email_ingested: "From email",
};

export function ruleLabel(rule: string): string {
  return RULE_LABELS[rule] ?? rule.replace(/_/g, " ");
}

export function asFlags(value: unknown): FlagLike[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (f): f is FlagLike =>
      typeof f === "object" &&
      f !== null &&
      typeof (f as FlagLike).rule === "string" &&
      typeof (f as FlagLike).message === "string"
  );
}

export function PolicyFlagChip({ flag, className }: { flag: FlagLike; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          // A chip is not a control, but it has to be reachable: the rule text
          // is the point, and a mouse-only tooltip hides it from half the
          // people who need it.
          tabIndex={0}
          role="note"
          className={cn(
            "inline-flex items-center gap-1 rounded-sm px-2 py-1 text-meta font-medium",
            "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
            TONE_CLASSES.warning.chip,
            className
          )}
        >
          <AlertTriangle aria-hidden="true" className="size-3" />
          {ruleLabel(flag.rule)}
          <span className="sr-only">— {flag.message}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{flag.message}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A row of chips that fades in over 150ms (§6.2) and does nothing else.
 *
 * Opacity only — no y-offset, no scale. A flag appearing under the field you
 * are typing in must not move anything, or you lose your place mid-amount.
 */
export function PolicyFlagChips({
  flags,
  className,
}: {
  flags: FlagLike[];
  className?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {flags.length > 0 ? (
        <motion.span
          key="flags"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: seconds(DURATION.fast), ease: [...EASE.out] },
          }}
          exit={{
            opacity: 0,
            transition: { duration: seconds(DURATION.instant), ease: [...EASE.in] },
          }}
          // polite, not assertive: a flag is worth hearing at the next pause,
          // never worth interrupting someone mid-word.
          aria-live="polite"
          className={cn("flex flex-wrap gap-1", className)}
        >
          {flags.map((flag, i) => (
            <PolicyFlagChip key={`${flag.rule}-${i}`} flag={flag} />
          ))}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}
