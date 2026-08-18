// Card statement import (route handlers are reserved for uploads).
// POST /api/card-imports — multipart form: file (CSV ≤ 1 MB).
// finance_admin+; parses, stores the batch, auto-matches (amount exact,
// date ±2 days), returns counts.
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionCtx } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import { logAudit } from "@/lib/domain/audit";
import {
  autoMatch,
  MATCH_WINDOW_DAYS,
  parseCardCsv,
  type MatchCandidate,
} from "@/lib/domain/card-import";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors } from "@/lib/errors";
import { checkRateLimit, rateLimitedMessage } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

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
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Upload a CSV file up to 1 MB." },
      { status: 400 }
    );
  }

  const parsed = parseCardCsv(await file.text());
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No usable charge rows found in the file." },
      { status: 400 }
    );
  }

  const db = scopedDb(ctx.orgId);
  const batch = randomUUID();

  // candidates: org expenses in the statement's date range (±window) that
  // aren't matched to any transaction yet
  const dates = parsed.rows.map((r) => r.date.getTime());
  const min = new Date(Math.min(...dates) - MATCH_WINDOW_DAYS * DAY_MS);
  const max = new Date(Math.max(...dates) + MATCH_WINDOW_DAYS * DAY_MS);
  const candidates = (await db.expense.findMany({
    where: {
      date: { gte: min, lte: max },
      cardTransaction: null,
    },
    select: { id: true, amount: true, date: true, merchant: true },
  })) as MatchCandidate[];

  const assignments = autoMatch(
    parsed.rows.map((r, index) => ({ index, ...r })),
    candidates
  );

  let matched = 0;
  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const expenseId = assignments.get(i) ?? null;
    if (expenseId) matched += 1;
    await db.cardTransaction.create({
      data: {
        orgId: ctx.orgId,
        importedBatch: batch,
        date: r.date,
        amount: r.amount,
        merchant: r.merchant,
        matchedExpenseId: expenseId,
      },
    });
  }

  await logAudit(db, ctx, {
    entity: "CardTransaction",
    entityId: batch,
    action: "card.batch_imported",
    meta: {
      rows: parsed.rows.length,
      matched,
      skipped: parsed.skipped.length,
      fileName: file.name,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      batch,
      imported: parsed.rows.length,
      matched,
      unmatched: parsed.rows.length - matched,
      skipped: parsed.skipped,
    },
  });
}
