import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";

export default async function DashboardPage() {
  const ctx = await requireSession();
  const db = scopedDb(ctx.orgId);
  const [org, user] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.user.findUniqueOrThrow({ where: { id: ctx.userId } }),
  ]);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold tracking-tight">
        Welcome, {user.name}
      </h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{org.name}</CardTitle>
            <CardDescription>
              Workspace /{org.slug} · currency {org.currency}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="capitalize">
              {ctx.role.replace("_", " ")}
            </CardTitle>
            <CardDescription>
              Your role in this organization. Expense capture arrives in
              Milestone 1.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
