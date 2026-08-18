import { z } from "zod";

export const decisionSchema = z
  .object({
    reportId: z.string().uuid(),
    action: z.enum(["approve", "reject", "send_back"]),
    reason: z.string().trim().max(500).optional(),
  })
  .refine(
    (d) =>
      d.action === "approve" ||
      (typeof d.reason === "string" && d.reason.length > 0),
    { message: "A reason is required.", path: ["reason"] }
  );
export type DecisionInput = z.infer<typeof decisionSchema>;

export const bulkApproveSchema = z.object({
  reportIds: z.array(z.string().uuid()).min(1).max(100),
});
