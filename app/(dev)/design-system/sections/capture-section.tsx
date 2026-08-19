"use client";

// Capture-flow components (D2.1) — DESIGN-PRD §7.1.
import * as React from "react";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { PolicyFlagChips } from "@/components/ui/policy-flag-chip";
import { SavedIndicator } from "@/components/ui/saved-indicator";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { normalizeAmountInput, parseToMinorUnits } from "@/lib/money";
import { Block, Group, Panel, Row } from "./shared";

const PASTE_CASES = [
  ["1,234.56", "grouping separators"],
  ["₹1234", "currency symbol"],
  ["Rs 1,234.5", "code, grouping, one decimal"],
  ["1,23,456.78", "en-IN lakhs"],
  [".5", "leading decimal point"],
  ["10.555", "too much precision — refused, not rounded"],
  ["-500", "negative — refused, sign never dropped"],
  ["abc", "not an amount"],
] as const;

const FLAGS = [
  { rule: "per_expense_limit", message: "Above the ₹5,000 per-expense limit for Meals" },
  { rule: "duplicate", message: "Same amount, date and merchant as EXP-2261" },
];

export function CaptureSection() {
  const [amount, setAmount] = React.useState("");
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [flagsOn, setFlagsOn] = React.useState(false);

  return (
    <Group
      id="capture"
      eyebrow="§7.1"
      title="Capture flow"
      description="The product's front door. §2.1 measures the whole design on submitting an expense in under 60 seconds on a phone, and these are the pieces that decide it."
    >
      <Block
        title="AmountInput"
        description="Display-size, right-aligned, tabular, currency at the same weight as the number. Grouped at rest, plain while you type — a cursor that jumps because a comma appeared mid-word is the classic broken money field."
      >
        <Panel>
          <div className="max-w-sm">
            <AmountInput
              value={amount}
              onValueChange={(text) => setAmount(text)}
              currencySymbol="₹"
              currencyCode="INR"
            />
          </div>
          <p className="text-meta text-text-tertiary tabular">
            form value: <code>{amount === "" ? "(empty)" : amount}</code> · minor
            units: <code>{String(parseToMinorUnits(amount))}</code>
          </p>
          <p className="text-meta text-text-tertiary">
            Focus it and the grouping disappears; blur and it comes back. The
            form only ever holds the plain decimal, which is exactly what the
            existing Zod rule already accepted — D2.1 changed no validation.
          </p>
        </Panel>

        <Panel title="What it accepts">
          <div className="border-line overflow-hidden rounded-lg border">
            <table className="w-full text-body">
              <thead className="bg-bg-subtle text-text-secondary text-label">
                <tr>
                  <th className="p-3 text-left font-medium">Pasted</th>
                  <th className="p-3 text-right font-medium">Minor units</th>
                  <th className="p-3 text-left font-medium">Why</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {PASTE_CASES.map(([raw, why]) => {
                  const parsed = normalizeAmountInput(raw);
                  return (
                    <tr key={raw}>
                      <td className="text-text-primary p-3 tabular">{raw}</td>
                      <td
                        className={`p-3 text-right tabular ${
                          parsed.minor === null ? "text-status-warning-text" : "text-text-secondary"
                        }`}
                      >
                        {parsed.minor === null ? "refused" : parsed.minor}
                      </td>
                      <td className="text-text-secondary p-3 text-meta">{why}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-meta text-text-tertiary">
            <strong className="text-text-primary">It never silently rounds.</strong>{" "}
            10.555 does not become ₹10.56 — the field keeps your text and says
            money has two decimal places. A paisa invented by a text field is a
            paisa nobody can trace, in an app whose job is that the numbers
            reconcile.
          </p>
        </Panel>
      </Block>

      <Block
        title="PolicyFlagChip"
        description="Warning token, rule text in a tooltip, 150ms fade in. It informs and does nothing else — no shake, no scroll, no focus steal, no disabled submit. Policy violations flag, never block."
      >
        <Panel>
          <Row label="Toggle — watch that nothing moves">
            <Button size="sm" variant="secondary" onClick={() => setFlagsOn((v) => !v)}>
              {flagsOn ? "Clear flags" : "Trigger flags"}
            </Button>
          </Row>
          <div className="grid gap-2">
            <span className="text-label text-text-secondary">Amount</span>
            <div className="border-line-strong bg-bg-surface rounded-md border px-4 py-3">
              <span className="amount text-display text-text-primary">₹6,400.00</span>
            </div>
            <PolicyFlagChips flags={flagsOn ? FLAGS : []} />
          </div>
          <p className="text-meta text-text-tertiary">
            Opacity only, no y-offset: a flag appearing under the field you are
            typing in must not move anything, or you lose your place mid-amount.
            Tab to a chip — the rule text is reachable by keyboard, which a
            <code> title</code> attribute never was.
          </p>
        </Panel>
      </Block>

      <Block
        title="Sticky bar and saved indicator"
        description="One filled button on the screen (§4.6). The bar pins to the bottom while there is form below it and clears the mobile tab bar, because a submit button hidden behind navigation is a form nobody can finish."
      >
        <Panel>
          <Row label="Saved indicator">
            <Button size="sm" variant="secondary" onClick={() => setSavedAt(Date.now())}>
              Simulate a save
            </Button>
            <SavedIndicator savedAt={savedAt} />
          </Row>
          <p className="text-meta text-text-tertiary">
            Fades after 2s. A permanent “Saved” badge stops meaning anything
            within a minute; one that leaves is the difference between feedback
            and decoration. It is driven by a save that actually completed,
            never by a hopeful timer.
          </p>
        </Panel>

        <div className="border-line overflow-hidden rounded-lg border">
          <div className="p-4">
            <p className="text-meta text-text-tertiary">
              Form content would scroll above the bar.
            </p>
          </div>
          <StickyActionBar status={<SavedIndicator savedAt={savedAt} />}>
            <Button variant="ghost">Save draft</Button>
            <Button>Add to report</Button>
          </StickyActionBar>
        </div>
      </Block>
    </Group>
  );
}
