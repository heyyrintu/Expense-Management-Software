"use client";

// Finance-side controls (D4.3): assign an eligible handler, drive the status
// machine, and close with a mandatory resolution note.
//
// The assignee list is filtered SERVER-side — the disputed approver and the
// complainant are never in it — and the action re-checks the same rule. This
// panel only presents what it was handed.
//
// Closing moves into a dialog (§7.7: "Resolve opens a dialog demanding a
// resolution note"). It was an inline textarea that appeared under the
// buttons, which is the wrong shape for the action: closing a dispute is the
// decision the whole screen exists for, it is one-way, and the note becomes
// the answer the employee reads. A dialog takes the focus and makes writing
// it the only thing on screen.
import * as React from "react";
import { useRouter } from "next/navigation";
import { notify, toast } from "@/components/ui/toaster";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/** What each closing action tells the employee, in the dialog. */
const CLOSING_COPY: Record<"resolve" | "wont_fix", { title: string; description: string; placeholder: string }> = {
  resolve: {
    title: "Resolve this complaint",
    description:
      "Your note is what the employee reads as the answer, and it is kept with the complaint permanently.",
    placeholder: "What you found, and what happens next — ₹1,300 short-paid on 14 Aug, topping up in Friday's run.",
  },
  wont_fix: {
    title: "Close without changing anything",
    description:
      "Say why no action is being taken. This is the explanation the employee gets, so it needs to stand on its own.",
    placeholder: "The ₹450 difference is the per-diem cap in the travel policy, applied correctly here.",
  },
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
  const [closing, setClosing] = React.useState<"resolve" | "wont_fix" | null>(null);
  const [note, setNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  // Each opening starts clean — carrying a previous note over is a very easy
  // way to send someone the wrong explanation.
  React.useEffect(() => {
    if (closing) setNote("");
  }, [closing]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        notify.failed(res.error);
        return;
      }
      toast.success(success);
      setClosing(null);
      setNote("");
      router.refresh();
    });
  }

  function transition(action: ComplaintAction, resolutionNote?: string) {
    const form = new FormData();
    form.set("complaintId", complaintId);
    form.set("action", action);
    if (resolutionNote) form.set("resolutionNote", resolutionNote);
    run(
      () => transitionComplaintAction(form),
      action === "start_review" ? "Review started." : "Complaint closed."
    );
  }

  const noteReady = note.trim().length > 0;

  return (
    <section className="border-line bg-bg-surface grid gap-4 rounded-lg border p-5">
      <div className="grid gap-2">
        <label className="grid gap-1">
          <span className="text-label text-text-primary">Assigned to</span>
          <span className="flex flex-wrap gap-2">
            <NativeSelect
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="min-w-48 flex-1"
            >
              <option value="">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.role.replace("_", " ")})
                </option>
              ))}
            </NativeSelect>
            <Button
              variant="secondary"
              disabled={pending || !assignee || assignee === assignedToId}
              onClick={() => {
                const form = new FormData();
                form.set("complaintId", complaintId);
                form.set("assigneeId", assignee);
                run(() => assignComplaintAction(form), "Assigned.");
              }}
            >
              Assign
            </Button>
          </span>
        </label>

        {excludedCount > 0 ? (
          <p className="text-meta text-text-tertiary">
            {excludedCount} {excludedCount === 1 ? "approver is" : "approvers are"}{" "}
            hidden from this list — their decision is what&apos;s being disputed.
          </p>
        ) : null}
        {assignees.length === 0 ? (
          <p className="text-meta text-status-warning-text">
            Nobody in the finance pool is eligible to handle this complaint.
          </p>
        ) : null}
      </div>

      {actions.length > 0 ? (
        <div className="border-line grid gap-2 border-t pt-4">
          <span className="text-label text-text-primary">Next step</span>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) =>
              action === "start_review" ? (
                <Button
                  key={action}
                  variant="secondary"
                  disabled={pending}
                  onClick={() => transition(action)}
                >
                  {ACTION_LABELS[action]}
                </Button>
              ) : (
                <Button
                  key={action}
                  // Resolve is the screen's single primary action; won't-fix
                  // is a legitimate outcome but not the one to encourage.
                  variant={action === "resolve" ? "primary" : "secondary"}
                  disabled={pending}
                  onClick={() => setClosing(action as "resolve" | "wont_fix")}
                >
                  {ACTION_LABELS[action]}
                </Button>
              )
            )}
          </div>
        </div>
      ) : null}

      <Dialog
        open={closing !== null}
        onOpenChange={(open) => {
          if (pending) return;
          if (!open) setClosing(null);
        }}
      >
        <DialogContent>
          {closing ? (
            <>
              <DialogHeader>
                <DialogTitle>{CLOSING_COPY[closing].title}</DialogTitle>
                <DialogDescription>
                  {CLOSING_COPY[closing].description}
                </DialogDescription>
              </DialogHeader>

              <label className="grid gap-1">
                <span className="text-label text-text-primary">
                  Resolution note
                </span>
                <Textarea
                  rows={4}
                  value={note}
                  maxLength={2000}
                  autoFocus
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={CLOSING_COPY[closing].placeholder}
                />
              </label>

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setClosing(null)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  // Disabled until there is a note — the requirement is the
                  // point of the dialog, and the server enforces it too.
                  disabled={!noteReady || pending}
                  onClick={() => transition(closing, note.trim())}
                >
                  {pending
                    ? "Saving…"
                    : `Confirm ${ACTION_LABELS[closing].toLowerCase()}`}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
