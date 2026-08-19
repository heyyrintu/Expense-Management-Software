// Report timeline (D2.3). The branching worth testing is the branching that
// would otherwise tell a comfortable lie: a rejection is not progress, and
// partly paid is not paid.
import { describe, expect, it } from "vitest";

import { buildReportTimeline, hasTimeline } from "@/lib/domain/report-timeline";
import { REPORT_STATUSES } from "@/lib/domain/report-workflow";

const SUBMITTED = new Date("2026-08-12T09:00:00Z");
const APPROVED = new Date("2026-08-13T11:00:00Z");
const PAID = new Date("2026-08-15T16:00:00Z");

const base = { submittedAt: null, approvedAt: null, paidAt: null };

function states(status: Parameters<typeof buildReportTimeline>[0]["status"], dates = {}) {
  return buildReportTimeline({ ...base, status, ...dates }).map((s) => s.state);
}

describe("buildReportTimeline", () => {
  it("always returns the three §7.2 steps in order", () => {
    for (const status of REPORT_STATUSES) {
      const steps = buildReportTimeline({ ...base, status });
      expect(steps.map((s) => s.key), status).toEqual(["submitted", "approved", "paid"]);
    }
  });

  it("puts a draft at the start with nothing done", () => {
    expect(states("draft")).toEqual(["current", "upcoming", "upcoming"]);
  });

  it("moves to the approval step once submitted", () => {
    expect(states("submitted", { submittedAt: SUBMITTED })).toEqual([
      "done",
      "current",
      "upcoming",
    ]);
  });

  it("moves to payment once approved", () => {
    expect(states("approved", { submittedAt: SUBMITTED, approvedAt: APPROVED })).toEqual([
      "done",
      "done",
      "current",
    ]);
  });

  it("completes only when reimbursed", () => {
    expect(
      states("reimbursed", { submittedAt: SUBMITTED, approvedAt: APPROVED, paidAt: PAID })
    ).toEqual(["done", "done", "done"]);
  });
});

describe("partly paid is NOT paid", () => {
  it("leaves the final step current while money is still owed", () => {
    // The one lie this component could tell that costs somebody real money.
    const steps = buildReportTimeline({
      status: "partially_reimbursed",
      submittedAt: SUBMITTED,
      approvedAt: APPROVED,
      paidAt: PAID,
    });
    expect(steps[2].state).toBe("current");
    expect(steps[2].label).toBe("Partly paid");
  });

  it("still counts the approval as done", () => {
    const steps = buildReportTimeline({
      status: "partially_reimbursed",
      ...base,
    });
    expect(steps[1].state).toBe("done");
  });
});

describe("a rejection stops, it does not reverse", () => {
  it("marks the approval step stopped and names why", () => {
    const steps = buildReportTimeline({
      status: "rejected",
      submittedAt: SUBMITTED,
      approvedAt: null,
      paidAt: null,
    });
    expect(steps[0].state).toBe("done"); // it WAS submitted; that happened
    expect(steps[1].state).toBe("stopped");
    expect(steps[1].note).toBe("Rejected");
    // Payment is not "stopped" — it was never reached.
    expect(steps[2].state).toBe("upcoming");
  });

  it("treats sent back the same way, with its own word", () => {
    const steps = buildReportTimeline({
      status: "sent_back",
      submittedAt: SUBMITTED,
      approvedAt: null,
      paidAt: null,
    });
    expect(steps[1].state).toBe("stopped");
    expect(steps[1].note).toBe("Sent back");
  });

  it("never shows a stopped report as approved", () => {
    for (const status of ["rejected", "sent_back"] as const) {
      const steps = buildReportTimeline({ ...base, status, submittedAt: SUBMITTED });
      expect(steps[1].state, status).not.toBe("done");
    }
  });
});

describe("timestamps", () => {
  it("carries each step's own timestamp, and null when it hasn't happened", () => {
    const steps = buildReportTimeline({
      status: "approved",
      submittedAt: SUBMITTED,
      approvedAt: APPROVED,
      paidAt: null,
    });
    expect(steps[0].at).toBe(SUBMITTED);
    expect(steps[1].at).toBe(APPROVED);
    expect(steps[2].at).toBeNull();
  });
});

describe("hasTimeline", () => {
  it("hides the stepper on a draft — there is no history yet", () => {
    expect(hasTimeline("draft")).toBe(false);
  });

  it("shows it for every other status", () => {
    for (const status of REPORT_STATUSES.filter((s) => s !== "draft")) {
      expect(hasTimeline(status), status).toBe(true);
    }
  });
});
