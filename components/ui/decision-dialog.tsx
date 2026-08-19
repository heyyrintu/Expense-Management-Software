"use client";

// Reject / Send back dialog (D3.1) — DESIGN-PRD §7.3.
//
// A reason is MANDATORY, and the submit button stays disabled until there is
// one. That is not a validation nicety: rejecting someone's expense claim
// without saying why is how a finance tool becomes a grievance, and the
// reason is what the employee reads first when the report comes back.
//
// The rule already exists in decisionSchema, which refuses a reject or a
// send-back with an empty reason. This mirrors it in the UI so the reader
// finds out before they commit, rather than after a round-trip.
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export type DecisionKind = "reject" | "send_back";

const COPY: Record<
  DecisionKind,
  { title: string; description: string; label: string; placeholder: string; confirm: string }
> = {
  reject: {
    title: "Reject this report?",
    description:
      "The report closes and the expenses unlock. Your reason is the first thing the employee reads.",
    label: "Why are you rejecting it?",
    placeholder: "The client dinner on 12 Aug isn't billable to this project.",
    confirm: "Reject",
  },
  send_back: {
    title: "Send this back?",
    description:
      "The report returns to the employee to fix and resubmit. Say what needs changing.",
    label: "What needs changing?",
    placeholder: "Please attach the hotel invoice — the card slip isn't enough for finance.",
    confirm: "Send back",
  },
};

export function DecisionDialog({
  kind,
  reportTitle,
  open,
  onOpenChange,
  onConfirm,
  pending = false,
}: {
  kind: DecisionKind | null;
  reportTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  pending?: boolean;
}) {
  const [reason, setReason] = React.useState("");

  // Each opening starts clean. Carrying the previous report's reason over
  // would be a very easy way to send someone the wrong explanation.
  React.useEffect(() => {
    if (open) setReason("");
  }, [open, kind]);

  if (!kind) return null;
  const copy = COPY[kind];
  const ready = reason.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <label htmlFor="decision-reason" className="text-label text-text-secondary">
            {copy.label}
          </label>
          <Textarea
            id="decision-reason"
            autoFocus
            rows={4}
            value={reason}
            placeholder={copy.placeholder}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby="decision-reason-hint"
          />
          <p id="decision-reason-hint" className="text-meta text-text-tertiary">
            {/* Says what the button is waiting for, rather than leaving a
                disabled control to be puzzled over. */}
            {ready
              ? `${reportTitle} — this goes back with your note.`
              : "A reason is required."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={kind === "reject" ? "destructive" : "primary"}
            disabled={!ready}
            loading={pending}
            onClick={() => onConfirm(reason.trim())}
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
