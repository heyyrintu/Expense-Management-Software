// /design-system access rule (D0.5).
import { describe, expect, it } from "vitest";

import { canViewGallery } from "@/lib/design/gallery-access";
import { ROLES } from "@/lib/auth/roles";

describe("canViewGallery", () => {
  it("is open in development, signed in or not", () => {
    expect(canViewGallery({ nodeEnv: "development", role: null })).toBe(true);
    expect(canViewGallery({ nodeEnv: "development", role: "employee" })).toBe(true);
  });

  it("is open in test so the suite can render it", () => {
    expect(canViewGallery({ nodeEnv: "test", role: null })).toBe(true);
  });

  it("requires org_admin in production", () => {
    for (const role of ROLES) {
      expect(canViewGallery({ nodeEnv: "production", role })).toBe(role === "org_admin");
    }
  });

  it("refuses an unauthenticated visitor in production", () => {
    expect(canViewGallery({ nodeEnv: "production", role: null })).toBe(false);
  });

  it("treats an unknown or unset NODE_ENV as production — fail closed", () => {
    expect(canViewGallery({ nodeEnv: undefined, role: null })).toBe(false);
    expect(canViewGallery({ nodeEnv: undefined, role: "finance_admin" })).toBe(false);
    expect(canViewGallery({ nodeEnv: undefined, role: "org_admin" })).toBe(true);
    // A preview/staging build must not silently open the gallery.
    expect(canViewGallery({ nodeEnv: "preview", role: "finance_admin" })).toBe(false);
  });
});
