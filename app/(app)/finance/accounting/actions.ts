"use server";

// Accounting export actions (FINAL-AUDIT §4). finance_admin only — this
// writes to the general ledger's inbox.
//
// TWO ACTIONS, ONE DERIVATION. `previewExportAction` and `runExportAction`
// call the same `resolveExport` helper, so the line count and total the
// reader approves are literally the numbers the file carries. A preview that
// re-derives its figures separately is the §7.4 trap wearing a different hat.
import { revalidatePath } from "next/cache";

import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import {
  fetchEntityLabels,
  fetchExportableReports,
  fetchMappings,
  fetchPriorExports,
} from "@/lib/accounting/queries";
import { logAudit } from "@/lib/domain/audit";
import { planExport } from "@/lib/domain/accounting-export";
import { parseOrgSettings } from "@/lib/domain/org-settings";
import {
  adapterFor,
  buildMappingIndex,
  findUnmapped,
} from "@/lib/exports/accounting";
import type { UnmappedEntity } from "@/lib/exports/accounting/types";
import { err, ok, userErrors, type Result } from "@/lib/errors";
import { exportRequestSchema } from "@/lib/schemas/accounting";

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

export type ExportPreview = {
  target: string;
  adapterLabel: string;
  /** Reports that will be written. */
  includedCount: number;
  /** Already sent to this target — blocked unless re-export is confirmed. */
  alreadyExported: Array<{ reportId: string; title: string; exportedAt: string }>;
  unmapped: UnmappedEntity[];
  lineCount: number;
  totalMinor: number;
  /** Everything green? The generate button reads this, not its own logic. */
  canExport: boolean;
  blockedReason: string | null;
};

/**
 * Everything both actions need. Pure-ish: reads, then hands the adapter
 * already-fetched data. No writes.
 *
 * A TAGGED union rather than `{ error }` vs `{ ...everything }`: presence
 * narrowing on a key that one arm merely lacks is fragile, and an action that
 * silently treated a failure as a success here would export nothing while
 * reporting that it had.
 */
type ResolveFailure = { ok: false; error: string };
type ResolveSuccess = {
  ok: true;
  db: ReturnType<typeof scopedDb>;
  adapter: NonNullable<ReturnType<typeof adapterFor>>;
  period: { start: Date; end: Date };
  selected: Awaited<ReturnType<typeof fetchExportableReports>>;
  included: Awaited<ReturnType<typeof fetchExportableReports>>;
  plan: ReturnType<typeof planExport>;
  mapping: ReturnType<typeof buildMappingIndex>;
  unmapped: UnmappedEntity[];
  config: {
    currency: string;
    expenseLedger: string;
    bankLedger: string;
    payableAccount: string;
  };
};

async function resolveExport(
  orgId: string,
  input: { target: string; start: string; end: string; reportIds: string[]; allowReExport: boolean }
): Promise<ResolveFailure | ResolveSuccess> {
  const db = scopedDb(orgId);
  const adapter = adapterFor(input.target as never);
  if (!adapter) {
    return { ok: false, error: "That accounting system isn't supported yet." };
  }

  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  const settings = parseOrgSettings(org.settings);
  const period = {
    start: new Date(`${input.start}T00:00:00.000Z`),
    end: new Date(`${input.end}T00:00:00.000Z`),
  };
  if (period.end < period.start) {
    return { ok: false, error: "The period ends before it starts." };
  }

  const all = await fetchExportableReports(db, period);
  // The reader's selection narrows the period; an empty selection means "all
  // of them", which is what the screen's default state shows.
  const selected =
    input.reportIds.length > 0
      ? all.filter((r) => input.reportIds.includes(r.id))
      : all;

  const prior = await fetchPriorExports(db, selected.map((r) => r.id));
  const plan = planExport(
    { reportIds: selected.map((r) => r.id), target: adapter.target },
    prior,
    input.allowReExport
  );

  const included = selected.filter((r) => plan.included.includes(r.id));
  const [mappingRows, labels] = await Promise.all([
    fetchMappings(db, adapter.target),
    fetchEntityLabels(db),
  ]);
  const mapping = buildMappingIndex(mappingRows);
  const unmapped = findUnmapped(included, mapping, adapter.requiredEntities, labels);

  return {
    ok: true,
    db,
    adapter,
    period,
    selected,
    included,
    plan,
    mapping,
    unmapped,
    config: {
      currency: org.currency,
      expenseLedger: settings.tallyExpenseLedger ?? "Expense Reimbursements",
      bankLedger: settings.tallyBankLedger ?? "Bank",
      payableAccount: "",
    },
  };
}

