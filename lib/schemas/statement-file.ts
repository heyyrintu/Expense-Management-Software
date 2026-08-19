// Bank statement upload validation (D4.2).
//
// ── ONE FUNCTION, BOTH SIDES ──────────────────────────────────────────────
// The same rule D2.2 established for receipts: the dropzone and the route
// call this, so the client and the server can never disagree about a file.
// Two copies of "2 MB, CSV or XLSX" drift the moment one of them is relaxed,
// and the failure mode is the worst kind — a file the UI accepted, spun on,
// and then rejected from the server with a different message.
// ──────────────────────────────────────────────────────────────────────────

export const STATEMENT_MAX_BYTES = 2 * 1024 * 1024;
export const STATEMENT_MAX_ROWS = 5000;

/** What the file input offers, and what the server accepts. */
export const STATEMENT_ACCEPT = ".csv,.xlsx,.xls,text/csv";

const EXTENSIONS = [".csv", ".xlsx", ".xls"];

export type StatementFileMeta = { name: string; size: number };

/** Null when the file is fine; otherwise the sentence to show the reader. */
export function validateStatementFile(file: StatementFileMeta): string | null {
  const name = file.name.toLowerCase();
  if (!EXTENSIONS.some((ext) => name.endsWith(ext))) {
    // Names the formats rather than the rejected one: the reader's next
    // action is to find a different file, not to learn what .pdf means.
    return "Bank statements come as CSV or Excel (.csv, .xlsx, .xls).";
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  if (file.size > STATEMENT_MAX_BYTES) {
    return `That file is over ${Math.round(STATEMENT_MAX_BYTES / (1024 * 1024))} MB. Export a shorter period and try again.`;
  }
  return null;
}
