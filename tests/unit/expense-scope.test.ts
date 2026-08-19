// View scope (D3.3). The URL asks; the role decides.
//
// This file exists because D3.3 gave the expense list a `?scope=` parameter
// so dashboard KPIs would have an honest place to click through to. That
// parameter is the only thing in the product that could WIDEN a query rather
// than narrow it, so it gets tested the way a widening control has to be:
// by trying to widen it from every role that shouldn't be able to.
import { describe, expect, it } from "vitest";

import {
  EXPENSE_VIEW_SCOPES,
  narrowViewScope,
  parseViewScope,
  viewScopeCopy,
  viewScopeWhere,
} from "@/lib/domain/expense-scope";
import type { ExpenseScope } from "@/lib/domain/expense-query";

const SELF = "user-self";
const employee: ExpenseScope = { kind: "employee", userId: SELF };
const team: ExpenseScope = { kind: "team", teamUserIds: [SELF, "user-b", "user-c"] };
const org: ExpenseScope = { kind: "org" };

describe("parseViewScope", () => {
  it("defaults to the narrowest view", () => {
    expect(parseViewScope(undefined)).toBe("mine");
    expect(parseViewScope("")).toBe("mine");
  });

  it("falls back to 'mine' for anything it doesn't recognise", () => {
    // A mangled or hand-edited link should under-show, never over-show.
    expect(parseViewScope("everything")).toBe("mine");
    expect(parseViewScope("ORG")).toBe("mine");
    expect(parseViewScope(["org", "mine"])).toBe("org"); // first value wins
  });

  it("accepts each real scope", () => {
    for (const scope of EXPENSE_VIEW_SCOPES) {
      expect(parseViewScope(scope)).toBe(scope);
    }
  });
});

describe("narrowViewScope clamps the request to the role's ceiling", () => {
  it("gives an employee 'mine' whatever they ask for", () => {
    for (const requested of EXPENSE_VIEW_SCOPES) {
      expect(narrowViewScope(employee, requested), requested).toBe("mine");
    }
  });

  it("caps an approver at their team", () => {
    expect(narrowViewScope(team, "org")).toBe("team");
    expect(narrowViewScope(team, "team")).toBe("team");
    expect(narrowViewScope(team, "mine")).toBe("mine");
  });

  it("lets finance have any width, including a narrower one", () => {
    expect(narrowViewScope(org, "org")).toBe("org");
    expect(narrowViewScope(org, "mine")).toBe("mine");
  });
});

describe("viewScopeWhere never produces a predicate wider than the ceiling", () => {
  it("pins an employee to themselves even when the URL says org", () => {
    // The important one. If this ever returns {} an employee can read the
    // whole organisation's expenses by editing a query string.
    expect(viewScopeWhere(employee, "org", SELF)).toEqual({ userId: SELF });
    expect(viewScopeWhere(employee, "team", SELF)).toEqual({ userId: SELF });
  });

  it("gives an approver their team and no more", () => {
    expect(viewScopeWhere(team, "org", SELF)).toEqual({
      userId: { in: [SELF, "user-b", "user-c"] },
    });
    expect(viewScopeWhere(team, "mine", SELF)).toEqual({ userId: SELF });
  });

  it("opens up only for an org ceiling", () => {
    // Empty is correct and safe: scopedDb injects org_id into every query, so
    // "no user predicate" still means "this organisation".
    expect(viewScopeWhere(org, "org", SELF)).toEqual({});
  });

  it("falls back to the reader alone when a team is asked for without one", () => {
    // Finance has no "team" — rather than silently widening to the org, the
    // request lands on the narrowest thing that is certainly allowed.
    expect(viewScopeWhere(org, "team", SELF)).toEqual({ userId: SELF });
  });

  it("clamps even when the caller forgot to narrow first", () => {
    // viewScopeWhere re-clamps rather than trusting its caller. A security
    // property you have to remember to invoke is one that eventually isn't.
    const direct = viewScopeWhere(employee, "org", SELF);
    const narrowed = viewScopeWhere(employee, narrowViewScope(employee, "org"), SELF);
    expect(direct).toEqual(narrowed);
  });

  it("pins to the ACTING user, not the session user", () => {
    // Delegation: while acting for someone else, "mine" means their rows.
    expect(viewScopeWhere(employee, "mine", "principal-id")).toEqual({
      userId: "principal-id",
    });
  });
});

describe("viewScopeCopy", () => {
  it("names whose expenses a total covers", () => {
    // The reader must never have to guess. Three views, three titles.
    const titles = EXPENSE_VIEW_SCOPES.map((s) => viewScopeCopy(s).title);
    expect(new Set(titles).size).toBe(3);
    expect(viewScopeCopy("org").title).toBe("All expenses");
    expect(viewScopeCopy("mine").title).toBe("My expenses");
  });
});
