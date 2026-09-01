// Disburse an approved advance (6.2) — finance_admin+, optional payment
// proof rides along (reuses the 6.1 proof storage under the org prefix).
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCtx } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import {
  nextAdvanceStatus,
  type AdvanceStatus,
} from "@/lib/domain/advance";
import { logAudit } from "@/lib/domain/audit";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { sendEmail } from "@/lib/notifications/email";
import { checkRateLimit, rateLimitedMessage } from "@/lib/rate-limit";
import { validateReceiptFile } from "@/lib/schemas/receipt";
import { buildProofKey, putProofObject } from "@/lib/storage/payment-proofs";

export const runtime = "nodejs";

const payloadSchema = z.object({
  advanceId: z.string().uuid(),
  reference: z.string().trim().min(1).max(120),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getSessionCtx();
  if (!ctx || !roleAtLeast(ctx.role, "finance_admin")) {
    return NextResponse.json(
      { ok: false, error: userErrors.notAuthorized },
      { status: ctx ? 403 : 401 }
    );
  }
  if (!(await checkRateLimit("upload", ctx.orgId))) {
    return NextResponse.json({ ok: false, error: rateLimitedMessage }, { status: 429 });
  }

  const form = await request.formData();
  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(JSON.parse(String(form.get("payload") ?? "")));
  } catch {
    return NextResponse.json({ ok: false, error: userErrors.validation }, { status: 400 });
  }

  const db = scopedDb(ctx.orgId);
  const advance = await db.advance.findUnique({
    where: { id: payload.advanceId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!advance) {
    return NextResponse.json({ ok: false, error: "Advance not found." }, { status: 404 });
  }
  const to = nextAdvanceStatus(advance.status as AdvanceStatus, "disburse");
  if (!to) {
    return NextResponse.json(
      { ok: false, error: "Only approved advances can be disbursed." },
      { status: 400 }
    );
  }

  let proofKey: string | null = null;
  const proof = form.get("proof");
  if (proof instanceof File && proof.size > 0) {
    const invalid = validateReceiptFile({
      name: proof.name,
      type: proof.type,
      size: proof.size,
    });
    if (invalid) {
      return NextResponse.json({ ok: false, error: invalid }, { status: 400 });
    }
    proofKey = buildProofKey(ctx.orgId, `advance-${advance.id}`, proof.name);
    await putProofObject({
      key: proofKey,
      body: Buffer.from(await proof.arrayBuffer()),
      contentType: proof.type,
      fileName: proof.name,
    });
  }

  await db.advance.update({
    where: { id: advance.id },
    data: {
      status: to,
      disbursedAt: new Date(),
      disbursementRef: payload.reference,
      disbursementProofKey: proofKey,
    },
  });
  await logAudit(db, ctx, {
    entity: "Advance",
    entityId: advance.id,
    action: "advance.disbursed",
    meta: { amount: advance.amount, reference: payload.reference, proof: proofKey !== null },
  });

  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  try {
    const title = "Advance disbursed";
    const body = `${formatMoney(advance.amount, org.currency)} is on its way (ref ${payload.reference}). It will settle against your future expense reports.`;
    await db.notification.create({
      data: {
        orgId: ctx.orgId,
        userId: advance.user.id,
        type: "advance.disbursed",
        title,
        body,
        link: "/advances",
      },
    });
    await sendEmail({ to: advance.user.email, subject: title, text: body });
  } catch (e) {
    console.error("[advances] notify failed:", e);
  }

  return NextResponse.json({ ok: true, data: { id: advance.id } });
}
