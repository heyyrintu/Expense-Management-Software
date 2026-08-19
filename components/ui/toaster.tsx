"use client";

// Toast (§6.1) on Sonner: bottom-right on desktop, top on mobile, 4s
// auto-dismiss, pause on hover, max 3 stacked.
//
// `toast` is re-exported with three project-shaped helpers so call sites
// never hand-style a toast:
//   notify.success / notify.error / notify.undo
//
// The undo variant is the counterpart to optimistic approvals (§4.5): the
// action already happened, and this is the 5-second window to take it back.
// Money movement never uses it.
import { Toaster as SonnerToaster, toast } from "sonner";

import { failureCopy } from "@/lib/errors";
import { DURATION } from "@/lib/motion";

const UNDO_WINDOW_MS = 5000;

function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      mobileOffset={{ top: "16px" }}
      visibleToasts={3}
      duration={4000}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "border-line bg-bg-surface text-text-primary shadow-overlay rounded-lg border p-4 text-body",
          title: "text-body font-medium text-text-primary",
          description: "text-meta text-text-secondary",
          actionButton:
            "rounded-md bg-accent-solid px-3 py-1 text-label text-text-on-accent",
          cancelButton:
            "rounded-md bg-bg-subtle px-3 py-1 text-label text-text-secondary",
          success: "text-status-success-text",
          error: "text-status-danger-text",
        },
      }}
    />
  );
}

export const notify = {
  success(message: string, description?: string) {
    return toast.success(message, { description });
  },
  /**
   * A mutation that didn't land (D5.1).
   *
   * Every failed action goes through here rather than each call site writing
   * its own sentence, so the voice stays consistent and — more importantly —
   * so OFFLINE is distinguished from a server refusal everywhere at once.
   * The reader's first question after a failed save is "did I lose it?", and
   * lib/errors' copy answers that before anything else.
   *
   * `navigator.onLine` is read at the moment of failure, not held in state:
   * a stale flag would tell someone they are offline while they are reading
   * the toast on a working connection.
   */
  failed(serverError?: string | null) {
    const copy = failureCopy({
      serverError,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
    });
    return toast.error(copy.title, {
      description: copy.description || undefined,
      duration: 6000,
    });
  },
  error(message: string, description?: string) {
    // Errors linger: they carry information the user needs to act on.
    return toast.error(message, { description, duration: 6000 });
  },
  /**
   * Optimistic action with a way back. `onUndo` runs if the user takes it;
   * `onCommit` runs when the window closes untouched.
   */
  undo(
    message: string,
    handlers: { onUndo: () => void; onCommit?: () => void; description?: string }
  ) {
    let undone = false;
    return toast(message, {
      description: handlers.description,
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          handlers.onUndo();
        },
      },
      onAutoClose: () => {
        if (!undone) handlers.onCommit?.();
      },
      onDismiss: () => {
        if (!undone) handlers.onCommit?.();
      },
    });
  },
};

export { Toaster, toast, UNDO_WINDOW_MS, DURATION as TOAST_DURATION };
