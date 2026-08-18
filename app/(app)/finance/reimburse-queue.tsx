"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import { reimburseReportsAction } from "./actions";

type Item = {
  id: string;
  title: string;
  total: number;
  ownerName: string;
  expenseCount: number;
  submitted: string;
};

export function ReimburseQueue({ items, currency }: { items: Item[]; currency: string }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [paidAt, setPaidAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const selectedTotal = items
    .filter((i) => selected.has(i.id))
    .reduce((sum, i) => sum + i.total, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    setError(null);
    setMessage(null);
    if (selected.size === 0) return;
    if (reference.trim() === "") {
      setError("Enter a payment reference (batch id, UTR, cheque no…).");
      return;
    }
    startTransition(async () => {
      const res = await reimburseReportsAction({
        reportIds: [...selected],
        paidAt,
        reference: reference.trim(),
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setMessage(
          `Marked ${res.data.reimbursed} report${res.data.reimbursed === 1 ? "" : "s"} reimbursed` +
            (res.data.failed ? ` (${res.data.failed} failed)` : "")
        );
        setSelected(new Set());
        setReference("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              aria-label={`Select ${i.title}`}
              checked={selected.has(i.id)}
              onChange={() => toggle(i.id)}
              className="size-4"
            />
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-medium">{i.title}</span>
              <span className="text-muted-foreground">
                {i.ownerName} · {i.expenseCount} expense{i.expenseCount === 1 ? "" : "s"}
                {i.submitted ? ` · submitted ${i.submitted}` : ""}
              </span>
            </span>
            <span className="font-semibold whitespace-nowrap">
              {formatMoney(i.total, currency)}
            </span>
          </li>
        ))}
      </ul>

      <div className="grid max-w-md gap-3 rounded-xl border p-4">
        <h2 className="text-sm font-medium">
          Mark {selected.size || "selected"} report{selected.size === 1 ? "" : "s"} reimbursed
          {selected.size > 0 ? ` — ${formatMoney(selectedTotal, currency)}` : ""}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label htmlFor="paid-at" className="text-muted-foreground text-xs">
              Payment date
            </label>
            <Input
              id="paid-at"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor="reference" className="text-muted-foreground text-xs">
              Payment reference
            </label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="UTR / batch id"
            />
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-sm">{error}</p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm text-green-700">{message}</p>
        ) : null}
        <div>
          <Button disabled={pending || selected.size === 0} onClick={submit}>
            {pending ? "Working…" : "Mark reimbursed"}
          </Button>
        </div>
      </div>
    </div>
  );
}
