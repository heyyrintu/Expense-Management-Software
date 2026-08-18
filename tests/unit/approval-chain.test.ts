import { describe, expect, it } from "vitest";
import { resolveChain, type ChainRule } from "@/lib/domain/approval-chain";

const rule = (over: Partial<ChainRule>): ChainRule => ({
  id: over.id ?? "r",
  departmentId: null,
  aboveAmount: null,
  approverId: "ruleAp",
  secondApproverId: null,
  createdAt: new Date("2026-01-01"),
  ...over,
});

const base = {
  ownerAssignedApproverId: "assigned" as string | null,
  ownerDepartmentId: "sales" as string | null,
  total: 50000,
  orgThreshold: null as number | null,
  rules: [] as ChainRule[],
};

describe("resolveChain — defaults", () => {
  it("no rules: assigned approver, threshold decides level 2", () => {
    expect(resolveChain(base)).toEqual({
      level1ApproverId: "assigned",
      level2: null,
      ruleId: null,
    });
    expect(resolveChain({ ...base, orgThreshold: 40000 }).level2).toEqual({ type: "finance" });
    expect(resolveChain({ ...base, orgThreshold: 50000 }).level2).toBeNull(); // not strictly above
  });
});

describe("resolveChain — matching", () => {
  it("department and amount conditions must both hold", () => {
    const r = rule({ id: "d", departmentId: "sales", aboveAmount: 40000 });
    expect(resolveChain({ ...base, rules: [r] }).ruleId).toBe("d");
    expect(resolveChain({ ...base, ownerDepartmentId: "eng", rules: [r] }).ruleId).toBeNull();
    expect(resolveChain({ ...base, total: 40000, rules: [r] }).ruleId).toBeNull();
  });

  it("specificity: dept+amount > dept > amount; higher amount breaks ties", () => {
    const rules = [
      rule({ id: "amt", aboveAmount: 10000 }),
      rule({ id: "dept", departmentId: "sales" }),
      rule({ id: "both", departmentId: "sales", aboveAmount: 10000 }),
    ];
    expect(resolveChain({ ...base, rules }).ruleId).toBe("both");
    expect(resolveChain({ ...base, ownerDepartmentId: "eng", rules }).ruleId).toBe("amt");
    const amounts = [
      rule({ id: "low", aboveAmount: 10000 }),
      rule({ id: "high", aboveAmount: 40000 }),
    ];
    expect(resolveChain({ ...base, rules: amounts }).ruleId).toBe("high");
  });

  it("a matching rule overrides level 1 and can pin level 2", () => {
    const r = rule({ id: "pin", approverId: "vp", secondApproverId: "cfo" });
    const out = resolveChain({ ...base, rules: [r] });
    expect(out.level1ApproverId).toBe("vp");
    expect(out.level2).toEqual({ type: "user", userId: "cfo" });
  });

  it("rule without second approver falls back to the org threshold", () => {
    const r = rule({ id: "solo", approverId: "vp" });
    expect(resolveChain({ ...base, orgThreshold: 40000, rules: [r] }).level2).toEqual({ type: "finance" });
    expect(resolveChain({ ...base, rules: [r] }).level2).toBeNull();
  });

  it("no assigned approver and no rule → unroutable (null level 1)", () => {
    expect(
      resolveChain({ ...base, ownerAssignedApproverId: null }).level1ApproverId
    ).toBeNull();
  });
});
