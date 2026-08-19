"use client";

// Ledger (D4.1) — DESIGN-PRD §7.5.
//
// The states worth reviewing here are the ones a demo dataset never
// produces: a negative balance, a row whose particulars wrap, an empty
// period, and the segmented control mid-slide. The print layout can only be
// reviewed in a print preview, so the notes below say what it does rather
// than pretending the gallery shows it.
import * as React from "react";

import { LedgerTable } from "@/components/ledger/ledger-table";
import { ExportMenu } from "@/components/ledger/export-menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { LedgerLine, LedgerTotals } from "@/lib/domain/ledger";
import { Block, Group, Panel, Row } from "./shared";

const CURRENCY = "INR";
const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** A statement that ends OWING the organisation — the danger-token case. */
const LINES: LedgerLine[] = [
  {
    id: "1",
    date: D("2026-06-02"),
    type: "advance_disbursed",
    description: "Advance: Q3 field tour",
    reference: "N226060298765432",
    credit: 0,
    debit: 5_000_00,
    balance: -5_000_00,
  },
  {
    id: "2",
    date: D("2026-06-28"),
    type: "report_approved",
    description: "June site visits — Coimbatore, Salem and Erode",
    reference: "",
    credit: 3_820_00,
    debit: 0,
    balance: -1_180_00,
  },
  {
    id: "3",
    date: D("2026-07-04"),
    type: "advance_settled",
    description: "Advance settled: Q3 field tour",
    reference: "",
    credit: 1_180_00,
    debit: 0,
    balance: 0,
  },
  {
    id: "4",
    date: D("2026-07-19"),
    type: "report_approved",
    description: "July travel",
    reference: "",
    credit: 12_456_00,
    debit: 0,
    balance: 12_456_00,
  },
  {
    id: "5",
    date: D("2026-08-15"),
    type: "payment",
    description: "July travel",
    reference: "bank transfer · N226081512345678 · batch 0a91c2f4",
    credit: 0,
    debit: 8_000_00,
    balance: 4_456_00,
  },
];

const TOTALS: LedgerTotals = {
  requested: 18_100_00,
  approved: 16_276_00,
  paid: 8_000_00,
  outstanding: 8_276_00,
  netBalance: 4_456_00,
};

const OWING_TOTALS: LedgerTotals = {
  requested: 5_000_00,
  approved: 0,
  paid: 0,
  outstanding: 0,
  netBalance: -5_000_00,
};

export function LedgerSection() {
  const [entity, setEntity] = React.useState<"user" | "project" | "department">("user");

  return (
    <Group
      id="ledger"
      eyebrow="§7.5 · PLAN 7.1"
      title="Ledger"
      description="A Tally-style party statement: dense but airy, read top to bottom, with a running balance every row depends on the one above for."
    >
      <Block
        title="Entity switcher"
        description="A segmented control, not tabs — these are peers, not destinations, and the view they switch is rendered on the server. The indicator is a shared layoutId, so it slides between options instead of blinking out and back."
      >
        <Panel>
          <Row label="Entity">
            <SegmentedControl
              label="Ledger entity"
              value={entity}
              onChange={setEntity}
              segments={[
                { value: "user", label: "User" },
                { value: "project", label: "Project" },
                { value: "department", label: "Department" },
              ]}
            />
          </Row>
          <p className="text-meta text-text-tertiary">
            Switching kind clears the entity id: a project id is not a user id,
            and carrying it across would resolve to nothing and render an empty
            ledger that looks like a data fault. Below finance_admin the
            control is not rendered at all — and, more to the point,{" "}
            <code>resolveLedgerEntity</code> forces those readers back to their
            own user ledger server-side, so a hand-typed{" "}
            <code>?entity=department</code> changes nothing.
          </p>
        </Panel>
      </Block>

      <Block
        title="The table"
        description="Sticky header AND sticky totals. The footer is the half that earns it: the four figures a reader came for stay visible while they scroll the lines that produced them."
      >
        <Panel>
          <LedgerTable lines={LINES} totals={TOTALS} currency={CURRENCY} />
          <ul className="text-meta text-text-secondary grid gap-2">
            <li>
              <strong className="text-text-primary">Balance is semibold, tabular, danger when negative.</strong>{" "}
              A negative balance means the EMPLOYEE owes the organisation —
              usually an unsettled advance. Not an error, but not neutral
              either, so it takes the colour and keeps the ordinary minus sign
              rather than inventing a parenthesised accounting notation.
            </li>
            <li>
              <strong className="text-text-primary">Alternating rows at 40% of --bg-subtle.</strong>{" "}
              Enough to carry the eye across five columns; well short of zebra
              striping, which turns a dense table into a barcode. Opaque via{" "}
              <code>color-mix</code>, not an opacity utility — a translucent
              row would let the sticky header show through it.
            </li>
            <li>
              <strong className="text-text-primary">Dates are absolute, never relative.</strong>{" "}
              This is a column somebody compares against a bank statement, and
              references render tabular for the same reason.
            </li>
            <li>
              <strong className="text-text-primary">Not components/data-table.</strong> The
              second sanctioned exception. A ledger is a statement, not a list:
              its rows are meaningless out of order, because each carries the
              balance the row above produced. Sorting it by amount would
              destroy the only column that matters.
            </li>
          </ul>
        </Panel>
      </Block>

      <Block
        title="Ending in the red, and ending empty"
        description="An advance taken and not yet settled leaves the reader owing. A filtered period with no activity is ordinary, not an error."
      >
        <Panel>
          <LedgerTable
            lines={[LINES[0]]}
            totals={OWING_TOTALS}
            currency={CURRENCY}
          />
        </Panel>
        <Panel>
          <LedgerTable lines={[]} totals={OWING_TOTALS} currency={CURRENCY} />
        </Panel>
      </Block>

      <Block
        title="Export menu"
        description="CSV · Tally XML · Print. The two exports are plain download links straight at the route, so they work even if this component never hydrates."
      >
        <Panel>
          <Row label="Open it">
            <ExportMenu
              csvHref="/api/exports/ledger?format=csv&entity=user&id=demo"
              tallyHref="/api/exports/ledger?format=tally&entity=user&id=demo"
            />
          </Row>
          <p className="text-meta text-text-tertiary">
            Print is a real layout, not the screen with its colours knocked
            out: white ground, black text, no sidebar or top bar, and —
            the part browsers get wrong by default —{" "}
            <code>display: table-header-group</code> so the column header
            REPEATS on every page, with the totals in a footer group on the
            last. Rows carry <code>break-inside: avoid</code>, because a row
            split across a page break loses its balance figure. Review it in a
            print preview; a gallery cannot show it.
          </p>
        </Panel>
      </Block>
    </Group>
  );
}
