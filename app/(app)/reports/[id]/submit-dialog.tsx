"use client";

// Submit confirmation (D2.3) — §7.2: "the user should never be surprised by
// what was submitted."
//
// Submitting is the moment an expense stops being yours. It locks the rows,
// notifies an approver, and starts a clock. So the dialog states the four
// things a person would otherwise have to reconstruct afterwards: how many
// expenses, how much money, WHO it goes to, and what is flagged.
//
// The approver name is resolved server-side by the same resolveChain the
// submit action uses — not a guess, and not a second implementation that
// could name someone the notification doesn't reach.
import * as React from "react";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PolicyFlagChips, type FlagLike } from "@/components/ui/policy-flag-chip";

export type SubmitPreview = {
  expenseCount: number;
  /** Integer minor units, org base currency. */
  total: number;
  currency: string;
  /** Null when the chain resolves to nobody — worth saying out loud. */
  approverName: string | null;
  /** Whether a second approval is required at this total. */
  needsSecondApproval: boolean;
  flags: FlagLike[];
};

export function SubmitDialog({
  open,
  onOpenChange,
  preview,
  onConfirm,
  pending,
  resubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: SubmitPreview;
  onConfirm: () => void;
  pending: boolean;
  resubmit: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{resubmit ? "Resubmit this report?" : "Submit this report?"}</DialogTitle>
          <DialogDescription>
            Once submitted, these expenses are locked until an approver
            responds.
          </DialogDescription>
        </DialogHeader>

        <dl className="border-line divide-line grid divide-y rounded-lg border">
          <Line label="Expenses">
            <span className="text-body-strong text-text-primary tabular">
              {preview.expenseCount}
            </span>
          </Line>
          <Line label="Total">
            <Amount value={preview.total} currency={preview.currency} align="right" />
          </Line>
          <Line label="Goes to">
            {preview.approverName ? (
              <span className="text-body text-text-primary">{preview.approverName}</span>
            ) : (
              // Better to say this than to submit into silence and leave the
              // reader wondering why nothing is happening.
              <span className="text-meta text-status-warning-text">
                No approver is assigned — finance will need to route it
              </span>
            )}
          </Line>
          {preview.needsSecondApproval ? (
            <Line label="Also needs">
              <span className="text-meta text-text-secondary">
                A second approval at this amount
              </span>
            </Line>
          ) : null}
        </dl>

        {preview.flags.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-label text-text-secondary">
              Going with {preview.flags.length} policy flag
              {preview.flags.length === 1 ? "" : "s"}
            </p>
            <PolicyFlagChips flags={preview.flags} />
            <p className="text-meta text-text-tertiary">
              Flags don&apos;t block submission — your approver sees them and can
              approve anyway.
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Not yet
          </Button>
          <Button onClick={onConfirm} loading={pending}>
            {resubmit ? "Resubmit" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-label text-text-secondary">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
