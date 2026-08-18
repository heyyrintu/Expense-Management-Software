// Payment run (6.1) — replaces the 4.1 action. Route handler because a
// payment-proof file rides along. finance_admin+ only.
// multipart form:
//   payload: JSON { paidAt, method, notes?, reports: [{reportId, reference, amountPaid?}] }
//   proof:   optional JPG/PNG/PDF ≤ 10 MB, stored under /{orgId}/payment-proofs/{batchId}/
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCtx } from "@/lib/auth/guard";
import {
  allocateSettlement,
  nextAdvanceStatus,
  OPEN_ADVANCE_STATUSES,
  type AdvanceStatus,
} from "@/lib/domain/advance";
import { roleAtLeast } from "@/lib/auth/roles";
import { logAudit } from "@/lib/domain/audit";
import {
  outstandingBalance,
  planPayment,
  PAYMENT_METHODS,
} from "@/lib/domain/reimbursement";
import {
  expenseStatusFor,
  nextStatus,
  type ReportStatus,
} from "@/lib/domain/report-workflow";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors } from "@/lib/errors";
import { formatMoney, parseToMinorUnits } from "@/lib/money";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/notifications/email";
import { checkRateLimit, rateLimitedMessage } from "@/lib/rate-limit";
import { validateReceiptFile } from "@/lib/schemas/receipt";
import { buildProofKey, putProofObject } from "@/lib/storage/payment-proofs";

export const runtime = "nodejs";

