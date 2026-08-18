import { describe, expect, it } from "vitest";
import { isRole, roleAtLeast, ROLES } from "@/lib/auth/roles";

describe("role hierarchy (employee < approver < finance_admin < org_admin)", () => {
  it("every role satisfies employee", () => {
    for (const r of ROLES) expect(roleAtLeast(r, "employee")).toBe(true);
  });

  it("only org_admin satisfies org_admin", () => {
    expect(roleAtLeast("org_admin", "org_admin")).toBe(true);
    expect(roleAtLeast("finance_admin", "org_admin")).toBe(false);
    expect(roleAtLeast("approver", "org_admin")).toBe(false);
    expect(roleAtLeast("employee", "org_admin")).toBe(false);
  });

  it("finance_admin threshold", () => {
    expect(roleAtLeast("org_admin", "finance_admin")).toBe(true);
    expect(roleAtLeast("finance_admin", "finance_admin")).toBe(true);
    expect(roleAtLeast("approver", "finance_admin")).toBe(false);
    expect(roleAtLeast("employee", "finance_admin")).toBe(false);
  });

  it("approver threshold", () => {
    expect(roleAtLeast("approver", "approver")).toBe(true);
    expect(roleAtLeast("employee", "approver")).toBe(false);
  });

  it("isRole guards unknown strings", () => {
    expect(isRole("employee")).toBe(true);
    expect(isRole("super_admin")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole(42)).toBe(false);
  });
});
