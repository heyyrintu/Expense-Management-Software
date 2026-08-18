// Typed access to the Organization.settings JSON blob.
export type OrgSettings = {
  /** Reports above this total (minor units) need a second approval. */
  secondApprovalAbove?: number | null;
};

export function parseOrgSettings(settings: unknown): OrgSettings {
  if (typeof settings !== "object" || settings === null) return {};
  const s = settings as Record<string, unknown>;
  const raw = s.secondApprovalAbove;
  return {
    secondApprovalAbove:
      typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0
        ? raw
        : null,
  };
}

export function secondApprovalThreshold(settings: unknown): number | null {
  return parseOrgSettings(settings).secondApprovalAbove ?? null;
}
