// Payment-run summary (D3.2).
//
// The review step of the batch sheet shows what is about to be paid. This
// computes it, and it is pure so the arithmetic behind a money screen is
// tested rather than trusted.
//
// It does NOT decide anything the server doesn't. planPayment and
// outstandingBalance in lib/domain/reimbursement remain the authority; this
// mirrors them for the preview, and tests/unit/payment-batch.test.ts asserts
// the mirror holds.
import { parseToMinorUnits } from "@/lib/money";

export type BatchLineInput = {
  reportId: string;
  title: string;
  ownerName: string;
  /** Outstanding balance in integer minor units. */
  balance: number;
  reference: string;
  /** Decimal string from the amount field; blank means "the full balance". */
  amountText?: string;
  hasBankDetails: boolean;
};

export type BatchLine = BatchLineInput & {
  /** Integer minor units this line will actually pay. */
  amount: number;
  /** What is left after this payment. */
  remaining: number;
  partial: boolean;
  /** Blocking problem, or null. */
  problem: string | null;
};

export type BatchSummary = {
  lines: BatchLine[];
  /** Integer minor units across every line. */
  total: number;
  count: number;
  partialCount: number;
  /** Lines that can't be paid as entered. */
  problems: BatchLine[];
  missingBankDetails: BatchLine[];
  ready: boolean;
};

/**
 * Resolve one line: what will it pay, and can it?
 *
 * A blank amount means the full balance, which is the common case and should
 * not require typing a number that is already on screen.
 */
export function resolveBatchLine(input: BatchLineInput): BatchLine {
  const text = (input.amountText ?? "").trim();
  const amount = text === "" ? input.balance : (parseToMinorUnits(text) ?? -1);

  let problem: string | null = null;
  if (!input.reference.trim()) {
    problem = "Needs a reference or UTR.";
  } else if (amount < 0) {
    problem = "That amount isn't a valid figure.";
  } else if (amount === 0) {
    problem = "A payment of zero isn't a payment.";
  } else if (amount > input.balance) {
    // Overpaying is almost always a typo, and the server refuses it anyway —
    // better to say so before the reader commits a batch.
    problem = "More than the outstanding balance.";
  }

  const paid = problem === null ? amount : 0;
  return {
    ...input,
    amount: problem === null ? amount : 0,
    remaining: Math.max(0, input.balance - paid),
    partial: problem === null && amount < input.balance,
    problem,
  };
}

/**
 * The review screen's numbers.
 *
 * `ready` is false while ANY line has a problem. A batch is one action to the
 * reader, so letting it go half-valid would mean discovering the other half
 * failed after the money moved.
 */
export function summariseBatch(inputs: BatchLineInput[]): BatchSummary {
  const lines = inputs.map(resolveBatchLine);
  const problems = lines.filter((l) => l.problem !== null);
  return {
    lines,
    total: lines.reduce((sum, l) => sum + l.amount, 0),
    count: lines.length,
    partialCount: lines.filter((l) => l.partial).length,
    problems,
    // Missing bank details is a WARNING, not a problem: cash and payroll runs
    // are legitimate, and finance may be recording a payment already made by
    // other means. It is worth surfacing, not worth blocking.
    missingBankDetails: lines.filter((l) => !l.hasBankDetails),
    ready: lines.length > 0 && problems.length === 0,
  };
}
