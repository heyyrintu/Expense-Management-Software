import { describe, expect, it } from "vitest";
import { complaintMessageFor } from "@/lib/notifications/complaint-messages";

const base = { complaintId: "c1", complaintType: "payment_not_received" as const };

describe("complaint notification copy", () => {
  it("links every message to the complaint", () => {
    for (const event of [
      "complaint.raised",
      "complaint.assigned",
      "complaint.status_changed",
      "complaint.message",
    ] as const) {
      const msg = complaintMessageFor(event, { ...base, status: "in_review" });
      expect(msg.link).toBe("/complaints/c1");
      expect(msg.type).toBe(event);
      expect(msg.title.length).toBeGreaterThan(0);
      expect(msg.body.length).toBeGreaterThan(0);
    }
  });

  it("names the dispute type in the body", () => {
    expect(complaintMessageFor("complaint.raised", { ...base, actorName: "Eve" }).body).toBe(
      "Eve raised a complaint about payment not received."
    );
  });

  it("tells the employee what the new status is, with the resolution note", () => {
    const msg = complaintMessageFor("complaint.status_changed", {
      ...base,
      status: "resolved",
      actorName: "Fay",
      resolutionNote: "Re-sent by NEFT.",
    });
    expect(msg.title).toBe("Your complaint is now resolved");
    expect(msg.body).toContain("by Fay");
    expect(msg.body).toContain("Re-sent by NEFT.");
  });

  it("falls back gracefully with no actor", () => {
    const msg = complaintMessageFor("complaint.message", {
      ...base,
      complaintType: "other",
    });
    expect(msg.body).toBe("Someone replied to the complaint about other.");
  });
});
