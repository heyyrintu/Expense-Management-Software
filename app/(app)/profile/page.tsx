// Profile (D4.4) — the employee's own settings.
//
// It lives outside the /settings tree because it needs no admin role, but it
// wears the same furniture: `SettingsPanel` + `SettingsSection`, so moving
// between "my profile" and "the organisation's settings" doesn't feel like
// moving between two products. The settings nav lists it first for the same
// reason.
import { SettingsPanel, SettingsSection } from "@/components/settings/settings-panel";
import { requireSession } from "@/lib/auth/guard";
import { maskAccountNumber } from "@/lib/domain/reimbursement";
import { scopedDb } from "@/lib/db/scoped";
import { formatPhone } from "@/lib/whatsapp/phone";
import { whatsappEnabledFor } from "@/lib/whatsapp";
import { BankDetailsForm } from "./bank-details-form";
import { WhatsAppPanel } from "./whatsapp-panel";

export default async function ProfilePage() {
  const ctx = await requireSession();
  const user = await scopedDb(ctx.orgId).user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: {
      name: true,
      email: true,
      bankAccountName: true,
      bankAccountNumber: true,
      bankIfsc: true,
      upiId: true,
    },
  });

  // WhatsApp is entirely hidden unless the org has the channel configured.
  const whatsappEnabled = await whatsappEnabledFor(ctx.orgId);
  const link = whatsappEnabled
    ? ((await scopedDb(ctx.orgId).whatsAppLink.findUnique({
        where: { userId: ctx.userId },
        select: {
          phoneE164: true,
          verifiedAt: true,
          otpHash: true,
          optedOut: true,
        },
      })) as {
        phoneE164: string;
        verifiedAt: Date | null;
        otpHash: string | null;
        optedOut: boolean;
      } | null)
    : null;
  const waStatus: "none" | "pending" | "linked" = !link
    ? "none"
    : link.verifiedAt
      ? "linked"
      : "pending";

  return (
    <SettingsPanel title="My profile" description={`${user.name} · ${user.email}`}>
      <SettingsSection
        title="Bank details for reimbursement"
        description="Finance uses these to pay you. The account number is stored on the server and only ever sent to this page when you ask to see it."
      >
        <BankDetailsForm
          defaults={{
            bankAccountName: user.bankAccountName ?? "",
            bankIfsc: user.bankIfsc ?? "",
            upiId: user.upiId ?? "",
          }}
          // The MASKED form only. The full number reaches the browser solely
          // through revealOwnAccountNumberAction, on request.
          maskedAccountNumber={
            user.bankAccountNumber ? maskAccountNumber(user.bankAccountNumber) : null
          }
        />
      </SettingsSection>

      {whatsappEnabled ? (
        <SettingsSection
          title="WhatsApp"
          description="Link your number to send receipts straight from your phone and get updates about your reports."
        >
          <WhatsAppPanel
            status={waStatus}
            phone={link ? formatPhone(link.phoneE164) : null}
            optedOut={link?.optedOut ?? false}
          />
        </SettingsSection>
      ) : null}
    </SettingsPanel>
  );
}
