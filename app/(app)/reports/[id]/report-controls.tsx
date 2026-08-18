"use client";

// Submit / withdraw / delete + attach/detach buttons for a report.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { ReportStatus } from "@/lib/domain/report-workflow";
import {
  addExpenseToReportAction,
  deleteReportAction,
  removeExpenseFromReportAction,
  submitReportAction,
  withdrawReportAction,
} from "../actions";

function useAct() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  function act(fn: () => Promise<{ ok: boolean; error?: string }>, after?: string) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
      } else if (after) {
        router.push(after);
        router.refresh();
      } else {
        router.refresh();
      }
    });
  }
  return { error, pending, act };
}

export function ReportControls({
  reportId,
  status,
  expenseCount,
}: {
  reportId: string;
  status: ReportStatus;
  expenseCount: number;
}) {
  const { error, pending, act } = useAct();

  return (
    <div className="grid justify-items-end gap-1">
      <div className="flex gap-2">
        {status === "draft" || status === "sent_back" ? (
          <Button
            disabled={pending || expenseCount === 0}
            onClick={() => act(() => submitReportAction({ id: reportId }))}
          >
            {pending ? "Working…" : status === "sent_back" ? "Resubmit" : "Submit for approval"}
          </Button>
        ) : null}
        {status === "submitted" ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => act(() => withdrawReportAction({ id: reportId }))}
          >
            {pending ? "Working…" : "Withdraw"}
          </Button>
        ) : null}
        {status === "draft" ? (
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => act(() => deleteReportAction({ id: reportId }), "/reports")}
          >
            Delete
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AddButton({ reportId, expenseId }: { reportId: string; expenseId: string }) {
  const { error, pending, act } = useAct();
  return (
    <span className="grid justify-items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => act(() => addExpenseToReportAction({ reportId, expenseId }))}
      >
        Add
      </Button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </span>
  );
}

function RemoveButton({ reportId, expenseId }: { reportId: string; expenseId: string }) {
  const { error, pending, act } = useAct();
  return (
    <span className="grid justify-items-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        className="text-destructive"
        onClick={() => act(() => removeExpenseFromReportAction({ reportId, expenseId }))}
      >
        Remove
      </Button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </span>
  );
}

ReportControls.AddButton = AddButton;
ReportControls.RemoveButton = RemoveButton;
