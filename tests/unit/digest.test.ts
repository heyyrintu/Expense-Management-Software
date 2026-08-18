import { describe, expect, it } from "vitest";
import {
  buildApprovalDigest,
  oldestAgeDays,
  type DigestItem,
} from "@/lib/domain/digest";

const now = new Date("2026-08-18T09:00:00.000Z");
const item = (over: Partial<DigestItem> = {}): DigestItem => ({
  title: "Trip",
  ownerName: "Priya",
  total: 50000,
  submittedAt: new Date("2026-08-15T09:00:00.000Z"),
  level: 1,
  ...over,
});

describe("oldestAgeDays", () => {
  it("finds the oldest submission in whole days; empty/no-date → 0", () => {
    expect(oldestAgeDays([item(), item({ submittedAt: new Date("2026-08-10T09:00:00.000Z") })], now)).toBe(8);
    expect(oldestAgeDays([item({ submittedAt: null })], now)).toBe(0);
    expect(oldestAgeDays([], now)).toBe(0);
  });
});

describe("buildApprovalDigest", () => {
  it("summarises count, total, aging, and lists items with levels", () => {
    const d = buildApprovalDigest(
      [item(), item({ title: "Offsite", total: 150000, level: 2 })],
      "INR",
      now,
      "http://localhost:3000/"
    );
    expect(d.subject).toContain("2 reports");
    expect(d.subject).toContain("2,000.00");
    expect(d.text).toContain("Offsite");
    expect(d.text).toContain("(2nd approval)");
    expect(d.text).toContain("waiting 3 days");
    expect(d.text).toContain("http://localhost:3000/approvals");
  });

  it("singular forms and truncation past 20 items", () => {
    const one = buildApprovalDigest([item()], "INR", now, "http://x");
    expect(one.subject).toContain("1 report awaiting");
    const many = buildApprovalDigest(
      Array.from({ length: 25 }, (_, i) => item({ title: `R${i}` })),
      "INR",
      now,
      "http://x"
    );
    expect(many.text).toContain("…and 5 more");
  });
});
