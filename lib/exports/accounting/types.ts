// The accounting export layer's contract (FINAL-AUDIT §4).
//
// ── WHAT THIS LAYER IS FOR ────────────────────────────────────────────────
// Sage syncs two ways with Intacct, QuickBooks, NetSuite and Xero. We export
// CSV and Tally XML. Closing that gap properly is an OAuth app, a token
// store, webhook receivers and conflict resolution per vendor — far more than
// one session. What one session CAN do is build the layer underneath, so the
// eventual API adapter is a new file rather than a reshaping of everything.
//
// ── THE SHAPE THAT MAKES THAT TRUE ────────────────────────────────────────
// An adapter is a PURE FUNCTION over already-fetched data:
//
//     buildExport(reports, mapping, config) -> AccountingArtifact
//
// No network, no database, no partial writes. That is not stylistic
// pedantry — it is what lets the export screen show the reader an exact line
// count and total BEFORE committing anything, because the preview and the
// download are literally the same call. An adapter that fetched or wrote as
// it went could not be previewed, and a preview that re-derives the numbers
// separately is the §7.4 trap (a figure that disagrees with what you get).
//
// A future two-way adapter implements the SAME `buildExport` and adds a
// `deliver` step. The artifact it produces is a JSON payload rather than a
// file, `AccountingExport.fileKey` stays null, and `remoteRef` records what
// the remote system called the batch. Both columns already exist. The
// optional `deliver` slot below is declared but deliberately unimplemented —
// declaring it is how the shape is committed to; implementing it is the next
// session's work.
import type { LedgerLine } from "@/lib/domain/ledger";

export const ACCOUNTING_TARGETS = [
  "quickbooks",
  "xero",
  "netsuite",
  "tally",
  "generic",
] as const;
export type AccountingTarget = (typeof ACCOUNTING_TARGETS)[number];

export const ACCOUNTING_ENTITY_TYPES = [
  "category",
  "department",
  "project",
  "user",
  "tax",
] as const;
export type AccountingEntityType = (typeof ACCOUNTING_ENTITY_TYPES)[number];

// ── Input: a report, flattened to what an accounting system needs ──────────
//
// Deliberately NOT the Prisma row. An adapter must not be able to reach into
// relations and issue a lazy query — the type is the enforcement of "pure
// function over already-fetched data".

export type ExportableLine = {
  expenseId: string;
  /** Calendar date at UTC midnight. */
  date: Date;
  merchant: string;
  /** Integer minor units, ORG BASE currency. */
  amountMinor: number;
  categoryId: string;
  categoryName: string;
  departmentId: string | null;
  projectId: string | null;
  /** Tax portion in minor units, when the org captures it (6.3). */
  taxMinor: number | null;
  purpose: string;
};

export type ExportableReport = {
  id: string;
  title: string;
  /** The date the journal entry is dated. */
  submittedAt: Date;
  /** Integer minor units — the report's own total, authoritative. */
  totalMinor: number;
  userId: string;
  userName: string;
  userEmail: string;
  lines: ExportableLine[];
};

// ── Mapping ────────────────────────────────────────────────────────────────

export type MappingRow = {
  entityType: AccountingEntityType;
  localId: string;
  remoteCode: string;
  remoteName: string | null;
};

/** Resolved lookup. `null` means unmapped — never a fallback code. */
export type MappingIndex = {
  get(entityType: AccountingEntityType, localId: string): MappingRow | null;
  has(entityType: AccountingEntityType, localId: string): boolean;
};

/** One thing an export needs a code for and hasn't got one. */
export type UnmappedEntity = {
  entityType: AccountingEntityType;
  localId: string;
  /** The local name, so the warning reads "Travel", not a UUID. */
  label: string;
  /** How many report lines depend on it — the reader fixes the worst first. */
  affectedLines: number;
};

// ── Output ─────────────────────────────────────────────────────────────────

export type AccountingArtifact = {
  filename: string;
  mimeType: string;
  /** The whole file. Adapters build strings, never streams — an export
   *  finance can preview is an export that fits in memory by definition. */
  content: string;
  /** Rows in the file EXCLUDING any header, so the preview and the file
   *  agree on what "12 lines" means. */
  lineCount: number;
  /** Integer minor units. The sum the reader checks against the batch. */
  totalMinor: number;
};

export type AdapterConfig = {
  /** ISO 4217, from the org. */
  currency: string;
  /** Ledger/account names for targets that need them (Tally). */
  expenseLedger: string;
  bankLedger: string;
  /** Fallback account code used ONLY by targets that permit one. Never a
   *  substitute for a mapping — see the note in adapters/quickbooks.ts. */
  payableAccount: string;
};

export type AccountingAdapter = {
  target: AccountingTarget;
  /** Shown in the target picker. */
  label: string;
  /** One line under the label — what the file is and what imports it. */
  description: string;
  /**
   * Entity types that MUST be mapped before this target can export.
   *
   * Per-adapter because targets genuinely differ: a QuickBooks journal entry
   * needs a GL account per category and a payable account per employee; the
   * Tally writer posts against org-level ledger names and needs neither.
   * Declaring it here is what lets one unmapped-warning implementation serve
   * every adapter.
   */
  requiredEntities: AccountingEntityType[];
  buildExport(
    reports: ExportableReport[],
    mapping: MappingIndex,
    config: AdapterConfig
  ): AccountingArtifact;
  /**
   * NOT IMPLEMENTED THIS SESSION — the slot a two-way adapter fills.
   *
   * Declared so the contract is settled: delivery is a SEPARATE step from
   * building, which is what keeps `buildExport` previewable. An API adapter
   * builds the same artifact, then pushes it and returns the remote id that
   * `AccountingExport.remoteRef` was added to hold.
   */
  deliver?: (
    artifact: AccountingArtifact
  ) => Promise<{ remoteRef: string } | { error: string }>;
};

/** Ledger lines, for the Tally adapter which works from the ledger rather
 *  than from reports. Re-exported so adapters need one import site. */
export type { LedgerLine };
