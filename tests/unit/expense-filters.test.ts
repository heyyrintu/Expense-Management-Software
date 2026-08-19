// Expense-list filters (D1.3): the URL contract, the presets, and the one
// invariant that actually matters — a filter can only narrow.
import { describe, expect, it } from "vitest";

import {
  applyExpenseFilters,
  buildExpenseListWhere,
} from "@/lib/domain/expense-query";
import {
  EMPTY_EXPENSE_FILTERS,
  activeFilterCount,
  expenseFiltersToParams,
  hasActiveFilters,
  parseExpenseFilters,
  searchParamsToRecord,
  type ExpenseFilters,
} from "@/lib/schemas/expense-filters";
import {
  PRESET_LABELS,
  presetForRange,
  resolvePreset,
  toDateString,
} from "@/lib/date-range";

const UUID_A = "0192f0a0-0000-7000-8000-000000000001";
const UUID_B = "0192f0a0-0000-7000-8000-000000000002";

describe("parseExpenseFilters", () => {
  it("returns empty filters for an empty query string", () => {
    expect(parseExpenseFilters({})).toEqual(EMPTY_EXPENSE_FILTERS);
  });

  it("reads repeated keys as multiple values", () => {
    const f = parseExpenseFilters({ status: ["draft", "approved"] });
    expect(f.status).toEqual(["draft", "approved"]);
  });

  it("accepts a single value for a multi-select key", () => {
    expect(parseExpenseFilters({ status: "draft" }).status).toEqual(["draft"]);
  });

  it("drops bad values FIELD BY FIELD, keeping the rest", () => {
    // One broken uuid in a shared link must not discard the date range the
    // reader followed the link for.
    const f = parseExpenseFilters({
      from: "2026-08-01",
      to: "2026-08-31",
      categoryId: ["not-a-uuid", UUID_A],
      status: ["draft", "nonsense"],
    });
    expect(f.from).toBe("2026-08-01");
    expect(f.to).toBe("2026-08-31");
    expect(f.categoryId).toEqual([UUID_A]);
    expect(f.status).toEqual(["draft"]);
  });

  it("never throws on a mangled URL", () => {
    expect(() =>
      parseExpenseFilters({ from: "yesterday", status: ["../../etc/passwd"], q: "" })
    ).not.toThrow();
  });

  it("straightens a reversed date range instead of returning nothing", () => {
    const f = parseExpenseFilters({ from: "2026-08-31", to: "2026-08-01" });
    expect([f.from, f.to]).toEqual(["2026-08-01", "2026-08-31"]);
  });

  it("trims search and drops it when blank", () => {
    expect(parseExpenseFilters({ q: "  indigo  " }).q).toBe("indigo");
    expect(parseExpenseFilters({ q: "   " }).q).toBeUndefined();
  });
});

