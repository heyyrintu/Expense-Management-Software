import { describe, expect, it } from "vitest";
import {
  approvalButtons,
  decodeApprovalPayload,
  encodeApprovalPayload,
  freeFormFor,
  sendModeFor,
  templateFor,
  withinSessionWindow,
  SESSION_WINDOW_MS,
  TEMPLATE_NAMES,
  WHATSAPP_EVENTS,
  type WhatsAppEvent,
} from "@/lib/whatsapp/templates";
import { backoffMs, isRetryable, shouldRetry, MAX_SEND_ATTEMPTS } from "@/lib/whatsapp/retry";
import { parseStatuses } from "@/lib/whatsapp/meta";

const payload = {
  recipientName: "Asha",
  reportTitle: "August travel",
  actorName: "Ravi",
  amountFormatted: "₹4,500.00",
  reference: "UTR123456",
  reason: "Missing receipt",
  status: "Resolved",
};

describe("event → template mapping", () => {
  it("covers every WhatsApp event with a distinct template name", () => {
    const names = WHATSAPP_EVENTS.map((e) => TEMPLATE_NAMES[e]);
    expect(names.filter(Boolean)).toHaveLength(WHATSAPP_EVENTS.length);
    expect(new Set(names).size).toBe(WHATSAPP_EVENTS.length);
  });

  it("builds parameters in the documented order", () => {
    expect(templateFor("report.submitted", payload)).toEqual({
      name: "report_submitted",
      languageCode: expect.any(String),
      bodyParams: ["Asha", "Ravi", "August travel", "₹4,500.00"],
    });
    expect(templateFor("payment.done", payload).bodyParams).toEqual([
      "Asha",
      "₹4,500.00",
      "August travel",
      "UTR123456",
    ]);
    expect(templateFor("report.rejected", payload).bodyParams).toEqual([
      "Asha",
      "August travel",
      "Ravi",
      "Missing receipt",
    ]);
    expect(templateFor("complaint.status_changed", payload).bodyParams).toEqual([
      "Asha",
      "Resolved",
      "Missing receipt",
    ]);
  });

  it("never emits an empty parameter — Meta rejects those", () => {
    for (const event of WHATSAPP_EVENTS) {
      const params = templateFor(event, { recipientName: "" }).bodyParams ?? [];
      expect(params.length).toBeGreaterThan(0);
      for (const p of params) {
        expect(p.trim().length).toBeGreaterThan(0);
        expect(p).not.toMatch(/\n/);
      }
    }
  });

  it("collapses whitespace and truncates long parameters", () => {
    const params = templateFor("report.approved", {
      recipientName: "A",
      reportTitle: "line one\nline two   spaced",
      amountFormatted: "x".repeat(400),
    }).bodyParams as string[];
    expect(params[1]).toBe("line one line two spaced");
    expect(params[2].length).toBe(250);
  });

  it("has free-form copy for every event", () => {
    for (const event of WHATSAPP_EVENTS) {
      const body = freeFormFor(event, payload);
      expect(body.length).toBeGreaterThan(10);
    }
    expect(freeFormFor("payment.done", payload)).toContain("UTR123456");
    expect(freeFormFor("report.rejected", payload)).toContain("Missing receipt");
  });
});

describe("24-hour session window", () => {
  const now = new Date("2026-08-21T12:00:00Z");

  it("is open only for an inbound message in the last 24 hours", () => {
    expect(withinSessionWindow(null, now)).toBe(false);
    expect(withinSessionWindow(undefined, now)).toBe(false);
    expect(withinSessionWindow(new Date(now.getTime() - 1000), now)).toBe(true);
    expect(
      withinSessionWindow(new Date(now.getTime() - SESSION_WINDOW_MS + 1000), now)
    ).toBe(true);
    expect(withinSessionWindow(new Date(now.getTime() - SESSION_WINDOW_MS), now)).toBe(
      false
    );
    expect(
      withinSessionWindow(new Date(now.getTime() - 25 * 60 * 60 * 1000), now)
    ).toBe(false);
  });

  it("ignores a clock-skewed future timestamp", () => {
    expect(withinSessionWindow(new Date(now.getTime() + 60_000), now)).toBe(false);
  });

  it("chooses free-form inside the window and a template outside it", () => {
    const inside = sendModeFor(
      "report.approved",
      payload,
      new Date(now.getTime() - 60_000),
      now
    );
    expect(inside.kind).toBe("free_form");
    const outside = sendModeFor("report.approved", payload, null, now);
    expect(outside.kind).toBe("template");
    if (outside.kind === "template") {
      expect(outside.template.name).toBe("report_approved");
    }
  });
});

