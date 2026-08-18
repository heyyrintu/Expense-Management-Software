import { z } from "zod";
import { moneyString, optionalMoneyString } from "./category";

export const orgSettingsSchema = z.object({
  name: z.string().trim().min(2, "Organization name is required").max(80),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "3-letter ISO code, e.g. INR"),
  // ₹/km as a decimal string; stored as minor units per km
  mileageRate: moneyString,
  // reports above this need a second approval; empty = single-level
  secondApprovalAbove: optionalMoneyString,
  // flag expenses older than N days; empty = rule disabled
  expenseAgeLimitDays: z.union([
    z.literal(""),
    z.string().regex(/^[1-9]\d{0,3}$/, "Whole days, e.g. 90"),
  ]),
});
export type OrgSettingsInput = z.infer<typeof orgSettingsSchema>;
