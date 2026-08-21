"use client";

// Batch payment run (D3.2) — two steps, and the second one exists to be read.
//
// MONEY MOVEMENT IS NEVER OPTIMISTIC (§4.5). Nothing here pretends. The
// commit button shows a real pending state, the sheet stays open until the
// server answers, and the result — including a partial failure — is reported
// exactly as it happened. An approval can be undone in five seconds; a
// payment cannot be un-sent.
//
// Same POST /api/reimbursements, same multipart payload as before. Only the
// flow around it changed.
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleAlert } from "lucide-react";

import { toDecimalString } from "@/lib/money";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { notify } from "@/components/ui/toaster";
import { summariseBatch, type BatchLineInput } from "@/lib/domain/payment-batch";
import { PAYMENT_METHODS } from "@/lib/domain/reimbursement";
import { RECEIPT_MAX_BYTES, validateReceiptFile } from "@/lib/schemas/receipt";
import { cn } from "@/lib/utils";

export type PayableItem = {
  id: string;
  title: string;
  ownerName: string;
  balance: number;
  total: number;
  paid: number;
  hasBankDetails: boolean;
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  upi: "UPI",
  cash: "Cash",
  payroll: "Payroll",
};

export function PaymentRunSheet({
  open,
  onOpenChange,
  items,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PayableItem[];
  currency: string;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [method, setMethod] = React.useState<string>("bank_transfer");
  const [paidAt, setPaidAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [offsetAdvances, setOffsetAdvances] = React.useState(false);
  const [references, setReferences] = React.useState<Record<string, string>>({});
  const [amounts, setAmounts] = React.useState<Record<string, string>>({});
  const [proof, setProof] = React.useState<File | null>(null);
  const [proofError, setProofError] = React.useState<string | null>(null);
  const [committing, setCommitting] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  // Every opening starts at step one with nothing carried over: a stale
  // reference from a previous run is a wrong UTR on a real payment.
  React.useEffect(() => {
    if (!open) return;
    setStep(1);
    setReferences({});
    setAmounts({});
    setProof(null);
    setProofError(null);
    setFailure(null);
  }, [open]);

  const inputs: BatchLineInput[] = items.map((item) => ({
    reportId: item.id,
    title: item.title,
    ownerName: item.ownerName,
    balance: item.balance,
    reference: references[item.id] ?? "",
    amountText: amounts[item.id],
    hasBankDetails: item.hasBankDetails,
  }));
  const summary = summariseBatch(inputs);

  function chooseProof(file: File | null) {
    setProofError(null);
    if (!file) {
      setProof(null);
      return;
    }
    // Same pure validator the route uses, so the browser and the server can't
    // disagree about a file.
    const problem = validateReceiptFile({ name: file.name, type: file.type, size: file.size });
    if (problem) {
      setProofError(problem);
      setProof(null);
      return;
    }
    setProof(file);
  }

  async function commit() {
    setCommitting(true);
    setFailure(null);
    try {
      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({
          paidAt,
          method,
          offsetAdvances,
          reports: summary.lines.map((line) => ({
            reportId: line.reportId,
            reference: line.reference.trim(),
            // Omitted means "the full outstanding balance" to the route, so
            // only a genuinely partial line sends an amount.
            // D5.5: toDecimalString, not float division. `amount / 100` on
            // integer minor units is exactly the arithmetic CLAUDE.md bans
            // — 1_234_567 / 100 is not representable and .toFixed rounds it.
            ...(line.partial ? { amountPaid: toDecimalString(line.amount) } : {}),
          })),
        })
      );
      if (proof) form.set("proof", proof);

      const res = await fetch("/api/reimbursements", { method: "POST", body: form });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { paid: number; failed: Array<{ reportId: string; error?: string }> };
      };

      if (!json.ok || !json.data) {
        setFailure(json.error ?? "The payment run didn't go through.");
        return;
      }

      const { paid, failed } = json.data;
      if (failed.length > 0) {
        // A partial batch is the case that must never be rounded off. Say
        // what landed and what didn't, and keep the sheet open.
        setFailure(
          `${paid} payment${paid === 1 ? "" : "s"} recorded, ${failed.length} failed — ${
            failed[0]?.error ?? "reason unknown"
          }`
        );
        router.refresh();
        return;
      }

      notify.success(
        `Recorded ${paid} payment${paid === 1 ? "" : "s"}`,
        `${METHOD_LABELS[method] ?? method} · ${paidAt}`
      );
      onOpenChange(false);
      router.refresh();
    } catch {
      setFailure("The payment run didn't go through. Nothing was recorded.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !committing && onOpenChange(next)}>
      <SheetContent side="right" className="md:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {step === 1 ? "Payment details" : "Review before paying"}
          </SheetTitle>
          <SheetDescription>
            {step === 1
              ? "Set the method and date, then a reference for each report."
              : "This is what will be recorded. Money movement can't be undone."}
          </SheetDescription>
        </SheetHeader>

        {/* A two-dot stepper rather than a progress bar: two steps don't need
            a percentage, they need to say which one you're on. */}
        <ol className="mb-4 flex items-center gap-2" aria-label="Payment run steps">
          {([1, 2] as const).map((n) => (
            <li key={n} className="flex items-center gap-2">
              <span
                aria-current={step === n ? "step" : undefined}
                className={cn(
                  "text-meta rounded-sm px-2 py-1",
                  step === n
                    ? "bg-accent-subtle text-accent-text"
                    : "text-text-tertiary"
                )}
              >
                {n === 1 ? "1 Details" : "2 Review"}
              </span>
            </li>
          ))}
        </ol>

        {step === 1 ? (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-label text-text-secondary">Method</span>
                <NativeSelect value={method} onChange={(e) => setMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABELS[m] ?? m}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="grid gap-1">
                <span className="text-label text-text-secondary">Paid on</span>
                <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </label>
            </div>

            <div className="grid gap-2">
              <span className="text-label text-text-secondary">
                Reference / UTR per report
              </span>
              <ul className="border-line divide-line grid divide-y rounded-lg border">
                {items.map((item) => {
                  const line = summary.lines.find((l) => l.reportId === item.id);
                  return (
                    <li key={item.id} className="grid gap-2 p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="grid min-w-0">
                          <span className="text-body text-text-primary truncate">
                            {item.title}
                          </span>
                          <span className="text-meta text-text-tertiary">
                            {item.ownerName}
                            {!item.hasBankDetails ? " · no bank details on file" : ""}
                          </span>
                        </span>
                        <Amount value={item.balance} currency={currency} align="right" />
                      </div>
                      {/* Flex rather than a grid template: the amount field
                          takes a fixed w-40 and the reference takes the rest,
                          without an arbitrary column size. */}
                      <div className="flex flex-wrap gap-2">
                        <Input
                          aria-label={`Reference for ${item.title}`}
                          placeholder="UTR / cheque no."
                          className="min-w-40 flex-1"
                          value={references[item.id] ?? ""}
                          onChange={(e) =>
                            setReferences((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                        />
                        <Input
                          aria-label={`Amount for ${item.title} — leave blank to pay the balance`}
                          inputMode="decimal"
                          placeholder="Full balance"
                          className="w-40"
                          value={amounts[item.id] ?? ""}
                          onChange={(e) =>
                            setAmounts((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                        />
                      </div>
                      {line?.problem ? (
                        <p className="text-meta text-status-danger-text">{line.problem}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="grid gap-2">
              <span className="text-label text-text-secondary">
                Proof of transfer (optional, one per batch)
              </span>
              <Input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => chooseProof(e.target.files?.[0] ?? null)}
              />
              <p className="text-meta text-text-tertiary">
                {/* The route stores one proof for the whole batch. Per-report
                    proof would be an API change, not a design one. */}
                JPG, PNG or PDF up to {Math.round(RECEIPT_MAX_BYTES / (1024 * 1024))} MB.
                Attached to every payment in this run.
              </p>
              {proofError ? (
                <p className="text-meta text-status-danger-text">{proofError}</p>
              ) : null}
            </div>

            <label className="text-body text-text-secondary flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={offsetAdvances}
                onChange={(e) => setOffsetAdvances(e.target.checked)}
                className="size-4"
              />
              Offset against the employee&apos;s open advances
            </label>
          </div>
        ) : (
          <div className="grid gap-4">
            <ul className="border-line divide-line grid divide-y rounded-lg border">
              {summary.lines.map((line) => (
                <li key={line.reportId} className="grid gap-1 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="grid min-w-0">
                      <span className="text-body text-text-primary truncate">{line.title}</span>
                      <span className="text-meta text-text-tertiary tabular truncate">
                        {line.ownerName} · ref {line.reference}
                      </span>
                    </span>
                    <Amount value={line.amount} currency={currency} align="right" />
                  </div>
                  {line.partial ? (
                    <span className="text-meta text-status-warning-text">
                      Partial — <Amount
                        value={line.remaining}
                        currency={currency}
                        size="meta"
                        className="text-status-warning-text"
                      />{" "}
                      still owed after this
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="border-line bg-bg-subtle flex flex-wrap items-baseline justify-between gap-2 rounded-lg border p-4">
              <span className="text-label text-text-secondary">
                {summary.count} payment{summary.count === 1 ? "" : "s"}
                {summary.partialCount > 0 ? `, ${summary.partialCount} partial` : ""}
              </span>
              {/* The batch total at display size: this is the figure the
                  reader is being asked to authorise. */}
              <Amount value={summary.total} currency={currency} size="display" align="right" />
            </div>

            <dl className="text-meta text-text-secondary grid gap-1">
              <div className="flex justify-between gap-4">
                <dt>Method</dt>
                <dd className="text-text-primary">{METHOD_LABELS[method] ?? method}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Paid on</dt>
                <dd className="text-text-primary tabular">{paidAt}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Proof</dt>
                <dd className="text-text-primary truncate">{proof ? proof.name : "None"}</dd>
              </div>
            </dl>

            {summary.missingBankDetails.length > 0 ? (
              <p className="border-status-warning-subtle bg-status-warning-subtle text-status-warning-text rounded-lg border p-3 text-meta">
                {summary.missingBankDetails.length} recipient
                {summary.missingBankDetails.length === 1 ? " has" : "s have"} no bank
                details on file. That&apos;s fine for cash or payroll — worth a look
                otherwise.
              </p>
            ) : null}

            {failure ? (
              <p
                role="alert"
                className="border-status-danger-subtle bg-status-danger-subtle text-status-danger-text flex items-start gap-2 rounded-lg border p-3 text-meta"
              >
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {failure}
              </p>
            ) : null}
          </div>
        )}

        <SheetFooter>
          {step === 2 ? (
            <Button variant="ghost" onClick={() => setStep(1)} disabled={committing}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back
            </Button>
          ) : null}
          {step === 1 ? (
            <Button disabled={!summary.ready} onClick={() => setStep(2)}>
              Review {summary.count} payment{summary.count === 1 ? "" : "s"}
            </Button>
          ) : (
            <Button loading={committing} onClick={() => void commit()}>
              {/* No optimism: the label says what is about to happen and the
                  button holds a real pending state until the server answers. */}
              {committing ? "Recording…" : "Record payments"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
