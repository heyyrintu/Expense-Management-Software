import { describe, expect, it } from "vitest";
import {
  canActorDecide,
  computeReportTotal,
  detachExpensesOnReject,
  expenseStatusFor,
  isReportDeletable,
  isReportEditable,
  nextStatus,
  REPORT_ACTIONS,
  REPORT_STATUSES,
  requiresReason,
  type ReportAction,
  type ReportStatus,
} from "@/lib/domain/report-workflow";

// The complete legal transition set — everything else must be null.
const LEGAL: Array<[ReportStatus, ReportAction, ReportStatus]> = [
  ["draft", "submit", "submitted"],
  ["submitted", "withdraw", "draft"],
  ["submitted", "approve", "approved"],
  ["submitted", "reject", "rejected"],
  ["submitted", "send_back", "sent_back"],
  ["sent_back", "submit", "submitted"],
  ["approved", "reimburse", "reimbursed"],
  ["approved", "reimburse_partial", "partially_reimbursed"],
  ["partially_reimbursed", "reimburse", "reimbursed"],
  ["partially_reimbursed", "reimburse_partial", "partially_reimbursed"],
];

describe("state machine — exhaustive matrix", () => {
  it("allows exactly the documented transitions", () => {
    for (const from of REPORT_STATUSES) {
      for (const action of REPORT_ACTIONS) {
        const expected =
          LEGAL.find(([f, a]) => f === from && a === action)?.[2] ?? null;
        expect(nextStatus(from, action), `${from} --${action}-->`).toBe(expected);
      }
    }
  });

  it("terminal states allow nothing", () => {
    for (const action of REPORT_ACTIONS) {
      expect(nextStatus("rejected", action)).toBeNull();
      expect(nextStatus("reimbursed", action)).toBeNull();
    }
  });

  it("a report can loop: submit → send_back → resubmit → approve → reimburse", () => {
    let s: ReportStatus = "draft";
    for (const [action, expected] of [
      ["submit", "submitted"],
      ["send_back", "sent_back"],
      ["submit", "submitted"],
      ["approve", "approved"],
      ["reimburse", "reimbursed"],
    ] as Array<[ReportAction, ReportStatus]>) {
      const next = nextStatus(s, action);
      expect(next).toBe(expected);
      s = next!;
    }
  });
});

describe("workflow rules", () => {
  it("reject and send_back require a reason; others don't", () => {
    expect(requiresReason("reject")).toBe(true);
    expect(requiresReason("send_back")).toBe(true);
    for (const a of ["submit", "withdraw", "approve", "reimburse"] as ReportAction[]) {
      expect(requiresReason(a)).toBe(false);
    }
  });

  it("editable only in draft and sent_back; deletable only in draft", () => {
    expect(REPORT_STATUSES.filter(isReportEditable)).toEqual(["draft", "sent_back"]);
    expect(REPORT_STATUSES.filter(isReportDeletable)).toEqual(["draft"]);
  });

  it("expense status mirrors report status (sent_back → editable draft)", () => {
    expect(expenseStatusFor("draft")).toBe("draft");
    expect(expenseStatusFor("sent_back")).toBe("draft");
    expect(expenseStatusFor("submitted")).toBe("submitted");
    expect(expenseStatusFor("approved")).toBe("approved");
    expect(expenseStatusFor("partially_reimbursed")).toBe("approved");
    expect(expenseStatusFor("rejected")).toBe("rejected");
    expect(expenseStatusFor("reimbursed")).toBe("reimbursed");
  });

  it("rejected expenses detach and return to draft", () => {
    expect(detachExpensesOnReject()).toEqual({ status: "draft", reportId: null });
  });

  it("self-approval is never allowed", () => {
    expect(canActorDecide("user-1", "user-1")).toBe(false);
    expect(canActorDecide("user-1", "user-2")).toBe(true);
  });
});

describe("computeReportTotal", () => {
  it("sums minor units", () => {
    expect(computeReportTotal([100, 250, 4999])).toBe(5349);
    expect(computeReportTotal([])).toBe(0);
  });
  it("throws on float amounts (money invariant)", () => {
    expect(() => computeReportTotal([100, 12.5])).toThrow();
  });
});