describe("quick-approve buttons", () => {
  it("round-trips payloads and rejects foreign ones", () => {
    expect(decodeApprovalPayload(encodeApprovalPayload("approve", "r1"))).toEqual({
      action: "approve",
      reportId: "r1",
    });
    expect(decodeApprovalPayload(encodeApprovalPayload("open", "r1"))).toEqual({
      action: "open",
      reportId: "r1",
    });
    // 8.2 capture payloads must not be mistaken for approvals
    expect(decodeApprovalPayload("wa:confirm:inbound-1")).toBeNull();
    expect(decodeApprovalPayload("ap:reject:r1")).toBeNull();
    expect(decodeApprovalPayload("ap:approve:")).toBeNull();
    expect(decodeApprovalPayload(null)).toBeNull();
  });

  it("offers Approve + Open for a clean report", () => {
    const buttons = approvalButtons({ reportId: "r1", flagged: false });
    expect(buttons.map((b) => decodeApprovalPayload(b.id)?.action)).toEqual([
      "approve",
      "open",
    ]);
  });

  it("REPLACES Approve with Open in app for a flagged report", () => {
    const buttons = approvalButtons({ reportId: "r1", flagged: true });
    expect(buttons).toHaveLength(1);
    expect(decodeApprovalPayload(buttons[0].id)?.action).toBe("open");
    expect(buttons.some((b) => b.id.includes("approve"))).toBe(false);
  });

  it("never offers reject from chat — a reason is mandatory", () => {
    for (const flagged of [true, false]) {
      const buttons = approvalButtons({ reportId: "r1", flagged });
      expect(buttons.some((b) => /reject|send.?back/i.test(b.title))).toBe(false);
    }
    expect(decodeApprovalPayload("ap:send_back:r1")).toBeNull();
  });

  it("keeps button titles within Meta's 20-character limit", () => {
    for (const flagged of [true, false]) {
      for (const b of approvalButtons({ reportId: "r1", flagged })) {
        expect(b.title.length).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe("send retry policy", () => {
  it("backs off exponentially", () => {
    expect(backoffMs(1)).toBe(500);
    expect(backoffMs(2)).toBe(1000);
    expect(backoffMs(3)).toBe(2000);
    expect(backoffMs(99)).toBe(backoffMs(6));
  });

  it("retries transient failures but not permanent ones", () => {
    expect(isRetryable("timeout")).toBe(true);
    expect(isRetryable("WhatsApp API responded 500")).toBe(true);
    expect(isRetryable(undefined)).toBe(true);
    expect(isRetryable("Template name does not exist")).toBe(false);
    expect(isRetryable("Invalid parameter for template")).toBe(false);
    expect(isRetryable("Recipient not in allowed list")).toBe(false);
    expect(isRetryable("Invalid OAuth access token")).toBe(false);
  });

  it("stops at the attempt ceiling", () => {
    expect(shouldRetry(1, "timeout")).toBe(true);
    expect(shouldRetry(MAX_SEND_ATTEMPTS - 1, "timeout")).toBe(true);
    expect(shouldRetry(MAX_SEND_ATTEMPTS, "timeout")).toBe(false);
    expect(shouldRetry(1, "template does not exist")).toBe(false);
  });
});

describe("delivery status webhook", () => {
  it("reads statuses with errors and timestamps", () => {
    const statuses = parseStatuses({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "PN1" },
                statuses: [
                  { id: "wamid.a", status: "delivered", timestamp: "1755772800" },
                  {
                    id: "wamid.b",
                    status: "failed",
                    timestamp: "1755772900",
                    errors: [{ title: "Undeliverable", message: "Number unreachable" }],
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(statuses).toHaveLength(2);
    expect(statuses[0]).toMatchObject({ waMessageId: "wamid.a", status: "delivered", error: null });
    expect(statuses[1]).toMatchObject({
      waMessageId: "wamid.b",
      status: "failed",
      error: "Number unreachable",
    });
  });

  it("ignores message payloads and junk", () => {
    expect(parseStatuses(null)).toEqual([]);
    expect(parseStatuses({})).toEqual([]);
    expect(
      parseStatuses({ entry: [{ changes: [{ value: { messages: [{ id: "x" }] } }] }] })
    ).toEqual([]);
    expect(
      parseStatuses({ entry: [{ changes: [{ value: { statuses: [{ status: "sent" }] } }] }] })
    ).toEqual([]);
  });
});

describe("event coverage", () => {
  it("maps exactly the six events the plan calls for", () => {
    const expected: WhatsAppEvent[] = [
      "report.submitted",
      "report.approved",
      "report.rejected",
      "report.sent_back",
      "payment.done",
      "complaint.status_changed",
    ];
    expect([...WHATSAPP_EVENTS].sort()).toEqual([...expected].sort());
  });
});
