"use client";

// Manual match (D4.2) — "select a statement line → search reimbursements →
// confirm".
//
// A dialog with a search box, not a dropdown. The dropdown it replaces held
// one long <option> per payment — "August travel · ₹12,456.00 · 15 Aug 2026 ·
// ref N226081512345678" — which is unreadable at option width, unsearchable,
// and gives the reader nothing to compare against the line they are matching.
//
// Here the statement line stays pinned at the top while they search, because
// matching is a COMPARISON: the amount and date on the left have to be
// checked against the amount and date on the right, and a reader who has to
// remember one of them will eventually mis-remember it.
//
// Filtering is client-side, which is normally the wrong answer — but the
// candidate set is bounded by the statement's period ±3 days and already
// fully loaded to render the bucket. Searching the server here would be a
// round-trip to filter rows the browser already has.
import * as React from "react";
import { Search } from "lucide-react";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type MatchCandidate = {
  id: string;
  amount: number;
  date: string;
  reference: string;
  reportTitle: string;
  ownerName: string;
  method: string;
};

export type StatementLineView = {
  id: string;
  date: string;
  amount: number;
  reference: string;
};

export function MatchDialog({
  line,
  candidates,
  currency,
  open,
  onOpenChange,
  onConfirm,
  pending = false,
}: {
  line: StatementLineView | null;
  candidates: MatchCandidate[];
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reimbursementId: string) => void;
  pending?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);

  // Each opening starts clean — carrying a previous selection over is a very
  // easy way to attach the wrong payment to the wrong line.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(null);
    }
  }, [open, line?.id]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? candidates.filter((c) =>
          [c.reference, c.reportTitle, c.ownerName].some((field) =>
            field.toLowerCase().includes(q)
          )
        )
      : candidates;

    // Exact-amount candidates first. When a reader opens this dialog they are
    // nearly always looking for the payment that matches the figure on the
    // line, so putting those at the top makes the common case one glance.
    if (!line) return rows;
    return [...rows].sort((a, b) => {
      const aExact = a.amount === line.amount ? 0 : 1;
      const bExact = b.amount === line.amount ? 0 : 1;
      return aExact - bExact;
    });
  }, [candidates, query, line]);

  if (!line) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Match this statement line</DialogTitle>
          <DialogDescription>
            Pick the payment this bank debit represents. You can undo it
            afterwards, until the period is locked.
          </DialogDescription>
        </DialogHeader>

        {/* The line being matched, pinned. Matching is a comparison. */}
        <div className="border-line bg-bg-subtle grid gap-1 rounded-lg border p-3">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-meta text-text-tertiary">Bank debit</span>
            <Amount value={line.amount} currency={currency} />
          </span>
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <DateCell value={line.date} tone="muted" />
            <span className="text-meta text-text-tertiary tabular truncate">
              {line.reference || "no reference"}
            </span>
          </span>
        </div>

        <div className="grid gap-2">
          <label className="relative">
            <span className="sr-only">Search payments</span>
            <Search
              aria-hidden="true"
              className="text-text-tertiary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by reference, report or person"
              className="ps-9"
            />
          </label>

          <ul
            role="radiogroup"
            aria-label="Payments"
            className="border-line divide-line max-h-bucket grid divide-y overflow-y-auto rounded-lg border"
          >
            {filtered.map((candidate) => {
              const isSelected = selected === candidate.id;
              const exact = candidate.amount === line.amount;
              return (
                <li key={candidate.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelected(candidate.id)}
                    className={cn(
                      "grid w-full gap-1 p-3 text-left",
                      "transition-colors duration-instant ease-out",
                      "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset",
                      isSelected ? "bg-accent-subtle" : "hover:bg-bg-subtle"
                    )}
                  >
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-body text-text-primary truncate">
                        {candidate.reportTitle}
                      </span>
                      <Amount value={candidate.amount} currency={currency} align="right" />
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <DateCell value={candidate.date} tone="muted" />
                      <span className="text-meta text-text-tertiary truncate">
                        {candidate.ownerName} · {candidate.method.replace("_", " ")}
                      </span>
                      <span className="text-meta text-text-tertiary tabular truncate">
                        {candidate.reference}
                      </span>
                      {exact ? (
                        // Not a claim that it IS the match — just that the
                        // figure agrees, which is what the reader scans for.
                        <span className="bg-status-success-subtle text-status-success-text rounded-sm px-1.5 py-0.5 text-meta">
                          amount matches
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}

            {filtered.length === 0 ? (
              <li className="text-meta text-text-tertiary p-6 text-center">
                {candidates.length === 0
                  ? "No unreconciled payments fall in this statement's period."
                  : "Nothing matches that search."}
              </li>
            ) : null}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={!selected || pending}
            onClick={() => selected && onConfirm(selected)}
          >
            {pending ? "Matching…" : "Confirm match"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
