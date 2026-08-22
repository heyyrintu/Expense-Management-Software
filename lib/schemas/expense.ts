import { z } from "zod";
import { moneyString, optionalMoneyString } from "./category";

// Shared by the capture form and server actions (CLAUDE.md: one schema per
// entity). Amount is a decimal string; actions convert to minor units.
const splitRowSchema = z.object({
  categoryId: z.string().uuid(),
  projectId: z.union([z.literal(""), z.string().uuid()]),
  value: moneyString, // amount mode; percent mode converts client-side
});

export const expenseInputSchema = z.object({
  amount: moneyString,
  // 6.4 multi-currency: ISO code + rate to the org base (required when foreign)
  currency: z.string().regex(/^[A-Z]{3}$/).default("INR"),
  fxRate: z.string().trim().max(13).default("1"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .refine((s) => !Number.isNaN(Date.parse(s)), "Pick a valid date"),
  merchant: z.string().trim().min(1, "Merchant is required").max(80),
  categoryId: z.string().uuid("Pick a category"),
  projectId: z.union([z.literal(""), z.string().uuid()]),
  purpose: z.string().trim().max(200),
  // 6.3 billable + tax
  billable: z.boolean().default(false),
  clientId: z.union([z.literal(""), z.string().uuid()]).default(""),
  taxAmount: optionalMoneyString.default(""),
  taxNumber: z.string().trim().max(30).default(""),
  // 6.3 splits (amount rows; empty = no split)
  splits: z.array(splitRowSchema).max(10).default([]),
});
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const expenseIdSchema = z.object({ id: z.string().uuid() });

// Mileage expense: amount is derived server-side (distance × org rate) —
// the form never submits an amount.
export const mileageInputSchema = z.object({
  distanceKm: z
    .string()
    .regex(/^[1-9]\d{0,4}$/, "Whole kilometres, at least 1"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .refine((s) => !Number.isNaN(Date.parse(s)), "Pick a valid date"),
  categoryId: z.string().uuid("Pick a category"),
  projectId: z.union([z.literal(""), z.string().uuid()]),
  purpose: z.string().trim().max(200),
});
export type MileageInput = z.infer<typeof mileageInputSchema>;

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  // Shape is not reality: "2026-13-45" matches the regex and yields an
  // Invalid Date, which compares false against everything downstream.
  .refine((s) => !Number.isNaN(Date.parse(s)), "Pick a valid date");

// Per-diem expense: the amount is derived server-side (rate × half-days), so
// the form never submits one. The reader picks an allowance by NAME and the
// server resolves which dated version of it applies — see lib/domain/per-diem.ts.
/**
 * The fields, WITHOUT the cross-field refinement.
 *
 * Kept separate so the update action can `.merge()` an id onto it: merging
 * onto a refined schema either drops the refinement or is not a ZodObject at
 * all, depending on the Zod version — and a validation rule that silently
 * disappears on one code path is worse than not having it.
 * `planPerDiem` re-checks the range regardless, so the server is never
 * relying on this refinement alone.
 */
export const perDiemFieldsSchema = z.object({
  rateName: z.string().trim().min(1, "Pick a per-diem rate").max(80),
  start: dateField,
  end: dateField,
  firstDayHalf: z.boolean().default(false),
  lastDayHalf: z.boolean().default(false),
  categoryId: z.string().uuid("Pick a category"),
  projectId: z.union([z.literal(""), z.string().uuid()]),
  purpose: z.string().trim().max(200),
});

// Caught here as well as in the domain so the FORM can show it on the field
// rather than as a server error after a round trip.
export const perDiemInputSchema = perDiemFieldsSchema.refine(
  (v) => v.end >= v.start,
  { message: "The end date is before the start date", path: ["end"] }
);
export type PerDiemInput = z.infer<typeof perDiemFieldsSchema>;

// ── Finance settings: the rate itself ──────────────────────────────────────
export const perDiemRateInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  location: z.string().trim().max(80).default(""),
  dailyAmount: moneyString,
  effectiveFrom: dateField,
  active: z.boolean().default(true),
});
export type PerDiemRateInput = z.infer<typeof perDiemRateInputSchema>;

export const perDiemRateIdSchema = z.object({ id: z.string().uuid() });
