"use client";

// Confirmations for the two reconciliation actions that are hard to take back
// (D4.2).
//
// ── UNMATCH vs LOCK ───────────────────────────────────────────────────────
// Unmatch is reversible — you can match it again — so it gets a plain
// confirmation that says what will happen, and its button is secondary.
//
// Lock is not. It is the one destructive control on the screen, so it gets
// the danger treatment and, more importantly, an ENUMERATED list of what
// becomes read-only. "Are you sure?" is not informed consent; a reader who
// has to guess what a lock covers will either avoid the feature entirely or
// discover its scope by being blocked by it later.
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function UnmatchDialog({
  open,
  onOpenChange,
  onConfirm,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Undo this match?</DialogTitle>
          <DialogDescription>
            The statement line goes back to “Not in app” and the payment
            becomes available to match again. The payment itself is not
            changed, and no money moves.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Keep the match
          </Button>
          <Button variant="secondary" onClick={onConfirm} disabled={pending}>
            {pending ? "Undoing…" : "Undo match"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LockDialog({
  open,
  onOpenChange,
  onConfirm,
  periodLabel,
  matchedCount,
  openCount,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  periodLabel: string;
  matchedCount: number;
  openCount: number;
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              aria-hidden="true"
              className="text-status-danger-text size-5 shrink-0"
            />
            Lock {periodLabel}?
          </DialogTitle>
          <DialogDescription>
            Locking freezes this reconciliation so it can be relied on as a
            record. It cannot be undone from this screen.
          </DialogDescription>
        </DialogHeader>

        {/* The enumeration. Exactly what becomes read-only, and — just as
            important — what does NOT, because a reader deciding whether to
            lock needs to know the lock won't stop them paying anyone. */}
        <div className="grid gap-3">
          <div className="border-status-danger-subtle bg-status-danger-subtle grid gap-2 rounded-lg border p-3">
            <span className="text-label text-status-danger-text">
              After locking you cannot:
            </span>
            <ul className="text-meta text-status-danger-text grid gap-1">
              <li>
                • change or undo any of the {matchedCount} matched{" "}
                {matchedCount === 1 ? "line" : "lines"}
              </li>
              <li>
                • match the {openCount} unexplained{" "}
                {openCount === 1 ? "line" : "lines"} still open
              </li>
              <li>• record a payment from a line in this statement</li>
            </ul>
          </div>

          <div className="border-line grid gap-2 rounded-lg border p-3">
            <span className="text-label text-text-secondary">
              Still possible:
            </span>
            <ul className="text-meta text-text-secondary grid gap-1">
              <li>• recording payments and payment runs as normal</li>
              <li>• importing a new statement for another period</li>
              <li>• reading this statement, and exporting the ledger</li>
            </ul>
          </div>

          {openCount > 0 ? (
            <p className="text-meta text-status-warning-text">
              {openCount} unexplained{" "}
              {openCount === 1 ? "line stays" : "lines stay"} unexplained
              permanently. Worth a last look before locking.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Not yet
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Locking…" : "Lock this period"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
