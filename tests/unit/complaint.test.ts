import { describe, expect, it } from "vitest";
import {
  autoAssign,
  availableActions,
  businessDaysBetween,
  canAssignComplaint,
  canManageComplaint,
  canPostMessage,
  canViewComplaint,
  complaintAgeBusinessDays,
  complaintTargetOf,
  eligibleAssignees,
  isClosed,
  nextComplaintStatus,
  requiresResolutionNote,
  slaBadge,
  slaLevel,
  typeMatchesTarget,
  SLA_BUSINESS_DAYS,
  type AssigneeCandidate,
  type ComplaintStatus,
} from "@/lib/domain/complaint";

// 2026-08-17 is a Monday.
const MON = new Date("2026-08-17T09:00:00Z");
const TUE = new Date("2026-08-18T09:00:00Z");
const WED = new Date("2026-08-19T09:00:00Z");
const THU = new Date("2026-08-20T09:00:00Z");
const FRI = new Date("2026-08-21T09:00:00Z");
const SAT = new Date("2026-08-22T09:00:00Z");
const SUN = new Date("2026-08-23T09:00:00Z");
const NEXT_MON = new Date("2026-08-24T09:00:00Z");

describe("business-day SLA arithmetic", () => {
  it("counts zero for the same day and for backwards ranges", () => {
    expect(businessDaysBetween(MON, MON)).toBe(0);
    expect(businessDaysBetween(MON, new Date("2026-08-17T23:59:00Z"))).toBe(0);
    expect(businessDaysBetween(WED, MON)).toBe(0);
  });

  it("counts consecutive weekdays", () => {
    expect(businessDaysBetween(MON, TUE)).toBe(1);
    expect(businessDaysBetween(MON, WED)).toBe(2);
    expect(businessDaysBetween(MON, THU)).toBe(3);
    expect(businessDaysBetween(MON, FRI)).toBe(4);
  });

  it("does not count the weekend", () => {
    expect(businessDaysBetween(FRI, SAT)).toBe(0);
    expect(businessDaysBetween(FRI, SUN)).toBe(0);
    expect(businessDaysBetween(FRI, NEXT_MON)).toBe(1);
    expect(businessDaysBetween(MON, NEXT_MON)).toBe(5);
  });

  it("handles multi-week spans in closed form", () => {
    // Monday to the Monday three weeks later = 15 business days.
    expect(businessDaysBetween(MON, new Date("2026-09-07T09:00:00Z"))).toBe(15);
    // Wednesday to Wednesday two weeks later = 10.
    expect(businessDaysBetween(WED, new Date("2026-09-02T09:00:00Z"))).toBe(10);
    // A whole year of weekdays, sanity-checked against a day-by-day walk.
    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-12-31T00:00:00Z");
    let walked = 0;
    for (
      let d = new Date("2026-01-02T00:00:00Z");
      d <= to;
      d = new Date(d.getTime() + 86_400_000)
    ) {
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) walked++;
    }
    expect(businessDaysBetween(from, to)).toBe(walked);
  });

  it("ignores the time of day (calendar days, not 24h windows)", () => {
    expect(
      businessDaysBetween(
        new Date("2026-08-17T23:00:00Z"),
        new Date("2026-08-18T01:00:00Z")
      )
    ).toBe(1);
  });

  it("crosses month and year boundaries", () => {
    // Thu 31 Dec 2026 -> Mon 4 Jan 2027 = Fri + Mon = 2 business days.
    expect(
      businessDaysBetween(
        new Date("2026-12-31T09:00:00Z"),
        new Date("2027-01-04T09:00:00Z")
      )
    ).toBe(2);
  });
});

