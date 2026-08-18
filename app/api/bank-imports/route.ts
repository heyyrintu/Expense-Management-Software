// Bank statement import (PLAN 7.2). Two stages in one route:
//   stage=preview → parse headers + first 5 rows + suggested mapping (from
//                   the org's saved mapping, else header heuristics). Nothing stored.
//   stage=commit  → apply the chosen mapping, create the import + lines,
//                   run auto-reconcile, save the mapping for reuse.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCtx } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import { logAudit } from "@/lib/domain/audit";
import { splitCsvLine } from "@/lib/domain/card-import";
import {
  autoReconcile,
  parseStatementRows,
  suggestMapping,
  type ColumnMapping,
  type PaymentCandidate,
} from "@/lib/domain/reconcile";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors } from "@/lib/errors";
import { checkRateLimit, rateLimitedMessage } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

const mappingSchema = z.object({
  dateCol: z.number().int().min(0).max(100),
  amountCol: z.number().int().min(0).max(100),
  referenceCol: z.number().int().min(0).max(100),
});

async function fileToRows(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    return rows.map((r) => r.map((c) => String(c ?? "")));
  }
  return (await file.text())
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map(splitCsvLine);
}

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
  const stage = String(form.get("stage") ?? "preview");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Upload a CSV or XLSX statement up to 2 MB." },
      { status: 400 }
    );
  }

  const rows = await fileToRows(file);
  if (rows.length < 2) {
    return NextResponse.json({ ok: false, error: "The file has no data rows." }, { status: 400 });
  }
  if (rows.length - 1 > MAX_ROWS) {
    return NextResponse.json(
      { ok: false, error: `Too many rows — the limit is ${MAX_ROWS}.` },
      { status: 400 }
    );
  }
  const headers = rows[0];
  const dataRows = rows.slice(1);
  const db = scopedDb(ctx.orgId);
  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });

  if (stage === "preview") {
    const saved = (org.settings as Record<string, unknown>)?.bankStatementMapping;
    const savedMapping = mappingSchema.safeParse(saved);
    return NextResponse.json({
      ok: true,
      data: {
        headers,
        preview: dataRows.slice(0, 5),
        suggested: savedMapping.success ? savedMapping.data : suggestMapping(headers),
        savedMappingUsed: savedMapping.success,
      },
    });
  }

  // commit
  let mapping: ColumnMapping;
  try {
    mapping = mappingSchema.parse(JSON.parse(String(form.get("mapping") ?? "")));
  } catch {
    return NextResponse.json({ ok: false, error: userErrors.validation }, { status: 400 });
  }
  const parsed = parseStatementRows(dataRows, mapping);
  if (parsed.lines.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No usable debit rows with that mapping." },
      { status: 400 }
    );
  }

  const dates = parsed.lines.map((l) => l.date.getTime());
  const periodStart = new Date(Math.min(...dates));
  const periodEnd = new Date(Math.max(...dates));

  // candidates: this org's payments in the period ±3d, not yet reconciled
  const payments = (await db.reimbursement.findMany({
    where: {
      paidAt: {
        gte: new Date(periodStart.getTime() - 3 * DAY_MS),
        lte: new Date(periodEnd.getTime() + 3 * DAY_MS),
      },
      bankLine: null,
    },
    select: { id: true, amountPaid: true, paidAt: true, reference: true },
  })) as PaymentCandidate[];

  const matches = autoReconcile(parsed.lines, payments);

  const imported = await db.bankStatementImport.create({
    data: {
      orgId: ctx.orgId,
      filename: file.name,
      columnMapping: mapping,
      periodStart,
      periodEnd,
      importedById: ctx.userId,
    },
  });
  let matched = 0;
  for (let i = 0; i < parsed.lines.length; i++) {
    const l = parsed.lines[i];
    const match = matches.get(i);
    if (match) matched += 1;
    await db.bankStatementLine.create({
      data: {
        orgId: ctx.orgId,
        importId: imported.id,
        date: l.date,
        amount: l.amount,
        reference: l.reference,
        matchedReimbursementId: match?.paymentId ?? null,
        matchType: match ? "auto" : null,
      },
    });
  }

  // save the mapping for reuse
  await db.organization.update({
    where: { id: ctx.orgId },
    data: {
      settings: {
        ...((org.settings as Record<string, unknown>) ?? {}),
        bankStatementMapping: mapping,
      },
    },
  });
  await logAudit(db, ctx, {
    entity: "BankStatementImport",
    entityId: imported.id,
    action: "bank.import_created",
    meta: {
      filename: file.name,
      lines: parsed.lines.length,
      matched,
      skipped: parsed.skipped.length,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      importId: imported.id,
      lines: parsed.lines.length,
      matched,
      skipped: parsed.skipped,
    },
  });
}
