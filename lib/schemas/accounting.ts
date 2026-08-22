// Accounting export + mapping schemas — one source for form and action.
import { z } from "zod";

import {
  ACCOUNTING_ENTITY_TYPES,
  ACCOUNTING_TARGETS,
} from "@/lib/exports/accounting/types";

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  // Shape is not reality: "2026-13-45" matches the regex and yields an
  // Invalid Date, which compares false against every bound and would silently
  // export nothing.
  .refine((s) => !Number.isNaN(Date.parse(s)), "Pick a valid date");

export const accountingTargetSchema = z.enum(ACCOUNTING_TARGETS);
export const accountingEntityTypeSchema = z.enum(ACCOUNTING_ENTITY_TYPES);

export const exportRequestSchema = z.object({
  target: accountingTargetSchema,
  start: dateField,
  end: dateField,
  /** Empty means "every eligible report in the period" — the screen's default. */
  reportIds: z.array(z.string().uuid()).max(500).default([]),
  /**
   * The explicit re-export confirmation. A parameter on the REQUEST, not a
   * stored preference: it must be a decision made about this run, in front of
   * the list of reports it affects.
   */
  allowReExport: z.boolean().default(false),
});
export type ExportRequest = z.infer<typeof exportRequestSchema>;

export const mappingInputSchema = z.object({
  target: accountingTargetSchema,
  entityType: accountingEntityTypeSchema,
  localId: z.string().uuid("Pick something to map"),
  remoteCode: z.string().trim().min(1, "An account code is required").max(60),
  remoteName: z.string().trim().max(120).default(""),
});
export type MappingInput = z.infer<typeof mappingInputSchema>;

export const mappingIdSchema = z.object({ id: z.string().uuid() });
