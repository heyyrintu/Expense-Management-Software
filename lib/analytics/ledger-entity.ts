// Ledger entity resolution and rollups (D4.1) — PLAN 7.1's "rollup ledgers
// per project and per department (same line format, aggregated)".
//
// Until D4.1 the ledger existed only per user; the screen carried a footnote
// pointing at Analytics instead. The entity switcher §7.5 asks for needs the
// other two to be real, so this module derives them — and derives them ONCE,
// for both the screen and the CSV/Tally exports, because a ledger that
// disagrees with its own export is worse than no export.
//
// ── WHERE THE ARITHMETIC LIVES ────────────────────────────────────────────
// Nowhere here. Every number below is produced by `proportionalAllocate` and
// `buildLedger` in lib/domain/ledger.ts, unchanged. This file only decides
// WHICH source rows belong to an entity; the running balance, the totals and
// the credit/debit sense stay in one tested place.
// ──────────────────────────────────────────────────────────────────────────
import type { SessionCtx } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import type { ScopedDb } from "@/lib/db/scoped";
import { proportionalAllocate, type LedgerEvent } from "@/lib/domain/ledger";
import { fetchLedgerEvents, type LedgerWindow } from "./ledger";

export const LEDGER_ENTITY_KINDS = ["user", "project", "department"] as const;
export type LedgerEntityKind = (typeof LEDGER_ENTITY_KINDS)[number];

export type LedgerEntity = {
  kind: LedgerEntityKind;
  id: string;
  name: string;
};

/** Reports that have reached at least "submitted" — the ones with a total
 *  worth counting as requested. Mirrors lib/analytics/ledger.ts. */
const LEDGER_REPORT_STATUSES = [
  "submitted",
  "approved",
  "partially_reimbursed",
  "reimbursed",
] as const;

export function parseLedgerEntityKind(
  raw: string | string[] | undefined
): LedgerEntityKind {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (LEDGER_ENTITY_KINDS as readonly string[]).includes(value ?? "")
    ? (value as LedgerEntityKind)
    : "user";
}

/**
 * Which entity the reader is actually allowed to open.
 *
 * ── THIS IS A GUARD, NOT A LOOKUP ─────────────────────────────────────────
 * An employee may only ever read their OWN user ledger: a project or
 * department rollup aggregates colleagues' reports and payments, which is
 * finance's view of the organisation, not a personal statement. So anything
 * below finance_admin is forced back to `{ kind: "user", id: self }` no
 * matter what the query string asks for — the same shape as the expense
 * list's scope ceiling in lib/domain/expense-scope.ts, and for the same
 * reason: a URL parameter that can widen a query has to be clamped where it
 * is read, not where it is rendered.
 * ──────────────────────────────────────────────────────────────────────────
 */
export async function resolveLedgerEntity(
  db: ScopedDb,
  ctx: SessionCtx,
  raw: { entity?: string | string[]; id?: string | string[] }
): Promise<LedgerEntity | null> {
  const isFinance = roleAtLeast(ctx.role, "finance_admin");
  const requestedId = Array.isArray(raw.id) ? raw.id[0] : raw.id;
  const kind = isFinance ? parseLedgerEntityKind(raw.entity) : "user";

  if (kind === "user") {
    const id = isFinance && requestedId ? requestedId : ctx.userId;
    const user = (await db.user.findUnique({
      where: { id },
      select: { id: true, name: true },
    })) as { id: string; name: string } | null;
    return user ? { kind: "user", id: user.id, name: user.name } : null;
  }

  if (!requestedId) return null;

  if (kind === "project") {
    const project = (await db.project.findUnique({
      where: { id: requestedId },
      select: { id: true, name: true },
    })) as { id: string; name: string } | null;
    return project ? { kind: "project", id: project.id, name: project.name } : null;
  }

  const department = (await db.department.findUnique({
    where: { id: requestedId },
    select: { id: true, name: true },
  })) as { id: string; name: string } | null;
  return department
    ? { kind: "department", id: department.id, name: department.name }
    : null;
}

function inWindow(d: Date, w: LedgerWindow): boolean {
  if (w.from && d < w.from) return false;
  if (w.to && d > w.to) return false;
  return true;
}

/**
 * One report's share of a project, in exact integer minor units.
 *
 * The allocation runs over EVERY project on the report, not just the one
 * being asked for, and then reads a single key. That matters: allocating
 * one share in isolation would floor it and lose the remainder, so the three
 * project ledgers of a split report would not add back up to the report.
 * Allocating the whole thing and taking a key keeps the set lossless, and
 * the screen and the export get the identical figure because both call this.
 */
function projectShare(
  total: number,
  expenses: Array<{ projectId: string | null; baseAmount: number }>,
  projectId: string
): number {
  const weights = new Map<string, number>();
  for (const e of expenses) {
    const key = e.projectId ?? "—";
    weights.set(key, (weights.get(key) ?? 0) + e.baseAmount);
  }
  const allocated = proportionalAllocate(
    total,
    [...weights.entries()].map(([key, weight]) => ({ key, weight }))
  );
  return allocated.get(projectId) ?? 0;
}

/** Ledger events for a project: report credits and payment debits, each
 *  apportioned by that project's share of the report. */
