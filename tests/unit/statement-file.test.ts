// Statement upload validation (D4.2).
//
// Small, but it is the ONE function the dropzone and the import route both
// call. Its value is that there is only one of it — so these assertions cover
// both sides at once, and a rule relaxed on the client cannot silently stay
// strict on the server (or the reverse, which is worse: a file the UI
// accepted, spun on, and then had rejected with different words).
import { describe, expect, it } from "vitest";

import {
  STATEMENT_ACCEPT,
  STATEMENT_MAX_BYTES,
  validateStatementFile,
} from "@/lib/schemas/statement-file";

const ok = { name: "hdfc-august.csv", size: 40_000 };

describe("validateStatementFile", () => {
  it("accepts the formats banks actually export", () => {
    for (const name of ["s.csv", "s.CSV", "s.xlsx", "s.xls", "Statement Aug 2026.csv"]) {
      expect(validateStatementFile({ name, size: 1000 }), name).toBeNull();
    }
  });

  it("refuses a PDF by naming what it wants, not what it got", () => {
    // The reader's next action is to find a different file, not to learn why
    // a PDF is unparseable — so the message lists the formats.
    const problem = validateStatementFile({ name: "statement.pdf", size: 1000 });
    expect(problem).toContain(".csv");
    expect(problem).toContain(".xlsx");
  });

  it("refuses an empty file", () => {
    expect(validateStatementFile({ ...ok, size: 0 })).toBe("That file is empty.");
  });

  it("refuses an oversized file and says what to do about it", () => {
    const problem = validateStatementFile({ ...ok, size: STATEMENT_MAX_BYTES + 1 });
    expect(problem).toContain("2 MB");
    // Actionable, not just a limit: a statement too big is nearly always too
    // long a period, and re-exporting is the fix.
    expect(problem).toContain("shorter period");
  });

  it("accepts a file exactly at the limit", () => {
    // Off-by-one at a boundary the reader cannot see is a bad way to fail.
    expect(validateStatementFile({ ...ok, size: STATEMENT_MAX_BYTES })).toBeNull();
  });

  it("offers every accepted extension in the file picker", () => {
    // If the accept-list and the validator disagree, the picker either hides
    // valid files or offers files that will be rejected on selection.
    for (const ext of [".csv", ".xlsx", ".xls"]) {
      expect(STATEMENT_ACCEPT).toContain(ext);
      expect(validateStatementFile({ name: `s${ext}`, size: 10 })).toBeNull();
    }
  });
});
