"use client";

// Patterns (D0.5) — the empty / loading / error trio every screen owes.
//
// Shown as the SAME screen three ways rather than three unrelated specimens,
// because that is the comparison that matters: the skeleton has to match the
// shape of the loaded content, and the empty and error states have to sit in
// the same box at roughly the same height. Lined up side by side, a skeleton
// that doesn't match its content is obvious. In isolation it never is.
import * as React from "react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Block, Group, Row } from "./shared";

type State = "loaded" | "loading" | "empty" | "error";

const STATES: Array<{ value: State; label: string }> = [
  { value: "loaded", label: "Loaded" },
  { value: "loading", label: "Loading" },
  { value: "empty", label: "Empty" },
  { value: "error", label: "Error" },
];

const ROWS = [
  { merchant: "IndiGo 6E-2043", meta: "Travel · 12 Aug", amount: "₹14,500.00", status: "submitted" },
  { merchant: "Blue Tokai", meta: "Meals · 12 Aug", amount: "₹450.00", status: "approved" },
  { merchant: "Uber", meta: "Travel · 11 Aug", amount: "₹340.50", status: "draft" },
];

export function PatternsSection() {
  const [state, setState] = React.useState<State>("loaded");

  return (
    <Group
      id="patterns"
      eyebrow="design-craft"
      title="Patterns"
      description="Three states every screen has to answer for, and one screen answering all of them. Switch between them: the box should stay roughly the same size, and nothing should jump."
    >
      <Block
        title="The trio, side by side"
        description="A skeleton earns its place only if it matches what replaces it. Toggle between Loading and Loaded and watch whether anything moves."
      >
        <Row label="State">
          {STATES.map((s) => (
            <Button
              key={s.value}
              size="sm"
              variant={state === s.value ? "primary" : "secondary"}
              onClick={() => setState(s.value)}
              aria-pressed={state === s.value}
            >
              {s.label}
            </Button>
          ))}
        </Row>

        <div className="border-line bg-bg-surface overflow-hidden rounded-lg border">
          <div className="border-line flex items-center justify-between border-b px-5 py-4">
            <h4 className="text-h3 text-text-primary">Expenses</h4>
            {state === "loaded" ? (
              <span className="text-meta text-text-tertiary tabular">3 items</span>
            ) : null}
          </div>

          {state === "loaded" ? <LoadedList /> : null}
          {state === "loading" ? <LoadingList /> : null}
          {state === "empty" ? (
            <EmptyState
              headline="No expenses yet"
              description="Capture one from a receipt, or add the details yourself."
              action={<Button>Add expense</Button>}
            />
          ) : null}
          {state === "error" ? (
            <ErrorState
              headline="Couldn't load your expenses"
              description="The list didn't come back. Try again — nothing was lost."
              action={
                <Button variant="secondary" onClick={() => setState("loading")}>
                  Try again
                </Button>
              }
            />
          ) : null}
        </div>
      </Block>

      <Block
        title="Copy voice"
        description="The difference between these columns is the whole of §copy voice. Say what happened and what to do about it; never apologise, never blame, never exclaim."
      >
        <div className="border-line bg-bg-surface overflow-hidden rounded-lg border">
          <table className="w-full text-body">
            <thead className="bg-bg-subtle text-text-secondary text-label">
              <tr>
                <th className="p-3 text-left font-medium">Don&apos;t</th>
                <th className="p-3 text-left font-medium">Do</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {[
                ["Oops! Something went wrong!", "Couldn't load your expenses"],
                ["Error: OCR_FAILED (code 422)", "Couldn't read this receipt — enter the details yourself"],
                ["You forgot to attach a receipt!", "A receipt is required over ₹1,000"],
                ["No data available at this time.", "No expenses yet"],
                ["Please try again later, sorry!", "Try again — nothing was lost"],
              ].map(([bad, good]) => (
                <tr key={bad}>
                  <td className="text-status-danger-text p-3">{bad}</td>
                  <td className="text-status-success-text p-3">{good}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block
        title="Error tones"
        description="Danger for a genuine failure, neutral for an expected dead end. Both demand a recovery action — the component's type won't compile without one."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="border-line bg-bg-surface rounded-lg border">
            <ErrorState
              headline="Couldn't load your expenses"
              description="The list didn't come back. Try again — nothing was lost."
              action={<Button variant="secondary">Try again</Button>}
            />
          </div>
          <div className="border-line bg-bg-surface rounded-lg border">
            <ErrorState
              tone="neutral"
              headline="This report no longer exists"
              description="It may have been deleted, or it belongs to another organisation."
              action={<Button variant="secondary">Back to reports</Button>}
            />
          </div>
        </div>
      </Block>
    </Group>
  );
}

function LoadedList() {
  return (
    <ul className="divide-line divide-y">
      {ROWS.map((row) => (
        <li key={row.merchant} className="flex h-12 items-center gap-4 px-5">
          <div className="grid min-w-0 flex-1">
            <span className="text-body text-text-primary truncate">{row.merchant}</span>
            <span className="text-meta text-text-tertiary truncate">{row.meta}</span>
          </div>
          <StatusBadge status={row.status} />
          <span className="amount w-28 text-right">{row.amount}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Shape-matched to LoadedList: same row height, same three columns, same
 * widths. The blocks stand where the content will, so the transition to
 * loaded content shifts nothing.
 */
function LoadingList() {
  return (
    <ul className="divide-line divide-y" aria-hidden="true">
      {ROWS.map((row) => (
        <li key={row.merchant} className="flex h-12 items-center gap-4 px-5">
          <div className="grid min-w-0 flex-1 gap-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-20 rounded-sm" />
          <Skeleton className="h-4 w-28" />
        </li>
      ))}
    </ul>
  );
}
