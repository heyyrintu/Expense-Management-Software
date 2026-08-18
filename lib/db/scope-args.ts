// Pure argument-scoping logic for scopedDb. Kept side-effect free so it
// can be unit-tested without a database (tests/unit/scope-args.test.ts).
//
// Contract (CLAUDE.md): every query is scoped by org_id — reads are
// filtered, creates are stamped. Postgres RLS is the backstop for
// anything this layer cannot reach (raw SQL, nested writes).

/** Tenant models: carry orgId. Scoped by `orgId = <session org>`. */
export const TENANT_MODELS = [
  "User",
  "Department",
  "Project",
  "Category",
  "Expense",
  "Receipt",
  "ExpenseReport",
  "Approval",
  "Reimbursement",
  "AuditLog",
  "Notification",
  "Budget",
  "CardTransaction",
  "ReportComment",
  "ApprovalRule",
  "PaymentBatch",
  "Advance",
  "Client",
  "ExpenseSplit",
  "RecurringTemplate",
  "Delegation",
  "InboundEmailFailure",
  "BankStatementImport",
  "BankStatementLine",
] as const;

/** Organization is scoped by its own id; only reads/updates allowed. */
const ORG_MODEL = "Organization";

/** Platform-only models — never reachable through a tenant scope. */
const FORBIDDEN_MODELS = ["SuperAdmin"] as const;

/** Operations whose `where` accepts a unique input plus extra filters. */
const UNIQUE_WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
  "upsert",
]);

/** Operations with a plain (non-unique) `where` filter. */
const FILTER_WHERE_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "updateManyAndReturn",
  "deleteMany",
]);

const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

/** Organization mutations that a tenant scope must never perform. */
const ORG_FORBIDDEN_OPS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

type Rec = Record<string, unknown>;

function asRec(v: unknown): Rec {
  return (v ?? {}) as Rec;
}

/**
 * Returns a scoped copy of Prisma query args for `model`/`operation`,
 * guaranteeing the query cannot cross the `orgId` tenant boundary.
 * Throws for models/operations that must not run under a tenant scope.
 */
export function scopeArgs(
  model: string,
  operation: string,
  args: unknown,
  orgId: string
): Rec {
  const a = asRec(args);

  if ((FORBIDDEN_MODELS as readonly string[]).includes(model)) {
    throw new Error(
      `scopedDb: model ${model} is platform-level and cannot be accessed from a tenant scope`
    );
  }

  if (model === ORG_MODEL) {
    if (ORG_FORBIDDEN_OPS.has(operation)) {
      throw new Error(
        `scopedDb: ${operation} on Organization is not allowed from a tenant scope`
      );
    }
    if (UNIQUE_WHERE_OPS.has(operation)) {
      return { ...a, where: { ...asRec(a.where), id: orgId } };
    }
    if (FILTER_WHERE_OPS.has(operation)) {
      return { ...a, where: { AND: [asRec(a.where), { id: orgId }] } };
    }
    return a;
  }

  // Tenant models (incl. any future model — fail closed by scoping orgId).
  if (UNIQUE_WHERE_OPS.has(operation)) {
    const scoped: Rec = { ...a, where: { ...asRec(a.where), orgId } };
    if (operation === "upsert") {
      scoped.create = { ...asRec(a.create), orgId };
    }
    return scoped;
  }

  if (FILTER_WHERE_OPS.has(operation)) {
    return { ...a, where: { AND: [asRec(a.where), { orgId }] } };
  }

  if (CREATE_OPS.has(operation)) {
    const data = a.data;
    return {
      ...a,
      data: Array.isArray(data)
        ? data.map((d) => ({ ...asRec(d), orgId }))
        : { ...asRec(data), orgId },
    };
  }

  // Unknown/other operations (e.g. future Prisma additions): pass through —
  // Postgres RLS remains the backstop.
  return a;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** orgId must be a UUID — it is interpolated into set_config per tx. */
export function assertOrgId(orgId: string): void {
  if (!UUID_RE.test(orgId)) {
    throw new Error("scopedDb: orgId must be a UUID from the server session");
  }
}