describe("SLA badge levels", () => {
  it("is green below the warning threshold, amber at 3-4, red at 5+", () => {
    expect(slaLevel(0)).toBe("green");
    expect(slaLevel(2)).toBe("green");
    expect(slaLevel(3)).toBe("amber");
    expect(slaLevel(4)).toBe("amber");
    expect(slaLevel(SLA_BUSINESS_DAYS)).toBe("red");
    expect(slaLevel(12)).toBe("red");
  });

  it("ages an open complaint against now", () => {
    const badge = slaBadge({ createdAt: MON, resolvedAt: null, status: "open" }, NEXT_MON);
    expect(badge.ageBusinessDays).toBe(5);
    expect(badge.level).toBe("red");
    expect(badge.breached).toBe(true);
    expect(badge.label).toContain("SLA breached");
  });

  it("freezes the age of a closed complaint at its resolution date", () => {
    const complaint = {
      createdAt: MON,
      resolvedAt: WED,
      status: "resolved" as ComplaintStatus,
    };
    const badge = slaBadge(complaint, new Date("2026-10-01T09:00:00Z"));
    expect(badge.ageBusinessDays).toBe(2);
    expect(badge.level).toBe("green");
    expect(badge.breached).toBe(false);
    expect(badge.label).toBe("Closed in 2 business days");
    expect(complaintAgeBusinessDays(complaint, new Date("2027-01-01T00:00:00Z"))).toBe(2);
  });

  it("singularises one day", () => {
    expect(slaBadge({ createdAt: MON, status: "open" }, TUE).label).toBe(
      "1 of 5 business days"
    );
  });
});

describe("exactly-one-target rule", () => {
  it("accepts a report-only complaint", () => {
    const r = complaintTargetOf({ reportId: "r1", reimbursementId: null });
    expect(r).toEqual({ ok: true, target: { kind: "report", reportId: "r1" } });
  });

  it("accepts a payment-only complaint", () => {
    const r = complaintTargetOf({ reimbursementId: "p1" });
    expect(r).toEqual({
      ok: true,
      target: { kind: "reimbursement", reimbursementId: "p1" },
    });
  });

  it("rejects both and neither", () => {
    expect(complaintTargetOf({ reportId: "r1", reimbursementId: "p1" }).ok).toBe(false);
    expect(complaintTargetOf({}).ok).toBe(false);
    expect(complaintTargetOf({ reportId: "", reimbursementId: "" }).ok).toBe(false);
  });

  it("ties dispute types to the right target", () => {
    const report = { kind: "report", reportId: "r1" } as const;
    const payment = { kind: "reimbursement", reimbursementId: "p1" } as const;
    expect(typeMatchesTarget("payment_not_received", payment)).toBe(true);
    expect(typeMatchesTarget("payment_not_received", report)).toBe(false);
    expect(typeMatchesTarget("unfair_rejection", report)).toBe(true);
    expect(typeMatchesTarget("unfair_rejection", payment)).toBe(false);
    expect(typeMatchesTarget("wrong_amount", report)).toBe(true);
    expect(typeMatchesTarget("wrong_amount", payment)).toBe(true);
    expect(typeMatchesTarget("other", payment)).toBe(true);
  });
});

describe("status machine", () => {
  it("walks open -> in_review -> resolved", () => {
    expect(nextComplaintStatus("open", "start_review")).toEqual({
      ok: true,
      status: "in_review",
    });
    expect(nextComplaintStatus("in_review", "resolve")).toEqual({
      ok: true,
      status: "resolved",
    });
  });

  it("allows closing straight from open", () => {
    expect(nextComplaintStatus("open", "resolve")).toEqual({
      ok: true,
      status: "resolved",
    });
    expect(nextComplaintStatus("open", "wont_fix")).toEqual({
      ok: true,
      status: "wont_fix",
    });
  });

  it("freezes terminal states", () => {
    for (const closed of ["resolved", "wont_fix"] as ComplaintStatus[]) {
      expect(isClosed(closed)).toBe(true);
      for (const action of ["start_review", "resolve", "wont_fix"] as const) {
        const r = nextComplaintStatus(closed, action);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain("closed");
      }
      expect(availableActions(closed)).toEqual([]);
    }
  });

  it("cannot re-open a review", () => {
    const r = nextComplaintStatus("in_review", "start_review");
    expect(r.ok).toBe(false);
  });

  it("requires a resolution note only when closing", () => {
    expect(requiresResolutionNote("start_review")).toBe(false);
    expect(requiresResolutionNote("resolve")).toBe(true);
    expect(requiresResolutionNote("wont_fix")).toBe(true);
  });

  it("offers the right actions per state", () => {
    expect(availableActions("open")).toEqual(["start_review", "resolve", "wont_fix"]);
    expect(availableActions("in_review")).toEqual(["resolve", "wont_fix"]);
  });
});

