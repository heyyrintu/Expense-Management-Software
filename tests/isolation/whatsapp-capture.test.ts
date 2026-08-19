// Isolation for 8.2: a receipt sent from a number that exists in two orgs
// must produce a draft, a receipt row and storage keys in the SENDER'S org
// only — and the button callbacks must refuse to act across the boundary.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { handleCaptureCallback } from "@/lib/whatsapp/callbacks";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

const SHARED_NUMBER = "+919876500002";

let A: OrgFixture;
let B: OrgFixture;
let aInboundId: string;
let aExpenseId: string;

beforeAll(async () => {
  A = await provisionOrg("wacap-a");
  B = await provisionOrg("wacap-b");

  for (const [org, userKey] of [
    [A, A.users.employee],
    [B, B.users.employee],
  ] as const) {
    await owner.whatsAppLink.create({
      data: {
        orgId: org.orgId,
        userId: userKey,
        phoneE164: SHARED_NUMBER,
        verifiedAt: new Date(),
      },
    });
  }

  // A draft captured from WhatsApp in org A, with its receipt.
  const expense = await owner.expense.create({
    data: {
      orgId: A.orgId,
      userId: A.users.employee,
      amount: 45000,
      baseAmount: 45000,
      fxRate: "1",
      currency: "INR",
      date: new Date("2026-08-12"),
      merchant: "Blue Tokai",
      categoryId: A.categoryId,
      purpose: "coffee 450",
      status: "draft",
      flags: [],
    },
  });
  aExpenseId = expense.id;
  await owner.receipt.create({
    data: {
      orgId: A.orgId,
      expenseId: expense.id,
      storageKey: `${A.orgId}/receipts/${expense.id}/wa.jpg`,
      fileName: "wa.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
    },
  });
  const inbound = await owner.whatsAppInbound.create({
    data: {
      orgId: A.orgId,
      waMessageId: `wamid.cap.${A.orgId.slice(0, 8)}`,
      fromPhone: SHARED_NUMBER,
      phoneNumberId: `PN-A-${A.orgId.slice(0, 8)}`,
      userId: A.users.employee,
      messageType: "image",
      mediaId: "media-1",
      expenseId: expense.id,
      status: "processed",
      receivedAt: new Date(),
    },
  });
  aInboundId = inbound.id;
});

afterAll(async () => {
  const orgs = [A.orgId, B.orgId];
  await owner.whatsAppInbound.deleteMany({ where: { orgId: { in: orgs } } });
  await owner.whatsAppLink.deleteMany({ where: { orgId: { in: orgs } } });
  await owner.receipt.deleteMany({ where: { orgId: { in: orgs } } });
  await teardownOrgs(orgs);
  await owner.$disconnect();
});

describe("captured drafts stay in the sender's org", () => {
  it("B sees no expense, receipt or inbound row from A's capture", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.expense.findUnique({ where: { id: aExpenseId } })).toBeNull();
    expect(await db.whatsAppInbound.findUnique({ where: { id: aInboundId } })).toBeNull();
    expect(
      await db.receipt.findMany({ where: { expenseId: aExpenseId } })
    ).toHaveLength(0);
  });

  it("receipt storage keys are written under the owning org's prefix", async () => {
    const receipt = await owner.receipt.findFirstOrThrow({
      where: { expenseId: aExpenseId },
    });
    expect(receipt.storageKey.startsWith(`${A.orgId}/`)).toBe(true);
    expect(receipt.storageKey.startsWith(`${B.orgId}/`)).toBe(false);
  });

  it("B cannot link its own inbound row to A's expense", async () => {
    await expect(
      scopedDb(B.orgId).whatsAppInbound.create({
        data: {
          orgId: B.orgId,
          waMessageId: `wamid.cross.${B.orgId.slice(0, 8)}`,
          fromPhone: SHARED_NUMBER,
          phoneNumberId: `PN-B-${B.orgId.slice(0, 8)}`,
          userId: B.users.employee,
          messageType: "image",
          expenseId: aExpenseId, // A's draft — invisible under B's RLS
          status: "pending",
          receivedAt: new Date(),
        },
      })
    ).rejects.toThrow();
  });
});

describe("capture callbacks", () => {
  it("refuse to act from another org even with the right inbound id", async () => {
    const res = await handleCaptureCallback(
      scopedDb(B.orgId),
      B.orgId,
      B.users.employee,
      "discard",
      aInboundId
    );
    expect(res.reply).toMatch(/can't find/i);
    // A's draft is untouched.
    expect(await owner.expense.findUnique({ where: { id: aExpenseId } })).not.toBeNull();
  });

  it("refuse to act for a different user inside the same org", async () => {
    const res = await handleCaptureCallback(
      scopedDb(A.orgId),
      A.orgId,
      A.users.approver, // not the sender
      "discard",
      aInboundId
    );
    expect(res.reply).toMatch(/can't find/i);
    expect(await owner.expense.findUnique({ where: { id: aExpenseId } })).not.toBeNull();
  });

  it("confirm is safe to repeat", async () => {
    const db = scopedDb(A.orgId);
    const first = await handleCaptureCallback(
      db, A.orgId, A.users.employee, "confirm", aInboundId
    );
    const second = await handleCaptureCallback(
      db, A.orgId, A.users.employee, "confirm", aInboundId
    );
    expect(first.reply).toBe(second.reply);
    expect(await owner.expense.count({ where: { id: aExpenseId } })).toBe(1);
  });

  it("discard removes the draft and its receipt, and repeats harmlessly", async () => {
    const db = scopedDb(A.orgId);
    const first = await handleCaptureCallback(
      db, A.orgId, A.users.employee, "discard", aInboundId
    );
    expect(first.reply).toMatch(/deleted/i);
    expect(await owner.expense.findUnique({ where: { id: aExpenseId } })).toBeNull();
    expect(await owner.receipt.count({ where: { expenseId: aExpenseId } })).toBe(0);

    const second = await handleCaptureCallback(
      db, A.orgId, A.users.employee, "discard", aInboundId
    );
    expect(second.reply).toMatch(/already/i);
    const row = await owner.whatsAppInbound.findUniqueOrThrow({
      where: { id: aInboundId },
    });
    expect(row.expenseId).toBeNull();
    expect(row.status).toBe("ignored");
  });

  it("never deletes an expense that has left Draft", async () => {
    const db = scopedDb(A.orgId);
    const attached = await owner.expense.create({
      data: {
        orgId: A.orgId,
        userId: A.users.employee,
        amount: 1000,
        baseAmount: 1000,
        fxRate: "1",
        currency: "INR",
        date: new Date("2026-08-13"),
        merchant: "Cab",
        categoryId: A.categoryId,
        reportId: A.reportId,
        status: "submitted",
        flags: [],
      },
    });
    const inbound = await owner.whatsAppInbound.create({
      data: {
        orgId: A.orgId,
        waMessageId: `wamid.locked.${A.orgId.slice(0, 8)}`,
        fromPhone: SHARED_NUMBER,
        phoneNumberId: `PN-A-${A.orgId.slice(0, 8)}`,
        userId: A.users.employee,
        messageType: "text",
        expenseId: attached.id,
        status: "processed",
        receivedAt: new Date(),
      },
    });

    const res = await handleCaptureCallback(
      db, A.orgId, A.users.employee, "discard", inbound.id
    );
    expect(res.reply).toMatch(/already on a report/i);
    expect(await owner.expense.findUnique({ where: { id: attached.id } })).not.toBeNull();
  });
});
