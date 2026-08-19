"use client";

// PaymentProofViewer (D3.2) — DESIGN-PRD §6.2.
//
// "Lightbox for proof images/PDFs, zoom, download, metadata sidebar (method,
// UTR, date, payer)."
//
// The sidebar is the difference between this and the receipt viewer. A
// receipt is looked at; a payment proof is CHECKED — against a UTR in a bank
// statement, on a date, by a named person. Putting those four facts beside
// the image means the person disputing "I never received this" and the person
// answering can look at the same screen.
import * as React from "react";
import { Download, Minus, Plus } from "lucide-react";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ZOOM_STEPS = [1, 1.5, 2, 3] as const;

export type PaymentProof = {
  id: string;
  /** Signed URL — generated server-side after an org check. */
  url: string | null;
  mimeType: string;
  fileName: string;
  /** Integer minor units. */
  amountPaid: number;
  currency: string;
  method: string;
  reference: string;
  paidAt: Date | string;
  paidByName: string;
  reportTitle: string;
};

export function PaymentProofViewer({
  proof,
  onOpenChange,
}: {
  /** null closes the viewer. */
  proof: PaymentProof | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [zoomIndex, setZoomIndex] = React.useState(0);

  React.useEffect(() => {
    setZoomIndex(0);
  }, [proof?.id]);

  if (!proof) return null;
  const isPdf = proof.mimeType === "application/pdf";
  const zoom = ZOOM_STEPS[zoomIndex];

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-3">
        <DialogTitle className="truncate pr-8">Payment proof</DialogTitle>
        <DialogDescription className="sr-only">
          The transfer confirmation for {proof.reportTitle}, with its method,
          reference, date and who recorded it.
        </DialogDescription>

        {/* Sidebar BESIDE the image from md up, beneath it on a phone — the
            metadata is the point, so it never gets pushed off-screen. */}
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
          <div className="border-line bg-bg-subtle grid h-80 place-items-center overflow-auto rounded-lg border">
            {proof.url === null ? (
              // A payment with no proof attached is ordinary — cash and
              // payroll runs often have none. Say so plainly.
              <span className="text-meta text-text-tertiary px-6 text-center">
                No proof file was attached to this payment.
              </span>
            ) : isPdf ? (
              <iframe src={proof.url} title="Payment proof" className="h-full w-full" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={proof.url}
                alt={`Payment proof ${proof.fileName}`}
                style={{ transform: `scale(${zoom})` }}
                className={cn(
                  "max-h-full max-w-full object-contain",
                  "transition-transform duration-fast ease-out"
                )}
              />
            )}
          </div>

          <dl className="border-line bg-bg-surface grid w-full gap-3 rounded-lg border p-4 md:w-64">
            <Field label="Amount">
              <Amount value={proof.amountPaid} currency={proof.currency} />
            </Field>
            <Field label="Method">
              <span className="text-body text-text-primary capitalize">
                {proof.method.replace("_", " ")}
              </span>
            </Field>
            <Field label="Reference / UTR">
              {/* Tabular: this is the string somebody compares against a bank
                  statement character by character. */}
              <span className="text-body text-text-primary tabular break-all">
                {proof.reference}
              </span>
            </Field>
            <Field label="Paid on">
              <DateCell value={proof.paidAt} />
            </Field>
            <Field label="Recorded by">
              <span className="text-body text-text-primary">{proof.paidByName}</span>
            </Field>
          </dl>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {proof.url && !isPdf ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={zoomIndex === 0}
                  onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
                  aria-label="Zoom out"
                >
                  <Minus aria-hidden="true" className="size-4" />
                </Button>
                <span className="text-meta text-text-tertiary tabular w-10 text-center">
                  {zoom}×
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={zoomIndex === ZOOM_STEPS.length - 1}
                  onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
                  aria-label="Zoom in"
                >
                  <Plus aria-hidden="true" className="size-4" />
                </Button>
              </>
            ) : null}
          </div>

          {proof.url ? (
            <Button asChild size="sm" variant="secondary">
              <a href={proof.url} download={proof.fileName} target="_blank" rel="noreferrer">
                <Download aria-hidden="true" className="size-4" />
                Download
              </a>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-meta text-text-tertiary">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
