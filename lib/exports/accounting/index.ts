// The adapter registry — one import site for the export layer.
//
// `xero` and `netsuite` are in the AccountingTarget enum and have NO adapter
// yet. That is deliberate and visible: `adapterFor` returns null rather than
// falling back to the generic CSV, because a file labelled "NetSuite export"
// that is actually a generic CSV is worse than an honest "not supported yet".
// The enum carries them so adding one is a new file plus a registry line, not
// a migration.
import { genericAdapter } from "./adapters/generic";
import { quickbooksAdapter } from "./adapters/quickbooks";
import { tallyAdapter } from "./adapters/tally";
import type { AccountingAdapter, AccountingTarget } from "./types";

const ADAPTERS: AccountingAdapter[] = [
  quickbooksAdapter,
  tallyAdapter,
  genericAdapter,
];

/** Every target that can actually produce a file today. */
export const AVAILABLE_ADAPTERS: readonly AccountingAdapter[] = ADAPTERS;

export function adapterFor(target: AccountingTarget): AccountingAdapter | null {
  return ADAPTERS.find((a) => a.target === target) ?? null;
}

/** Targets with no adapter yet — shown as unavailable rather than hidden, so
 *  the roadmap is legible from the product instead of from a backlog. */
export const UNIMPLEMENTED_TARGETS: readonly AccountingTarget[] = [
  "xero",
  "netsuite",
];

export * from "./types";
export {
  buildMappingIndex,
  emptyMappingIndex,
  findUnmapped,
  isExportable,
  requireCode,
} from "./mapping";
export { genericAdapter, quickbooksAdapter, tallyAdapter };
