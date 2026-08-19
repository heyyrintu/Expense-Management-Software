// Settings navigation model (D4.4).
//
// ── UI HIDING IS NOT AUTHORIZATION ────────────────────────────────────────
// Every `minRole` below MIRRORS a guard that already exists on the route —
// `requireRole("finance_admin")` or `requireRole("org_admin")` inside the
// page, plus the redirect in app/(app)/settings/layout.tsx. This file only
// decides what is worth showing someone; typing the URL still hits the real
// guard. Same contract as components/shell/nav.ts, and asserted the same way
// in tests/unit/settings-nav.test.ts.
// ──────────────────────────────────────────────────────────────────────────
//
// The grouping is the task's list, with the app's existing routes slotted
// under it. Two groups do work here: "Policies" collects the rules that
// decide who approves what, and "Integrations" collects the two channels
// expenses arrive through. Both were previously loose links in one long row,
// where "Delegations" sat beside "Categories" as though they were the same
// kind of thing.
import { roleAtLeast, type Role } from "@/lib/auth/roles";

export type SettingsItem = {
  label: string;
  href: string;
  /** One line under the label in the nav — settings names age badly alone. */
  hint: string;
  /** Mirrors the route's own server guard. See the header note. */
  minRole: Role;
};

export type SettingsGroup = {
  id: string;
  label: string;
  items: SettingsItem[];
};

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "you",
    label: "You",
    items: [
      // /profile is outside the settings tree but belongs in this nav: it is
      // where a reader looks for "my settings", and sending them hunting
      // through the avatar menu for it helps nobody.
      {
        label: "Profile",
        href: "/profile",
        hint: "Bank details and WhatsApp",
        minRole: "employee",
      },
    ],
  },
  {
    id: "organisation",
    label: "Organisation",
    items: [
      {
        label: "Organization",
        href: "/settings/organization",
        hint: "Currency, mileage, thresholds",
        minRole: "finance_admin",
      },
      {
        label: "Users",
        href: "/settings/users",
        hint: "Invite, roles, approvers",
        minRole: "org_admin",
      },
      {
        label: "Departments",
        href: "/settings/departments",
        hint: "Grouping for reporting",
        minRole: "org_admin",
      },
      {
        label: "Categories",
        href: "/settings/categories",
        hint: "Limits and receipt rules",
        minRole: "finance_admin",
      },
      {
        label: "Clients",
        href: "/settings/clients",
        hint: "For billable expenses",
        minRole: "finance_admin",
      },
    ],
  },
  {
    id: "policies",
    label: "Policies",
    items: [
      {
        label: "Approval chains",
        href: "/settings/approval-chains",
        hint: "Who approves what, and when",
        minRole: "org_admin",
      },
      {
        label: "Delegations",
        href: "/settings/delegations",
        hint: "Acting on someone's behalf",
        minRole: "org_admin",
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    items: [
      {
        label: "WhatsApp",
        href: "/settings/whatsapp",
        hint: "Channel credentials",
        minRole: "org_admin",
      },
      {
        label: "Email ingestion",
        href: "/settings/email-ingestion",
        hint: "Forward receipts by email",
        minRole: "org_admin",
      },
    ],
  },
];

/** Groups the role can see, with empty groups dropped. */
export function visibleSettingsGroups(role: Role): SettingsGroup[] {
  return SETTINGS_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => roleAtLeast(role, item.minRole)),
  })).filter((group) => group.items.length > 0);
}

/**
 * Whether a nav item is the current one.
 *
 * Prefix match so /settings/categories/new keeps "Categories" lit, but
 * anchored at a path SEGMENT — a plain `startsWith` would light
 * /settings/users for /settings/users-archive.
 */
export function isActiveSettingsHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
