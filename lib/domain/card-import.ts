// Card statement CSV parsing + auto-matching (PLAN 5.2) — pure,
// unit-tested in tests/unit/card-import.test.ts.

export const CARD_IMPORT_MAX_ROWS = 2000;
export const MATCH_WINDOW_DAYS = 2;

export type ParsedTransaction = {
  date: Date; // UTC midnight
  amount: number; // minor units, positive
  merchant: string;
};

export type ParseResult = {
  rows: ParsedTransaction[];
  skipped: Array<{ line: number; reason: string }>;
};

/** Minimal RFC-4180-ish line splitter with quoted-field support. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function parseDateCell(s: string): Date | null {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s); // dd/mm/yyyy
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[1] ? d : null;
  }
  return null;
}

function parseAmountCell(s: string): number | null {
  const cleaned = s.replace(/[₹$€£,\s]/g, "");
  const m = /^(-?)(\d{1,13})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const minor =
    Number.parseInt(m[2], 10) * 100 +
    (m[3] ? Number.parseInt(m[3].padEnd(2, "0"), 10) : 0);
  if (!Number.isSafeInteger(minor)) return null;
  return m[1] === "-" ? -minor : minor;
}

/**
 * Parse a statement CSV. Requires a header row containing date, amount, and
 * merchant/description columns (case-insensitive; extra columns ignored).
 * Credits/zero rows and unparseable lines are skipped with reasons.
 */
export function parseCardCsv(text: string): ParseResult | { error: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { error: "The file has no data rows." };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = header.findIndex((h) => h.includes("date"));
  const amountIdx = header.findIndex((h) => h.includes("amount") || h.includes("debit"));
  const merchantIdx = header.findIndex(
    (h) => h.includes("merchant") || h.includes("description") || h.includes("narration")
  );
  if (dateIdx < 0 || amountIdx < 0 || merchantIdx < 0) {
    return {
      error:
        "Couldn't find the required columns — the header needs date, amount (or debit), and merchant (or description).",
    };
  }
  if (lines.length - 1 > CARD_IMPORT_MAX_ROWS) {
    return { error: `Too many rows — the limit is ${CARD_IMPORT_MAX_ROWS} per import.` };
  }

  const rows: ParsedTransaction[] = [];
  const skipped: ParseResult["skipped"] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const date = parseDateCell(cells[dateIdx] ?? "");
    const amount = parseAmountCell(cells[amountIdx] ?? "");
    const merchant = (cells[merchantIdx] ?? "").trim();
    if (!date) {
      skipped.push({ line: i + 1, reason: "unreadable date" });
    } else if (amount === null) {
      skipped.push({ line: i + 1, reason: "unreadable amount" });
    } else if (amount <= 0) {
      skipped.push({ line: i + 1, reason: "credit or zero amount" });
    } else if (merchant === "") {
      skipped.push({ line: i + 1, reason: "missing merchant" });
    } else {
      rows.push({ date, amount, merchant });
    }
  }
  return { rows, skipped };
}

// ---------- matching ----------

export type MatchCandidate = {
  id: string;
  amount: number;
  date: Date;
  merchant: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function dayDiff(a: Date, b: Date): number {
  return Math.abs(Math.round((a.getTime() - b.getTime()) / DAY_MS));
}

/**
 * Greedy 1:1 auto-match: exact amount + date within ±MATCH_WINDOW_DAYS.
 * Preference order per transaction: closer date first, then matching
 * merchant (case-insensitive substring either way). Each expense is used
 * at most once.
 */
export function autoMatch(
  transactions: Array<{ index: number } & ParsedTransaction>,
  candidates: MatchCandidate[]
): Map<number, string> {
  const used = new Set<string>();
  const result = new Map<number, string>();

  for (const txn of transactions) {
    let best: { id: string; score: number } | null = null;
    for (const c of candidates) {
      if (used.has(c.id) || c.amount !== txn.amount) continue;
      const diff = dayDiff(c.date, txn.date);
      if (diff > MATCH_WINDOW_DAYS) continue;
      const tm = txn.merchant.trim().toLowerCase();
      const cm = c.merchant.trim().toLowerCase();
      const merchantBonus = tm.includes(cm) || cm.includes(tm) ? 1 : 0;
      // lower is better: date distance dominates, merchant match breaks ties
      const score = diff * 2 - merchantBonus;
      if (best === null || score < best.score) {
        best = { id: c.id, score };
      }
    }
    if (best) {
      used.add(best.id);
      result.set(txn.index, best.id);
    }
  }
  return result;
}
