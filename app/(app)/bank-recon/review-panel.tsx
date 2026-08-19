"use client";

// Three-bucket review (7.2): Matched · In-app-not-in-bank (red flags) ·
// In-bank-not-in-app (record payment / manual match).
import * as React from "react";
import { useRouter } from "next/navigation";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import { NativeSelect } from "@/components/ui/native-select";
import {
  lockImportAction,
  manualMatchAction,
  recordPaymentFromLineAction,
  unmatchLineAction,
} from "./actions";

export type BucketData = {
  importId: string;
  locked: boolean;
  /** Org base currency — every line on a statement is in it. */
  currency: string;
  /** `date` is an ISO instant, `amount` integer minor units: DateCell/Amount render them. */
  matched: Array<{ id: string; date: string; amount: number; reference: string; matchType: string; paymentLabel: string }>;
  inBankOnly: Array<{ id: string; date: string; amount: number; reference: string }>;
  inAppOnly: Array<{ id: string; date: string; amount: number; label: string }>;
  payableReports: Array<{ id: string; label: string }>;
  unmatchedPaymentOptions: Array<{ id: string; label: string }>;
};

export function ReviewPanel({ data }: { data: BucketData }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      {!data.locked ? (
        <div>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => lockImportAction({ importId: data.importId }))}
          >
            Lock this period
          </Button>
        </div>
      ) : (
        <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
          This period is locked — matches can no longer be changed.
        </p>
      )}
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}

      <section className="grid gap-2">
        <h2 className="text-sm font-medium">Matched ({data.matched.length})</h2>
        <ul className="grid gap-1">
          {data.matched.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-green-200 bg-green-50/50 p-2 text-sm">
              <DateCell value={l.date} tone="muted" />
              <Amount value={l.amount} currency={data.currency} />
              <span className="text-muted-foreground min-w-0 flex-1 truncate">
                {l.reference} → {l.paymentLabel}
              </span>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">{l.matchType}</span>
              {!data.locked ? (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => unmatchLineAction({ lineId: l.id }))}>
                  Unmatch
                </Button>
              ) : null}
            </li>
          ))}
          {data.matched.length === 0 ? <li className="text-muted-foreground text-sm">None yet.</li> : null}
        </ul>
      </section>

      <section className="grid gap-2">
        <h2 className="text-sm font-medium text-red-700">
          Paid in app, missing in bank ({data.inAppOnly.length})
        </h2>
        <ul className="grid gap-1">
          {data.inAppOnly.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50/50 p-2 text-sm">
              <DateCell value={p.date} tone="muted" />
              <Amount value={p.amount} currency={data.currency} />
              <span className="text-muted-foreground min-w-0 flex-1 truncate">{p.label}</span>
            </li>
          ))}
          {data.inAppOnly.length === 0 ? (
            <li className="text-muted-foreground text-sm">Every recorded payment appears in the bank. </li>
          ) : null}
        </ul>
      </section>

      <section className="grid gap-2">
        <h2 className="text-sm font-medium">
          In bank, not in app ({data.inBankOnly.length})
        </h2>
        <ul className="grid gap-2">
          {data.inBankOnly.map((l) => (
            <OpenLine key={l.id} line={l} data={data} pending={pending} run={run} />
          ))}
          {data.inBankOnly.length === 0 ? (
            <li className="text-muted-foreground text-sm">Every bank debit is explained.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function OpenLine({
  line,
  data,
  pending,
  run,
}: {
  line: { id: string; date: string; amount: number; reference: string };
  data: BucketData;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [paymentId, setPaymentId] = React.useState("");
  const [reportId, setReportId] = React.useState("");

  return (
    <li className="grid gap-2 rounded-lg border p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <DateCell value={line.date} tone="muted" />
        <Amount value={line.amount} currency={data.currency} />
        <span className="text-muted-foreground min-w-0 flex-1 truncate">{line.reference}</span>
      </div>
      {!data.locked ? (
        <div className="flex flex-wrap items-center gap-2 pl-1">
          <label htmlFor={`mm-${line.id}`} className="sr-only">Match with payment</label>
          <NativeSelect
            id={`mm-${line.id}`}
            value={paymentId}
            onChange={(e) => setPaymentId(e.target.value)}
            className="h-8 w-72"
          >
            <option value="">Match existing payment…</option>
            {data.unmatchedPaymentOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </NativeSelect>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !paymentId}
            onClick={() => run(() => manualMatchAction({ lineId: line.id, reimbursementId: paymentId }))}
          >
            Match
          </Button>
          <span className="text-muted-foreground text-xs">or</span>
          <label htmlFor={`rp-${line.id}`} className="sr-only">Record payment against report</label>
          <NativeSelect
            id={`rp-${line.id}`}
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            className="h-8 w-72"
          >
            <option value="">Record payment against report…</option>
            {data.payableReports.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </NativeSelect>
          <Button
            size="sm"
            disabled={pending || !reportId}
            onClick={() => run(() => recordPaymentFromLineAction({ lineId: line.id, reportId }))}
          >
            Record payment
          </Button>
        </div>
      ) : null}
    </li>
  );
}
