"use client";

// Submit / withdraw / delete + attach/detach buttons for a report.
//
// D2.3 puts a confirmation between the reader and submission (§7.2: never be
// surprised by what was submitted). The preview is computed on the SERVER and
// passed in, so the approver it names is the one resolveChain will actually
// notify, not a second guess made in the browser.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { ReportStatus } from "@/lib/domain/report-workflow";
import { SubmitDialog, type SubmitPreview } from "./submit-dialog";
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
  preview,
}: {
  reportId: string;
  status: ReportStatus;
  expenseCount: number;
  preview: SubmitPreview;
}) {
  const { error, pending, act } = useAct();
  const [confirming, setConfirming] = React.useState(false);
  const submittable = status === "draft" || status === "sent_back";

  return (
    <div className="grid justify-items-end gap-1">
      <div className="flex gap-2">
        {submittable ? (
          <Button
            disabled={pending || expenseCount === 0}
            onClick={() => setConfirming(true)}
          >
            {status === "sent_back" ? "Resubmit" : "Submit for approval"}
          </Button>
        ) : null}
        {status === "submitted" ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => act(() => withdrawReportAction({ id: reportId }))}
          >
            {pending ? "Working…" : "Withdraw"}
          </Button>
        ) : null}
        {status === "draft" ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => act(() => deleteReportAction({ id: reportId }), "/reports")}
          >
            Delete
          </Button>
        ) : null}
      </div>

      {submittable ? (
        <SubmitDialog
          open={confirming}
          onOpenChange={setConfirming}
          preview={preview}
          pending={pending}
          resubmit={status === "sent_back"}
          onConfirm={() => {
            setConfirming(false);
            act(() => submitReportAction({ id: reportId }));
          }}
        />
      ) : null}
      {error ? (
        <p role="alert" className="text-status-danger-text text-body">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AddButton({ reportId, expenseId }: { reportId: string; expenseId: string }) {
  const { error, pending, act } = useAct();
  return (
    <span className="grid justify-items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => act(() => addExpenseToReportAction({ reportId, expenseId }))}
      >
        Add
      </Button>
      {error ? <span className="text-status-danger-text text-meta">{error}</span> : null}
    </span>
  );
}

export function RemoveButton({ reportId, expenseId }: { reportId: string; expenseId: string }) {
  const { error, pending, act } = useAct();
  return (
    <span className="grid justify-items-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => act(() => removeExpenseFromReportAction({ reportId, expenseId }))}
      >
        Remove
      </Button>
      {error ? <span className="text-status-danger-text text-meta">{error}</span> : null}
    </span>
  );
}

// NOT compound components. `ReportControls.AddButton = AddButton` looks
// tidier, but this module is "use client" and the report page is a SERVER
// component: Next replaces a client module's exports with client-reference
// proxies, and a static property hung off a function does not survive that
// boundary. `ReportControls.AddButton` arrived as undefined and React threw
//   "Element type is invalid ... got: undefined"
// which took down the whole report detail screen. Named exports cross the
// boundary; properties do not.