describe("URL round-trip", () => {
  /**
   * The whole journey a shared link takes: state → query string → a real URL
   * → back to state. Uses searchParamsToRecord, the same helper useUrlFilters
   * uses, so this exercises the shipped path rather than a lookalike.
   */
  function throughUrl(filters: ExpenseFilters): ExpenseFilters {
    const href = `https://example.test/expenses?${expenseFiltersToParams(filters).toString()}`;
    return parseExpenseFilters(searchParamsToRecord(new URL(href).searchParams));
  }

  it("survives serialise → URL → parse unchanged", () => {
    const filters: ExpenseFilters = {
      q: "indigo",
      from: "2026-08-01",
      to: "2026-08-31",
      status: ["draft", "submitted"],
      categoryId: [UUID_A, UUID_B],
      projectId: [],
      departmentId: [],
      userId: [UUID_A],
    };
    expect(throughUrl(filters)).toEqual(filters);
  });

  it("survives characters that need percent-encoding", () => {
    // A merchant search is free text. "Ola & Uber" or a café name must come
    // back byte-identical rather than truncated at the ampersand.
    for (const q of ["Ola & Uber", "café", "50% off", "a+b", "श्री", "a/b?c#d"]) {
      expect(throughUrl({ ...EMPTY_EXPENSE_FILTERS, q }).q).toBe(q);
    }
  });

  it("keeps every value of a multi-select through a real URL", () => {
    const filters: ExpenseFilters = {
      ...EMPTY_EXPENSE_FILTERS,
      status: ["draft", "submitted", "approved"],
    };
    // The failure this guards: Object.fromEntries on a raw iterator keeps
    // only the last repeated key, silently reducing three filters to one.
    expect(throughUrl(filters).status).toEqual(["draft", "submitted", "approved"]);
  });

  it("is idempotent — parsing a parsed URL changes nothing", () => {
    const once = throughUrl({
      ...EMPTY_EXPENSE_FILTERS,
      q: "uber",
      status: ["draft"],
      categoryId: [UUID_A],
    });
    expect(throughUrl(once)).toEqual(once);
  });

  it("writes nothing for an unfiltered view, so the URL stays clean", () => {
    expect(expenseFiltersToParams(EMPTY_EXPENSE_FILTERS).toString()).toBe("");
  });

  it("produces the same string for the same state", () => {
    const f: ExpenseFilters = { ...EMPTY_EXPENSE_FILTERS, status: ["draft"], q: "uber" };
    expect(expenseFiltersToParams(f).toString()).toBe(
      expenseFiltersToParams({ ...f }).toString()
    );
  });
});

describe("activeFilterCount", () => {
  it("counts a date range once, however many ends are set", () => {
    expect(activeFilterCount({ ...EMPTY_EXPENSE_FILTERS, from: "2026-08-01" })).toBe(1);
    expect(
      activeFilterCount({ ...EMPTY_EXPENSE_FILTERS, from: "2026-08-01", to: "2026-08-31" })
    ).toBe(1);
  });

  it("counts every selected facet value", () => {
    expect(
      activeFilterCount({
        ...EMPTY_EXPENSE_FILTERS,
        q: "uber",
        status: ["draft", "approved"],
        categoryId: [UUID_A],
      })
    ).toBe(4);
  });

  it("agrees with hasActiveFilters", () => {
    expect(hasActiveFilters(EMPTY_EXPENSE_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_EXPENSE_FILTERS, status: ["draft"] })).toBe(true);
  });
});

