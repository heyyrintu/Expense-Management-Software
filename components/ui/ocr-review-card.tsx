"use client";

// OCRReviewCard (D2.2) — DESIGN-PRD §6.2.
//
// Extracted merchant / date / amount as EDITABLE fields, each carrying a
// subtle "extracted" chip, with one primary "Looks right" action.
//
// FAILURE IS NORMAL HERE, AND IS STYLED THAT WAY. lib/ocr never throws and
// resolves to {} on anything it can't read — PDFs included, since the engine
// only handles images. So "couldn't read this" is an ordinary Tuesday, not an
// error, and it gets no danger token, no alert icon and no apology. Treating
// an expected outcome as a failure trains people to ignore real failures.
//
// ── ON LOW CONFIDENCE ─────────────────────────────────────────────────────
// §6.2 asks for a warning-token underline on low-confidence fields. The card
// implements it and the gallery demonstrates it, but NOTHING PASSES IT YET:
// lib/ocr's OcrResult is `{merchant?, date?, amount?}` with no confidence,
// and inventing one from field length or roundness would be a guess wearing
// a warning colour. It lights up the day the OCR layer reports confidence —
// a change in lib/ocr, not here.
// ──────────────────────────────────────────────────────────────────────────
import * as React from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type OcrField = "merchant" | "date" | "amount";

export type OcrValues = Partial<Record<OcrField, string>>;

/** Per-field confidence. Absent means "no opinion", which renders plainly. */
export type OcrConfidence = Partial<Record<OcrField, "high" | "low">>;

const FIELD_LABELS: Record<OcrField, string> = {
  merchant: "Merchant",
  date: "Date",
  amount: "Amount",
};

const FIELD_ORDER: OcrField[] = ["amount", "merchant", "date"];

export function OcrReviewCard({
  values,
  confidence = {},
  onChange,
  onAccept,
  onDismiss,
  className,
}: {
  /** What OCR read. An empty object means it read nothing. */
  values: OcrValues;
  confidence?: OcrConfidence;
  onChange: (field: OcrField, value: string) => void;
  /** Applies every value to the form. The single primary action. */
  onAccept: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  const found = FIELD_ORDER.filter((field) => values[field]);

  if (found.length === 0) {
    return (
      <div
        className={cn(
          // Neutral surface, deliberately. No danger tokens: this is the
          // expected outcome for every PDF and every blurry photo.
          "border-line bg-bg-subtle grid gap-1 rounded-lg border p-4",
          className
        )}
      >
        <p className="text-label text-text-primary">Couldn&apos;t read this receipt</p>
        <p className="text-meta text-text-secondary">
          Enter the details yourself — it&apos;s attached either way, and
          nothing is blocked.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn("border-accent-border bg-accent-subtle grid gap-3 rounded-lg border p-4", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label text-accent-text flex items-center gap-2">
          <Sparkles aria-hidden="true" className="size-4" />
          Read from your receipt
        </p>
        {onDismiss ? (
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>

      {/* Editable, not a preview. The reader is checking a machine's guess,
          and correcting it here is faster than accepting it and then hunting
          for the field to fix. */}
      <div className="grid gap-3">
        {found.map((field) => {
          const low = confidence[field] === "low";
          const inputId = `ocr-${field}`;
          const hintId = `ocr-${field}-hint`;
          return (
            <div key={field} className="grid gap-1">
              <label htmlFor={inputId} className="text-meta text-text-secondary flex items-center gap-2">
                {FIELD_LABELS[field]}
                <span className="bg-bg-surface text-text-tertiary rounded-sm px-1 text-meta">
                  extracted
                </span>
              </label>
              <Input
                id={inputId}
                value={values[field] ?? ""}
                onChange={(e) => onChange(field, e.target.value)}
                aria-describedby={low ? hintId : undefined}
                inputMode={field === "amount" ? "decimal" : undefined}
                className={cn(
                  "bg-bg-surface",
                  // Underline, not a full danger treatment: the value is
                  // probably fine, it just wants a second pair of eyes.
                  low && "border-b-2 border-b-status-warning"
                )}
              />
              {low ? (
                <p id={hintId} className="text-meta text-status-warning-text">
                  Please check this one.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* One filled button (§4.6). "Looks right" is what the reader is
          actually asserting — not "save", which they do at the bottom. */}
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={onAccept}>
          Looks right
        </Button>
      </div>
    </div>
  );
}
