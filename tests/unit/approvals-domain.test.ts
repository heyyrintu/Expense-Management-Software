import { describe, expect, it } from "vitest";
import {
  canDecideAtLevel,
  validateDecisionReason,
  currentSubmissionApprovals,
  isReportFlagged,
  pendingLevel,
  requiredLevels,
  type ApprovalRow,
} from "@/lib/domain/approvals";
import { parseOrgSettings, secondApprovalThreshold } from "@/lib/domain/org-settings";

const row = (
  level: number,
  action: ApprovalRow["action"],
  approverId: string,
  actedAt: string
): ApprovalRow => ({ level, action, approverId, actedAt: new Date(actedAt) });

describe("requiredLevels", () => {
  it("single level without a threshold; two above it", () => {
    expect(requiredLevels(100000, null)).toBe(1);
    expect(requiredLevels(100000, 100000)).toBe(1); // not strictly above
    expect(requiredLevels(100001, 100000)).toBe(2);
  });
});

describe("currentSubmissionApprovals", () => {
  it("only counts approvals from the latest submission", () => {
    const approvals = [
      row(1, "sent_back", "ap1", "2026-08-01"),
      row(1, "approved", "ap1", "2026-08-10"),
    ];
    const current = currentSubmissionApprovals(approvals, new Date("2026-08-05"));
    expect(current).toHaveLength(1);
    expect(current[0].action).toBe("approved");
    expect(currentSubmissionApprovals(approvals, null)).toHaveLength(0);
  });
});

describe("pendingLevel", () => {
  it("level 1 until approved; level 2 only when required; null when done", () => {
    expect(pendingLevel([], 1)).toBe(1);
    expect(pendingLevel([], 2)).toBe(1);
    const l1 = [row(1, "approved", "ap1", "2026-08-10")];
    expect(pendingLevel(l1, 1)).toBeNull();
    expect(pendingLevel(l1, 2)).toBe(2);
    expect(
      pendingLevel([...l1, row(2, "approved", "fa1", "2026-08-11")], 2)
    ).toBeNull();
  });
});

describe("canDecideAtLevel", () => {
  const base = {
    ownerId: "owner",
    ownerApproverId: "ap1",
    level1ApproverId: null as string | null,
  };

  it("level 1: only the assigned approver, never the owner", () => {
    expect(canDecideAtLevel({ ...base, actorId: "ap1", actorRole: "approver", level: 1 })).toBe(true);
    expect(canDecideAtLevel({ ...base, actorId: "other", actorRole: "org_admin", level: 1 })).toBe(false);
    expect(
      canDecideAtLevel({
        ...base,
        ownerApproverId: "owner",
        actorId: "owner",
        actorRole: "approver",
        level: 1,
      })
    ).toBe(false); // self-approval blocked even if misconfigured as own approver
    expect(
      canDecideAtLevel({ ...base, ownerApproverId: null, actorId: "ap1", actorRole: "approver", level: 1 })
    ).toBe(false); // no approver assigned → nobody can decide level 1
  });

  it("level 2: finance_admin+ only, distinct from owner and level-1 approver", () => {
    const l2 = { ...base, level1ApproverId: "ap1", level: 2 as const };
    expect(canDecideAtLevel({ ...l2, actorId: "fa1", actorRole: "finance_admin" })).toBe(true);
    expect(canDecideAtLevel({ ...l2, actorId: "fa1", actorRole: "approver" })).toBe(false);
    expect(canDecideAtLevel({ ...l2, actorId: "ap1", actorRole: "finance_admin" })).toBe(false);
    expect(canDecideAtLevel({ ...l2, actorId: "owner", actorRole: "org_admin" })).toBe(false);
  });
});

describe("isReportFlagged", () => {
  it("flagged when any expense has non-empty flags", () => {
    expect(isReportFlagged([[], [], []])).toBe(false);
    expect(isReportFlagged([[], ["over_limit"]])).toBe(true);
    expect(isReportFlagged([])).toBe(false);
  });
});

describe("org settings parsing", () => {
  it("reads a valid threshold and rejects junk", () => {
    expect(secondApprovalThreshold({ secondApprovalAbove: 50000 })).toBe(50000);
    expect(secondApprovalThreshold({ secondApprovalAbove: "5万" })).toBeNull();
    expect(secondApprovalThreshold({})).toBeNull();
    expect(secondApprovalThreshold(null)).toBeNull();
    expect(parseOrgSettings({ secondApprovalAbove: -5 }).secondApprovalAbove).toBeNull();
  });
});

describe("validateDecisionReason (3.2)", () => {
  it("reject/send_back always need a reason", () => {
    for (const action of ["reject", "send_back"] as const) {
      expect(validateDecisionReason(action, false, undefined)).not.toBeNull();
      expect(validateDecisionReason(action, false, "   ")).not.toBeNull();
      expect(validateDecisionReason(action, true, "too old")).toBeNull();
    }
  });
  it("approve needs a justification only when flagged", () => {
    expect(validateDecisionReason("approve", false, undefined)).toBeNull();
    expect(validateDecisionReason("approve", true, undefined)).not.toBeNull();
    expect(validateDecisionReason("approve", true, "  ")).not.toBeNull();
    expect(validateDecisionReason("approve", true, "client emergency travel")).toBeNull();
  });
});
