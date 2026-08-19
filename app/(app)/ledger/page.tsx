// Ledger (D4.1) — DESIGN-PRD §7.5, PLAN 7.1.
//
// A Tally-style party statement: Date · Particulars · Debit · Credit ·
// Balance, in date order, with a running balance and four totals.
//
// ── THE SCREEN AND ITS EXPORTS ARE ONE DERIVATION ─────────────────────────
// The DoD for this task is "on-screen totals match the CSV export", and the
// way that is kept is structural rather than checked: this page and
// /api/exports/ledger both call `resolveLedgerEntity` then `fetchEntityLedger`
// then `buildLedger`, with the same date window parsed by the same helper.
// Neither computes a total of its own. tests/isolation/ledger-export.test.ts
// runs both paths and compares every figure.
//
// Presentation only, per the task: every number below comes out of
// lib/domain/ledger.ts untouched.
// ──────────────────────────────────────────────────────────────────────────
import { Amount } from "@/components/ui/amount";
import { EmptyState } from "@/components/ui/empty-state";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { ExportMenu } from "@/components/ledger/export-menu";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import { scopedDb } from "@/lib/db/scoped";
import {
  entityCaveat,
  fetchEntityLedger,
  parseLedgerEntityKind,
  resolveLedgerEntity,
  type LedgerEntityKind,
} from "@/lib/analytics/ledger-entity";
import { buildLedger } from "@/lib/domain/ledger";
import {
  ledgerExportHref,
  parseLedgerWindow,
} from "@/lib/domain/ledger-params";
import { LedgerControls, type EntityOption } from "./ledger-controls";

/** Heading and subtitle for the resolved entity. */
function entityCopy(
  kind: LedgerEntityKind,
  name: string,
  isSelf: boolean
): { title: string; description: string } {
  if (kind === "project") {
    return {
      title: `Ledger — ${name}`,
      description: "Every report and payment touching this project.",
    };
  }
  if (kind === "department") {
    return {
      title: `Ledger — ${name}`,
      description: "Every member's reports, payments and advances, combined.",
    };
  }
  return {
    title: isSelf ? "My ledger" : `Ledger — ${name}`,
    description:
      "Derived live from reports, payments and advances — nothing is stored.",
  };
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireSession();
  const db = scopedDb(ctx.orgId);
  const raw = await searchParams;

  const isFinance = roleAtLeast(ctx.role, "finance_admin");
  // Below finance_admin this is forced to the reader's own user ledger
  // inside resolveLedgerEntity — the guard is there, not here, so the export
  // route gets it too.
  const kind: LedgerEntityKind = isFinance ? parseLedgerEntityKind(raw.entity) : "user";
  const entity = await resolveLedgerEntity(db, ctx, { entity: raw.entity, id: raw.id });

  const [org, options] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    // Only the pickable set for the CURRENT kind — loading users, projects
    // and departments on every render to fill a select the reader may never
    // open is three queries for one.
    (async (): Promise<EntityOption[]> => {
      if (!isFinance) return [];
      if (kind === "project") {
        return (await db.project.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })) as EntityOption[];
      }
      if (kind === "department") {
        return (await db.department.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })) as EntityOption[];
      }
      return (await db.user.findMany({
        where: { status: "active" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })) as EntityOption[];
    })(),
  ]);

  const window = parseLedgerWindow(raw);
  const caveat = entityCaveat(kind);

  // A project or department that hasn't been picked yet, or an id that
  // resolves to nothing. Not an error — the switcher is right there.
  if (!entity) {
    return (
      <>
        <PageHeader
          title="Ledger"
          description="Pick a project or department to open its rollup."
        />
        <div className="grid gap-6">
          <LedgerControls
            kind={kind}
            entityId=""
            options={options}
            canSwitchEntity={isFinance}
          />
          <EmptyState
            headline={`Choose a ${kind}`}
            description={
              options.length === 0
                ? `No ${kind === "project" ? "projects" : "departments"} have been set up yet.`
                : "Its ledger loads as soon as you pick one."
            }
          />
        </div>
      </>
    );
  }

  const { events, requested } = await fetchEntityLedger(db, entity, window);
  const { lines, totals } = buildLedger(events, requested);

  const copy = entityCopy(kind, entity.name, entity.id === ctx.userId);
  const exportBase = { entity: kind, id: entity.id, ...window.raw };

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        action={
          <ExportMenu
            csvHref={ledgerExportHref({ ...exportBase, format: "csv" })}
            tallyHref={ledgerExportHref({ ...exportBase, format: "tally" })}
          />
        }
      />

      <div className="grid gap-6">
        <LedgerControls
          kind={kind}
          entityId={entity.id}
          options={options}
          canSwitchEntity={isFinance}
        />

        {/* Print-only masthead. A printed page leaves the app behind, so it
            has to name the organisation, the party and the period itself —
            otherwise it is a table of numbers about nobody. */}
        <div className="hidden print:block">
          <h1 className="text-h2">
            {org.name} — {copy.title}
          </h1>
          <p className="text-meta tabular">
            {window.raw.from || window.raw.to
              ? `Period: ${window.raw.from ?? "start"} to ${window.raw.to ?? "today"}`
              : "Period: all time"}
          </p>
        </div>

        {caveat ? (
          <p className="text-meta text-text-tertiary max-w-3xl">{caveat}</p>
        ) : null}

        <LedgerTable lines={lines} totals={totals} currency={org.currency} />

        {/* The net position only differs from `outstanding` when advances are
            in play, and when it differs it is the number that decides who
            owes whom — so it is stated rather than left to be derived from
            the last row of the balance column. */}
        {totals.netBalance !== totals.outstanding ? (
          <p className="text-meta text-text-secondary">
            Net position including advances:{" "}
            {/* Raw minor units into <Amount>; never a pre-formatted string. */}
            <Amount
              value={totals.netBalance}
              currency={org.currency}
              className={totals.netBalance < 0 ? "text-status-danger-text" : undefined}
            />
            {totals.netBalance < 0 ? " — owed back to the organisation." : ""}
          </p>
        ) : null}
      </div>
    </>
  );
}
