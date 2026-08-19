"use client";

// Reconciliation results board (D4.2) — DESIGN-PRD §7.6.
//
// Three buckets, and every row in them is either finished or has exactly one
// obvious next action:
//
//   Matched      — nothing to do; "Undo" is there but quiet.
//   Not in bank   — DANGER, and deliberately actionless. The app says a
//                   payment was made and the bank disagrees; no button on
//                   this screen can resolve that, and offering one would
//                   imply otherwise. It is a list to investigate.
//   Not in app    — WARNING, with the two ways to explain a debit: match it
//                   to a payment already recorded, or record the payment it
//                   represents.
//
// Nothing here is optimistic. Reconciliation writes payment records and
// changes report status (CLAUDE.md: money movement is never optimistic), so
// every action waits for the server and the board re-renders from it.
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import { NativeSelect } from "@/components/ui/native-select";
import { Bucket, BucketBoard, BucketEmpty } from "@/components/recon/bucket-board";
import {
  lockImportAction,
  manualMatchAction,
  recordPaymentFromLineAction,
  unmatchLineAction,
} from "./actions";
import { LockDialog, UnmatchDialog } from "./confirm-dialogs";
import { MatchDialog, type MatchCandidate, type StatementLineView } from "./match-dialog";

export type BucketData = {
  importId: string;
  locked: boolean;
  periodLabel: string;
  /** Org base currency — every line on a statement is in it. */
  currency: string;
  /** `date` is an ISO instant, `amount` integer minor units (D1.1). */
  matched: Array<{
    id: string;
    date: string;
    amount: number;
    reference: string;
    matchType: string;
    paymentLabel: string;
  }>;
  inBankOnly: Array<{ id: string; date: string; amount: number; reference: string }>;
  inAppOnly: Array<{
    id: string;
    date: string;
    amount: number;
    reportTitle: string;
    ownerName: string;
    reference: string;
  }>;
  payableReports: Array<{ id: string; label: string }>;
  candidates: MatchCandidate[];
};

