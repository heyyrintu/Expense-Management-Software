// Isolation for 8.1. The interesting case: the SAME personal number is
// linked in two orgs. Routing must key on the BUSINESS number
// (phone_number_id), never on the sender, or a message could land in the
// wrong tenant.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { configFromAccount } from "@/lib/whatsapp/config";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

const SHARED_NUMBER = "+919876500001";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("wa-a");
  B = await provisionOrg("wa-b");

  await owner.whatsAppAccount.create({
    data: {
      orgId: A.orgId,
      enabled: true,
      phoneNumberId: `PN-A-${A.orgId.slice(0, 8)}`,
      businessPhone: "+911111100001",
    },
  });
  await owner.whatsAppAccount.create({
    data: {
      orgId: B.orgId,
      enabled: true,
      phoneNumberId: `PN-B-${B.orgId.slice(0, 8)}`,
      businessPhone: "+911111100002",
    },
  });

  // One human, two employers — the same number linked in both orgs.
  await owner.whatsAppLink.create({
    data: {
      orgId: A.orgId,
      userId: A.users.employee,
      phoneE164: SHARED_NUMBER,
      verifiedAt: new Date(),
    },
  });
  await owner.whatsAppLink.create({
    data: {
      orgId: B.orgId,
      userId: B.users.employee,
      phoneE164: SHARED_NUMBER,
      verifiedAt: new Date(),
    },
  });
});

afterAll(async () => {
  const orgs = [A.orgId, B.orgId];
  await owner.whatsAppInbound.deleteMany({ where: { orgId: { in: orgs } } });
  await owner.whatsAppLink.deleteMany({ where: { orgId: { in: orgs } } });
  await owner.whatsAppAccount.deleteMany({ where: { orgId: { in: orgs } } });
  await teardownOrgs(orgs);
  await owner.$disconnect();
});

describe("business-number routing", () => {
  it("maps each business number to exactly one org", async () => {
    const accountA = await owner.whatsAppAccount.findUniqueOrThrow({
      where: { phoneNumberId: `PN-A-${A.orgId.slice(0, 8)}` },
    });
    const accountB = await owner.whatsAppAccount.findUniqueOrThrow({
      where: { phoneNumberId: `PN-B-${B.orgId.slice(0, 8)}` },
    });
    expect(accountA.orgId).toBe(A.orgId);
    expect(accountB.orgId).toBe(B.orgId);
  });

  it("resolves the shared number to the right user WITHIN each org", async () => {
    const inA = await scopedDb(A.orgId).whatsAppLink.findFirst({
      where: { phoneE164: SHARED_NUMBER, verifiedAt: { not: null } },
    });
    const inB = await scopedDb(B.orgId).whatsAppLink.findFirst({
      where: { phoneE164: SHARED_NUMBER, verifiedAt: { not: null } },
    });
    expect(inA?.userId).toBe(A.users.employee);
    expect(inB?.userId).toBe(B.users.employee);
    expect(inA?.userId).not.toBe(inB?.userId);
  });

  it("a business number cannot be claimed by two orgs", async () => {
    await expect(
      owner.whatsAppAccount.create({
        data: {
          orgId: B.orgId,
          enabled: true,
          phoneNumberId: `PN-A-${A.orgId.slice(0, 8)}`, // A's number
          businessPhone: "+911111100003",
        },
      })
    ).rejects.toThrow();
  });

  it("a number is claimed at most once inside an org", async () => {
    await expect(
      scopedDb(A.orgId).whatsAppLink.create({
        data: {
          orgId: A.orgId,
          userId: A.users.approver,
          phoneE164: SHARED_NUMBER,
        },
      })
    ).rejects.toThrow();
  });
});

describe("cross-org WhatsApp data", () => {
  it("B cannot see A's account, links, or inbound messages", async () => {
    const db = scopedDb(B.orgId);
    const account = await db.whatsAppAccount.findUnique({ where: { orgId: A.orgId } });
    expect(account).toBeNull();
    const links = await db.whatsAppLink.findMany({ where: { userId: A.users.employee } });
    expect(links).toHaveLength(0);
  });

  it("inbound messages stay in the org that received them", async () => {
    await scopedDb(A.orgId).whatsAppInbound.create({
      data: {
        orgId: A.orgId,
        waMessageId: `wamid.iso.${A.orgId.slice(0, 8)}`,
        fromPhone: SHARED_NUMBER,
        phoneNumberId: `PN-A-${A.orgId.slice(0, 8)}`,
        userId: A.users.employee,
        messageType: "text",
        text: "lunch 450",
        receivedAt: new Date(),
      },
    });
    expect(await scopedDb(A.orgId).whatsAppInbound.count({})).toBe(1);
    expect(await scopedDb(B.orgId).whatsAppInbound.count({})).toBe(0);
    expect(
      await scopedDb(B.orgId).whatsAppInbound.findMany({ where: { fromPhone: SHARED_NUMBER } })
    ).toHaveLength(0);
  });

  it("B cannot attach an inbound message to one of A's users", async () => {
    await expect(
      scopedDb(B.orgId).whatsAppInbound.create({
        data: {
          orgId: B.orgId,
          waMessageId: `wamid.steal.${B.orgId.slice(0, 8)}`,
          fromPhone: SHARED_NUMBER,
          phoneNumberId: `PN-B-${B.orgId.slice(0, 8)}`,
          userId: A.users.employee, // A's user — invisible under B's RLS
          messageType: "text",
          text: "nope",
          receivedAt: new Date(),
        },
      })
    ).rejects.toThrow();
  });

  it("B cannot flip A's channel on or off", async () => {
    const res = await scopedDb(B.orgId).whatsAppAccount.updateMany({
      where: { orgId: A.orgId },
      data: { enabled: false },
    });
    expect(res.count).toBe(0);
    const stillOn = await owner.whatsAppAccount.findUniqueOrThrow({
      where: { orgId: A.orgId },
    });
    expect(stillOn.enabled).toBe(true);
  });

  it("the same wa_message_id cannot be stored twice", async () => {
    const id = `wamid.dupe.${A.orgId.slice(0, 8)}`;
    const row = {
      orgId: A.orgId,
      waMessageId: id,
      fromPhone: SHARED_NUMBER,
      phoneNumberId: `PN-A-${A.orgId.slice(0, 8)}`,
      messageType: "text",
      text: "once",
      receivedAt: new Date(),
    };
    await scopedDb(A.orgId).whatsAppInbound.create({ data: row });
    await expect(
      scopedDb(A.orgId).whatsAppInbound.create({ data: row })
    ).rejects.toThrow();
  });
});

describe("channel gating", () => {
  it("a disabled org resolves to no config even with full env", async () => {
    const env = {
      WA_PHONE_NUMBER_ID: "env-id",
      WA_TOKEN: "t",
      WA_VERIFY_TOKEN: "v",
      WA_APP_SECRET: "s",
    } as unknown as NodeJS.ProcessEnv;
    const account = await owner.whatsAppAccount.findUniqueOrThrow({
      where: { orgId: A.orgId },
    });
    expect(
      configFromAccount({ ...account, enabled: false }, env)
    ).toBeNull();
    expect(configFromAccount({ ...account, enabled: true }, env)).not.toBeNull();
  });
});
