import { z } from "zod";

export const reportCreateSchema = z.object({
  title: z.string().trim().min(1, "Give the report a title").max(120),
});
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;

export const reportIdSchema = z.object({ id: z.string().uuid() });

export const reportExpenseSchema = z.object({
  reportId: z.string().uuid(),
  expenseId: z.string().uuid(),
});