async function fetchProjectLedger(
  db: ScopedDb,
  projectId: string,
  window: LedgerWindow
): Promise<{ events: LedgerEvent[]; requested: number }> {
  const [reports, payments] = await Promise.all([
    db.expenseReport.findMany({
      where: {
        status: { in: [...LEDGER_REPORT_STATUSES] },
        expenses: { some: { projectId } },
      },
      select: {
        id: true,
        title: true,
        total: true,
        status: true,
        submittedAt: true,
        user: { select: { name: true } },
        expenses: { select: { projectId: true, baseAmount: true } },
        approvals: {
          where: { action: "approved" },
          orderBy: { actedAt: "desc" },
          take: 1,
          select: { actedAt: true },
        },
      },
    }) as Promise<
      Array<{
        id: string;
        title: string;
        total: number;
        status: string;
        submittedAt: Date | null;
        user: { name: string };
        expenses: Array<{ projectId: string | null; baseAmount: number }>;
        approvals: Array<{ actedAt: Date }>;
      }>
    >,
    db.reimbursement.findMany({
      where: { report: { expenses: { some: { projectId } } } },
      select: {
        id: true,
        amountPaid: true,
        paidAt: true,
        reference: true,
        method: true,
        batchId: true,
        report: {
          select: {
            title: true,
            user: { select: { name: true } },
            expenses: { select: { projectId: true, baseAmount: true } },
          },
        },
      },
    }) as Promise<
      Array<{
        id: string;
        amountPaid: number;
        paidAt: Date;
        reference: string;
        method: string;
        batchId: string | null;
        report: {
          title: string;
          user: { name: string };
          expenses: Array<{ projectId: string | null; baseAmount: number }>;
        };
      }>
    >,
  ]);

  let requested = 0;
  const events: LedgerEvent[] = [];

  for (const r of reports) {
    const share = projectShare(r.total, r.expenses, projectId);
    if (share <= 0) continue;
    requested += share;
    if (r.status === "submitted") continue; // requested, not yet owed
    const date = r.approvals[0]?.actedAt ?? r.submittedAt ?? new Date(0);
    if (!inWindow(date, window)) continue;
    events.push({
      kind: "report_approved",
      id: r.id,
      date,
      // Whose report it was matters in a rollup — "August travel" alone is
      // unidentifiable once four people's reports sit in one ledger.
      title: `${r.title} — ${r.user.name}`,
      amount: share,
    });
  }

  for (const p of payments) {
    const share = projectShare(p.amountPaid, p.report.expenses, projectId);
    if (share <= 0) continue;
    if (!inWindow(p.paidAt, window)) continue;
    events.push({
      kind: "payment",
      id: p.id,
      date: p.paidAt,
      title: `${p.report.title} — ${p.report.user.name}`,
      amount: share,
      reference: p.reference,
      method: p.method,
      batchId: p.batchId,
    });
  }

  return { events, requested };
}

/**
 * Ledger events for a department: the union of its members' ledgers.
 *
 * No apportionment — an expense belongs to exactly one person and a person to
 * exactly one department, so every amount lands whole. Advances are included
 * here and excluded from the project rollup, because an advance is issued to
 * a PERSON and carries no project; see `entityCaveat` below, which says so on
 * screen rather than leaving the reader to notice a missing line.
 */
async function fetchDepartmentLedger(
  db: ScopedDb,
  departmentId: string,
  window: LedgerWindow
): Promise<{ events: LedgerEvent[]; requested: number }> {
  const members = (await db.user.findMany({
    where: { departmentId },
    select: { id: true, name: true },
  })) as Array<{ id: string; name: string }>;

  const perMember = await Promise.all(
    members.map(async (m) => {
      const { events, requested } = await fetchLedgerEvents(db, m.id, window);
      return {
        requested,
        // Same reason as the project rollup: name the person, or a department
        // ledger is a list of anonymous amounts.
        events: events.map((e) => ({ ...e, title: `${e.title} — ${m.name}` })),
      };
    })
  );

  return {
    events: perMember.flatMap((p) => p.events),
    requested: perMember.reduce((sum, p) => sum + p.requested, 0),
  };
}

/** THE entry point. Both /ledger and /api/exports/ledger call this. */
export async function fetchEntityLedger(
  db: ScopedDb,
  entity: LedgerEntity,
  window: LedgerWindow = {}
): Promise<{ events: LedgerEvent[]; requested: number }> {
  if (entity.kind === "user") return fetchLedgerEvents(db, entity.id, window);
  if (entity.kind === "project") return fetchProjectLedger(db, entity.id, window);
  return fetchDepartmentLedger(db, entity.id, window);
}

/**
 * What this rollup cannot show, in one sentence, or null when nothing is
 * missing.
 *
 * A rollup that quietly drops a category of line is a ledger someone will
 * reconcile against Tally and lose an afternoon to. Saying it on screen costs
 * one line of meta text.
 */
export function entityCaveat(kind: LedgerEntityKind): string | null {
  if (kind === "project") {
    return "Report and payment amounts are apportioned by each project's share of the report. Advances are excluded — an advance is issued to a person and carries no project.";
  }
  if (kind === "department") {
    return "The union of every member's ledger, including advances. People who changed department appear under their current one.";
  }
  return null;
}
