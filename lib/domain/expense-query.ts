// One query builder feeds the dashboard, its tables, and the CSV export —
// so every number reconciles with every list by construction.
// Scope is derived from the ROLE server-side; orgId is injected by scopedDb.
import type { DashboardFilters } from "@/lib/schemas/dashboard";

export type ExpenseScope =
  | { kind: "employee"; userId: string }
  | { kind: "team"; teamUserIds: string[] } // approver: direct reports
  | { kind: "org" }; // finance_admin+

type Where = Record<string, unknown>;

export function buildExpenseWhere(
  scope: ExpenseScope,
  filters: DashboardFilters
): Where {
  const where: Where = {};

  if (scope.kind === "employee") {
    where.userId = scope.userId; // always pinned — never widened by filters
  } else if (scope.kind === "team") {
    where.userId = { in: scope.teamUserIds };
  }

  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T00:00:00.000Z`) } : {}),
    };
  }
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = filters.status;
  // department is a property of the expense owner
  if (filters.departmentId) {
    where.user = { departmentId: filters.departmentId };
  }
  return where;
}
