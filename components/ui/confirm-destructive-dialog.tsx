"use client";

// Destructive confirmation (D4.4).
//
// Three rules, and each one exists because of a specific way these dialogs go
// wrong.
//
//  1. NAME THE ENTITY. "Deactivate this user?" is a question about an
//     abstraction; "Deactivate Priya Raman?" is a question about a person. A
//     reader who opened the wrong row's menu finds out here, which is the
//     last moment it is free.
//
//  2. THE CONFIRM BUTTON IS NEVER THE DEFAULT FOCUS. Radix focuses the first
//     tabbable element in the content; Cancel is placed to receive it, and
//     the confirm button explicitly opts out of autofocus. Enter on an
//     unread dialog must not destroy anything.
//
//  3. SAY WHAT SURVIVES. Deactivating a user does not delete their expenses,
//     and a reader who fears it does will avoid the feature and leave stale
//     accounts active instead. `consequences` carries what changes;
//     `preserved` carries what doesn't.
import * as React from "react";
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

export function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  onConfirm,
  /** The exact thing being acted on — a person's name, a category name. */
  entityName,
  /** "Deactivate", "Delete" — used in the title and on the button. */
  verb,
  description,
  consequences,
  preserved,
  confirmLabel,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  entityName: string;
  verb: string;
  description: string;
  consequences?: string[];
  preserved?: string[];
  confirmLabel?: string;
  pending?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Never dismiss mid-flight: the request is already away.
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              aria-hidden="true"
              className="text-status-danger-text size-5 shrink-0"
            />
            {/* The name, in the question. */}
            {verb} {entityName}?
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {consequences && consequences.length > 0 ? (
          <div className="border-status-danger-subtle bg-status-danger-subtle grid gap-2 rounded-lg border p-3">
            <span className="text-label text-status-danger-text">
              What changes
            </span>
            <ul className="text-meta text-status-danger-text grid gap-1">
              {consequences.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {preserved && preserved.length > 0 ? (
          <div className="border-line grid gap-2 rounded-lg border p-3">
            <span className="text-label text-text-secondary">
              What stays the same
            </span>
            <ul className="text-meta text-text-secondary grid gap-1">
              {preserved.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter>
          {/* FIRST in the DOM, so it takes the dialog's initial focus. */}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
            // Belt and braces: even if the footer's order ever changes, this
            // button will not take autofocus.
            autoFocus={false}
          >
            {pending ? `${verb}…` : (confirmLabel ?? `${verb} ${entityName}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
