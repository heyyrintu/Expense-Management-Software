// Mapping resolution and unmapped detection — PURE.
//
// ── THE RULE THIS MODULE EXISTS TO KEEP ───────────────────────────────────
// An export must never silently drop a row because its category has no GL
// code, and must never quietly substitute a default one. Both failures look
// identical from the outside — a file that imports cleanly and is wrong — and
// both are discovered a month later by a bookkeeper reconciling a control
// account.
//
// So resolution has exactly two outcomes: a code, or UNMAPPED. There is no
// third "probably fine" branch, and `findUnmapped` is what the export screen
// shows before anything is generated.
import type {
  AccountingEntityType,
  ExportableReport,
  MappingIndex,
  MappingRow,
  UnmappedEntity,
} from "./types";

function key(entityType: AccountingEntityType, localId: string): string {
  return `${entityType}:${localId}`;
}

/**
 * Index a target's mapping rows for lookup.
 *
 * Takes rows for ONE target — mixing targets would let a QuickBooks code
 * satisfy a Tally export, which is exactly the kind of "it resolved to
 * something" bug this module is written to prevent. The caller filters by
 * target in the query; the type cannot express that, so it is stated here.
 */
export function buildMappingIndex(rows: MappingRow[]): MappingIndex {
  const byKey = new Map<string, MappingRow>();
  for (const row of rows) {
    // Last wins, but the schema's unique constraint on
    // (org_id, target, entity_type, local_id) means there is never a second.
    byKey.set(key(row.entityType, row.localId), row);
  }
  return {
    get(entityType, localId) {
      return byKey.get(key(entityType, localId)) ?? null;
    },
    has(entityType, localId) {
      return byKey.has(key(entityType, localId));
    },
  };
}

/** Empty index — the "nothing configured yet" case, so callers need no null
 *  check and the unmapped list simply contains everything. */
export function emptyMappingIndex(): MappingIndex {
  return buildMappingIndex([]);
}

/**
 * Everything the given reports need a code for, that has none.
 *
 * `requiredEntities` comes from the adapter, because targets genuinely
 * differ — a Tally export posts to org-level ledger names and needs no
 * per-category code at all, while a QuickBooks journal entry cannot be built
 * without one.
 *
 * Counted BY LINE, not by entity, so the reader can fix the category that
 * blocks forty rows before the one that blocks a single expense. Sorted worst
 * first for the same reason.
 */
export function findUnmapped(
  reports: ExportableReport[],
  mapping: MappingIndex,
  requiredEntities: AccountingEntityType[],
  labels: {
    category: Map<string, string>;
    department: Map<string, string>;
    project: Map<string, string>;
    user: Map<string, string>;
  }
): UnmappedEntity[] {
  const required = new Set(requiredEntities);
  const counts = new Map<string, UnmappedEntity>();

  const note = (
    entityType: AccountingEntityType,
    localId: string | null,
    label: string
  ) => {
    if (!required.has(entityType)) return;
    // A null localId is "this line has no department", which is not the same
    // as "this department has no code" — nothing to map, so nothing to warn
    // about. Warning here would make an optional dimension look broken.
    if (!localId) return;
    if (mapping.has(entityType, localId)) return;
    const k = key(entityType, localId);
    const existing = counts.get(k);
    if (existing) existing.affectedLines += 1;
    else counts.set(k, { entityType, localId, label, affectedLines: 1 });
  };

  for (const report of reports) {
    // The employee is mapped once per report, not once per line: the journal
    // entry has one payable credit however many expenses it covers, so
    // counting per line would overstate how much of the file it blocks.
    if (required.has("user")) {
      const k = key("user", report.userId);
      if (!mapping.has("user", report.userId)) {
        const existing = counts.get(k);
        if (existing) existing.affectedLines += 1;
        else
          counts.set(k, {
            entityType: "user",
            localId: report.userId,
            label: labels.user.get(report.userId) ?? report.userName,
            affectedLines: 1,
          });
      }
    }

    for (const line of report.lines) {
      note(
        "category",
        line.categoryId,
        labels.category.get(line.categoryId) ?? line.categoryName
      );
      note(
        "department",
        line.departmentId,
        line.departmentId
          ? (labels.department.get(line.departmentId) ?? "Unknown department")
          : ""
      );
      note(
        "project",
        line.projectId,
        line.projectId
          ? (labels.project.get(line.projectId) ?? "Unknown project")
          : ""
      );
    }
  }

  return [...counts.values()].sort(
    (a, b) =>
      b.affectedLines - a.affectedLines || a.label.localeCompare(b.label)
  );
}

/** Can this set be exported at all? Convenience over `findUnmapped`, so no
 *  caller re-derives the rule as `length === 0` and gets it subtly wrong. */
export function isExportable(unmapped: UnmappedEntity[]): boolean {
  return unmapped.length === 0;
}

/**
 * The code for a local record, or a thrown error naming what is missing.
 *
 * Adapters call this rather than `mapping.get(...)?.remoteCode ?? "SOMETHING"`.
 * The throw is deliberate and is not expected to fire in normal operation:
 * the export screen refuses to generate while `findUnmapped` is non-empty, so
 * reaching this means the guard was bypassed. Failing loudly beats writing a
 * file with a placeholder account in it.
 */
export function requireCode(
  mapping: MappingIndex,
  entityType: AccountingEntityType,
  localId: string,
  label: string
): string {
  const row = mapping.get(entityType, localId);
  if (!row) {
    throw new Error(
      `Cannot export: ${entityType} "${label}" has no account code mapped. ` +
        `Map it in Settings → Accounting before exporting.`
    );
  }
  return row.remoteCode;
}
