import { describe, expect, it } from "vitest";
import {
  alertLevel,
  contribution,
  crossedThresholds,
  inBudgetScope,
  periodWindow,
  utilizationPct,
  type BudgetExpense,
} from "@/lib/domain/budget";

describe("periodWindow", () => {
  const now = new Date("2026-08-18T10:00:00.000Z");
  it("monthly / quarterly / yearly UTC windows", () => {
    expect(periodWindow("monthly", now).start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(periodWindow("monthly", now).end.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(periodWindow("quarterly", now).start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(periodWindow("quarterly", now).end.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(periodWindow("yearly", now).start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(periodWindow("yearly", now).end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
  it("quarter boundaries", () => {
    expect(periodWindow("quarterly", new Date("2026-12-31T00:00:00.000Z")).start.toISOString())
      .toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("utilization + alert levels", () => {
  it("floors percent and maps levels", () => {
    expect(utilizationPct(7999, 10000)).toBe(79);
    expect(utilizationPct(8000, 10000)).toBe(80);
    expect(utilizationPct(15000, 10000)).toBe(150);
    expect(utilizationPct(0, 0)).toBe(0); // unconfigured amount → never alarms
    expect(alertLevel(79)).toBe("ok");
    expect(alertLevel(80)).toBe("warn");
    expect(alertLevel(99)).toBe("warn");
    expect(alertLevel(100)).toBe("over");
  });
});

describe("crossedThresholds", () => {
  const amount = 10000;
  it("fires 80 and/or 100 exactly on crossing", () => {
    expect(crossedThresholds(7000, 7999, amount)).toEqual([]);
    expect(crossedThresholds(7999, 8000, amount)).toEqual([80]);
    expect(crossedThresholds(8000, 9999, amount)).toEqual([]); // already past 80
    expect(crossedThresholds(9999, 10000, amount)).toEqual([100]);
    expect(crossedThresholds(7000, 12000, amount)).toEqual([80, 100]);
  });
  it("never fires on decreases or zero budgets", () => {
    expect(crossedThresholds(9000, 8000, amount)).toEqual([]);
    expect(crossedThresholds(0, 99999, 0)).toEqual([]);
  });
});

describe("scope + contribution", () => {
  const w = { start: new Date("2026-08-01T00:00:00.000Z"), end: new Date("2026-09-01T00:00:00.000Z") };
  const e = (over: Partial<BudgetExpense>): BudgetExpense => ({
    amount: 100,
    date: new Date("2026-08-10T00:00:00.000Z"),
    categoryId: "c1",
    projectId: "p1",
    ownerDepartmentId: "d1",
    ...over,
  });

  it("matches by the right dimension", () => {
    expect(inBudgetScope(e({}), "category", "c1")).toBe(true);
    expect(inBudgetScope(e({}), "project", "p2")).toBe(false);
    expect(inBudgetScope(e({ ownerDepartmentId: null }), "department", "d1")).toBe(false);
  });

  it("sums only in-scope, in-window expenses", () => {
    const rows = [
      e({ amount: 100 }),
      e({ amount: 200, categoryId: "other" }),
      e({ amount: 400, date: new Date("2026-07-31T00:00:00.000Z") }), // outside window
    ];
    expect(contribution(rows, "category", "c1", w)).toBe(100);
  });
});
