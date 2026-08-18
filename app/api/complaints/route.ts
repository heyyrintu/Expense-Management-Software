// Raise a complaint (7.3). Route handler because it accepts an optional
// attachment (multipart) — mutations without files go through server actions.
// POST /api/complaints — form: type, description, reportId | reimbursementId, file?
import { NextResponse } from "next/server";
import { getSessionCtx } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { logAudit } from "@/lib/domain/audit";
import {
  autoAssign,
  complaintTargetOf,
  typeMatchesTarget,
  COMPLAINT_TYPE_LABELS,
  type ComplaintType,
} from "@/lib/domain/complaint";
import {
  disputedApproverIds,
  financePool,
  openLoadByAssignee,
} from "@/lib/complaints/queries";
import { userErrors } from "@/lib/errors";
import { notifyComplaint } from "@/lib/notifications/complaint";
import { checkRateLimit, rateLimitedMessage } from "@/lib/rate-limit";
import { raiseComplaintSchema } from "@/lib/schemas/complaint";
import { validateReceiptFile } from "@/lib/schemas/receipt";
import { buildComplaintKey, putComplaintObject } from "@/lib/storage/complaints";

export const runtime = "nodejs";

function fieldOrUndefined(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getSessionCtx();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: userErrors.notAuthenticated },
      { status: 401 }
    );
  }
  if (!checkRateLimit("mutation", ctx.orgId)) {
    return NextResponse.json({ ok: false, error: rateLimitedMessage }, { status: 429 });
  }

  const form = await request.formData();
  const parsed = raiseComplaintSchema.safeParse({
    type: fieldOrUndefined(form, "type"),
    description: fieldOrUndefined(form, "description") ?? "",
    reportId: fieldOrUndefined(form, "reportId"),
    reimbursementId: fieldOrUndefined(form, "reimbursementId"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? userErrors.validation },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const targetResult = complaintTargetOf(input);
  if (!targetResult.ok) {
    return NextResponse.json({ ok: false, error: targetResult.error }, { status: 400 });
  }
  const target = targetResult.target;
  if (!typeMatchesTarget(input.type as ComplaintType, target)) {
    return NextResponse.json(
      {
        ok: false,
        error: `“${COMPLAINT_TYPE_LABELS[input.type as ComplaintType]}” doesn't apply to what you're disputing.`,
      },
      { status: 400 }
    );
  }

  const db = scopedDb(ctx.orgId);
  const actor = (await db.user.findUnique({
    where: { id: ctx.userId },
    select: { name: true },
  })) as { name: string } | null;

  // The complainant must own what they are disputing. Ownership is checked
  // through scopedDb, so another org's ids simply do not resolve.
  let reportId: string | null = null;
  let reimbursementId: string | null = null;
  if (target.kind === "report") {
    const report = (await db.expenseReport.findUnique({
      where: { id: target.reportId },
      select: { id: true, userId: true },
    })) as { id: string; userId: string } | null;
    if (!report || report.userId !== ctx.userId) {
      return NextResponse.json(
        { ok: false, error: "You can only raise a complaint about your own report." },
        { status: 404 }
      );
    }
    reportId = report.id;
  } else {
    const payment = (await db.reimbursement.findUnique({
      where: { id: target.reimbursementId },
      select: { id: true, report: { select: { userId: true } } },
    })) as { id: string; report: { userId: string } } | null;
    if (!payment || payment.report.userId !== ctx.userId) {
      return NextResponse.json(
        { ok: false, error: "You can only raise a complaint about your own payment." },
        { status: 404 }
      );
    }
    reimbursementId = payment.id;
  }

  // Routing: finance pool minus the complainant and every approver whose
  // decision is being disputed (enforced here, not just in the UI).
  const routing = {
    raisedById: ctx.userId,
    disputedApproverIds: await disputedApproverIds(db, { reportId, reimbursementId }),
  };
  const [pool, load] = await Promise.all([financePool(db), openLoadByAssignee(db)]);
  const assignee = autoAssign(pool, routing, load);

  const complaint = (await db.complaint.create({
    data: {
      orgId: ctx.orgId,
      raisedById: ctx.userId,
      reportId,
      reimbursementId,
      type: input.type,
      description: input.description,
      status: "open",
      assignedToId: assignee?.id ?? null,
    },
    select: { id: true },
  })) as { id: string };

  // Optional attachment. A failed upload must not lose the complaint, so it
  // is stored after creation and reported separately.
  let attachmentError: string | null = null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    const invalid = validateReceiptFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (invalid) {
      attachmentError = invalid;
    } else {
      try {
        const key = buildComplaintKey(ctx.orgId, complaint.id, file.name);
        await putComplaintObject({
          key,
          body: Buffer.from(await file.arrayBuffer()),
          contentType: file.type,
          fileName: file.name,
        });
        await db.complaint.update({
          where: { id: complaint.id },
          data: { attachmentKey: key },
        });
      } catch (e) {
        console.error("[complaints] attachment upload failed:", e);
        attachmentError = "The complaint was raised but the attachment failed to upload.";
      }
    }
  }

  await logAudit(db, ctx, {
    entity: "Complaint",
    entityId: complaint.id,
    action: "complaint.raised",
    meta: {
      type: input.type,
      reportId,
      reimbursementId,
      assignedToId: assignee?.id ?? null,
      autoAssigned: Boolean(assignee),
      excludedApproverIds: routing.disputedApproverIds,
    },
  });

  // Notify the handler (or the whole pool when nobody could take it).
  const recipientIds = assignee
    ? [assignee.id]
    : pool.filter((p) => p.id !== ctx.userId).map((p) => p.id);
  if (recipientIds.length > 0) {
    const recipients = (await db.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, email: true },
    })) as Array<{ id: string; email: string }>;
    await notifyComplaint(db, ctx.orgId, recipients, "complaint.raised", {
      complaintId: complaint.id,
      complaintType: input.type as ComplaintType,
      actorName: actor?.name,
    });
  }

  return NextResponse.json({
    ok: true,
    data: { id: complaint.id, warning: attachmentError },
  });
}
