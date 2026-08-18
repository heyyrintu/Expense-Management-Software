import { describe, expect, it } from "vitest";
import {
  isValidApproverAssignment,
  leavesOrgAdminPool,
  wouldRemoveLastOrgAdmin,
} from "@/lib/domain/users";

describe("last-org-admin guard", () => {
  it("blocks removing the only active org_admin", () => {
    expect(wouldRemoveLastOrgAdmin("u1", ["u1"])).toBe(true);
  });
  it("allows when another active org_admin remains", () => {
    expect(wouldRemoveLastOrgAdmin("u1", ["u1", "u2"])).toBe(false);
    expect(wouldRemoveLastOrgAdmin("u3", ["u1", "u2"])).toBe(false);
  });

  it("detects edits that leave the active-admin pool", () => {
    const activeAdmin = { role: "org_admin" as const, status: "active" as const };
    expect(leavesOrgAdminPool(activeAdmin, { role: "employee", status: "active" })).toBe(true);
    expect(leavesOrgAdminPool(activeAdmin, { role: "org_admin", status: "deactivated" })).toBe(true);
    expect(leavesOrgAdminPool(activeAdmin, { role: "org_admin", status: "active" })).toBe(false);
    // non-admins can change freely
    expect(
      leavesOrgAdminPool(
        { role: "employee", status: "active" },
        { role: "employee", status: "deactivated" }
      )
    ).toBe(false);
  });
});

describe("self-approver guard", () => {
  it("rejects self, accepts others and none", () => {
    expect(isValidApproverAssignment("u1", "u1")).toBe(false);
    expect(isValidApproverAssignment("u1", "u2")).toBe(true);
    expect(isValidApproverAssignment("u1", null)).toBe(true);
  });
});
