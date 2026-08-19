"use client";

// Finance reimbursement queue (D3.2) — approved and partly-paid reports
// waiting for money, and the entry point to a batch payment run.
//
// PRESENTATION ONLY. Same POST /api/reimbursements, same payload; the flow
// around it moved into PaymentRunSheet.
import * as React from "react";
import Link from "next/link";
import { Landmark, TriangleAlert, Wallet } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Amount } from "@/components/ui/amount";
import { Avatar } from "@/components/shell/avatar-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateCell } from "@/components/ui/date-cell";
import { EmptyState } from "@/components/ui/empty-state";
import { PaymentProgress } from "@/components/ui/payment-progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PaymentRunSheet, type PayableItem } from "./payment-run-sheet";

export type QueueRowView = PayableItem & {
  status: string;
  expenseCount: number;
  submittedAt: string | null;
};

export function ReimburseQueue({
  items,
  currency,
}: {
  items: QueueRowView[];
  currency: string;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const selectedItems = items.filter((i) => selected.has(i.id));
  const selectedTotal = selectedItems.reduce((sum, i) => sum + i.balance, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <div className="border-line bg-bg-surface rounded-lg border">
        <EmptyState
          icon={<Wallet aria-hidden="true" className="size-5" />}
          headline="Nothing to pay"
          description="Approved reports appear here when they're ready for a payment run."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setSelected(
              selected.size === items.length ? new Set() : new Set(items.map((i) => i.id))
            )
          }
        >
          {selected.size === items.length ? "Clear selection" : "Select all"}
        </Button>

        <Button size="sm" disabled={selectedItems.length === 0} onClick={() => setSheetOpen(true)}>
          Pay {selectedItems.length > 0 ? selectedItems.length : ""}
          {selectedItems.length === 1 ? " report" : selectedItems.length > 1 ? " reports" : ""}
        </Button>

        {selectedItems.length > 0 ? (
          // The running total sits beside the button, so the reader knows what
          // they're about to authorise before the sheet opens.
          <span className="text-meta text-text-secondary flex items-baseline gap-1">
            Total
            <Amount value={selectedTotal} currency={currency} size="meta" />
          </span>
        ) : null}
      </div>

      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <div
              className={cn(
                "border-line bg-bg-surface grid gap-3 rounded-lg border p-3",
                "transition-colors duration-instant ease-out",
                selected.has(item.id) && "bg-accent-subtle border-accent-border"
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                <Checkbox
                  aria-label={`Select ${item.title}`}
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                />

                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={item.ownerName} />
                  <span className="grid min-w-0">
                    <Link
                      href={`/reports/${item.id}`}
                      className="text-text-primary truncate font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
                    >
                      {item.title}
                    </Link>
                    <span className="text-meta text-text-tertiary truncate">
                      {item.ownerName} · {item.expenseCount} expense
                      {item.expenseCount === 1 ? "" : "s"}
                    </span>
                  </span>
                </span>

                <BankDetailsIndicator present={item.hasBankDetails} name={item.ownerName} />
                <StatusBadge status={item.status} />

                {/* Age, not date: how long someone has been out of pocket is
                    the signal finance is scanning for. */}
                <DateCell value={item.submittedAt} format="relative" />

                <Amount
                  value={item.balance}
                  currency={currency}
                  align="right"
                  className="whitespace-nowrap"
                />
              </div>

              {/* Only where it says something: a report with nothing paid yet
                  has no progress to show, and an empty bar is noise. */}
              {item.paid > 0 ? (
                <PaymentProgress total={item.total} paid={item.paid} currency={currency} />
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <PaymentRunSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        items={selectedItems}
        currency={currency}
      />
    </div>
  );
}

/**
 * Whether the recipient has bank details on file.
 *
 * A PRESENCE indicator, never the details themselves — CLAUDE.md keeps the
 * account number server-side, and finance only needs to know whether a
 * transfer is possible, not what the number is.
 */
function BankDetailsIndicator({ present, name }: { present: boolean; name: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full",
            "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
            present
              ? "bg-status-success-subtle text-status-success-text"
              : "bg-status-warning-subtle text-status-warning-text"
          )}
        >
          {present ? (
            <Landmark aria-hidden="true" className="size-4" />
          ) : (
            <TriangleAlert aria-hidden="true" className="size-4" />
          )}
          <span className="sr-only">
            {present ? `${name} has bank details on file` : `${name} has no bank details on file`}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {present
          ? "Bank details on file"
          : "No bank details on file — fine for cash or payroll, otherwise ask them to add some"}
      </TooltipContent>
    </Tooltip>
  );
}
