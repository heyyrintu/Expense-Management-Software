"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { bulkApproveAction } from "./actions";

type Item = {
  id: string;
  title: string;
  total: number;
  submittedAt: string | null;
  ownerName: string;
  expenseCount: number;
  level: 1 | 2;
  flagged: boolean;
};

export function QueueList({ items, currency }: { items: Item[]; currency: string }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const selectable = items.filter((i) => !i.flagged);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkApprove() {
    setMessage(null);
    startTransition(async () => {
      const res = await bulkApproveAction({ reportIds: [...selected] });
      if (!res.ok) {
        setMessage(res.error);
      } else {
        setMessage(
          `Approved ${res.data.approved} report${res.data.approved === 1 ? "" : "s"}` +
            (res.data.skipped ? `, ${res.data.skipped} skipped` : "")
        );
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={selectable.length === 0}
          onClick={() =>
            setSelected(
              selected.size === selectable.length
                ? new Set()
                : new Set(selectable.map((i) => i.id))
            )
          }
        >
          {selected.size === selectable.length && selectable.length > 0
            ? "Clear selection"
            : "Select all unflagged"}
        </Button>
        <Button
          size="sm"
          disabled={pending || selected.size === 0}
          onClick={bulkApprove}
        >
          {pending ? "Approving…" : `Approve selected (${selected.size})`}
        </Button>
        {message ? <span className="text-muted-foreground text-sm">{message}</span> : null}
      </div>

      <ul className="grid gap-2">
        {items.map((i) => (
          <li
            key={i.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
          >
            <input
              type="checkbox"
              aria-label={`Select ${i.title}`}
              checked={selected.has(i.id)}
              disabled={i.flagged}
              onChange={() => toggle(i.id)}
              className="size-4"
            />
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-medium">{i.title}</span>
              <span className="text-muted-foreground">
                {i.ownerName} · {i.expenseCount} expense{i.expenseCount === 1 ? "" : "s"}
              </span>
            </span>
            {i.level === 2 ? (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                2nd approval
              </span>
            ) : null}
            {i.flagged ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Flagged
              </span>
            ) : null}
            <Amount
              value={i.total}
              currency={currency}
              align="right"
              className="whitespace-nowrap"
            />
            <Button asChild variant="outline" size="sm">
              <Link href={`/approvals/${i.id}`}>Review</Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
