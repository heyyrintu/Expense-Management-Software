// Custom approval-chain resolution (PLAN 5.4) — pure.
// The most specific matching rule wins: department+amount (3) >
// department (2) > amount (1). Ties break toward the higher aboveAmount,
// then the earliest-created rule.
export type ChainRule = {
  id: string;
  departmentId: string | null;
  aboveAmount: number | null;
  approverId: string;
  secondApproverId: string | null;
  createdAt: Date;
};

export type ChainLevel2 =
  | { type: "user"; userId: string }
  | { type: "finance" }
  | null;

export type ResolvedChain = {
  /** who must decide level 1; null = nobody can (unroutable) */
  level1ApproverId: string | null;
  level2: ChainLevel2;
  ruleId: string | null;
};

function specificity(rule: ChainRule): number {
  return (rule.departmentId ? 2 : 0) + (rule.aboveAmount !== null ? 1 : 0);
}

export function resolveChain(input: {
  ownerAssignedApproverId: string | null;
  ownerDepartmentId: string | null;
  total: number;
  orgThreshold: number | null;
  rules: ChainRule[];
}): ResolvedChain {
  const matching = input.rules.filter(
    (r) =>
      (r.departmentId === null || r.departmentId === input.ownerDepartmentId) &&
      (r.aboveAmount === null || input.total > r.aboveAmount)
  );

  matching.sort((a, b) => {
    const spec = specificity(b) - specificity(a);
    if (spec !== 0) return spec;
    const amt = (b.aboveAmount ?? -1) - (a.aboveAmount ?? -1);
    if (amt !== 0) return amt;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  const rule = matching[0] ?? null;

  const thresholdLevel2: ChainLevel2 =
    input.orgThreshold !== null && input.total > input.orgThreshold
      ? { type: "finance" }
      : null;

  if (!rule) {
    return {
      level1ApproverId: input.ownerAssignedApproverId,
      level2: thresholdLevel2,
      ruleId: null,
    };
  }
  return {
    level1ApproverId: rule.approverId,
    level2: rule.secondApproverId
      ? { type: "user", userId: rule.secondApproverId }
      : thresholdLevel2,
    ruleId: rule.id,
  };
}
