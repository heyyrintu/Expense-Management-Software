import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import {
  expenseAgeLimitDays,
  secondApprovalThreshold,
} from "@/lib/domain/org-settings";
import { toDecimalString } from "@/lib/money";
import { OrgSettingsForm } from "./org-settings-form";

export default async function OrgSettingsPage() {
  const ctx = await requireRole("finance_admin");
  const org = await scopedDb(ctx.orgId).organization.findUniqueOrThrow({
    where: { id: ctx.orgId },
  });

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Organization settings</h1>
        <p className="text-muted-foreground text-sm">
          Currency and mileage rate apply to all expenses in /{org.slug}.
        </p>
      </div>
      <OrgSettingsForm
        defaults={{
          name: org.name,
          currency: org.currency,
          mileageRate: toDecimalString(org.mileageRate),
          secondApprovalAbove: (() => {
            const t = secondApprovalThreshold(org.settings);
            return t === null ? "" : toDecimalString(t);
          })(),
          expenseAgeLimitDays: (() => {
            const d = expenseAgeLimitDays(org.settings);
            return d === null ? "" : String(d);
          })(),
        }}
      />
    </section>
  );
}
