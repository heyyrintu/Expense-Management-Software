// Settings shell (D4.4) — left section nav, right form panel, one column
// under md.
//
// The nav is role-filtered by `visibleSettingsGroups`, which MIRRORS the
// guards already on each route — the redirect below and the `requireRole`
// inside every page. Hiding a link is not a permission; typing the URL still
// hits the real check.
import { redirect } from "next/navigation";

import { SettingsNav } from "@/components/settings/settings-nav";
import { getSessionCtx } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import { visibleSettingsGroups } from "@/lib/settings/nav";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getSessionCtx();
  if (!ctx) redirect("/login");
  // UI gate only — every action re-checks with requireRole(...).
  if (!roleAtLeast(ctx.role, "finance_admin")) redirect("/dashboard");

  return (
    // 12 columns from md, nav taking three. Below md the nav flows above the
    // panel as a horizontal scroller — same DOM, different layout.
    <div className="grid gap-6 md:grid-cols-12 md:gap-8">
      <div className="md:col-span-3">
        <SettingsNav groups={visibleSettingsGroups(ctx.role)} />
      </div>
      <div className="min-w-0 md:col-span-9">{children}</div>
    </div>
  );
}
