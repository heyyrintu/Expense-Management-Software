"use server";

// Complaint handling actions (7.3): assign, drive the status machine, and
// post to the thread. Rules enforced server-side:
//   * only finance_admin+ can assign or change status
//   * the disputed approver can never be assigned (canAssignComplaint)
//   * closing requires a resolution note
//   * a closed complaint is immutable — only the thread stays open
//   * AuditLog on every transition, employee notified on every status change
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
  requireSession,
} from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { logAudit } from "@/lib/domain/audit";
import {
  canAssignComplaint,
  canManageComplaint,
  canPostMessage,
  isClosed,
  nextComplaintStatus,
  requiresResolutionNote,
  type ComplaintStatus,
  type ComplaintType,
} from "@/lib/domain/complaint";
import { disputedApproverIds } from "@/lib/complaints/queries";
import { err, ok, userErrors, type Result } from "@/lib/errors";
import { notifyComplaint } from "@/lib/notifications/complaint";
import {
  assignComplaintSchema,
  complaintMessageSchema,
  complaintTransitionSchema,
} from "@/lib/schemas/complaint";
import type { Role } from "@/lib/auth/roles";

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

type LoadedComplaint = {
  id: string;
  status: ComplaintStatus;
  type: ComplaintType;
  raisedById: string;
  assignedToId: string | null;
  reportId: string | null;
  reimbursementId: string | null;
  raisedBy: { id: string; email: string };
};

const complaintSelect = {
  id: true,
  status: true,
  type: true,
  raisedById: true,
  assignedToId: true,
  reportId: true,
  reimbursementId: true,
  raisedBy: { select: { id: true, email: true } },
} as const;

async function loadOpenComplaint(
  db: ReturnType<typeof scopedDb>,
  id: string
): Promise<{ ok: false; error: string } | { ok: true; complaint: LoadedComplaint }> {
  const complaint = (await db.complaint.findUnique({
    where: { id },
    select: complaintSelect,
  })) as LoadedComplaint | null;
  if (!complaint) return { ok: false, error: "Complaint not found." };
  if (isClosed(complaint.status)) {
    return {
      ok: false,
      error: "This complaint is closed — you can still reply on the thread.",
    };
  }
  return { ok: true, complaint };
}

async function actorName(
  db: ReturnType<typeof scopedDb>,
  userId: string
): Promise<string | undefined> {
  const u = (await db.user.findUnique({
    where: { id: userId },
    select: { name: true },
  })) as { name: string } | null;
  return u?.name;
}

/** Assign (or reassign) a complaint to someone in the finance pool. */
export async function assignComplaintAction(formData: FormData): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = assignComplaintSchema.safeParse({
      complaintId: formData.get("complaintId"),
      assigneeId: formData.get("assigneeId"),
    });
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const found = await loadOpenComplaint(db, parsed.data.complaintId);
    if (!found.ok) return err(found.error);
    const complaint = found.complaint;

    const candidate = (await db.user.findUnique({
      where: { id: parsed.data.assigneeId },
      select: { id: true, name: true, role: true, email: true, status: true },
    })) as {
      id: string;
      name: string;
      role: Role;
      email: string;
      status: string;
    } | null;
    if (!candidate || candidate.status !== "active") {
      return err("That person can't take this complaint.");
    }

    const excluded = await disputedApproverIds(db, {
      reportId: complaint.reportId,
      reimbursementId: complaint.reimbursementId,
    });
    const allowed = canAssignComplaint(
      { id: candidate.id, name: candidate.name, role: candidate.role },
      { raisedById: complaint.raisedById, disputedApproverIds: excluded }
    );
    if (!allowed) {
      return err(
        excluded.includes(candidate.id)
          ? "That approver's decision is what's being disputed — pick someone else."
          : "Complaints can only be assigned to finance admins who aren't involved."
      );
    }

    await db.complaint.update({
      where: { id: complaint.id },
      data: { assignedToId: candidate.id },
    });
    await logAudit(db, ctx, {
      entity: "Complaint",
      entityId: complaint.id,
      action: "complaint.assigned",
      meta: {
        assignedToId: candidate.id,
        previousAssigneeId: complaint.assignedToId,
        excludedApproverIds: excluded,
      },
    });
    await notifyComplaint(
      db,
      ctx.orgId,
      [{ id: candidate.id, email: candidate.email }],
      "complaint.assigned",
      { complaintId: complaint.id, complaintType: complaint.type }
    );

    revalidatePath("/complaints");
    revalidatePath(`/complaints/${complaint.id}`);
    return ok(undefined);
  } catch (e) {
    return guardError(e) ?? err(userErrors.unknown);
  }
}

