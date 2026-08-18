import { z } from "zod";
import { moneyString } from "./category";

// Shared by the capture form and server actions (CLAUDE.md: one schema per
// entity). Amount is a decimal string; actions convert to minor units.
export const expenseInputSchema = z.object({
  amount: moneyString,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .refine((s) => !Number.isNaN(Date.parse(s)), "Pick a valid date"),
  merchant: z.string().trim().min(1, "Merchant is required").max(80),
  categoryId: z.string().uuid("Pick a category"),
  projectId: z.union([z.literal(""), z.string().uuid()]),
  purpose: z.string().trim().max(200),
});
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const expenseIdSchema = z.object({ id: z.string().uuid() });
