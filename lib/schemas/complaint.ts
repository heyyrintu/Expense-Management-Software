import { z } from "zod";
import { COMPLAINT_ACTIONS, COMPLAINT_TYPES } from "@/lib/domain/complaint";

export const raiseComplaintSchema = z
  .object({
    type: z.enum(COMPLAINT_TYPES),
    description: z.string().trim().min(10).max(2000),
    reportId: z.string().uuid().optional(),
    reimbursementId: z.string().uuid().optional(),
  })
  .refine((d) => Boolean(d.reportId) !== Boolean(d.reimbursementId), {
    message: "A complaint must be about exactly one report or one payment.",
    path: ["reportId"],
  });
export type RaiseComplaintInput = z.infer<typeof raiseComplaintSchema>;

export const complaintTransitionSchema = z
  .object({
    complaintId: z.string().uuid(),
    action: z.enum(COMPLAINT_ACTIONS),
    resolutionNote: z.string().trim().max(2000).optional(),
  })
  .refine(
    (d) =>
      d.action === "start_review" ||
      (typeof d.resolutionNote === "string" && d.resolutionNote.length > 0),
    { message: "A resolution note is required.", path: ["resolutionNote"] }
  );
export type ComplaintTransitionInput = z.infer<typeof complaintTransitionSchema>;

export const assignComplaintSchema = z.object({
  complaintId: z.string().uuid(),
  assigneeId: z.string().uuid(),
});

export const complaintMessageSchema = z.object({
  complaintId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export const complaintFilterSchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  age: z.enum(["all", "breached", "warning"]).optional(),
  mine: z.string().optional(),
});
