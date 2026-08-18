"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import {
  createAdvanceAction,
  deleteAdvanceDraftAction,
  submitAdvanceAction,
} from "./actions";

export type AdvanceView = {
  id: string;
  amount: string;
  outstanding: string | null;
  purpose: string;
  trip: string | null;
  status: string;
  reference: string | null;
  when: string;
};

export function AdvancesPanel({ mine }: { mine: AdvanceView[] }) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [tripStart, setTripStart] = React.useState("");
  const [tripEnd, setTripEnd] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
      } else {
        setAmount("");
        setPurpose("");
        setTripStart("");
        setTripEnd("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4">
      <form
        className="grid max-w-2xl gap-3 rounded-xl border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createAdvanceAction({ amount, purpose, tripStart, tripEnd }));
        }}
      >
        <h2 className="text-sm font-medium">Request an advance</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor="adv-amount" className="text-muted-foreground text-xs">Amount</label>
            <Input id="adv-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="20000.00" />
          </div>
          <div className="grid gap-1">
            <label htmlFor="adv-purpose" className="text-muted-foreground text-xs">Purpose</label>
            <Input id="adv-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Client visit — Mumbai" />
          </div>
          <div className="grid gap-1">
            <label htmlFor="adv-start" className="text-muted-foreground text-xs">Trip start (optional)</label>
            <Input id="adv-start" type="date" value={tripStart} onChange={(e) => setTripStart(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <label htmlFor="adv-end" className="text-muted-foreground text-xs">Trip end (optional)</label>
            <Input id="adv-end" type="date" value={tripEnd} onChange={(e) => setTripEnd(e.target.value)} />
          </div>
        </div>
        <div>
          <Button type="submit" disabled={pending || !amount || !purpose}>
            {pending ? "Saving…" : "Save draft"}
          </Button>
        </div>
      </form>

      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}

      {mine.length > 0 ? (
        <ul className="grid gap-2">
          {mine.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
              <span className="grid min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{a.purpose}</span>
                  <StatusBadge status={a.status} />
                </span>
                <span className="text-muted-foreground">
                  {a.when}
                  {a.trip ? ` · ${a.trip}` : ""}
                  {a.reference ? ` · ref ${a.reference}` : ""}
                  {a.outstanding ? ` · outstanding ${a.outstanding}` : ""}
                </span>
              </span>
              <span className="font-semibold whitespace-nowrap">{a.amount}</span>
              {a.status === "draft" ? (
                <span className="flex gap-2">
                  <Button size="sm" disabled={pending} onClick={() => run(() => submitAdvanceAction({ id: a.id }))}>
                    Submit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() => run(() => deleteAdvanceDraftAction({ id: a.id }))}
                  >
                    Delete
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No advances yet.</p>
      )}
    </div>
  );
}