/** Drive the status machine: start review, resolve, or won't fix. */
export async function transitionComplaintAction(
  formData: FormData
): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    if (!canManageComplaint(ctx.role)) return err(userErrors.notAuthorized);

    const parsed = complaintTransitionSchema.safeParse({
      complaintId: formData.get("complaintId"),
      action: formData.get("action"),
      resolutionNote: (formData.get("resolutionNote") as string | null) ?? undefined,
    });
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? userErrors.validation);
    }
    const { complaintId, action, resolutionNote } = parsed.data;

    const db = scopedDb(ctx.orgId);
    const found = await loadOpenComplaint(db, complaintId);
    if (!found.ok) return err(found.error);
    const complaint = found.complaint;

    const transition = nextComplaintStatus(complaint.status, action);
    if (!transition.ok) return err(transition.error);
    if (requiresResolutionNote(action) && !resolutionNote) {
      return err("A resolution note is required.");
    }

    const closing = requiresResolutionNote(action);
    await db.complaint.update({
      where: { id: complaint.id },
      data: {
        status: transition.status,
        resolutionNote: closing ? resolutionNote : undefined,
        resolvedAt: closing ? new Date() : undefined,
        // whoever acts on an unassigned complaint takes ownership of it
        assignedToId: complaint.assignedToId ?? ctx.userId,
      },
    });

    await logAudit(db, ctx, {
      entity: "Complaint",
      entityId: complaint.id,
      action: `complaint.${action}`,
      meta: {
        from: complaint.status,
        to: transition.status,
        resolutionNote: closing ? resolutionNote : undefined,
      },
    });

    await notifyComplaint(
      db,
      ctx.orgId,
      [complaint.raisedBy],
      "complaint.status_changed",
      {
        complaintId: complaint.id,
        complaintType: complaint.type,
        status: transition.status,
        actorName: await actorName(db, ctx.userId),
        resolutionNote: closing ? resolutionNote : null,
      }
    );

    revalidatePath("/complaints");
    revalidatePath(`/complaints/${complaint.id}`);
    revalidatePath("/dashboard");
    return ok(undefined);
  } catch (e) {
    return guardError(e) ?? err(userErrors.unknown);
  }
}

/** Post to the thread — allowed even after the complaint is closed. */
export async function postComplaintMessageAction(
  formData: FormData
): Promise<Result> {
  try {
    const ctx = await requireSession();
    const parsed = complaintMessageSchema.safeParse({
      complaintId: formData.get("complaintId"),
      body: formData.get("body"),
    });
    if (!parsed.success) return err("Write a message first.");

    const db = scopedDb(ctx.orgId);
    const complaint = (await db.complaint.findUnique({
      where: { id: parsed.data.complaintId },
      select: complaintSelect,
    })) as LoadedComplaint | null;
    if (!complaint) return err("Complaint not found.");

    if (
      !canPostMessage({
        actorId: ctx.userId,
        actorRole: ctx.role,
        raisedById: complaint.raisedById,
      })
    ) {
      return err(userErrors.notAuthorized);
    }

    await db.complaintMessage.create({
      data: {
        orgId: ctx.orgId,
        complaintId: complaint.id,
        authorId: ctx.userId,
        body: parsed.data.body,
      },
    });

    // Tell the other side — employee ⇄ handler.
    const name = await actorName(db, ctx.userId);
    const recipientId =
      ctx.userId === complaint.raisedById ? complaint.assignedToId : complaint.raisedById;
    if (recipientId && recipientId !== ctx.userId) {
      const recipient = (await db.user.findUnique({
        where: { id: recipientId },
        select: { id: true, email: true },
      })) as { id: string; email: string } | null;
      if (recipient) {
        await notifyComplaint(db, ctx.orgId, [recipient], "complaint.message", {
          complaintId: complaint.id,
          complaintType: complaint.type,
          actorName: name,
        });
      }
    }

    revalidatePath(`/complaints/${complaint.id}`);
    return ok(undefined);
  } catch (e) {
    return guardError(e) ?? err(userErrors.unknown);
  }
}
