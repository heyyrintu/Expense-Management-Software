import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateCell } from "@/components/ui/date-cell";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";

type FailureRow = {
  id: string;
  fromEmail: string;
  subject: string;
  reason: string;
  createdAt: Date;
};

export default async function EmailIngestionPage() {
  const ctx = await requireRole("org_admin");
  const failures: FailureRow[] = await scopedDb(ctx.orgId).inboundEmailFailure.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const mailDomain = process.env.APP_MAIL_DOMAIN ?? "(APP_MAIL_DOMAIN not set)";

  return (
    <section className="grid gap-4">
      <PageHeader
        title="Email ingestion"
        description={`Employees can email receipts to receipts+${ctx.orgSlug}@${mailDomain} from their work email — each attachment becomes a draft expense.`}
      />
      <Card>
        <CardHeader>
          <CardTitle>Dead letters</CardTitle>
          <CardDescription>
            Emails that produced nothing, and why. Only senders matching an
            active member&apos;s email are accepted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {failures.length === 0 ? (
            <p className="text-text-tertiary text-sm">No failures — all quiet.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {failures.map((f) => (
                <li key={f.id} className="flex flex-wrap gap-2">
                  <DateCell value={f.createdAt} tone="muted" />
                  <span className="font-medium">{f.fromEmail}</span>
                  {f.subject ? <span>“{f.subject}”</span> : null}
                  <span className="text-status-danger-text">— {f.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
