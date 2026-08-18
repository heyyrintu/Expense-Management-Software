import { z } from "zod";
import { moneyString } from "./category";

export const orgSettingsSchema = z.object({
  name: z.string().trim().min(2, "Organization name is required").max(80),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "3-letter ISO code, e.g. INR"),
  // ₹/km as a decimal string; stored as minor units per km
  mileageRate: moneyString,
});
export type OrgSettingsInput = z.infer<typeof orgSettingsSchema>;
