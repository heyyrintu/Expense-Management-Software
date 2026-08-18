import { z } from "zod";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const dashboardFilterSchema = z.object({
  from: dateStr.optional(),
  to: dateStr.optional(),
  categoryId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z
    .enum(["draft", "submitted", "approved", "rejected", "reimbursed"])
    .optional(),
});
export type DashboardFilters = z.infer<typeof dashboardFilterSchema>;

/** Parse raw search params into filters, dropping anything invalid. */
export function parseFilters(
  raw: Record<string, string | string[] | undefined>
): DashboardFilters {
  const pick = (k: string) =>
    typeof raw[k] === "string" && raw[k] !== "" ? (raw[k] as string) : undefined;
  const parsed = dashboardFilterSchema.safeParse({
    from: pick("from"),
    to: pick("to"),
    categoryId: pick("categoryId"),
    departmentId: pick("departmentId"),
    projectId: pick("projectId"),
    status: pick("status"),
  });
  return parsed.success ? parsed.data : {};
}
