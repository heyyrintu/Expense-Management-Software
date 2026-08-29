// Navigation model for the app shell (D0.4).
//
// ── UI HIDING IS NOT AUTHORIZATION ────────────────────────────────────────
// Every `minRole` below MIRRORS a server-side guard that already exists on
// the route; it does not create one. /approvals is protected by
// requireRole("approver") inside its page, /finance by
// requireRole("finance_admin"), and so on. This file only decides what is
// worth showing someone — typing the URL still hits the real guard.
//
// When a route's guard changes, change it there first and mirror it here.
// The mapping is asserted in tests/unit/nav.test.ts so the two can't drift
// silently.
// ──────────────────────────────────────────────────────────────────────────
// Icons are load-bearing in the 64px rail: with the labels gone, the icon IS
// the item. So every one below is distinct — no two destinations may share a
// glyph, or the collapsed sidebar becomes a guessing game.
import {
  Banknote,
  BookOpen,
  ClipboardCheck,
  CreditCard,
  FileText,
  Home,
  Landmark,
  MessageSquareWarning,
  Receipt,
  Repeat,
  Settings,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { roleAtLeast, type Role } from "@/lib/auth/roles";

export type NavItem = {
  /** Sidebar and tab-bar label. Also the command palette's search text. */
  label: string;
  href: string;
  icon: LucideIcon;
  /** Mirrors the route's own server guard. See the header note. */
  minRole: Role;
  /** Match only this exact path — for parents of unrelated child routes. */
  exact?: boolean;
};

export type NavSection = {
  id: string;
  /** Omitted for the first group: a heading above one item is noise. */
  label?: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "overview",
    items: [
      { label: "Home", href: "/dashboard", icon: Home, minRole: "employee" },
    ],
  },
  {
    id: "expenses",
    label: "Expenses",
    items: [
      { label: "Expenses", href: "/expenses", icon: Receipt, minRole: "employee" },
      { label: "Reports", href: "/reports", icon: FileText, minRole: "employee" },
      { label: "Advances", href: "/advances", icon: Wallet, minRole: "employee" },
      { label: "Recurring", href: "/recurring", icon: Repeat, minRole: "employee" },
      { label: "Ledger", href: "/ledger", icon: BookOpen, minRole: "employee" },
      {
        label: "Complaints",
        href: "/complaints",
        icon: MessageSquareWarning,
        minRole: "employee",
      },
    ],
  },
  {
    id: "approvals",
    label: "Approvals",
    items: [
      // requireRole("approver") in app/(app)/approvals/page.tsx
      { label: "Approvals", href: "/approvals", icon: ClipboardCheck, minRole: "approver" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      // Every item here is requireRole("finance_admin") on the route itself.
      { label: "Reimbursements", href: "/finance", icon: Banknote, minRole: "finance_admin" },
      { label: "Budgets", href: "/budgets", icon: Target, minRole: "finance_admin" },
      { label: "Card imports", href: "/card-imports", icon: CreditCard, minRole: "finance_admin" },
      { label: "Bank recon", href: "/bank-recon", icon: Landmark, minRole: "finance_admin" },
      { label: "Analytics", href: "/analytics", icon: TrendingUp, minRole: "finance_admin" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      // app/(app)/settings/layout.tsx redirects below finance_admin.
      { label: "Settings", href: "/settings", icon: Settings, minRole: "finance_admin" },
    ],
  },
];

/** Sections the role can see, with empty sections dropped. */
export function visibleSections(role: Role): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => roleAtLeast(role, item.minRole)),
  })).filter((section) => section.items.length > 0);
}

/** Flattened, in sidebar order — used by the command palette and top bar. */
export function visibleItems(role: Role): NavItem[] {
  return visibleSections(role).flatMap((section) => section.items);
}

/**
 * A nav item is active for its own path and everything beneath it, so
 * /expenses/new keeps "Expenses" lit. `exact` opts an item out where a
 * child route belongs to a different destination.
 */
export function isActiveHref(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * The current destination, longest-match-wins so /settings/users resolves to
 * Settings rather than to a shorter prefix. Null on routes outside the nav
 * (profile, notifications) — the top bar falls back to the org name there.
 */
export function activeItem(pathname: string, role: Role): NavItem | null {
  const matches = visibleItems(role).filter((item) => isActiveHref(pathname, item));
  if (matches.length === 0) return null;
  return matches.reduce((best, item) => (item.href.length > best.href.length ? item : best));
}

/**
 * The nav SECTION a route belongs to, for the page-header eyebrow (N2.1).
 * Deliberately role-blind: it names where a screen sits in the product's
 * architecture, and a screen's address does not change with who is looking
 * at it — role still gates the routes themselves server-side. Longest match
 * wins for the same reason as activeItem. Null for unlabelled sections
 * (Home) and for routes outside the nav; the header simply shows no eyebrow.
 */
export function sectionLabelFor(pathname: string): string | null {
  let best: { label: string; hrefLength: number } | null = null;
  for (const section of NAV_SECTIONS) {
    if (!section.label) continue;
    for (const item of section.items) {
      if (!isActiveHref(pathname, item)) continue;
      if (!best || item.href.length > best.hrefLength) {
        best = { label: section.label, hrefLength: item.href.length };
      }
    }
  }
  return best?.label ?? null;
}

// ---------------------------------------------------------------------------
// Mobile tab bar (§5.5): Home · Expenses · Add · Reports · More.
// Fixed five, deliberately: the tab bar is muscle memory, so it does not
// reshuffle by role. Everything role-gated lives behind "More", which reads
// the same visibleSections() the sidebar does.
// ---------------------------------------------------------------------------
export const TAB_BAR_ITEMS: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home, minRole: "employee" },
  { label: "Expenses", href: "/expenses", icon: Receipt, minRole: "employee", exact: true },
  { label: "Reports", href: "/reports", icon: FileText, minRole: "employee" },
];

/** The centre action. Accent circle, always reachable — §5.5. */
export const ADD_EXPENSE_HREF = "/expenses/new";
