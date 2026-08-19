// Isolation for the D0.4 app shell.
//
// The shell is presentation, but it introduced two new reads in
// app/(app)/layout.tsx — the org's display name and the signed-in user's
// name/email — and CLAUDE.md is unconditional: every new query gets a case
// here proving org B cannot reach org A's data through it.
//
// These are the exact shapes the layout issues.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("shell-a");
  B = await provisionOrg("shell-b");
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("app shell chrome reads", () => {
  it("B asking for A's organization gets its OWN, never A's", async () => {
    // Not null — and that is deliberate. For Organization, scope-args pins
    // `where.id` to the session's org, so the caller's id is overwritten
    // rather than ANDed. The session always wins over the request, which is
    // the safe direction: B cannot address A's row at all.
    const row = (await scopedDb(B.orgId).organization.findUnique({
      where: { id: A.orgId },
      select: { name: true },
    })) as { name: string } | null;

    expect(row?.name).toBe("Isolation shell-b");
    expect(row?.name).not.toBe("Isolation shell-a");
  });

  it("B listing organizations by A's id gets nothing", async () => {
    // findMany goes through the AND branch instead, so a filter genuinely
    // intersects and the result is empty rather than substituted.
    const rows = (await scopedDb(B.orgId).organization.findMany({
      where: { id: A.orgId },
      select: { name: true },
    })) as Array<{ name: string }>;
    expect(rows).toHaveLength(0);
  });

  it("B reads its own organization name", async () => {
    const db = scopedDb(B.orgId);
    const org = (await db.organization.findUnique({
      where: { id: B.orgId },
      select: { name: true },
    })) as { name: string } | null;
    expect(org?.name).toBe("Isolation shell-b");
  });

  it("B cannot read A's user for the avatar menu", async () => {
    const db = scopedDb(B.orgId);
    expect(
      await db.user.findUnique({
        where: { id: A.users.finance_admin },
        select: { name: true, email: true },
      })
    ).toBeNull();
  });

  it("B reads its own user", async () => {
    const db = scopedDb(B.orgId);
    const user = (await db.user.findUnique({
      where: { id: B.users.finance_admin },
      select: { name: true, email: true },
    })) as { name: string; email: string } | null;
    expect(user?.email).toBe(`finance_admin@${B.slug}.test`);
  });

  it("B's unread notification count never counts A's notifications", async () => {
    await owner.notification.create({
      data: {
        orgId: A.orgId,
        userId: A.users.employee,
        type: "report.submitted",
        title: "A only",
        body: "Should never reach B",
      },
    });
    const count = await scopedDb(B.orgId).notification.count({
      where: { userId: A.users.employee, readAt: null },
    });
    expect(count).toBe(0);
  });
});
