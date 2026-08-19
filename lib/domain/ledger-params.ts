// Ledger URL contract (D4.1).
//
// The screen and the export route must agree on three things or the DoD
// ("on-screen totals match the CSV export") is luck: which entity, which
// date window, and where the window's boundaries fall. Before D4.1 they
// agreed by both containing the same four lines of `new Date(...)`, which is
// the arrangement that holds until someone edits one of them.
//
// So the parsing lives here and both import it. The screen additionally uses
// `ledgerExportHref` to build its own export links, which means the links
// cannot point at a different window than the table above them.
import type { LedgerWindow } from "@/lib/analytics/ledger";

type RawParams = Record<string, string | string[] | undefined>;

function single(raw: RawParams, key: string): string | undefined {
  const v = raw[key];
  if (Array.isArray(v)) return v[0] || undefined;
  return typeof v === "string" && v !== "" ? v : undefined;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shape AND validity. The regex alone accepts "2026-13-45", which `new Date`
 * turns into an Invalid Date — and an Invalid Date compares false against
 * every other date, so it would not throw, it would quietly return an empty
 * ledger. A blank statement reads like "you have no activity", which is the
 * worst possible way for a typo to fail.
 */
function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  // Rejects roll-over too: "2026-02-31" parses, as 3 March.
  return parsed.toISOString().slice(0, 10) === value;
}

export type ParsedLedgerWindow = LedgerWindow & {
  /** The strings as they appeared, for round-tripping into export hrefs. */
  raw: { from?: string; to?: string };
};

/**
 * Parse `?from=&to=` into a window.
 *
 * ── THE BOUNDARIES ARE THE POINT ──────────────────────────────────────────
 * `from` is midnight UTC and `to` is 23:59:59.999 UTC of the day named.
 * Ledger events carry TIMESTAMPS (a payment at 14:05, an approval at 09:30),
 * unlike expense dates which are stored as dates. An exclusive `to` at
 * midnight would silently drop every event on the last day of the range — so
 * a quarter-end ledger would omit quarter-end, which is the one day it is
 * most often run for.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function parseLedgerWindow(raw: RawParams): ParsedLedgerWindow {
  let from = single(raw, "from");
  let to = single(raw, "to");
  if (from && !isRealDate(from)) from = undefined;
  if (to && !isRealDate(to)) to = undefined;
  // A reversed range is a typo, not an instruction to return nothing.
  if (from && to && from > to) [from, to] = [to, from];

  return {
    from: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
    to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
    raw: { from, to },
  };
}

/** The export URL for an entity, window and format. */
export function ledgerExportHref(args: {
  entity: string;
  id: string;
  from?: string;
  to?: string;
  format: "csv" | "tally";
}): string {
  const params = new URLSearchParams();
  params.set("format", args.format);
  params.set("entity", args.entity);
  params.set("id", args.id);
  if (args.from) params.set("from", args.from);
  if (args.to) params.set("to", args.to);
  return `/api/exports/ledger?${params.toString()}`;
}