describe("buildExpenseListWhere", () => {
  it("returns nothing for empty filters", () => {
    expect(buildExpenseListWhere(EMPTY_EXPENSE_FILTERS)).toEqual({});
  });

  it("searches merchant case-insensitively", () => {
    expect(buildExpenseListWhere({ ...EMPTY_EXPENSE_FILTERS, q: "indigo" })).toEqual({
      merchant: { contains: "indigo", mode: "insensitive" },
    });
  });

  it("uses `in` for facets, single or multiple", () => {
    expect(
      buildExpenseListWhere({ ...EMPTY_EXPENSE_FILTERS, status: ["draft"] })
    ).toEqual({ status: { in: ["draft"] } });
    expect(
      buildExpenseListWhere({ ...EMPTY_EXPENSE_FILTERS, categoryId: [UUID_A, UUID_B] })
    ).toEqual({ categoryId: { in: [UUID_A, UUID_B] } });
  });

  it("treats the date range as inclusive at both ends", () => {
    const where = buildExpenseListWhere({
      ...EMPTY_EXPENSE_FILTERS,
      from: "2026-08-01",
      to: "2026-08-31",
    }) as { date: { gte: Date; lte: Date } };
    expect(where.date.gte.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    // Dates are stored at UTC midnight, so lte the day itself keeps the last
    // day's rows rather than dropping them.
    expect(where.date.lte.toISOString()).toBe("2026-08-31T00:00:00.000Z");
  });

  it("reaches department through the expense's owner", () => {
    expect(
      buildExpenseListWhere({ ...EMPTY_EXPENSE_FILTERS, departmentId: [UUID_A] })
    ).toEqual({ user: { departmentId: { in: [UUID_A] } } });
  });
});

describe("applyExpenseFilters — filters may only narrow", () => {
  it("keeps the scope predicate untouched when nothing is filtered", () => {
    expect(applyExpenseFilters({ userId: "me" }, EMPTY_EXPENSE_FILTERS)).toEqual({
      userId: "me",
    });
  });

  it("ANDs filters onto scope rather than merging them", () => {
    const where = applyExpenseFilters({ userId: "me" }, {
      ...EMPTY_EXPENSE_FILTERS,
      status: ["draft"],
    });
    expect(where).toEqual({ userId: "me", AND: [{ status: { in: ["draft"] } }] });
  });

  it("CANNOT let a user facet overwrite the pinned scope", () => {
    // The bug this shape exists to prevent: spreading the filter over the
    // scope would replace `userId: "me"` with the other user's id, and an
    // employee could filter their way into a colleague's expenses.
    const where = applyExpenseFilters({ userId: "me" }, {
      ...EMPTY_EXPENSE_FILTERS,
      userId: ["someone-else"],
    }) as { userId: string; AND: Array<Record<string, unknown>> };

    expect(where.userId).toBe("me");
    expect(where.AND[0]).toEqual({ userId: { in: ["someone-else"] } });
  });

  it("never emits an org key — org scoping belongs to scopedDb alone", () => {
    const where = applyExpenseFilters({ userId: "me" }, {
      q: "x",
      from: "2026-01-01",
      to: "2026-12-31",
      status: ["draft"],
      categoryId: [UUID_A],
      projectId: [UUID_B],
      departmentId: [UUID_A],
      userId: [UUID_B],
    });
    const serialised = JSON.stringify(where);
    expect(serialised).not.toContain("orgId");
    expect(serialised).not.toContain("org_id");
  });
});

describe("date-range presets", () => {
  const now = new Date("2026-08-19T12:00:00Z");

  it("resolves this month to its first and last day", () => {
    expect(resolvePreset("this_month", now)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("resolves last month, including across a year boundary", () => {
    expect(resolvePreset("last_month", now)).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(resolvePreset("last_month", new Date("2026-01-15T00:00:00Z"))).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("resolves the calendar quarter containing today", () => {
    expect(resolvePreset("this_quarter", now)).toEqual({
      from: "2026-07-01",
      to: "2026-09-30",
    });
    expect(resolvePreset("this_quarter", new Date("2026-02-10T00:00:00Z"))).toEqual({
      from: "2026-01-01",
      to: "2026-03-31",
    });
  });

  it("handles February in a leap year", () => {
    expect(resolvePreset("this_month", new Date("2028-02-10T00:00:00Z"))).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });

  it("has no computed range for custom", () => {
    expect(resolvePreset("custom", now)).toBeNull();
  });

  it("recognises a stored range as its preset, so a link lights the button", () => {
    expect(presetForRange({ from: "2026-08-01", to: "2026-08-31" }, now)).toBe("this_month");
    expect(presetForRange({ from: "2026-07-01", to: "2026-09-30" }, now)).toBe("this_quarter");
    expect(presetForRange({ from: "2026-08-03", to: "2026-08-09" }, now)).toBe("custom");
    expect(presetForRange({}, now)).toBe("custom");
  });

  it("stores dates rather than the preset name, so a shared link cannot drift", () => {
    // The whole reason the URL carries dates: "This month" picked in August
    // still selects August when the link is opened in September. If the URL
    // stored the word "this_month" the link would silently change period.
    const august = resolvePreset("this_month", now)!;
    expect(august).toEqual({ from: "2026-08-01", to: "2026-08-31" });

    const september = new Date("2026-09-05T00:00:00Z");
    // Same dates, same rows — only the label the UI puts on them moves, which
    // is honest: in September, August IS last month.
    expect(presetForRange(august, september)).toBe("last_month");
    expect(resolvePreset("last_month", september)).toEqual(august);
  });

  it("labels every preset", () => {
    for (const [preset, label] of Object.entries(PRESET_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
      expect(preset).toBeTruthy();
    }
  });

  it("formats a date as yyyy-mm-dd in UTC", () => {
    expect(toDateString(new Date("2026-08-19T23:30:00Z"))).toBe("2026-08-19");
  });
});
