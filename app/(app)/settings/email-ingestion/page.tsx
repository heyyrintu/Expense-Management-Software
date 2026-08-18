import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";

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
      <div>
        <h1 className="text-xl font-semibold">Email ingestion</h1>
        <p className="text-muted-foreground text-sm">
          Employees can email receipts to{" "}
          <code className="bg-muted rounded px-1">
            receipts+{ctx.orgSlug}@{mailDomain}
          </code>{" "}
          from their work email — each attachment becomes a draft expense.
        </p>
      </div>
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
            <p className="text-muted-foreground text-sm">No failures — all quiet.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {failures.map((f) => (
                <li key={f.id} className="flex flex-wrap gap-2">
                  <span className="text-muted-foreground">{formatDate(f.createdAt)}</span>
                  <span className="font-medium">{f.fromEmail}</span>
                  {f.subject ? <span>“{f.subject}”</span> : null}
                  <span className="text-destructive">— {f.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
