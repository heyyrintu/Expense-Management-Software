import { z } from "zod";
import { moneyString } from "./category";

export const budgetInputSchema = z.object({
  scopeType: z.enum(["department", "project", "category"]),
  scopeId: z.string().uuid("Pick a target"),
  period: z.enum(["monthly", "quarterly", "yearly"]),
  amount: moneyString,
});
export type BudgetInput = z.infer<typeof budgetInputSchema>;

export const budgetIdSchema = z.object({ id: z.string().uuid() });
export const budgetAmountSchema = budgetIdSchema.extend({ amount: moneyString });
