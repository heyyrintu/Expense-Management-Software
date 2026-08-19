"use client";

// Advance decisions (6.2) — assigned approver only; reject needs a reason.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decideAdvanceAction } from "@/app/(app)/advances/actions";

type Item = {
  id: string;
  purpose: string;
  ownerName: string;
  /** Integer minor units — rendered through <Amount>, never pre-formatted. */
  amount: number;
  currency: string;
  trip: string | null;
};

export function AdvanceQueue({ items }: { items: Item[] }) {
  return (
    <div className="grid gap-2">
      <h2 className="text-sm font-medium">Advance requests ({items.length})</h2>
      <ul className="grid gap-2">
        {items.map((a) => (
          <AdvanceRow key={a.id} item={a} />
        ))}
      </ul>
    </div>
  );
}

function AdvanceRow({ item }: { item: Item }) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function decide(action: "approve" | "reject") {
    setError(null);
    if (action === "reject" && reason.trim() === "") {
      setError("A reason is required to reject.");
      return;
    }
    startTransition(async () => {
      const res = await decideAdvanceAction({
        id: item.id,
        action,
        reason: reason.trim() || undefined,
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
      <span className="grid min-w-0 flex-1">
        <span className="truncate font-medium">{item.purpose}</span>
        <span className="text-muted-foreground">
          {item.ownerName}
          {item.trip ? ` · ${item.trip}` : ""}
        </span>
      </span>
      <Amount
        value={item.amount}
        currency={item.currency}
        align="right"
        className="whitespace-nowrap"
      />
      <label htmlFor={`adv-reason-${item.id}`} className="sr-only">
        Rejection reason
      </label>
      <Input
        id={`adv-reason-${item.id}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (for reject)"
        className="h-8 w-44"
      />
      <Button size="sm" disabled={pending} onClick={() => decide("approve")}>
        Approve
      </Button>
      <Button size="sm" variant="destructive" disabled={pending} onClick={() => decide("reject")}>
        Reject
      </Button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </li>
  );
}
