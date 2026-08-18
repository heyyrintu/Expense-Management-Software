"use client";

// Finance-side controls: assign to an eligible handler and drive the status
// machine. The assignee list is already filtered server-side (the disputed
// approver is never in it) and the action re-checks the same rule.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ComplaintAction } from "@/lib/domain/complaint";
import { assignComplaintAction, transitionComplaintAction } from "../actions";

export type HandlerPanelProps = {
  complaintId: string;
  assignedToId: string | null;
  assignees: Array<{ id: string; name: string; role: string }>;
  actions: ComplaintAction[];
  excludedCount: number;
};

const ACTION_LABELS: Record<ComplaintAction, string> = {
  start_review: "Start review",
  resolve: "Resolve",
  wont_fix: "Won't fix",
};

export function HandlerPanel({
  complaintId,
  assignedToId,
  assignees,
  actions,
  excludedCount,
}: HandlerPanelProps) {
  const router = useRouter();
  const [assignee, setAssignee] = React.useState(assignedToId ?? "");
  const [closing, setClosing] = React.useState<ComplaintAction | null>(null);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setClosing(null);
        setNote("");
        router.refresh();
      }
    });
  }

  function assign() {
    if (!assignee) return;
    const form = new FormData();
    form.set("complaintId", complaintId);
    form.set("assigneeId", assignee);
    run(() => assignComplaintAction(form));
  }

  function transition(action: ComplaintAction, resolutionNote?: string) {
    const form = new FormData();
    form.set("complaintId", complaintId);
    form.set("action", action);
    if (resolutionNote) form.set("resolutionNote", resolutionNote);
    run(() => transitionComplaintAction(form));
  }

  return (
    <div className="grid gap-4 rounded-lg border p-4">
      <div className="grid gap-2">
        <label htmlFor="assignee" className="text-sm font-medium">
          Assigned to
        </label>
        <div className="flex flex-wrap gap-2">
          <NativeSelect
            id="assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="max-w-xs"
          >
            <option value="">Unassigned</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.role.replace("_", " ")})
              </option>
            ))}
          </NativeSelect>
          <Button size="sm" onClick={assign} disabled={pending || !assignee}>
            Assign
          </Button>
        </div>
        {excludedCount > 0 ? (
          <p className="text-muted-foreground text-xs">
            {excludedCount} {excludedCount === 1 ? "approver is" : "approvers are"} hidden
            from this list — their decision is what&apos;s being disputed.
          </p>
        ) : null}
        {assignees.length === 0 ? (
          <p className="text-xs text-amber-700">
            Nobody in the finance pool is eligible to handle this complaint.
          </p>
        ) : null}
      </div>

      {actions.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Next step</p>
          <div className="flex flex-wrap gap-2">
            {actions.map((a) =>
              a === "start_review" ? (
                <Button
                  key={a}
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => transition(a)}
                >
                  {ACTION_LABELS[a]}
                </Button>
              ) : (
                <Button
                  key={a}
                  size="sm"
                  variant={a === "resolve" ? "default" : "outline"}
                  disabled={pending}
                  onClick={() => setClosing(closing === a ? null : a)}
                >
                  {ACTION_LABELS[a]}
                </Button>
              )
            )}
          </div>
          {closing ? (
            <div className="grid gap-2">
              <label htmlFor="resolution" className="text-sm font-medium">
                Resolution note (required)
              </label>
              <Textarea
                id="resolution"
                rows={3}
                value={note}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What did you find, and what happens next?"
              />
              <div>
                <Button
                  size="sm"
                  disabled={pending || note.trim().length === 0}
                  onClick={() => transition(closing, note.trim())}
                >
                  {pending ? "Saving…" : `Confirm ${ACTION_LABELS[closing].toLowerCase()}`}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
