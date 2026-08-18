// Storage isolation (tenant-isolation-check skill step 5): org B must not be
// able to obtain a signed URL for org A's receipt. Signed URLs are only ever
// derived from a scopedDb receipt lookup, so the test proves that lookup
// fails closed — and that a signed URL for one's own receipt works and is
// confined to the org's storage prefix.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { signedReceiptUrl } from "@/lib/storage/receipts";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("rcpt-a");
  B = await provisionOrg("rcpt-b");
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("signed URL isolation", () => {
  it("B's scope cannot resolve A's receipt, so no URL can be issued", async () => {
    const receipt = await scopedDb(B.orgId).receipt.findUnique({
      where: { id: A.receiptId },
    });
    expect(receipt).toBeNull(); // nothing to presign — flow fails closed
  });

  it("A's own receipt presigns to A's org prefix", async () => {
    const receipt = await scopedDb(A.orgId).receipt.findUniqueOrThrow({
      where: { id: A.receiptId },
    });
    expect(receipt.storageKey.startsWith(`${A.orgId}/receipts/`)).toBe(true);
    const url = await signedReceiptUrl(receipt);
    expect(url).toContain(encodeURI(receipt.storageKey));
    expect(url).not.toContain(B.orgId);
  });

  it("delete-receipt ownership pin: another org's receipt is unreachable including its expense join", async () => {
    const r = await scopedDb(B.orgId).receipt.findUnique({
      where: { id: A.receiptId },
      include: { expense: { select: { userId: true, status: true } } },
    });
    expect(r).toBeNull();
  });
});
