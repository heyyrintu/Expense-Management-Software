import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { ChainsPanel, type RuleView } from "./chains-panel";

type RuleRow = {
  id: string;
  name: string;
  departmentId: string | null;
  aboveAmount: number | null;
  approverId: string;
  secondApproverId: string | null;
};

export default async function ApprovalChainsPage() {
  const ctx = await requireRole("org_admin");
  const db = scopedDb(ctx.orgId);
  const [org, rules, departments, eligibleApprovers] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.approvalRule.findMany({ orderBy: { createdAt: "asc" } }) as Promise<RuleRow[]>,
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { status: "active", role: { in: ["approver", "finance_admin", "org_admin"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const deptName = new Map<string, string>(
    departments.map((d: { id: string; name: string }) => [d.id, d.name])
  );
  const userName = new Map<string, string>(
    eligibleApprovers.map((u: { id: string; name: string }) => [u.id, u.name])
  );

  const views: RuleView[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    department: r.departmentId ? (deptName.get(r.departmentId) ?? "(deleted)") : "All departments",
    aboveAmount: r.aboveAmount,
    currency: org.currency,
    approver: userName.get(r.approverId) ?? "(inactive user)",
    secondApprover: r.secondApproverId
      ? (userName.get(r.secondApproverId) ?? "(inactive user)")
      : null,
  }));

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Approval chains</h1>
        <p className="text-muted-foreground text-sm">
          The most specific matching rule (department + amount, then
          department, then amount) decides who approves. Without a rule,
          reports go to the submitter&apos;s assigned approver, with finance
          sign-off above the org threshold.
        </p>
      </div>
      <ChainsPanel
        rules={views}
        departments={departments}
        approvers={eligibleApprovers}
      />
    </section>
  );
}
