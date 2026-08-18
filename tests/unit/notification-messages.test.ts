import { describe, expect, it } from "vitest";
import { messageFor, type NotificationEvent } from "@/lib/notifications/messages";

const EVENTS: NotificationEvent[] = [
  "report.submitted",
  "report.approved",
  "report.approved_level1",
  "report.rejected",
  "report.sent_back",
  "report.reimbursed",
];

describe("messageFor", () => {
  it("every event produces a title, body, and a link to the right surface", () => {
    for (const event of EVENTS) {
      const m = messageFor(event, {
        reportId: "rid",
        reportTitle: "Trip to Pune",
        actorName: "Priya",
        reason: "missing receipt",
        totalFormatted: "₹5,000.00",
      });
      expect(m.type).toBe(event);
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.body).toContain("Trip to Pune");
      // approver-facing events deep-link to approvals; owner-facing to reports
      if (event === "report.submitted" || event === "report.approved_level1") {
        expect(m.link).toBe("/approvals/rid");
      } else {
        expect(m.link).toBe("/reports/rid");
      }
    }
  });

  it("reject/send-back include the reason; approve includes the actor", () => {
    expect(
      messageFor("report.rejected", { reportId: "r", reportTitle: "T", reason: "no receipt" }).body
    ).toContain("no receipt");
    expect(
      messageFor("report.sent_back", { reportId: "r", reportTitle: "T", reason: "wrong project" }).body
    ).toContain("wrong project");
    expect(
      messageFor("report.approved", { reportId: "r", reportTitle: "T", actorName: "Asha" }).body
    ).toContain("Asha");
  });

  it("copes with missing optional fields", () => {
    for (const event of EVENTS) {
      const m = messageFor(event, { reportId: "r", reportTitle: "T" });
      expect(m.body.length).toBeGreaterThan(0);
      expect(m.body).not.toContain("undefined");
    }
  });
});
