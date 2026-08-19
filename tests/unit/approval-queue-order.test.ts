// Approval queue presentation logic (D3.1) — §7.3.
//
// The ordering and the summarising are what let an approver decide without
// opening a report, so they are pure functions with tests rather than
// incidental behaviour of a query.
import { describe, expect, it } from "vitest";

import {
  dedupeFlags,
  sortApprovalQueue,
  summariseCategories,
  type QueueItem,
} from "@/lib/domain/approval-queue";

function item(over: Partial<QueueItem> & { id: string }): QueueItem {
  return {
    title: over.id,
    total: 100000,
    submittedAt: null,
    ownerName: "Someone",
    expenseCount: 1,
    level: 1,
    flagged: false,
    categories: [],
    flags: [],
    ...over,
  };
}

const day = (n: number) => new Date(Date.UTC(2026, 7, n));

describe("sortApprovalQueue", () => {
  it("puts flagged reports first (§7.3)", () => {
    const sorted = sortApprovalQueue([
      item({ id: "clean" }),
      item({ id: "flagged", flagged: true }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["flagged", "clean"]);
  });

  it("orders oldest first within each group", () => {
    // A queue that surfaces the newest item is a queue whose bottom never
    // gets read.
    const sorted = sortApprovalQueue([
      item({ id: "clean-new", submittedAt: day(10) }),
      item({ id: "flagged-new", flagged: true, submittedAt: day(9) }),
      item({ id: "clean-old", submittedAt: day(1) }),
      item({ id: "flagged-old", flagged: true, submittedAt: day(2) }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual([
      "flagged-old",
      "flagged-new",
      "clean-old",
      "clean-new",
    ]);
  });

  it("never lets a newer flagged report fall below an older clean one", () => {
    // The failure this ordering exists to prevent: flagged reports need an
    // individual decision, so burying them is how they age out.
    const sorted = sortApprovalQueue([
      item({ id: "clean-ancient", submittedAt: day(1) }),
      item({ id: "flagged-today", flagged: true, submittedAt: day(28) }),
    ]);
    expect(sorted[0].id).toBe("flagged-today");
  });

  it("treats a missing submittedAt as oldest rather than dropping the row", () => {
    const sorted = sortApprovalQueue([
      item({ id: "dated", submittedAt: day(5) }),
      item({ id: "undated", submittedAt: null }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["undated", "dated"]);
  });

  it("does not mutate its input", () => {
    const input = [item({ id: "a" }), item({ id: "b", flagged: true })];
    const before = input.map((i) => i.id);
    sortApprovalQueue(input);
    expect(input.map((i) => i.id)).toEqual(before);
  });
});

describe("summariseCategories", () => {
  it("orders by how much of the report each category accounts for", () => {
    // Nine taxis and one hotel reads "Travel, Lodging", not whichever was
    // entered first.
    const expenses = [
      ...Array.from({ length: 9 }, () => ({ category: { name: "Travel" } })),
      { category: { name: "Lodging" } },
    ];
    expect(summariseCategories(expenses)).toEqual(["Travel", "Lodging"]);
  });

  it("breaks ties alphabetically, so the summary is stable between renders", () => {
    expect(
      summariseCategories([
        { category: { name: "Meals" } },
        { category: { name: "A-category" } },
      ])
    ).toEqual(["A-category", "Meals"]);
  });

  it("returns each category once", () => {
    expect(
      summariseCategories([
        { category: { name: "Travel" } },
        { category: { name: "Travel" } },
      ])
    ).toEqual(["Travel"]);
  });

  it("handles an empty report", () => {
    expect(summariseCategories([])).toEqual([]);
  });
});

describe("dedupeFlags", () => {
  it("shows one chip per RULE, not per expense", () => {
    // Six expenses over the same limit is one fact an approver needs, not
    // six identical chips to read past.
    const flags = dedupeFlags([
      { flags: [{ rule: "per_expense_limit", message: "Over the limit" }] },
      { flags: [{ rule: "per_expense_limit", message: "Over the limit" }] },
      { flags: [{ rule: "duplicate", message: "Possible duplicate" }] },
    ]);
    expect(flags.map((f) => f.rule)).toEqual(["per_expense_limit", "duplicate"]);
  });

  it("ignores expenses with no flags, and malformed flag data", () => {
    expect(dedupeFlags([{ flags: [] }, { flags: null }, { flags: "nonsense" }])).toEqual([]);
  });

  it("keeps the first message it saw for a rule", () => {
    const flags = dedupeFlags([
      { flags: [{ rule: "duplicate", message: "Same as EXP-1" }] },
      { flags: [{ rule: "duplicate", message: "Same as EXP-2" }] },
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0].message).toBe("Same as EXP-1");
  });
});
