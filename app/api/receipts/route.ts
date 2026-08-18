// Receipt upload (route handlers are reserved for uploads/webhooks/exports).
// POST /api/receipts  — multipart form: expenseId + files[]
// Rules: session user's OWN DRAFT expense only; JPG/PNG/PDF ≤ 10 MB each.
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveActing } from "@/lib/auth/acting";
import { getSessionCtx } from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { refreshExpenseFlags } from "@/lib/domain/policy-eval";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors } from "@/lib/errors";
import { extractReceipt } from "@/lib/ocr";
import { checkRateLimit, rateLimitedMessage } from "@/lib/rate-limit";
import { validateReceiptFile } from "@/lib/schemas/receipt";
import { buildReceiptKey, putReceiptObject } from "@/lib/storage/receipts";

export const runtime = "nodejs";

const paramsSchema = z.object({ expenseId: z.string().uuid() });

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getSessionCtx();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: userErrors.notAuthenticated },
      { status: 401 }
    );
  }

  if (!checkRateLimit("upload", ctx.orgId)) {
    return NextResponse.json(
      { ok: false, error: rateLimitedMessage },
      { status: 429 }
    );
  }

  const form = await request.formData();
  const parsed = paramsSchema.safeParse({ expenseId: form.get("expenseId") });
  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File);
  if (!parsed.success || files.length === 0) {
    return NextResponse.json(
      { ok: false, error: userErrors.validation },
      { status: 400 }
    );
  }

  const db = scopedDb(ctx.orgId);
  const acting = await resolveActing(ctx);
  // owner's draft expense only (principal's when acting) — else 404
  const expense = await db.expense.findUnique({
    where: {
      id: parsed.data.expenseId,
      userId: acting.effectiveUserId,
      status: "draft",
    },
    select: { id: true },
  });
  if (!expense) {
    return NextResponse.json(
      { ok: false, error: "Receipts can only be added to your draft expenses." },
      { status: 404 }
    );
  }

  for (const file of files) {
    const invalid = validateReceiptFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (invalid) {
      return NextResponse.json({ ok: false, error: invalid }, { status: 400 });
    }
  }

  const created: string[] = [];
  for (const file of files) {
    const body = Buffer.from(await file.arrayBuffer());
    const key = buildReceiptKey(ctx.orgId, expense.id, file.name);
    await putReceiptObject({
      key,
      body,
      contentType: file.type,
      fileName: file.name,
    });
    // best-effort OCR (images only; resolves to {} on failure/timeout —
    // never blocks the upload)
    const ocr = await extractReceipt({ buffer: body, mimeType: file.type });
    const hasOcr = Object.keys(ocr).length > 0;
    const receipt = await db.receipt.create({
      data: {
        orgId: ctx.orgId,
        expenseId: expense.id,
        storageKey: key,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        ...(hasOcr ? { ocrData: ocr } : {}),
      },
    });
    created.push(receipt.id);
    await logAudit(db, ctx, {
      entity: "Receipt",
      entityId: receipt.id,
      action: "receipt.uploaded",
      meta: { expenseId: expense.id, fileName: file.name, sizeBytes: file.size },
    });
  }

  await refreshExpenseFlags(db, ctx.orgId, expense.id);

  return NextResponse.json({ ok: true, data: { ids: created } });
}
