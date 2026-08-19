import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import {
  expenseAgeLimitDays,
  parseOrgSettings,
  secondApprovalThreshold,
} from "@/lib/domain/org-settings";
import { toDecimalString } from "@/lib/money";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { OrgSettingsForm } from "./org-settings-form";

export default async function OrgSettingsPage() {
  const ctx = await requireRole("finance_admin");
  const org = await scopedDb(ctx.orgId).organization.findUniqueOrThrow({
    where: { id: ctx.orgId },
  });

  return (
    <SettingsPanel
      title="Organization"
      description={`Currency, mileage rate and approval thresholds for every expense in /${org.slug}.`}
    >
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
          tallyExpenseLedger: parseOrgSettings(org.settings).tallyExpenseLedger ?? "",
          tallyBankLedger: parseOrgSettings(org.settings).tallyBankLedger ?? "",
        }}
      />
    </SettingsPanel>
  );
}
