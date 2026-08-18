import { z } from "zod";

// Money fields arrive as decimal strings from forms; server actions convert
// to integer minor units via lib/money. Empty string = "no limit".
export const moneyString = z
  .string()
  .regex(/^\d{1,13}(\.\d{1,2})?$/, "Enter an amount like 500 or 500.00");

export const optionalMoneyString = z.union([z.literal(""), moneyString]);

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  perExpenseLimit: optionalMoneyString,
  monthlyLimit: optionalMoneyString,
  receiptRequiredAbove: optionalMoneyString,
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const categoryIdSchema = z.object({ id: z.string().uuid() });
