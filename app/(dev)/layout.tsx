import { notFound } from "next/navigation";

import { getSessionCtx } from "@/lib/auth/guard";
import { canViewGallery } from "@/lib/design/gallery-access";

/**
 * Gate for every (dev) route (D0.5).
 *
 * Open in development, org_admin in production — the rule itself is in
 * lib/design/gallery-access.ts, where it is unit-tested.
 *
 * notFound(), NOT redirect(): a 404 tells an unauthorised visitor nothing.
 * A redirect to /login would confirm the route exists and is worth coming
 * back for with better credentials.
 *
 * The guard lives in the layout so it covers anything added under (dev)
 * later without that route having to remember.
 */
export default async function DevLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Skipped entirely in development, so the gallery needs no session there.
  const role =
    process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
      ? null
      : ((await getSessionCtx())?.role ?? null);

  if (!canViewGallery({ nodeEnv: process.env.NODE_ENV, role })) notFound();

  return children;
}
