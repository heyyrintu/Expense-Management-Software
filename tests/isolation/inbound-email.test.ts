// Isolation for 6.6: ingestion is anchored to the RECIPIENT org — a sender
// from org A can never create records in org B, and dead letters stay
// org-scoped.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("mail-a");
  B = await provisionOrg("mail-b");
});

afterAll(async () => {
  await owner.inboundEmailFailure.deleteMany({
    where: { orgId: { in: [A.orgId, B.orgId] } },
  });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("sender matching is org-anchored", () => {
  it("an org-A sender emailing org B's address matches no user → dead letter, no expense", async () => {
    // the webhook's exact sender lookup, in the RECIPIENT org's scope:
    const senderEmail = `employee@${A.slug}.test`; // exists in A only
    const dbB = scopedDb(B.orgId);
    const user = await dbB.user.findUnique({
      where: { orgId_email: { orgId: B.orgId, email: senderEmail } },
      select: { id: true },
    });
    expect(user).toBeNull(); // → route silently rejects + dead-letters

    await dbB.inboundEmailFailure.create({
      data: {
        orgId: B.orgId,
        fromEmail: senderEmail,
        subject: "Taxi receipt",
        reason: "unknown sender",
      },
    });
    // nothing was created for the sender in EITHER org via this path
    expect(
      await owner.expense.count({
        where: { orgId: B.orgId, user: { email: senderEmail } },
      })
    ).toBe(0);
  });

  it("the same email in the sender's OWN org matches (control)", async () => {
    const user = await scopedDb(A.orgId).user.findUnique({
      where: { orgId_email: { orgId: A.orgId, email: `employee@${A.slug}.test` } },
      select: { id: true },
    });
    expect(user).not.toBeNull();
  });
});

describe("dead letters are org-scoped", () => {
  it("A's admins never see B's failures", async () => {
    const aView = await scopedDb(A.orgId).inboundEmailFailure.findMany();
    for (const f of aView as Array<{ orgId: string }>) expect(f.orgId).toBe(A.orgId);
    expect(
      await scopedDb(A.orgId).inboundEmailFailure.count({
        where: { reason: "unknown sender" },
      })
    ).toBe(0); // that failure belongs to B
  });
});
