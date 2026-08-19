// Nav model tests (D0.4).
//
// The point of these is the header note in components/shell/nav.ts: the
// sidebar's minRole is a MIRROR of each route's server guard, and a mirror
// that drifts is worse than no mirror. These assertions fail the moment the
// two disagree.
import { describe, expect, it } from "vitest";

import {
  NAV_SECTIONS,
  TAB_BAR_ITEMS,
  activeItem,
  isActiveHref,
  visibleItems,
  visibleSections,
} from "@/components/shell/nav";
import { ROLES, type Role } from "@/lib/auth/roles";

/** The guard each route actually enforces, read from its page/layout. */
const ROUTE_GUARDS: Record<string, Role> = {
  "/dashboard": "employee", // requireSession
  "/expenses": "employee", // requireSession
  "/reports": "employee", // requireSession
  "/advances": "employee", // requireSession
  "/recurring": "employee", // requireSession
  "/ledger": "employee", // requireSession
  "/complaints": "employee", // requireSession
  "/approvals": "approver", // requireRole("approver")
  "/finance": "finance_admin", // requireRole("finance_admin")
  "/budgets": "finance_admin", // requireRole("finance_admin")
  "/card-imports": "finance_admin", // requireRole("finance_admin")
  "/bank-recon": "finance_admin", // requireRole("finance_admin")
  "/analytics": "finance_admin", // requireRole("finance_admin")
  "/settings": "finance_admin", // settings/layout.tsx redirects below this
};

describe("nav model", () => {
  it("mirrors every route's server guard exactly", () => {
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        expect(ROUTE_GUARDS[item.href], `${item.href} missing from ROUTE_GUARDS`).toBeDefined();
        expect(item.minRole, `${item.href} minRole must match its server guard`).toBe(
          ROUTE_GUARDS[item.href]
        );
      }
    }
  });

  it("shows an employee nothing that requires a higher role", () => {
    const hrefs = visibleItems("employee").map((i) => i.href);
    expect(hrefs).not.toContain("/approvals");
    expect(hrefs).not.toContain("/finance");
    expect(hrefs).not.toContain("/settings");
    expect(hrefs).toContain("/expenses");
  });

  it("widens monotonically with role — a higher role never loses a destination", () => {
    for (let i = 1; i < ROLES.length; i += 1) {
      const lower = new Set(visibleItems(ROLES[i - 1]).map((item) => item.href));
      const higher = new Set(visibleItems(ROLES[i]).map((item) => item.href));
      for (const href of lower) {
        expect(higher.has(href), `${ROLES[i]} lost ${href}`).toBe(true);
      }
    }
  });

  it("drops sections that have no visible items", () => {
    const ids = visibleSections("employee").map((s) => s.id);
    expect(ids).not.toContain("approvals");
    expect(ids).not.toContain("finance");
  });

  it("keeps the parent lit on child routes", () => {
    const expenses = { href: "/expenses" };
    expect(isActiveHref("/expenses", expenses)).toBe(true);
    expect(isActiveHref("/expenses/abc-123", expenses)).toBe(true);
    // Prefix must not leak across sibling routes.
    expect(isActiveHref("/expenses-archive", expenses)).toBe(false);
  });

  it("resolves the longest match so nested settings stay on Settings", () => {
    expect(activeItem("/settings/users", "org_admin")?.href).toBe("/settings");
    expect(activeItem("/reports/r-1/edit", "employee")?.href).toBe("/reports");
  });

  it("returns null off-nav so the top bar can fall back to the org name", () => {
    expect(activeItem("/profile", "employee")).toBeNull();
    expect(activeItem("/notifications", "employee")).toBeNull();
  });

  it("gives every destination a distinct icon — the rail has nothing else", () => {
    const items = NAV_SECTIONS.flatMap((s) => s.items);
    const icons = new Set(items.map((item) => item.icon));
    expect(icons.size).toBe(items.length);
  });

  it("gives the tab bar three fixed destinations every role can reach", () => {
    expect(TAB_BAR_ITEMS).toHaveLength(3);
    for (const item of TAB_BAR_ITEMS) {
      expect(item.minRole).toBe("employee");
    }
    // Expenses is exact so /expenses/new lights the Add button, not the tab.
    expect(isActiveHref("/expenses/new", TAB_BAR_ITEMS[1])).toBe(false);
  });
});
