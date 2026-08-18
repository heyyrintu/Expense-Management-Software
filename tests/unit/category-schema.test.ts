import { describe, expect, it } from "vitest";
import { categoryInputSchema } from "@/lib/schemas/category";
import { orgSettingsSchema } from "@/lib/schemas/org-settings";

describe("categoryInputSchema", () => {
  it("accepts a full category", () => {
    const r = categoryInputSchema.safeParse({
      name: "Travel",
      perExpenseLimit: "20000.00",
      monthlyLimit: "100000",
      receiptRequiredAbove: "500.5",
    });
    expect(r.success).toBe(true);
  });

  it("empty strings mean no limit", () => {
    const r = categoryInputSchema.safeParse({
      name: "Meals",
      perExpenseLimit: "",
      monthlyLimit: "",
      receiptRequiredAbove: "",
    });
    expect(r.success).toBe(true);
  });

  it("rejects bad money and blank names", () => {
    expect(
      categoryInputSchema.safeParse({
        name: "  ",
        perExpenseLimit: "",
        monthlyLimit: "",
        receiptRequiredAbove: "",
      }).success
    ).toBe(false);
    expect(
      categoryInputSchema.safeParse({
        name: "X",
        perExpenseLimit: "-5",
        monthlyLimit: "",
        receiptRequiredAbove: "",
      }).success
    ).toBe(false);
  });
});

describe("orgSettingsSchema", () => {
  it("normalizes currency to uppercase", () => {
    const r = orgSettingsSchema.safeParse({ name: "Acme", currency: "inr", mileageRate: "12.00" });
    expect(r.success && r.data.currency).toBe("INR");
  });
  it("rejects non-ISO currency and bad rates", () => {
    expect(orgSettingsSchema.safeParse({ name: "Acme", currency: "RUPEES", mileageRate: "1" }).success).toBe(false);
    expect(orgSettingsSchema.safeParse({ name: "Acme", currency: "INR", mileageRate: "-1" }).success).toBe(false);
  });
});