export async function previewExportAction(
  input: unknown
): Promise<Result<ExportPreview>> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = exportRequestSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const r = await resolveExport(ctx.orgId, parsed.data);
    if (!r.ok) return err(r.error);

    const titles = new Map(r.selected.map((s) => [s.id, s.title]));
    const alreadyExported = r.plan.alreadyExported
      // When a re-export is confirmed those reports ARE included, so the list
      // becomes "what you are about to re-send" rather than "what is blocked".
      .filter(() => true)
      .map((a) => ({
        reportId: a.reportId,
        title: titles.get(a.reportId) ?? a.reportId,
        exportedAt: a.exportedAt.toISOString(),
      }));

    let lineCount = 0;
    let totalMinor = 0;
    let blockedReason: string | null = null;

    if (r.unmapped.length > 0) {
      blockedReason =
        "Some accounts aren't mapped yet. An export that guessed at them would post costs to the wrong ledger.";
    } else if (r.included.length === 0) {
      blockedReason = parsed.data.allowReExport
        ? "Nothing to export in this period."
        : r.plan.alreadyExported.length > 0
          ? "Every selected report has already been exported to this system."
          : "Nothing to export in this period.";
    } else {
      // The SAME call the download makes. If it throws — an unbalanced entry,
      // say — the reader learns now rather than from a downloaded file.
      try {
        const artifact = r.adapter.buildExport(r.included, r.mapping, r.config);
        lineCount = artifact.lineCount;
        totalMinor = artifact.totalMinor;
      } catch (e) {
        blockedReason = e instanceof Error ? e.message : "That export can't be built.";
      }
    }

    return ok({
      target: r.adapter.target,
      adapterLabel: r.adapter.label,
      includedCount: r.included.length,
      alreadyExported,
      unmapped: r.unmapped,
      lineCount,
      totalMinor,
      canExport: blockedReason === null,
      blockedReason,
    });
  } catch (e) {
    const g = guardError(e);
    if (g) return g as Result<ExportPreview>;
    throw e;
  }
}

/**
 * Generate the file and RECORD the run.
 *
 * Returns the content rather than writing to object storage: the file is
 * generated on demand from data that is already durable, so persisting it
 * would add a second copy to keep consistent for no gain. `fileKey` stays
 * null, which is exactly the column state a future API adapter also produces —
 * see the schema note.
 */
export async function runExportAction(
  input: unknown
): Promise<Result<{ filename: string; mimeType: string; content: string; exportId: string }>> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = exportRequestSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const r = await resolveExport(ctx.orgId, parsed.data);
    if (!r.ok) return err(r.error);

    // The guard, server-side. The screen disables its button, but UI hiding is
    // not authorization and this action is reachable directly.
    if (r.unmapped.length > 0) {
      return err(
        `${r.unmapped.length} account${r.unmapped.length === 1 ? "" : "s"} still need mapping before this can export.`
      );
    }
    if (r.included.length === 0) {
      return err(
        r.plan.alreadyExported.length > 0
          ? "Every selected report has already been exported to this system. Tick “re-export” to send them again."
          : "Nothing to export in this period."
      );
    }

    let artifact;
    try {
      artifact = r.adapter.buildExport(r.included, r.mapping, r.config);
    } catch (e) {
      return err(e instanceof Error ? e.message : "That export can't be built.");
    }

    // Header + lines in one transaction: a run recorded without its reports
    // would let every one of them be exported again with no warning.
    const record = await r.db.accountingExport.create({
      data: {
        orgId: ctx.orgId,
        target: r.adapter.target,
        periodStart: r.period.start,
        periodEnd: r.period.end,
        exportedById: ctx.userId,
        fileKey: null,
        remoteRef: null,
        lineCount: artifact.lineCount,
        totalMinor: artifact.totalMinor,
        reports: {
          create: r.included.map((rep) => ({
            orgId: ctx.orgId,
            reportId: rep.id,
          })),
        },
      },
    });

    await logAudit(r.db, ctx, {
      entity: "AccountingExport",
      entityId: record.id,
      action: "accounting.exported",
      meta: {
        target: r.adapter.target,
        reportCount: r.included.length,
        lineCount: artifact.lineCount,
        totalMinor: artifact.totalMinor,
        reExport: parsed.data.allowReExport && r.plan.alreadyExported.length > 0,
      },
    });

    revalidatePath("/finance/accounting");
    return ok({
      filename: artifact.filename,
      mimeType: artifact.mimeType,
      content: artifact.content,
      exportId: record.id,
    });
  } catch (e) {
    const g = guardError(e);
    if (g)
      return g as Result<{
        filename: string;
        mimeType: string;
        content: string;
        exportId: string;
      }>;
    throw e;
  }
}
