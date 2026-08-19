// What the organisation owes its employees right now (D3.3).
//
// This module exists because two screens show the same figure: the finance
// dashboard's "Outstanding to employees" card, and the total above the
// payment queue on /finance. Before D3.3 each computed it locally, which is
// exactly the arrangement §7.4 warns about — two queries that agree until one
// of them is edited, and then disagree silently about how much money is owed.
//
// So the query shape, the cap and the arithmetic live here, and both callers
// use them. The cap matters: /finance renders a bounded queue, and a card
// summing an UNBOUNDED set while the list it links to shows the first N would
// be the §7.4 trap in its purest form — a number the reader cannot reconcile
// with the rows underneath it.
import { outstandingBalance } from "./reimbursement";

/** Reports that can still take a payment. `reimbursed` has none left. */
export const PAYABLE_STATUSES = ["approved", "partially_reimbursed"] as const;

/**
 * How many payable reports either screen will consider.
 *
 * Shared rather than duplicated so the card and the queue are bounded
 * identically. A payment run larger than this is a different problem than a
 * dashboard card, and finance clears the oldest first — the queue is ordered
 * by submission date, so the cap drops the newest, not the most urgent.
 */
export const PAYABLE_LIMIT = 200;

/**
 * The where-clause both screens run.
 *
 * A function rather than a frozen constant so each caller gets its own
 * mutable object: Prisma's generated argument types reject `readonly`
 * arrays, and sharing one literal would also let any caller mutate the other
 * caller's query.
 */
export function payableWhere() {
  return { status: { in: [...PAYABLE_STATUSES] } };
}

/** The find-many arguments both screens run, so the SET is identical too. */
export function payableQuery() {
  return {
    where: payableWhere(),
    orderBy: { submittedAt: "asc" as const },
    take: PAYABLE_LIMIT,
  };
}

export type PayableLike = {
  total: number;
  reimbursements: Array<{ amountPaid: number }>;
};

/**
 * Total still owed across the payable set, in integer minor units.
 *
 * Per report rather than in aggregate: `outstandingBalance` floors each
 * report at zero, so a single over-payment cannot quietly reduce what is
 * shown as owed to everybody else.
 */
export function summarisePayable(rows: PayableLike[]): {
  count: number;
  outstanding: number;
} {
  let outstanding = 0;
  for (const row of rows) {
    outstanding += outstandingBalance(row.total, row.reimbursements);
  }
  return { count: rows.length, outstanding };
}