describe("routing exclusion rule", () => {
  const finance: AssigneeCandidate = { id: "f1", name: "Fay", role: "finance_admin" };
  const finance2: AssigneeCandidate = { id: "f2", name: "Fred", role: "finance_admin" };
  const admin: AssigneeCandidate = { id: "a1", name: "Ada", role: "org_admin" };
  const approver: AssigneeCandidate = { id: "ap1", name: "Ari", role: "approver" };
  const employee: AssigneeCandidate = { id: "e1", name: "Eve", role: "employee" };
  const ctx = { raisedById: "e1", disputedApproverIds: ["ap1"] };

  it("accepts finance_admin and org_admin only", () => {
    expect(canAssignComplaint(finance, ctx)).toBe(true);
    expect(canAssignComplaint(admin, ctx)).toBe(true);
    expect(canAssignComplaint(approver, ctx)).toBe(false);
    expect(canAssignComplaint(employee, ctx)).toBe(false);
  });

  it("NEVER assigns the disputed approver — even with a finance role", () => {
    const approverWhoIsAlsoFinance: AssigneeCandidate = {
      id: "ap1",
      name: "Ari",
      role: "finance_admin",
    };
    expect(canAssignComplaint(approverWhoIsAlsoFinance, ctx)).toBe(false);
    const adminWhoDecided: AssigneeCandidate = { id: "a1", name: "Ada", role: "org_admin" };
    expect(
      canAssignComplaint(adminWhoDecided, {
        raisedById: "e1",
        disputedApproverIds: ["a1"],
      })
    ).toBe(false);
  });

  it("never assigns the complainant to their own dispute", () => {
    const complainantIsFinance: AssigneeCandidate = {
      id: "e1",
      name: "Eve",
      role: "finance_admin",
    };
    expect(canAssignComplaint(complainantIsFinance, ctx)).toBe(false);
  });

  it("excludes every disputed approver from the pool", () => {
    const pool = [finance, finance2, admin, approver, employee];
    const filtered = eligibleAssignees(pool, {
      raisedById: "f2",
      disputedApproverIds: ["a1", "ap1"],
    });
    expect(filtered.map((c) => c.id)).toEqual(["f1"]);
  });

  it("auto-assigns the least-loaded eligible handler, deterministically", () => {
    const pool = [finance2, finance, admin];
    expect(autoAssign(pool, ctx, { f1: 3, f2: 1, a1: 5 })?.id).toBe("f2");
    // ties break by id, not by pool order
    expect(autoAssign(pool, ctx, { f1: 2, f2: 2, a1: 2 })?.id).toBe("a1");
    expect(autoAssign(pool, ctx)?.id).toBe("a1");
  });

  it("leaves the complaint unassigned when nobody is eligible", () => {
    expect(autoAssign([approver, employee], ctx)).toBeNull();
    expect(
      autoAssign([finance], { raisedById: "x", disputedApproverIds: ["f1"] })
    ).toBeNull();
    expect(autoAssign([], ctx)).toBeNull();
  });
});

describe("visibility", () => {
  it("lets the raiser see and post on their own complaint", () => {
    const input = { actorId: "e1", actorRole: "employee" as const, raisedById: "e1" };
    expect(canViewComplaint(input)).toBe(true);
    expect(canPostMessage(input)).toBe(true);
  });

  it("hides other people's complaints from employees and approvers", () => {
    expect(
      canViewComplaint({ actorId: "e2", actorRole: "employee", raisedById: "e1" })
    ).toBe(false);
    expect(
      canViewComplaint({ actorId: "ap1", actorRole: "approver", raisedById: "e1" })
    ).toBe(false);
  });

  it("gives finance_admin and org_admin the full inbox", () => {
    expect(
      canViewComplaint({ actorId: "f1", actorRole: "finance_admin", raisedById: "e1" })
    ).toBe(true);
    expect(
      canViewComplaint({ actorId: "a1", actorRole: "org_admin", raisedById: "e1" })
    ).toBe(true);
  });

  it("restricts the status machine to finance_admin and above", () => {
    expect(canManageComplaint("employee")).toBe(false);
    expect(canManageComplaint("approver")).toBe(false);
    expect(canManageComplaint("finance_admin")).toBe(true);
    expect(canManageComplaint("org_admin")).toBe(true);
  });
});
