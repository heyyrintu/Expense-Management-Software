"use client";

// WhatsApp number linking (D4.4, PLAN 8.1) — the OTP flow as four visible
// states rather than three interacting booleans.
//
// Every state below comes from `lib/domain/whatsapp-link.ts`, which is a
// tested transition table. The panel renders the state and dispatches events;
// it decides nothing. That is what keeps "sending" and "linked" from ever
// being true at once, and what makes the awkward case correct: a wrong CODE
// returns to `code_sent`, not to `idle`, so a typo in six digits doesn't cost
// the reader the number they already entered.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDestructiveDialog } from "@/components/ui/confirm-destructive-dialog";
import { Input } from "@/components/ui/input";
import {
  initialLinkState,
  isBusy,
  linkStateHint,
  nextLinkState,
  type WhatsAppLinkEvent,
  type WhatsAppLinkState,
} from "@/lib/domain/whatsapp-link";
import { cn } from "@/lib/utils";
import {
  confirmWhatsAppLinkAction,
  setWhatsAppOptOutAction,
  startWhatsAppLinkAction,
  unlinkWhatsAppAction,
} from "./whatsapp-actions";

export type WhatsAppPanelProps = {
  status: "none" | "pending" | "linked";
  phone: string | null;
  optedOut?: boolean;
};

export function WhatsAppPanel({ status, phone, optedOut = false }: WhatsAppPanelProps) {
  const router = useRouter();
  const [state, setState] = React.useState<WhatsAppLinkState>(() =>
    initialLinkState({ status, phone })
  );
  const [error, setError] = React.useState<string | null>(null);
  const [unlinkOpen, setUnlinkOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();

  const dispatch = React.useCallback((event: WhatsAppLinkEvent) => {
    setState((current) => nextLinkState(current, event));
  }, []);

  const busy = isBusy(state);

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    onOk: WhatsAppLinkEvent,
    successMessage?: string
  ) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "That didn't work.");
        dispatch({ type: "failed" });
        return;
      }
      dispatch(onOk);
      if (successMessage) toast.success(successMessage);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <StepIndicator state={state} />

      {state.kind === "linked" ? (
        <div className="grid gap-4">
          <p className="text-body text-text-secondary">{linkStateHint(state)}</p>

          <label className="flex items-start gap-3">
            <Checkbox
              checked={!optedOut}
              disabled={busy}
              onCheckedChange={(checked) => {
                const form = new FormData();
                form.set("optedOut", checked === true ? "false" : "true");
                run(() => setWhatsAppOptOutAction(form), { type: "verified" });
              }}
            />
            <span className="grid gap-0.5">
              <span className="text-body text-text-primary">
                Send me updates on WhatsApp
              </span>
              <span className="text-meta text-text-tertiary">
                Approvals, payments and complaint updates. Turn this off and
                you still get them by email and in the app.
              </span>
            </span>
          </label>

          <div>
            <Button variant="secondary" onClick={() => setUnlinkOpen(true)}>
              Unlink this number
            </Button>
          </div>
        </div>
      ) : state.kind === "code_sent" || state.kind === "verifying" ? (
        <form
          className="grid gap-3"
          action={(formData) => {
            dispatch({ type: "submit_code" });
            run(
              () => confirmWhatsAppLinkAction(formData),
              { type: "verified" },
              "Number verified."
            );
          }}
        >
          <label className="grid gap-1">
            <span className="text-label text-text-primary">
              Enter the 6-digit code
            </span>
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              disabled={busy}
              className="w-40 tracking-widest tabular"
            />
            <span className="text-meta text-text-tertiary">
              {linkStateHint(state)}
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {state.kind === "verifying" ? "Checking…" : "Verify"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setError(null);
                dispatch({ type: "change_number" });
              }}
            >
              Use a different number
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="grid gap-3"
          action={(formData) => {
            dispatch({
              type: "submit_number",
              phone: String(formData.get("phone") ?? ""),
            });
            run(() => startWhatsAppLinkAction(formData), { type: "code_sent" });
          }}
        >
          <label className="grid gap-1">
            <span className="text-label text-text-primary">WhatsApp number</span>
            <Input
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              defaultValue={phone ?? ""}
              disabled={busy}
              className="max-w-xs"
            />
            <span className="text-meta text-text-tertiary">
              {linkStateHint(state)}
            </span>
          </label>
          <div>
            <Button type="submit" disabled={busy}>
              {state.kind === "sending" ? "Sending…" : "Send code"}
            </Button>
          </div>
        </form>
      )}

      {error ? (
        <p
          role="alert"
          className="border-status-danger-subtle bg-status-danger-subtle text-status-danger-text rounded-md border p-3 text-body"
        >
          {error}
        </p>
      ) : null}

      <ConfirmDestructiveDialog
        open={unlinkOpen}
        onOpenChange={setUnlinkOpen}
        entityName={state.kind === "linked" ? state.phone : "this number"}
        verb="Unlink"
        confirmLabel="Unlink number"
        description="Receipts sent from this number will no longer become expenses, and WhatsApp notifications stop."
        consequences={[
          "receipts sent over WhatsApp are ignored",
          "approval and payment updates stop arriving there",
        ]}
        preserved={[
          "every expense already created from WhatsApp",
          "email and in-app notifications, which continue as normal",
        ]}
        onConfirm={() =>
          run(() => unlinkWhatsAppAction(), { type: "unlinked" }, "Number unlinked.")
        }
      />
    </div>
  );
}

/**
 * The three steps, with the current one named.
 *
 * A progress rail rather than a spinner because the reader's real question
 * during an OTP flow is "is it me or is it stuck?" — and the answer is
 * usually "the code is on its way, check your phone", which a spinner cannot
 * say.
 */
function StepIndicator({ state }: { state: WhatsAppLinkState }) {
  const index =
    state.kind === "idle" || state.kind === "sending"
      ? 0
      : state.kind === "linked"
        ? 2
        : 1;

  const steps = ["Your number", "Verify", "Linked"];

  return (
    <ol className="flex items-center gap-2" aria-label="Linking progress">
      {steps.map((label, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-meta tabular",
                done && "bg-status-success text-text-inverse",
                active && "bg-accent text-text-inverse",
                !done && !active && "bg-bg-subtle text-text-tertiary"
              )}
            >
              {done || (active && state.kind === "linked") ? (
                <Check aria-hidden="true" className="size-3.5" />
              ) : isBusy(state) && active ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                "text-label truncate",
                active ? "text-text-primary" : "text-text-tertiary"
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 ? (
              <span aria-hidden="true" className="bg-line h-px flex-1" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