const payloadSchema = z.object({
  paidAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => !Number.isNaN(Date.parse(s))),
  method: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().max(500).optional(),
  // 6.2: offset reimbursed amounts against the owner's open advances
  offsetAdvances: z.boolean().optional(),
  reports: z
    .array(
      z.object({
        reportId: z.string().uuid(),
        reference: z.string().trim().min(1).max(120),
        // decimal string; omitted = pay the full outstanding balance
        amountPaid: z.string().regex(/^\d{1,13}(\.\d{1,2})?$/).optional(),
      })
    )
    .min(1)
    .max(100),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getSessionCtx();
  if (!ctx || !roleAtLeast(ctx.role, "finance_admin")) {
    return NextResponse.json(
      { ok: false, error: userErrors.notAuthorized },
      { status: ctx ? 403 : 401 }
    );
  }
  if (!checkRateLimit("upload", ctx.orgId)) {
    return NextResponse.json({ ok: false, error: rateLimitedMessage }, { status: 429 });
  }

  const form = await request.formData();
  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(JSON.parse(String(form.get("payload") ?? "")));
  } catch {
    return NextResponse.json(
      { ok: false, error: userErrors.validation },
      { status: 400 }
    );
  }

  const proof = form.get("proof");
  let proofFile: File | null = null;
  if (proof instanceof File && proof.size > 0) {
    const invalid = validateReceiptFile({
      name: proof.name,
      type: proof.type,
      size: proof.size,
    });
    if (invalid) {
      return NextResponse.json({ ok: false, error: invalid }, { status: 400 });
    }
    proofFile = proof;
  }

  const db = scopedDb(ctx.orgId);
  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  const paidAt = new Date(`${payload.paidAt}T00:00:00.000Z`);

  const batch = await db.paymentBatch.create({
    data: {
      orgId: ctx.orgId,
      createdById: ctx.userId,
      method: payload.method,
      paidAt,
      notes: payload.notes ?? "",
    },
  });

  let proofKey: string | null = null;
  if (proofFile) {
    proofKey = buildProofKey(ctx.orgId, batch.id, proofFile.name);
    await putProofObject({
      key: proofKey,
      body: Buffer.from(await proofFile.arrayBuffer()),
      contentType: proofFile.type,
      fileName: proofFile.name,
    });
  }

  const results: Array<{ reportId: string; ok: boolean; error?: string }> = [];
  for (const item of payload.reports) {
    const report = await db.expenseReport.findUnique({
      where: { id: item.reportId },
      include: {
        user: { select: { id: true, email: true } },
        reimbursements: { select: { amountPaid: true } },
      },
    });
    if (!report) {
      results.push({ reportId: item.reportId, ok: false, error: "Report not found." });
      continue;
    }
    const balance = outstandingBalance(report.total, report.reimbursements);
    const amountPaid =
      item.amountPaid !== undefined
        ? (parseToMinorUnits(item.amountPaid) ?? -1)
        : balance;
    const plan = planPayment(balance, amountPaid);
    if ("error" in plan) {
      results.push({ reportId: item.reportId, ok: false, error: plan.error });
      continue;
    }
    const to = nextStatus(report.status as ReportStatus, plan.action);
    if (!to) {
      results.push({
        reportId: item.reportId,
        ok: false,
        error: "Only approved or partially reimbursed reports can be paid.",
      });
      continue;
    }

    await db.reimbursement.create({
      data: {
        orgId: ctx.orgId,
        reportId: report.id,
        amount: report.total,
        amountPaid,
        method: payload.method,
        paidAt,
        reference: item.reference,
        batchId: batch.id,
        proofKey,
        paidById: ctx.userId,
      },
    });
    await db.expenseReport.update({
      where: { id: report.id },
      data: { status: to },
    });
    await db.expense.updateMany({
      where: { reportId: report.id },
      data: { status: expenseStatusFor(to) },
    });
    await logAudit(db, ctx, {
      entity: "ExpenseReport",
      entityId: report.id,
      action: to === "reimbursed" ? "report.reimbursed" : "report.partially_reimbursed",
      meta: {
        amountPaid,
        balanceAfter: balance - amountPaid,
        method: payload.method,
        reference: item.reference,
        batchId: batch.id,
        proof: proofKey !== null,
      },
    });

    const recipient = [{ id: report.user.id, email: report.user.email }];
    if (to === "reimbursed") {
      await notify(db, ctx.orgId, recipient, "report.reimbursed", {
        reportId: report.id,
        reportTitle: report.title,
        totalFormatted: formatMoney(report.total, org.currency),
      });
    } else {
      // partial — custom notification with the balance
      try {
        const title = `Partial payment for “${report.title}”`;
        const body = `${formatMoney(amountPaid, org.currency)} paid (${payload.method.replace("_", " ")}, ref ${item.reference}). Outstanding: ${formatMoney(balance - amountPaid, org.currency)}.`;
        await db.notification.create({
          data: {
            orgId: ctx.orgId,
            userId: report.user.id,
            type: "report.partially_reimbursed",
            title,
            body,
            link: `/reports/${report.id}`,
          },
        });
        await sendEmail({ to: report.user.email, subject: title, text: body });
      } catch (e) {
        console.error("[reimbursements] notify failed:", e);
      }
    }
    // 6.2: settle against the owner's open advances, oldest first
    if (payload.offsetAdvances) {
      const open = (await db.advance.findMany({
        where: {
          userId: report.user.id,
          status: { in: [...OPEN_ADVANCE_STATUSES] },
        },
        orderBy: { disbursedAt: "asc" },
        select: { id: true, amount: true, settledAmount: true, status: true },
      })) as Array<{ id: string; amount: number; settledAmount: number; status: string }>;
      const { allocations } = allocateSettlement(amountPaid, open);
      for (const alloc of allocations) {
        const current = open.find((a) => a.id === alloc.advanceId)!;
        const action = alloc.newStatus === "settled" ? "settle_full" : "settle_partial";
        const to = nextAdvanceStatus(current.status as AdvanceStatus, action);
        if (!to) continue; // stale state — skip rather than corrupt
        await db.advance.update({
          where: { id: alloc.advanceId },
          data: { settledAmount: alloc.newSettledAmount, status: to },
        });
        await logAudit(db, ctx, {
          entity: "Advance",
          entityId: alloc.advanceId,
          action: "advance.settled",
          meta: {
            amount: alloc.amount,
            settledAmount: alloc.newSettledAmount,
            viaReportId: report.id,
            batchId: batch.id,
          },
        });
      }
    }

    results.push({ reportId: item.reportId, ok: true });
  }

  await logAudit(db, ctx, {
    entity: "PaymentBatch",
    entityId: batch.id,
    action: "payment_batch.created",
    meta: {
      method: payload.method,
      reports: payload.reports.length,
      paid: results.filter((r) => r.ok).length,
      proof: proofKey !== null,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      batchId: batch.id,
      paid: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok),
    },
  });
}