export function ReviewPanel({ data }: { data: BucketData }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [matching, setMatching] = React.useState<StatementLineView | null>(null);
  const [unmatching, setUnmatching] = React.useState<string | null>(null);
  const [lockOpen, setLockOpen] = React.useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        // The server's own sentence, not a generic one — it knows whether the
        // period is locked, the line already matched, or the report unpayable.
        toast.error(res.error ?? "That didn't work.");
        return;
      }
      toast.success(success);
      setMatching(null);
      setUnmatching(null);
      setLockOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-meta text-text-tertiary">
          {data.locked
            ? "This period is locked. Matches are read-only."
            : "Explain every line, then lock the period."}
        </p>
        {!data.locked ? (
          <Button variant="secondary" onClick={() => setLockOpen(true)} disabled={pending}>
            Lock this period
          </Button>
        ) : null}
      </div>

      <BucketBoard>
        <Bucket
          title="Matched"
          description="Bank debit and recorded payment agree."
          count={data.matched.length}
          tone="success"
        >
          {data.matched.map((line) => (
            <li key={line.id} className="grid gap-1 py-3">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <DateCell value={line.date} tone="muted" />
                <Amount value={line.amount} currency={data.currency} align="right" />
              </span>
              <span className="text-meta text-text-secondary truncate">
                {line.paymentLabel}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="bg-status-success-subtle text-status-success-text rounded-sm px-1.5 py-0.5 text-meta">
                  {line.matchType === "auto" ? "auto-matched" : "matched by hand"}
                </span>
                {!data.locked ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setUnmatching(line.id)}
                  >
                    Undo
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
          {data.matched.length === 0 ? (
            <BucketEmpty>Nothing has been matched yet.</BucketEmpty>
          ) : null}
        </Bucket>

        <Bucket
          title="Not in bank"
          description="Recorded as paid, but the bank has no such debit."
          count={data.inAppOnly.length}
          tone="danger"
        >
          {data.inAppOnly.map((payment) => (
            <li key={payment.id} className="grid gap-1 py-3">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <DateCell value={payment.date} tone="muted" />
                <Amount value={payment.amount} currency={data.currency} align="right" />
              </span>
              <span className="text-meta text-text-secondary truncate">
                {payment.reportTitle} · {payment.ownerName}
              </span>
              <span className="text-meta text-text-tertiary tabular truncate">
                {payment.reference}
              </span>
            </li>
          ))}
          {data.inAppOnly.length === 0 ? (
            <BucketEmpty>Every recorded payment appears in the bank.</BucketEmpty>
          ) : null}
        </Bucket>

        <Bucket
          title="Not in app"
          description="A bank debit with no matching payment record."
          count={data.inBankOnly.length}
          tone="warning"
        >
          {data.inBankOnly.map((line) => (
            <li key={line.id} className="grid gap-2 py-3">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <DateCell value={line.date} tone="muted" />
                <Amount value={line.amount} currency={data.currency} align="right" />
              </span>
              <span className="text-meta text-text-tertiary tabular truncate">
                {line.reference || "no reference"}
              </span>
              {!data.locked ? (
                <OpenLineActions
                  payableReports={data.payableReports}
                  pending={pending}
                  onMatch={() => setMatching(line)}
                  onRecord={(reportId) =>
                    run(
                      () => recordPaymentFromLineAction({ lineId: line.id, reportId }),
                      "Payment recorded and matched."
                    )
                  }
                />
              ) : null}
            </li>
          ))}
          {data.inBankOnly.length === 0 ? (
            <BucketEmpty>Every bank debit is explained.</BucketEmpty>
          ) : null}
        </Bucket>
      </BucketBoard>

      <MatchDialog
        line={matching}
        candidates={data.candidates}
        currency={data.currency}
        open={matching !== null}
        onOpenChange={(open) => !open && setMatching(null)}
        pending={pending}
        onConfirm={(reimbursementId) =>
          matching &&
          run(
            () => manualMatchAction({ lineId: matching.id, reimbursementId }),
            "Matched."
          )
        }
      />

      <UnmatchDialog
        open={unmatching !== null}
        onOpenChange={(open) => !open && setUnmatching(null)}
        pending={pending}
        onConfirm={() =>
          unmatching &&
          run(() => unmatchLineAction({ lineId: unmatching }), "Match undone.")
        }
      />

      <LockDialog
        open={lockOpen}
        onOpenChange={setLockOpen}
        pending={pending}
        periodLabel={data.periodLabel}
        matchedCount={data.matched.length}
        openCount={data.inBankOnly.length}
        onConfirm={() =>
          run(
            () => lockImportAction({ importId: data.importId }),
            "Period locked."
          )
        }
      />
    </div>
  );
}

/**
 * The two ways to explain a debit.
 *
 * "Record this payment" is one click once a report is chosen — §7.6 asks for
 * one-click, and the report is the one thing the app genuinely cannot infer:
 * the line says how much left the bank, never who it was for. The amount,
 * date and reference all come from the line itself, which is why there is no
 * form here.
 */
function OpenLineActions({
  payableReports,
  pending,
  onMatch,
  onRecord,
}: {
  payableReports: Array<{ id: string; label: string }>;
  pending: boolean;
  onMatch: () => void;
  onRecord: (reportId: string) => void;
}) {
  const [reportId, setReportId] = React.useState("");

  return (
    <div className="grid gap-2">
      <Button size="sm" variant="secondary" disabled={pending} onClick={onMatch}>
        Match to a payment…
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Record payment against report</span>
          <NativeSelect
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            className="w-full"
          >
            <option value="">Record against report…</option>
            {payableReports.map((report) => (
              <option key={report.id} value={report.id}>
                {report.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button
          size="sm"
          disabled={pending || !reportId}
          onClick={() => onRecord(reportId)}
        >
          Record
        </Button>
      </div>
    </div>
  );
}
