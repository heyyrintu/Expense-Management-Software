// WhatsApp channel settings (8.1) — org_admin. Credentials are write-only
// from the browser's point of view: only a masked hint comes back.
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import { hasEncryptionKey } from "@/lib/crypto/secret-box";
import { scopedDb } from "@/lib/db/scoped";
import { envConfig } from "@/lib/whatsapp/config";
import { formatPhone } from "@/lib/whatsapp/phone";
import { WhatsAppSettingsForm } from "./settings-form";

type AccountView = {
  enabled: boolean;
  phoneNumberId: string;
  businessPhone: string;
  tokenCipher: string | null;
  appSecretCipher: string | null;
  verifyTokenCipher: string | null;
};

export default async function WhatsAppSettingsPage() {
  const ctx = await requireRole("finance_admin");
  if (!roleAtLeast(ctx.role, "org_admin")) redirect("/settings/organization");

  const account = (await scopedDb(ctx.orgId).whatsAppAccount.findUnique({
    where: { orgId: ctx.orgId },
  })) as AccountView | null;

  const env = envConfig();
  const hint = (cipher: string | null, envValue: string | undefined) =>
    cipher ? "encrypted value saved" : envValue ? "using server default" : "not set";

  const base = process.env.AUTH_URL ?? "https://your-app.example.com";
  const linked = await scopedDb(ctx.orgId).whatsAppLink.count({
    where: { verifiedAt: { not: null } },
  });

  return (
    <section className="grid gap-6">
      <PageHeader
        title="WhatsApp"
        description="Connect your Meta WhatsApp Business number so your team can send receipts and get updates in chat. Leave it off and nothing about WhatsApp appears anywhere in the app."
      />

      <WhatsAppSettingsForm
        view={{
          enabled: account?.enabled ?? false,
          phoneNumberId: account?.phoneNumberId ?? "",
          businessPhone: account?.businessPhone
            ? formatPhone(account.businessPhone)
            : "",
          tokenHint: hint(account?.tokenCipher ?? null, env?.token),
          appSecretHint: hint(account?.appSecretCipher ?? null, env?.appSecret),
          verifyTokenHint: hint(account?.verifyTokenCipher ?? null, env?.verifyToken),
          hasEncryptionKey: hasEncryptionKey(),
          webhookUrl: `${base.replace(/\/$/, "")}/api/webhooks/whatsapp`,
        }}
      />

      <p className="text-text-tertiary text-sm">
        {linked} {linked === 1 ? "person has" : "people have"} linked a number.
        Everyone links their own from their profile page.
      </p>
    </section>
  );
}
