"use client";

// Recent payments (D3.2) — the list that opens the PaymentProofViewer.
//
// Client-side only so the viewer has somewhere to live; the rows and their
// signed URLs are prepared on the server, where the org check happens.
import * as React from "react";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import { PaymentProofViewer, type PaymentProof } from "@/components/ui/payment-proof-viewer";

export function RecentPayments({ payments }: { payments: PaymentProof[] }) {
  const [viewing, setViewing] = React.useState<PaymentProof | null>(null);

  return (
    <div className="grid gap-2">
      <ul className="border-line divide-line grid divide-y rounded-lg border">
        {payments.map((payment) => (
          <li key={payment.id} className="flex flex-wrap items-center gap-3 p-3">
            <DateCell value={payment.paidAt} tone="muted" />
            <span className="grid min-w-0 flex-1">
              <span className="text-body text-text-primary truncate">
                {payment.reportTitle}
              </span>
              <span className="text-meta text-text-tertiary truncate">
                {payment.method.replace("_", " ")} · ref{" "}
                <span className="tabular">{payment.reference}</span> · by {payment.paidByName}
              </span>
            </span>
            <Amount value={payment.amountPaid} currency={payment.currency} align="right" />
            <Button size="sm" variant="ghost" onClick={() => setViewing(payment)}>
              {/* Every payment opens the viewer, proof or not: the metadata
                  sidebar is worth reading either way, and "View proof" that
                  is sometimes absent is a control nobody learns to trust. */}
              Details
            </Button>
          </li>
        ))}
      </ul>

      <PaymentProofViewer
        proof={viewing}
        onOpenChange={(open) => !open && setViewing(null)}
      />
    </div>
  );
}
