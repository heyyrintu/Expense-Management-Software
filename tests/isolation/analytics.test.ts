// Isolation for 6.7: the shared analytics fetch is org-scoped, so every
// widget built on it is too.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchSpendRows } from "@/lib/analytics";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("ana-a");
  B = await provisionOrg("ana-b");
  await owner.expense.update({
    where: { id: A.expenseId },
    data: { status: "submitted", flags: [{ rule: "duplicate", message: "x" }] },
  });
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("analytics fetch scoping", () => {
  const window = {
    start: new Date("2020-01-01T00:00:00.000Z"),
    end: new Date("2030-01-01T00:00:00.000Z"),
  };

  it("A sees its flagged spend; B sees none of it", async () => {
    const aRows = await fetchSpendRows(scopedDb(A.orgId), window);
    expect(aRows.map((r) => r.id)).toContain(A.expenseId);

    const bRows = await fetchSpendRows(scopedDb(B.orgId), window);
    expect(bRows.map((r) => r.id)).not.toContain(A.expenseId);
    for (const r of bRows) expect(r.userId).not.toBe(A.users.employee);
  });
});
