"use client";

// Finance register (6.2): filter, disburse approved advances with
// reference + optional proof.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Amount } from "@/components/ui/amount";
import { DateCell } from "@/components/ui/date-cell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/status-badge";
import type { AdvanceView } from "./advances-panel";

export type RegisterRow = AdvanceView & { ownerName: string; approved: boolean };

export function RegisterPanel({
  rows,
  statusFilter,
}: {
  rows: RegisterRow[];
  statusFilter: string;
}) {
  return (
    <div className="grid gap-3">
      <form className="flex items-end gap-2" action="/advances" method="GET">
        <div className="grid gap-1">
          <label htmlFor="reg-status" className="text-muted-foreground text-xs">Status</label>
          <NativeSelect id="reg-status" name="status" defaultValue={statusFilter} className="w-44">
            <option value="">All statuses</option>
            {["draft", "submitted", "approved", "rejected", "disbursed", "partially_settled", "settled"].map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      <ul className="grid gap-2">
        {rows.map((r) => (
          <RegisterItem key={r.id} row={r} />
        ))}
        {rows.length === 0 ? (
          <li className="text-muted-foreground text-sm">Nothing matches.</li>
        ) : null}
      </ul>
    </div>
  );
}

function RegisterItem({ row }: { row: RegisterRow }) {
  const router = useRouter();
  const [reference, setReference] = React.useState("");
  const [proof, setProof] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function disburse() {
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("payload", JSON.stringify({ advanceId: row.id, reference: reference.trim() }));
      if (proof) form.set("proof", proof);
      const res = await fetch("/api/advances/disburse", { method: "POST", body: form });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) setError(json.error ?? "Disbursement failed.");
      else router.refresh();
    } catch {
      setError("Disbursement failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{row.purpose}</span>
            <StatusBadge status={row.status} />
          </span>
          <span className="text-muted-foreground">
            {row.ownerName} · <DateCell value={row.when} tone="muted" />
            {row.trip ? (
              <>
                {" · "}
                <DateCell value={row.trip.start} tone="muted" />
                {" – "}
                <DateCell value={row.trip.end} tone="muted" />
              </>
            ) : null}
            {row.reference ? ` · ref ${row.reference}` : ""}
            {row.outstanding !== null ? (
              <>
                {" · outstanding "}
                <Amount
                  value={row.outstanding}
                  currency={row.currency}
                  size="meta"
                  tone="muted"
                />
              </>
            ) : null}
          </span>
        </span>
        <Amount
          value={row.amount}
          currency={row.currency}
          align="right"
          className="whitespace-nowrap"
        />
      </div>
      {row.approved ? (
        <div className="flex flex-wrap items-end gap-2 pl-1">
          <div className="grid gap-1">
            <label htmlFor={`dis-ref-${row.id}`} className="text-muted-foreground text-xs">
              Reference / UTR
            </label>
            <Input
              id={`dis-ref-${row.id}`}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-8 w-44"
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor={`dis-proof-${row.id}`} className="text-muted-foreground text-xs">
              Proof (optional)
            </label>
            <Input
              id={`dis-proof-${row.id}`}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="h-8 w-56"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button size="sm" disabled={busy || !reference.trim()} onClick={disburse}>
            {busy ? "Recording…" : "Disburse"}
          </Button>
          {error ? <span className="text-status-danger-text text-xs">{error}</span> : null}
        </div>
      ) : null}
    </li>
  );
}
