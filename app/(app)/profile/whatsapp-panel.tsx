"use client";

// WhatsApp number linking panel (8.1). Two steps — enter number, then the
// 6-digit code that arrives over WhatsApp.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [step, setStep] = React.useState<"number" | "code">(
    status === "pending" ? "code" : "number"
  );
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    onDone?: () => void
  ) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        onDone?.();
        router.refresh();
      }
    });
  }

  if (status === "linked" && phone) {
    return (
      <div className="grid gap-3 text-sm">
        <p>
          <span className="text-muted-foreground">Linked number:</span> {phone}{" "}
          <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-800">
            Verified
          </span>
        </p>
        <p className="text-muted-foreground">
          Send a receipt photo to our WhatsApp number and it becomes a draft expense.
        </p>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={!optedOut}
            disabled={pending}
            onChange={(e) => {
              const form = new FormData();
              form.set("optedOut", e.target.checked ? "false" : "true");
              run(() => setWhatsAppOptOutAction(form));
            }}
          />
          <span>
            Send me updates on WhatsApp
            <span className="text-muted-foreground block text-xs">
              Approvals, payments and complaint updates. Turn this off and you&apos;ll
              still get them by email and in the app.
            </span>
          </span>
        </label>
        {error ? (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        ) : null}
        <div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => unlinkWhatsAppAction())}
          >
            {pending ? "Working…" : "Unlink this number"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 text-sm">
      {step === "number" ? (
        <form
          className="grid gap-2"
          action={(formData) =>
            run(() => startWhatsAppLinkAction(formData), () => {
              setStep("code");
              setNotice("We sent a 6-digit code to that number on WhatsApp.");
            })
          }
        >
          <label htmlFor="wa-phone" className="font-medium">
            WhatsApp number
          </label>
          <Input
            id="wa-phone"
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            defaultValue={phone ?? ""}
            className="max-w-xs"
          />
          <p className="text-muted-foreground text-xs">
            Indian numbers can be entered without the country code.
          </p>
          <div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Sending…" : "Send code"}
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="grid gap-2"
          action={(formData) =>
            run(() => confirmWhatsAppLinkAction(formData), () =>
              setNotice("Number verified.")
            )
          }
        >
          <label htmlFor="wa-code" className="font-medium">
            Enter the 6-digit code
          </label>
          <Input
            id="wa-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            className="max-w-[10rem] tracking-widest"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Checking…" : "Verify"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setStep("number");
                setError(null);
                setNotice(null);
              }}
            >
              Use a different number
            </Button>
          </div>
        </form>
      )}

      {notice ? <p className="text-muted-foreground">{notice}</p> : null}
      {error ? (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
