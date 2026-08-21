import { Amount } from "@/components/ui/amount";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import { outstandingAdvance } from "@/lib/domain/advance";
import { scopedDb } from "@/lib/db/scoped";
import { AdvancesPanel, type AdvanceView } from "./advances-panel";
import { RegisterPanel, type RegisterRow } from "./register-panel";

type AdvanceRow = {
  id: string;
  amount: number;
  purpose: string;
  tripStart: Date | null;
  tripEnd: Date | null;
  status: string;
  settledAmount: number;
  disbursementRef: string | null;
  createdAt: Date;
  user: { name: string };
};

export default async function AdvancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireSession();
  const db = scopedDb(ctx.orgId);
  const isFinance = roleAtLeast(ctx.role, "finance_admin");
  const raw = await searchParams;
  const statusFilter =
    typeof raw.status === "string" && raw.status !== "" ? raw.status : undefined;

  const [org, mine] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.advance.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }) as Promise<AdvanceRow[]>,
  ]);

  const toView = (a: AdvanceRow): AdvanceView => ({
    id: a.id,
    amount: a.amount,
    currency: org.currency,
    outstanding:
      a.status === "disbursed" || a.status === "partially_settled"
        ? outstandingAdvance(a.amount, a.settledAmount)
        : null,
    purpose: a.purpose,
    trip: a.tripStart && a.tripEnd ? { start: a.tripStart, end: a.tripEnd } : null,
    status: a.status,
    reference: a.disbursementRef,
    when: a.createdAt,
  });

  let register: RegisterRow[] = [];
  let outstandingTotal = 0;
  if (isFinance) {
    const all = (await db.advance.findMany({
      where: statusFilter ? { status: statusFilter as never } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true } } },
    })) as AdvanceRow[];
    register = all.map((a) => ({
      ...toView(a),
      ownerName: a.user.name,
      approved: a.status === "approved",
    }));
    const open = (await db.advance.findMany({
      where: { status: { in: ["disbursed", "partially_settled"] } },
      select: { amount: true, settledAmount: true },
    })) as Array<{ amount: number; settledAmount: number }>;
    outstandingTotal = open.reduce(
      (sum, a) => sum + outstandingAdvance(a.amount, a.settledAmount),
      0
    );
  }

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Advances</h1>
        <p className="text-text-tertiary text-sm">
          Request money before a trip — approved advances settle against your
          future expense reports.
        </p>
      </div>

      <AdvancesPanel mine={mine.map(toView)} />

      {isFinance ? (
        <div className="grid gap-3">
          <Card>
            <CardHeader>
              <CardTitle>Advance register</CardTitle>
              <CardDescription>
                Org-wide advances · outstanding total{" "}
                <Amount value={outstandingTotal} currency={org.currency} />
              </CardDescription>
            </CardHeader>
          </Card>
          <RegisterPanel rows={register} statusFilter={statusFilter ?? ""} />
        </div>
      ) : null}
    </section>
  );
}
