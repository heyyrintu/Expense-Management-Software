// Ledger URL contract (D4.1).
//
// Small surface, but it decides which events land inside a period — and the
// last day of a range is the one a quarter-end ledger is run for.
import { describe, expect, it } from "vitest";

import {
  ledgerExportHref,
  parseLedgerWindow,
} from "@/lib/domain/ledger-params";

describe("parseLedgerWindow", () => {
  it("is open at both ends when nothing is given", () => {
    const w = parseLedgerWindow({});
    expect(w.from).toBeUndefined();
    expect(w.to).toBeUndefined();
    expect(w.raw).toEqual({});
  });

  it("takes `from` at midnight UTC", () => {
    expect(parseLedgerWindow({ from: "2026-07-01" }).from?.toISOString()).toBe(
      "2026-07-01T00:00:00.000Z"
    );
  });

  it("takes `to` at the END of the day, not the start", () => {
    // The bug this prevents: ledger events carry timestamps, so an exclusive
    // midnight `to` drops every event on the final day — and a quarter-end
    // ledger is run precisely to see quarter-end.
    expect(parseLedgerWindow({ to: "2026-09-30" }).to?.toISOString()).toBe(
      "2026-09-30T23:59:59.999Z"
    );
  });

  it("includes an event timestamped late on the last day", () => {
    const w = parseLedgerWindow({ from: "2026-07-01", to: "2026-07-31" });
    const lateEvent = new Date("2026-07-31T18:45:00.000Z");
    expect(lateEvent >= w.from!).toBe(true);
    expect(lateEvent <= w.to!).toBe(true);
  });

  it("treats a reversed range as a typo and swaps it", () => {
    const w = parseLedgerWindow({ from: "2026-09-30", to: "2026-07-01" });
    expect(w.raw).toEqual({ from: "2026-07-01", to: "2026-09-30" });
  });

  it("drops malformed dates rather than producing an Invalid Date", () => {
    // An Invalid Date compares false against everything, so an unparsed
    // string here would silently return an empty ledger.
    const w = parseLedgerWindow({ from: "last-tuesday", to: "2026-13-45" });
    expect(w.from).toBeUndefined();
    expect(w.to).toBeUndefined();
  });

  it("keeps the raw strings so an export link can round-trip them", () => {
    expect(parseLedgerWindow({ from: "2026-07-01", to: "2026-07-31" }).raw).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });
});

describe("ledgerExportHref", () => {
  it("carries entity, id, window and format", () => {
    const href = ledgerExportHref({
      entity: "project",
      id: "p1",
      from: "2026-07-01",
      to: "2026-07-31",
      format: "csv",
    });
    const url = new URL(href, "https://example.test");
    expect(url.pathname).toBe("/api/exports/ledger");
    expect(url.searchParams.get("entity")).toBe("project");
    expect(url.searchParams.get("id")).toBe("p1");
    expect(url.searchParams.get("from")).toBe("2026-07-01");
    expect(url.searchParams.get("to")).toBe("2026-07-31");
    expect(url.searchParams.get("format")).toBe("csv");
  });

  it("round-trips through parseLedgerWindow unchanged", () => {
    // The screen builds its own export links from the window it rendered. If
    // these two ever disagreed, the CSV would cover a different period than
    // the table above the button.
    const raw = { from: "2026-01-01", to: "2026-03-31" };
    const href = ledgerExportHref({ entity: "user", id: "u1", ...raw, format: "csv" });
    const url = new URL(href, "https://example.test");
    const reparsed = parseLedgerWindow(Object.fromEntries(url.searchParams));
    expect(reparsed.raw).toEqual(raw);
  });

  it("omits an absent window rather than writing empty parameters", () => {
    const href = ledgerExportHref({ entity: "user", id: "u1", format: "tally" });
    expect(href).not.toContain("from=");
    expect(href).not.toContain("to=");
  });
});
