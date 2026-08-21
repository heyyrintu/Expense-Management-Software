import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Amount } from "@/components/ui/amount";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";

type CategoryRow = {
  id: string;
  name: string;
  perExpenseLimit: number | null;
  monthlyLimit: number | null;
  receiptRequiredAbove: number | null;
};

export default async function CategoriesPage() {
  const ctx = await requireRole("finance_admin");
  const db = scopedDb(ctx.orgId);
  const [org, categories] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <SettingsPanel
      title="Categories"
      description="Spend limits and receipt thresholds FLAG violations — they never block submission."
      action={
        <Button asChild>
          <Link href="/settings/categories/new">New category</Link>
        </Button>
      }
    >

      {categories.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>No categories yet</CardTitle>
            <CardDescription>
              Employees need at least one category to file an expense.
            </CardDescription>
            <Button asChild className="mt-2 w-fit self-center">
              <Link href="/settings/categories/new">Add your first category</Link>
            </Button>
          </CardHeader>
        </Card>
      ) : (
        <>
          {/* mobile: cards */}
          <ul className="grid gap-3 md:hidden">
            {categories.map((c: CategoryRow) => (
              <li key={c.id}>
                <Link href={`/settings/categories/${c.id}`}>
                  <Card>
                    <CardHeader>
                      <CardTitle>{c.name}</CardTitle>
                      <CardDescription>
                        Per expense{" "}
                        <Amount value={c.perExpenseLimit} currency={org.currency} size="meta" /> ·
                        monthly{" "}
                        <Amount value={c.monthlyLimit} currency={org.currency} size="meta" /> ·
                        receipt above{" "}
                        <Amount value={c.receiptRequiredAbove} currency={org.currency} size="meta" />
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
          {/* desktop: table */}
          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th scope="col" className="p-3 font-medium">Name</th>
                  <th scope="col" className="p-3 font-medium">Per-expense limit</th>
                  <th scope="col" className="p-3 font-medium">Monthly limit</th>
                  <th scope="col" className="p-3 font-medium">Receipt required above</th>
                  <th scope="col" className="p-3" />
                </tr>
              </thead>
              <tbody>
                {categories.map((c: CategoryRow) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3">
                      <Amount value={c.perExpenseLimit} currency={org.currency} />
                    </td>
                    <td className="p-3">
                      <Amount value={c.monthlyLimit} currency={org.currency} />
                    </td>
                    <td className="p-3">
                      <Amount value={c.receiptRequiredAbove} currency={org.currency} />
                    </td>
                    <td className="p-3 text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/settings/categories/${c.id}`}>Edit</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SettingsPanel>
  );
}
