import { describe, expect, it } from "vitest";
import {
  computeMileageAmount,
  MILEAGE_MERCHANT,
  toMileageData,
} from "@/lib/domain/expense";
import { mileageInputSchema } from "@/lib/schemas/expense";

describe("computeMileageAmount", () => {
  it("distance × rate in pure integer math", () => {
    expect(computeMileageAmount(42, 1200)).toBe(50400); // 42 km × ₹12.00
    expect(computeMileageAmount(1, 1)).toBe(1);
  });
  it("null when the rate is unconfigured or distance invalid", () => {
    expect(computeMileageAmount(10, 0)).toBeNull();
    expect(computeMileageAmount(0, 1200)).toBeNull();
    expect(computeMileageAmount(-5, 1200)).toBeNull();
    expect(computeMileageAmount(2.5, 1200)).toBeNull();
  });
  it("throws on a float rate (money invariant)", () => {
    expect(() => computeMileageAmount(10, 12.5)).toThrow();
  });
});

describe("toMileageData", () => {
  const input = {
    distanceKm: "42",
    date: "2026-08-15",
    categoryId: "0198c5f2-0000-7000-8000-000000000c01",
    projectId: "",
    purpose: "site visit",
  };

  it("derives amount, type, and the fixed merchant label", () => {
    const d = toMileageData(input, 1200);
    expect(d?.amount).toBe(50400);
    expect(d?.type).toBe("mileage");
    expect(d?.distanceKm).toBe(42);
    expect(d?.merchant).toBe(MILEAGE_MERCHANT);
    expect(d?.date.toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });

  it("null when the org has no rate", () => {
    expect(toMileageData(input, 0)).toBeNull();
  });
});

describe("mileageInputSchema", () => {
  it("accepts whole positive km", () => {
    expect(mileageInputSchema.safeParse({ ...base(), distanceKm: "1" }).success).toBe(true);
    expect(mileageInputSchema.safeParse({ ...base(), distanceKm: "99999" }).success).toBe(true);
  });
  it("rejects zero, decimals, negatives, and absurd distances", () => {
    for (const bad of ["0", "-3", "2.5", "100000", "abc", ""]) {
      expect(mileageInputSchema.safeParse({ ...base(), distanceKm: bad }).success, bad).toBe(false);
    }
  });
  function base() {
    return {
      distanceKm: "10",
      date: "2026-08-15",
      categoryId: "0198c5f2-0000-7000-8000-000000000c01",
      projectId: "",
      purpose: "",
    };
  }
});
