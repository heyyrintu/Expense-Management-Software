"use client";

// Finance and payment proof (D3.2) — DESIGN-PRD §6.2, PLAN 6.1.
//
// A payment run is the screen with the least room for a nice surprise, so the
// states worth reviewing are the awkward ones: a partial payment, a recipient
// with no bank details, a batch that half-failed, and a payment recorded with
// no proof attached.
import * as React from "react";

import { StatusBadge } from "@/components/status-badge";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { PaymentProgress } from "@/components/ui/payment-progress";
import {
  PaymentProofViewer,
  type PaymentProof,
} from "@/components/ui/payment-proof-viewer";
import { summariseBatch, type BatchLineInput } from "@/lib/domain/payment-batch";
import { Block, Group, Panel, Row } from "./shared";

/** A 1×1 PNG, so the specimen needs no network and no fixture on disk. */
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const PROOF: PaymentProof = {
  id: "p1",
  url: PIXEL,
  mimeType: "image/png",
  fileName: "neft-confirmation.png",
  amountPaid: 1_245_600,
  currency: "INR",
  method: "bank_transfer",
  reference: "N225081412345678",
  paidAt: "2026-08-15T10:30:00Z",
  paidByName: "Sana Kapoor",
  reportTitle: "August travel — Arjun Mehta",
};

const NO_PROOF: PaymentProof = {
  ...PROOF,
  id: "p2",
  url: null,
  method: "cash",
  reference: "CASH-0042",
  reportTitle: "Client dinner — Priya Raman",
};

const BATCH: BatchLineInput[] = [
  {
    reportId: "a",
    title: "August travel",
    ownerName: "Arjun Mehta",
    balance: 1_245_600,
    reference: "N225081412345678",
    hasBankDetails: true,
  },
  {
    reportId: "b",
    title: "Client dinner series",
    ownerName: "Priya Raman",
    balance: 486_000,
    reference: "N225081412345679",
    amountText: "2000.00",
    hasBankDetails: true,
  },
  {
    reportId: "c",
    title: "Q3 offsite",
    ownerName: "Sana Kapoor",
    balance: 894_000,
    reference: "",
    hasBankDetails: false,
  },
];

