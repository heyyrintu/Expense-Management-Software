// Complaints inbox filters (D4.3) — the URL contract.
//
// Multi-select facets have one behaviour that is easy to get backwards, and
// it is tested first: ticking a SECOND box must widen the result, never
// narrow it.
import { describe, expect, it } from "vitest";

import {
  ageFloorBusinessDays,
  complaintFilterCount,
  complaintFiltersToParams,
  EMPTY_COMPLAINT_FILTERS,
  parseComplaintFilters,
  type ComplaintUrlFilters,
} from "@/lib/domain/complaint-filters";

function roundTrip(filters: ComplaintUrlFilters): ComplaintUrlFilters {
  const params = complaintFiltersToParams(filters);
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    raw[key] = all.length === 1 ? all[0] : all;
  }
  return parseComplaintFilters(raw);
}

describe("parseComplaintFilters", () => {
  it("is empty when the URL is", () => {
    expect(parseComplaintFilters({})).toEqual(EMPTY_COMPLAINT_FILTERS);
  });

  it("reads repeated keys as a multi-select", () => {
    const filters = parseComplaintFilters({ status: ["open", "in_review"] });
    expect(filters.status).toEqual(["open", "in_review"]);
  });

  it("drops unknown values field by field, keeping the rest", () => {
    // One bad value in a shared link must not discard the filter the reader
    // actually came for.
    const filters = parseComplaintFilters({
      status: ["open", "exploded"],
      type: "not_a_type",
      age: "breached",
    });
    expect(filters.status).toEqual(["open"]);
    expect(filters.type).toEqual([]);
    expect(filters.age).toEqual(["breached"]);
  });

  it("reads `mine` only as the literal 1", () => {
    expect(parseComplaintFilters({ mine: "1" }).mine).toBe(true);
    expect(parseComplaintFilters({ mine: "true" }).mine).toBe(false);
  });
});

describe("complaintFiltersToParams", () => {
  it("round-trips a full filter state", () => {
    const filters: ComplaintUrlFilters = {
      status: ["open", "in_review"],
      type: ["wrong_amount"],
      age: ["breached"],
      mine: true,
    };
    expect(roundTrip(filters)).toEqual(filters);
  });

  it("writes nothing for an empty state", () => {
    // A clean URL for an unfiltered inbox, and two identical filter states
    // always produce the same string.
    expect(complaintFiltersToParams(EMPTY_COMPLAINT_FILTERS).toString()).toBe("");
  });
});

describe("complaintFilterCount", () => {
  it("counts every applied value, including `mine`", () => {
    expect(
      complaintFilterCount({
        status: ["open", "in_review"],
        type: ["other"],
        age: [],
        mine: true,
      })
    ).toBe(4);
  });
});

describe("ageFloorBusinessDays", () => {
  it("is null when no age filter is applied", () => {
    expect(ageFloorBusinessDays([])).toBeNull();
  });

  it("maps each bucket to its floor", () => {
    expect(ageFloorBusinessDays(["warning"])).toBe(3);
    expect(ageFloorBusinessDays(["breached"])).toBe(5);
  });

  it("WIDENS when both are selected, rather than narrowing", () => {
    // The multi-select promise: two ticked boxes mean "either". Taking the
    // maximum would make ticking a second box return FEWER rows, which is
    // the opposite of what the control implies — and the kind of bug nobody
    // reports because it looks like there simply aren't many complaints.
    expect(ageFloorBusinessDays(["warning", "breached"])).toBe(3);
    expect(ageFloorBusinessDays(["breached", "warning"])).toBe(3);
  });
});
