// Who may see /design-system (D0.5).
//
// The rule is one sentence — "open in development, org_admin only in
// production" — but it is a security decision, so it lives here as a pure
// function that tests/unit/gallery-access.test.ts can exercise directly
// rather than as an `if` buried in a layout nobody re-reads.
//
// WHY GATE IT AT ALL. The gallery renders no tenant data: no session, no
// scopedDb, no org. What it does expose is a complete inventory of the
// product's surfaces — including components for features a given tenant may
// not have enabled — plus every internal task reference. That is a
// reconnaissance surface, not a data leak, and org_admin is the proportionate
// bar for it.
import { roleAtLeast, type Role } from "@/lib/auth/roles";

export type GalleryViewer = {
  /** process.env.NODE_ENV at the call site. */
  nodeEnv: string | undefined;
  /** Session role, or null when signed out / not a tenant session. */
  role: Role | null;
};

/**
 * True when the gallery may render.
 *
 * Development and test are open: the gallery is a working tool, and requiring
 * a login to check a focus ring would mean nobody checks focus rings.
 * Anything else — production, preview, an unset NODE_ENV — is treated as
 * production and demands org_admin. Defaulting the unknown case to CLOSED is
 * deliberate: a misconfigured environment should over-protect, not under.
 */
export function canViewGallery({ nodeEnv, role }: GalleryViewer): boolean {
  if (nodeEnv === "development" || nodeEnv === "test") return true;
  if (!role) return false;
  return roleAtLeast(role, "org_admin");
}
