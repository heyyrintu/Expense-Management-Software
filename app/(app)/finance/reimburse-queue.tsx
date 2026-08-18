"use client";

// Payment run panel (6.1): pick reports, method, per-report reference/UTR,
// optional partial amount (single selection), optional proof file — posts
// multipart to /api/reimbursements.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";

type Item = {
  id: string;
  title: string;
  status: string;
  balance: number;
  total: number;
  ownerName: string;
  expenseCount: number;
  submitted: string;
};

export function ReimburseQueue({ items, currency }: { items: Item[]; currency: string }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [references, setReferences] = React.useState<Record<string, string>>({});
  const [paidAt, setPaidAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = React.useState("bank_transfer");
  const [partialAmount, setPartialAmount] = React.useState("");
  const [proof, setProof] = React.useState<File | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const selectedItems = items.filter((i) => selected.has(i.id));
  const selectedBalance = selectedItems.reduce((sum, i) => sum + i.balance, 0);
  const single = selectedItems.length === 1 ? selectedItems[0] : null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPartialAmount("");
  }

  async function submit() {
    setError(null);
    setMessage(null);
    const missingRef = selectedItems.find((i) => !(references[i.id] ?? "").trim());
    if (missingRef) {
      setError(`Enter a reference/UTR for “${missingRef.title}”.`);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({
          paidAt,
          method,
          reports: selectedItems.map((i) => ({
            reportId: i.id,
            reference: references[i.id].trim(),
            ...(single && partialAmount ? { amountPaid: partialAmount } : {}),
          })),
        })
      );
      if (proof) form.set("proof", proof);
      const res = await fetch("/api/reimbursements", { method: "POST", body: form });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { paid: number; failed: Array<{ reportId: string; error?: string }> };
      };
      if (!json.ok || !json.data) {
        setError(json.error ?? "Payment failed.");
      } else {
        setMessage(
          `Recorded ${json.data.paid} payment${json.data.paid === 1 ? "" : "s"}` +
            (json.data.failed.length
              ? ` — ${json.data.failed.length} failed: ${json.data.failed[0]?.error ?? ""}`
              : "")
        );
        setSelected(new Set());
        setReferences({});
        setPartialAmount("");
        setProof(null);
        router.refresh();
      }
    } catch {
      setError("Payment failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {items.map((i) => (
          <li key={i.id} className="grid gap-2 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="checkbox"
                aria-label={`Select ${i.title}`}
                checked={selected.has(i.id)}
                onChange={() => toggle(i.id)}
                className="size-4"
              />
              <span className="grid min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{i.title}</span>
                  <StatusBadge status={i.status} />
                </span>
                <span className="text-muted-foreground">
                  {i.ownerName} · {i.expenseCount} expense{i.expenseCount === 1 ? "" : "s"}
                  {i.submitted ? ` · submitted ${i.submitted}` : ""}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-semibold whitespace-nowrap">
                  {formatMoney(i.balance, currency)}
                </span>
                {i.balance !== i.total ? (
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    of {formatMoney(i.total, currency)}
                  </span>
                ) : null}
              </span>
            </div>
            {selected.has(i.id) ? (
              <div className="grid gap-1 pl-7">
                <label htmlFor={`ref-${i.id}`} className="text-muted-foreground text-xs">
                  Reference / UTR
                </label>
                <Input
                  id={`ref-${i.id}`}
                  value={references[i.id] ?? ""}
                  onChange={(e) =>
                    setReferences((prev) => ({ ...prev, [i.id]: e.target.value }))
                  }
                  placeholder="UTR / cheque / payroll id"
                  className="h-8 max-w-xs"
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="grid max-w-lg gap-3 rounded-xl border p-4">
        <h2 className="text-sm font-medium">
          Pay {selectedItems.length || "selected"} report{selectedItems.length === 1 ? "" : "s"}
          {selectedItems.length > 0 ? ` — ${formatMoney(selectedBalance, currency)}` : ""}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label htmlFor="pay-date" className="text-muted-foreground text-xs">Payment date</label>
            <Input id="pay-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <label htmlFor="pay-method" className="text-muted-foreground text-xs">Method</label>
            <NativeSelect id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="payroll">Payroll</option>
            </NativeSelect>
          </div>
          {single ? (
            <div className="grid gap-1">
              <label htmlFor="pay-partial" className="text-muted-foreground text-xs">
                Amount (empty = full {formatMoney(single.balance, currency)})
              </label>
              <Input
                id="pay-partial"
                inputMode="decimal"
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                placeholder="Partial amount"
              />
            </div>
          ) : null}
          <div className="grid gap-1">
            <label htmlFor="pay-proof" className="text-muted-foreground text-xs">
              Payment proof (optional, JPG/PNG/PDF ≤ 10 MB)
            </label>
            <Input
              id="pay-proof"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
        {message ? <p role="status" className="text-sm text-green-700">{message}</p> : null}
        <div>
          <Button disabled={busy || selectedItems.length === 0} onClick={submit}>
            {busy ? "Recording…" : "Record payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
