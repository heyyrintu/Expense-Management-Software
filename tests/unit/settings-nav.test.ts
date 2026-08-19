// Settings nav (D4.4) — the nav must MIRROR the route guards, never replace
// them.
//
// The mapping is asserted here for the same reason components/shell/nav.ts is:
// a nav item at the wrong minRole doesn't grant access (the route still
// guards), but it does put a link in front of someone that leads to a
// redirect, which reads as the app being broken.
import { describe, expect, it } from "vitest";

import {
  isActiveSettingsHref,
  SETTINGS_GROUPS,
  visibleSettingsGroups,
} from "@/lib/settings/nav";
import type { Role } from "@/lib/auth/roles";

/** The guard each route actually runs, read off the pages. */
const ROUTE_GUARDS: Record<string, Role> = {
  "/profile": "employee", // requireSession
  "/settings/organization": "finance_admin",
  "/settings/users": "org_admin",
  "/settings/departments": "org_admin",
  "/settings/categories": "finance_admin",
  "/settings/clients": "finance_admin",
  "/settings/approval-chains": "org_admin",
  "/settings/delegations": "org_admin",
  "/settings/whatsapp": "org_admin",
  "/settings/email-ingestion": "org_admin",
};

const ALL_ITEMS = SETTINGS_GROUPS.flatMap((g) => g.items);

describe("every nav item mirrors its route's own guard", () => {
  it("covers exactly the routes we know about", () => {
    expect(new Set(ALL_ITEMS.map((i) => i.href))).toEqual(
      new Set(Object.keys(ROUTE_GUARDS))
    );
  });

  it("declares the same minRole the route enforces", () => {
    for (const item of ALL_ITEMS) {
      expect(item.minRole, item.href).toBe(ROUTE_GUARDS[item.href]);
    }
  });
});

describe("visibleSettingsGroups", () => {
  it("shows an employee only their own profile", () => {
    const groups = visibleSettingsGroups("employee");
    expect(groups.flatMap((g) => g.items).map((i) => i.href)).toEqual(["/profile"]);
  });

  it("gives finance the org-level screens but not user administration", () => {
    const hrefs = visibleSettingsGroups("finance_admin")
      .flatMap((g) => g.items)
      .map((i) => i.href);
    expect(hrefs).toContain("/settings/organization");
    expect(hrefs).toContain("/settings/categories");
    // org_admin territory.
    expect(hrefs).not.toContain("/settings/users");
    expect(hrefs).not.toContain("/settings/approval-chains");
  });

  it("gives org_admin everything", () => {
    const hrefs = visibleSettingsGroups("org_admin")
      .flatMap((g) => g.items)
      .map((i) => i.href);
    expect(new Set(hrefs)).toEqual(new Set(Object.keys(ROUTE_GUARDS)));
  });

  it("drops groups that end up empty rather than rendering a bare heading", () => {
    const groups = visibleSettingsGroups("finance_admin");
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
    // Policies is entirely org_admin, so finance shouldn't see the heading.
    expect(groups.map((g) => g.id)).not.toContain("policies");
  });

  it("never widens: each role sees a superset of the one below", () => {
    const hrefsFor = (role: Role) =>
      new Set(visibleSettingsGroups(role).flatMap((g) => g.items).map((i) => i.href));
    const employee = hrefsFor("employee");
    const finance = hrefsFor("finance_admin");
    const admin = hrefsFor("org_admin");
    for (const href of employee) expect(finance.has(href)).toBe(true);
    for (const href of finance) expect(admin.has(href)).toBe(true);
  });
});

describe("isActiveSettingsHref", () => {
  it("lights the section for its own page and its children", () => {
    expect(isActiveSettingsHref("/settings/categories", "/settings/categories")).toBe(true);
    expect(isActiveSettingsHref("/settings/categories/new", "/settings/categories")).toBe(
      true
    );
  });

  it("anchors at a path segment, not a prefix", () => {
    // A bare startsWith would light "Users" on /settings/users-archive.
    expect(isActiveSettingsHref("/settings/users-archive", "/settings/users")).toBe(false);
  });

  it("doesn't light a sibling", () => {
    expect(isActiveSettingsHref("/settings/departments", "/settings/delegations")).toBe(
      false
    );
  });
});
