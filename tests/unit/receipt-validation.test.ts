import { describe, expect, it } from "vitest";
import {
  RECEIPT_MAX_BYTES,
  sanitizeFileName,
  validateReceiptFile,
} from "@/lib/schemas/receipt";

describe("validateReceiptFile", () => {
  it("accepts jpg/png/pdf within 10 MB", () => {
    for (const type of ["image/jpeg", "image/png", "application/pdf"]) {
      expect(validateReceiptFile({ name: "r", type, size: 1024 })).toBeNull();
    }
    expect(
      validateReceiptFile({ name: "r", type: "image/png", size: RECEIPT_MAX_BYTES })
    ).toBeNull();
  });

  it("rejects other types", () => {
    for (const type of ["image/gif", "image/svg+xml", "text/html", "application/zip", ""]) {
      expect(validateReceiptFile({ name: "r", type, size: 1024 }), type).not.toBeNull();
    }
  });

  it("rejects oversized and empty files", () => {
    expect(
      validateReceiptFile({ name: "r", type: "image/png", size: RECEIPT_MAX_BYTES + 1 })
    ).not.toBeNull();
    expect(validateReceiptFile({ name: "r", type: "image/png", size: 0 })).not.toBeNull();
  });
});

describe("sanitizeFileName", () => {
  it("strips path separators and risky characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).not.toContain("/");
    expect(sanitizeFileName('a"b<c>d.png')).toBe("a_b_c_d.png");
  });
  it("never returns empty", () => {
    expect(sanitizeFileName("///").length).toBeGreaterThan(0);
    expect(sanitizeFileName("")).toBe("receipt");
    expect(sanitizeFileName("   ")).toBe("receipt");
  });
});