export function FinanceSection() {
  const [viewing, setViewing] = React.useState<PaymentProof | null>(null);
  const [withProblem, setWithProblem] = React.useState(true);

  const lines = withProblem ? BATCH : BATCH.map((l) => ({ ...l, reference: l.reference || "N999" }));
  const summary = summariseBatch(lines);

  return (
    <Group
      id="finance"
      eyebrow="§6.2 · PLAN 6.1"
      title="Finance and payment proof"
      description="The screens where money actually moves. Nothing here is optimistic: a payment shows a real pending state and a confirmed result, because a payment cannot be un-sent."
    >
      <Block
        title="Partial payments"
        description="A thin accent bar for what's been paid, and the balance in the WARNING token — money still owed to an employee is not neutral information. It's the number that decides whether this row needs another run."
      >
        <Panel>
          <div className="grid gap-4">
            {[
              { label: "Nothing paid yet", total: 1_245_600, paid: 0 },
              { label: "Partly paid", total: 1_245_600, paid: 400_000 },
              { label: "Almost settled", total: 1_245_600, paid: 1_200_000 },
              { label: "Settled", total: 1_245_600, paid: 1_245_600 },
            ].map((row) => (
              <div key={row.label} className="grid gap-2">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-meta text-text-tertiary">{row.label}</span>
                  <StatusBadge
                    status={
                      row.paid === 0
                        ? "approved"
                        : row.paid >= row.total
                          ? "reimbursed"
                          : "partially_reimbursed"
                    }
                  />
                </span>
                <PaymentProgress total={row.total} paid={row.paid} currency="INR" />
              </div>
            ))}
          </div>
          <p className="text-meta text-text-tertiary">
            The bar carries no label: it shows proportion, and the two figures
            underneath carry the values. A progress bar with numbers written on
            it is a chart pretending to be a control. It animates{" "}
            <code>scaleX</code>, a transform, and turns green only when the
            balance actually reaches zero.
          </p>
        </Panel>
      </Block>

      <Block
        title="Batch review"
        description="Step two of the payment run. Every line, what it pays, what it leaves owing, and the batch total at display size — the figure the reader is being asked to authorise."
      >
        <Row label="Line state">
          <Button
            size="sm"
            variant={withProblem ? "primary" : "secondary"}
            onClick={() => setWithProblem(true)}
          >
            One line incomplete
          </Button>
          <Button
            size="sm"
            variant={withProblem ? "secondary" : "primary"}
            onClick={() => setWithProblem(false)}
          >
            All lines valid
          </Button>
        </Row>

        <Panel>
          <ul className="border-line divide-line grid divide-y rounded-lg border">
            {summary.lines.map((line) => (
              <li key={line.reportId} className="grid gap-1 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="grid min-w-0">
                    <span className="text-body text-text-primary truncate">{line.title}</span>
                    <span className="text-meta text-text-tertiary tabular truncate">
                      {line.ownerName}
                      {line.reference ? ` · ref ${line.reference}` : ""}
                    </span>
                  </span>
                  <Amount value={line.amount} currency="INR" align="right" />
                </div>
                {line.partial ? (
                  <span className="text-meta text-status-warning-text">
                    Partial —{" "}
                    <Amount
                      value={line.remaining}
                      currency="INR"
                      size="meta"
                      className="text-status-warning-text"
                    />{" "}
                    still owed after this
                  </span>
                ) : null}
                {line.problem ? (
                  <span className="text-meta text-status-danger-text">{line.problem}</span>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="border-line bg-bg-subtle flex flex-wrap items-baseline justify-between gap-2 rounded-lg border p-4">
            <span className="text-label text-text-secondary">
              {summary.count} payment{summary.count === 1 ? "" : "s"}
              {summary.partialCount > 0 ? `, ${summary.partialCount} partial` : ""}
            </span>
            <Amount value={summary.total} currency="INR" size="display" align="right" />
          </div>

          {summary.missingBankDetails.length > 0 ? (
            <p className="border-status-warning-subtle bg-status-warning-subtle text-status-warning-text rounded-lg border p-3 text-meta">
              {summary.missingBankDetails.length} recipient has no bank details on
              file. Fine for cash or payroll — worth a look otherwise.
            </p>
          ) : null}

          <Button disabled={!summary.ready}>
            {summary.ready ? "Record payments" : `${summary.problems.length} line needs fixing`}
          </Button>

          <ul className="text-meta text-text-secondary grid gap-2">
            <li>
              <strong className="text-text-primary">A refused line contributes nothing.</strong>{" "}
              Its amount is zero in the total, so the figure the reader
              authorises can never overstate what will actually be paid.
            </li>
            <li>
              <strong className="text-text-primary">One bad line blocks the batch.</strong> A
              batch is one action to the reader; letting it go half-valid means
              discovering the other half failed after the money moved.
            </li>
            <li>
              <strong className="text-text-primary">Missing bank details warn, not block.</strong>{" "}
              Cash and payroll runs are legitimate, and finance may be recording
              a payment already made another way.
            </li>
            <li>
              <strong className="text-text-primary">The preview never disagrees with the server.</strong>{" "}
              tests/unit/payment-batch.test.ts asserts it accepts exactly what{" "}
              <code>planPayment</code> accepts — otherwise this screen would be
              promising payments the server refuses.
            </li>
          </ul>
        </Panel>
      </Block>

      <Block
        title="PaymentProofViewer"
        description="A receipt is looked at; a payment proof is CHECKED — against a UTR in a bank statement, on a date, by a named person. The sidebar puts those four facts beside the image."
      >
        <Panel>
          <Row label="Open one">
            <Button size="sm" variant="secondary" onClick={() => setViewing(PROOF)}>
              With proof
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setViewing(NO_PROOF)}>
              No proof attached
            </Button>
          </Row>
          <p className="text-meta text-text-tertiary">
            The reference renders tabular, because it is the string somebody
            compares against a bank statement character by character. A payment
            with no proof is ordinary — cash and payroll runs often have none —
            so it says so plainly and still shows the metadata, which is the
            part a dispute actually turns on.
          </p>
        </Panel>
      </Block>

      <PaymentProofViewer proof={viewing} onOpenChange={(open) => !open && setViewing(null)} />
    </Group>
  );
}
