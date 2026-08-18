import { describe, expect, it } from "vitest";
import { canCommentOnReport } from "@/lib/domain/comments";

describe("canCommentOnReport", () => {
  it("the owner can always comment, whatever their role", () => {
    expect(
      canCommentOnReport({ actorId: "u1", actorRole: "employee", ownerId: "u1" })
    ).toBe(true);
  });
  it("approver+ can comment on others' reports", () => {
    for (const role of ["approver", "finance_admin", "org_admin"] as const) {
      expect(canCommentOnReport({ actorId: "x", actorRole: role, ownerId: "u1" })).toBe(true);
    }
  });
  it("a non-owner employee cannot join the thread", () => {
    expect(
      canCommentOnReport({ actorId: "x", actorRole: "employee", ownerId: "u1" })
    ).toBe(false);
  });
});
