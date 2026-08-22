// Tenant isolation for per-diem (PRD P1).
//
// CLAUDE.md is unconditional: a new table and a new query shape each get a
// case here. Two things to prove — org B cannot read or write org A's rates,
// and a per-diem EXPENSE is scoped exactly like every other expense.
//
// The third thing is specific to this feature: the rate a per-diem points at
// must belong to the same org. A cross-org rate reference would be both a
// leak (org B learning org A's allowance) and a correctness hole (an amount
// derived from a rate the org never set).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { scopedDb } from "@/lib/db/scoped";
import { selectEffectiveRate, type PerDiemRateRow } from "@/lib/domain/per-diem";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;
let rateA: string;
let rateB: string;

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

beforeAll(async () => {
  A = await provisionOrg("pd-a");
  B = await provisionOrg("pd-b");

  // Same NAME in both orgs, different amounts — so a leak shows up as a wrong
  // number, not just a wrong row count.
  const a = await owner.perDiemRate.create({
    data: {
      orgId: A.orgId,
      name: "Metro",
      location: "Mumbai",
      dailyAmount: 250_000,
      effectiveFrom: d("2026-01-01"),
    },
  });
  rateA = a.id;
  const b = await owner.perDiemRate.create({
    data: {
      orgId: B.orgId,
      name: "Metro",
      location: "Berlin",
      dailyAmount: 900_000,
      effectiveFrom: d("2026-01-01"),
    },
  });
  rateB = b.id;

  // A per-diem expense in A, priced at A's rate.
  await owner.expense.create({
    data: {
      orgId: A.orgId,
      userId: A.users.employee,
      type: "per_diem",
      amount: 750_000,
      baseAmount: 750_000,
      fxRate: "1",
      currency: "INR",
      date: d("2026-08-10"),
      merchant: "Per diem — Metro",
      categoryId: A.categoryId,
      purpose: "isolation fixture",
      perDiemRateId: rateA,
      perDiemStart: d("2026-08-10"),
      perDiemEnd: d("2026-08-12"),
      perDiemHalfDays: 6,
    },
  });
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("per-diem rates are org-scoped", () => {
  it("A sees only its own rate", async () => {
    const rows = (await scopedDb(A.orgId).perDiemRate.findMany({})) as PerDiemRateRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(rateA);
    expect(rows[0].dailyAmount).toBe(250_000);
  });

  it("B sees only its own rate, at its own amount", async () => {
    const rows = (await scopedDb(B.orgId).perDiemRate.findMany({})) as PerDiemRateRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(rateB);
    expect(rows[0].dailyAmount).toBe(900_000);
  });

  it("B cannot read A's rate by id", async () => {
    const row = await scopedDb(B.orgId).perDiemRate.findUnique({ where: { id: rateA } });
    expect(row).toBeNull();
  });

  it("B cannot update A's rate", async () => {
    const res = await scopedDb(B.orgId).perDiemRate.updateMany({
      where: { id: rateA },
      data: { dailyAmount: 1 },
    });
    expect(res.count).toBe(0);
    // And the row is untouched when checked with the owner client.
    const still = await owner.perDiemRate.findUnique({ where: { id: rateA } });
    expect(still?.dailyAmount).toBe(250_000);
  });

  it("B cannot delete A's rate", async () => {
    const res = await scopedDb(B.orgId).perDiemRate.deleteMany({ where: { id: rateA } });
    expect(res.count).toBe(0);
    expect(await owner.perDiemRate.findUnique({ where: { id: rateA } })).not.toBeNull();
  });

  it("a rate B creates lands in B, whatever orgId is asked for", async () => {
    // scopedDb injects org_id; a hand-passed one must not win.
    const created = await scopedDb(B.orgId).perDiemRate.create({
      data: {
        orgId: A.orgId,
        name: "Injected",
        dailyAmount: 111,
        effectiveFrom: d("2026-02-01"),
      } as never,
    });
    const check = await owner.perDiemRate.findUnique({ where: { id: created.id } });
    expect(check?.orgId).toBe(B.orgId);
  });
});

describe("the effective-rate lookup cannot cross orgs", () => {
  it("resolves A's Metro to A's amount, not B's", async () => {
    const rows = (await scopedDb(A.orgId).perDiemRate.findMany({})) as PerDiemRateRow[];
    const rate = selectEffectiveRate(rows, "Metro", d("2026-08-10"));
    expect(rate?.dailyAmount).toBe(250_000);
    expect(rate?.location).toBe("Mumbai");
  });

  it("resolves B's Metro to B's amount", async () => {
    const rows = (await scopedDb(B.orgId).perDiemRate.findMany({})) as PerDiemRateRow[];
    const rate = selectEffectiveRate(rows, "Metro", d("2026-08-10"));
    expect(rate?.dailyAmount).toBe(900_000);
    expect(rate?.location).toBe("Berlin");
  });
});

describe("per-diem expenses are scoped like every other expense", () => {
  it("B cannot see A's per-diem expense", async () => {
    const rows = (await scopedDb(B.orgId).expense.findMany({
      where: { type: "per_diem" },
    })) as Array<{ id: string }>;
    expect(rows).toHaveLength(0);
  });

  it("A sees it, with its per-diem fields intact", async () => {
    const rows = (await scopedDb(A.orgId).expense.findMany({
      where: { type: "per_diem" },
    })) as Array<{
      perDiemRateId: string | null;
      perDiemHalfDays: number | null;
      amount: number;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].perDiemRateId).toBe(rateA);
    expect(rows[0].perDiemHalfDays).toBe(6);
    expect(rows[0].amount).toBe(750_000);
  });

  it("a per-diem expense joins its rate without leaking across orgs", async () => {
    const row = (await scopedDb(A.orgId).expense.findFirst({
      where: { type: "per_diem" },
      include: { perDiemRate: true },
    })) as { perDiemRate: { dailyAmount: number; location: string | null } | null } | null;
    expect(row?.perDiemRate?.dailyAmount).toBe(250_000);
    expect(row?.perDiemRate?.location).toBe("Mumbai");
  });

  it("appears in an unfiltered expense list for A and never for B", async () => {
    const aAll = (await scopedDb(A.orgId).expense.findMany({})) as Array<{ type: string }>;
    const bAll = (await scopedDb(B.orgId).expense.findMany({})) as Array<{ type: string }>;
    expect(aAll.some((e) => e.type === "per_diem")).toBe(true);
    expect(bAll.some((e) => e.type === "per_diem")).toBe(false);
  });
});

describe("a rate that has priced an expense cannot be deleted", () => {
  it("the FK is RESTRICT, so the amount stays re-derivable", async () => {
    // Retiring is the supported action; deleting would leave an expense whose
    // amount nobody can explain.
    await expect(
      owner.perDiemRate.delete({ where: { id: rateA } })
    ).rejects.toThrow();
  });
});
