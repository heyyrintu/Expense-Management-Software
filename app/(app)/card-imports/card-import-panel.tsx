"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { matchTransactionAction, unmatchTransactionAction } from "./actions";

export type UnmatchedTxn = {
  id: string;
  /** ISO instant + integer minor units — DateCell/Amount do the formatting. */
  date: string;
  amount: number;
  currency: string;
  merchant: string;
  suggestions: Array<{ id: string; label: string }>;
};

export function CardImportPanel({ unmatched }: { unmatched: UnmatchedTxn[] }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function upload(files: FileList | File[]) {
    const file = Array.from(files)[0];
    if (!file) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/card-imports", { method: "POST", body: form });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { imported: number; matched: number; unmatched: number; skipped: unknown[] };
      };
      if (!json.ok || !json.data) {
        setError(json.error ?? "Import failed.");
      } else {
        setMessage(
          `Imported ${json.data.imported} — auto-matched ${json.data.matched}, ` +
            `${json.data.unmatched} for review` +
            (json.data.skipped.length ? `, ${json.data.skipped.length} rows skipped` : "")
        );
        router.refresh();
      }
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setBusy(true);
    void (async () => {
      const res = await fn();
      setBusy(false);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else router.refresh();
    })();
  }

  return (
    <div className="grid gap-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload statement CSV"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void upload(e.dataTransfer.files);
        }}
        className={cn(
          "text-text-tertiary grid cursor-pointer place-items-center rounded-lg border border-dashed p-6 text-center text-sm",
          dragOver && "border-accent bg-bg-subtle/50"
        )}
      >
        {busy ? "Working…" : "Drag & drop a statement CSV here — or click to choose (max 1 MB)"}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
          }}
        />
      </div>

      {message ? <p role="status" className="text-status-success-text text-sm">{message}</p> : null}
      {error ? <p role="alert" className="text-status-danger-text text-sm">{error}</p> : null}

      {unmatched.length > 0 ? (
        <div className="grid gap-2">
          <h2 className="text-sm font-medium">
            Unmatched worklist ({unmatched.length})
          </h2>
          <ul className="grid gap-2">
            {unmatched.map((t) => (
              <UnmatchedRow key={t.id} txn={t} busy={busy} act={act} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function UnmatchedRow({
  txn,
  busy,
  act,
}: {
  txn: UnmatchedTxn;
  busy: boolean;
  act: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [expenseId, setExpenseId] = React.useState("");
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
      <span className="grid min-w-0 flex-1">
        <span className="truncate font-medium">{txn.merchant}</span>
        <DateCell value={txn.date} tone="muted" />
      </span>
      <Amount value={txn.amount} currency={txn.currency} className="whitespace-nowrap" />
      {txn.suggestions.length > 0 ? (
        <>
          <label htmlFor={`match-${txn.id}`} className="sr-only">
            Match with expense
          </label>
          <NativeSelect
            id={`match-${txn.id}`}
            value={expenseId}
            onChange={(e) => setExpenseId(e.target.value)}
            className="w-64"
          >
            <option value="">Pick a matching expense…</option>
            {txn.suggestions.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </NativeSelect>
          <Button
            size="sm"
            disabled={busy || !expenseId}
            onClick={() =>
              act(() =>
                matchTransactionAction({ transactionId: txn.id, expenseId })
              )
            }
          >
            Match
          </Button>
        </>
      ) : (
        <span className="text-text-tertiary text-xs">
          No candidate expenses — nudge the employee to file it.
        </span>
      )}
    </li>
  );
}

export function UnmatchButton({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await unmatchTransactionAction({ transactionId });
          router.refresh();
        })
      }
    >
      Unmatch
    </Button>
  );
}
