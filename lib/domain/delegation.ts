// Delegation rules (PLAN 6.5) — pure.
export function isValidDelegationPair(
  delegateId: string,
  principalId: string
): boolean {
  return delegateId !== principalId; // no self-delegation
}
