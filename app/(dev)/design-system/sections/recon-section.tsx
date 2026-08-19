"use client";

// Reconciliation (D4.2) — DESIGN-PRD §7.6.
//
// The states that matter here are the ones a healthy demo never reaches: an
// unexplained amount, a "Not in bank" bucket with something in it, and the
// lock dialog. A reconciliation screen looks fine when everything reconciles;
// it is judged on the day something doesn't.
import * as React from "react";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import { Bucket, BucketBoard, BucketEmpty } from "@/components/recon/bucket-board";
import { ReconSummaryStrip } from "@/components/recon/summary-strip";
import { LockDialog, UnmatchDialog } from "@/app/(app)/bank-recon/confirm-dialogs";
import { MatchDialog, type MatchCandidate } from "@/app/(app)/bank-recon/match-dialog";
import { Block, Group, Panel, Row } from "./shared";

const CURRENCY = "INR";

const LINE = {
  id: "l1",
  date: "2026-08-14T00:00:00.000Z",
  amount: 1_245_600,
  reference: "NEFT DR-N226081412345678-SALARY ADV",
};

const CANDIDATES: MatchCandidate[] = [
  {
    id: "p1",
    amount: 1_245_600,
    date: "2026-08-14T00:00:00.000Z",
    reference: "N226081412345678",
    reportTitle: "August travel",
    ownerName: "Arjun Mehta",
    method: "bank_transfer",
  },
  {
    id: "p2",
    amount: 486_000,
    date: "2026-08-12T00:00:00.000Z",
    reference: "N226081298765432",
    reportTitle: "Client dinner series",
    ownerName: "Priya Raman",
    method: "bank_transfer",
  },
  {
    id: "p3",
    amount: 894_000,
    date: "2026-08-15T00:00:00.000Z",
    reference: "UPI-0092134",
    reportTitle: "Q3 offsite",
    ownerName: "Sana Kapoor",
    method: "upi",
  },
];

export function ReconSection() {
  const [clean, setClean] = React.useState(false);
  const [matchOpen, setMatchOpen] = React.useState(false);
  const [unmatchOpen, setUnmatchOpen] = React.useState(false);
  const [lockOpen, setLockOpen] = React.useState(false);

  return (
    <Group
      id="recon"
      eyebrow="§7.6 · PLAN 7.2"
      title="Reconciliation"
      description="Three buckets that partition one statement, and a summary strip in which exactly one figure is allowed to shout."
    >
      <Block
        title="Summary strip"
        description="Period, matched %, unexplained. §7.6 asks for the unexplained amount in the danger token — always, because there is no threshold below which money leaving the bank unexplained is fine."
      >
        <Row label="State">
          <Button
            size="sm"
            variant={clean ? "secondary" : "primary"}
            onClick={() => setClean(false)}
          >
            Something unexplained
          </Button>
          <Button
            size="sm"
            variant={clean ? "primary" : "secondary"}
            onClick={() => setClean(true)}
          >
            Fully reconciled
          </Button>
        </Row>
        <Panel>
          <ReconSummaryStrip
            periodStart="2026-08-01T00:00:00.000Z"
            periodEnd="2026-08-31T00:00:00.000Z"
            matchedPct={clean ? 100 : 82}
            unexplained={clean ? 0 : 894_000}
            currency={CURRENCY}
            lineCount={49}
          />
          <p className="text-meta text-text-tertiary">
            At ZERO it turns green rather than showing a red ₹0. A danger token
            on the goal state teaches the reader to ignore the colour, which is
            precisely what you cannot afford on the one figure that decides
            whether the month is done.
          </p>
        </Panel>
      </Block>

      <Block
        title="The three buckets"
        description="Matched is success. “Not in bank” is DANGER — the app says money moved and the bank disagrees. “Not in app” is WARNING — usually a real payment nobody recorded, and there is a button for that."
      >
        <Panel>
          <BucketBoard>
            <Bucket
              title="Matched"
              description="Bank debit and recorded payment agree."
              count={31}
              tone="success"
            >
              <li className="grid gap-1 py-3">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <DateCell value={LINE.date} tone="muted" />
                  <Amount value={LINE.amount} currency={CURRENCY} align="right" />
                </span>
                <span className="text-meta text-text-secondary truncate">
                  August travel · Arjun Mehta
                </span>
                <span className="bg-status-success-subtle text-status-success-text w-fit rounded-sm px-1.5 py-0.5 text-meta">
                  auto-matched
                </span>
              </li>
            </Bucket>

            <Bucket
              title="Not in bank"
              description="Recorded as paid, but the bank has no such debit."
              count={1}
              tone="danger"
            >
              <li className="grid gap-1 py-3">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <DateCell value="2026-08-09T00:00:00.000Z" tone="muted" />
                  <Amount value={486_000} currency={CURRENCY} align="right" />
                </span>
                <span className="text-meta text-text-secondary truncate">
                  Client dinner series · Priya Raman
                </span>
                <span className="text-meta text-text-tertiary tabular truncate">
                  N226080998765432
                </span>
              </li>
            </Bucket>

            <Bucket
              title="Not in app"
              description="A bank debit with no matching payment record."
              count={0}
              tone="warning"
            >
              <BucketEmpty>Every bank debit is explained.</BucketEmpty>
            </Bucket>
          </BucketBoard>

          <p className="text-meta text-text-tertiary">
            “Not in bank” carries no action on purpose. No button on this screen
            can resolve a payment the bank has never seen — either the money
            didn&apos;t move and someone is still waiting, or the record is
            wrong. Offering an action would imply the screen can settle it.
            Buckets are equal width because they partition one set; sizing them
            by importance would suggest an empty “Not in bank” matters less,
            when it is the best possible outcome.
          </p>
        </Panel>
      </Block>

      <Block
        title="Manual match"
        description="Select a line, search the payments, confirm. The line stays pinned while you search, because matching is a comparison and a reader who has to remember an amount will eventually mis-remember it."
      >
        <Panel>
          <Row label="Open">
            <Button size="sm" variant="secondary" onClick={() => setMatchOpen(true)}>
              Match a line
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setUnmatchOpen(true)}>
              Undo a match
            </Button>
          </Row>
          <p className="text-meta text-text-tertiary">
            Candidates whose amount equals the line sort first and carry an
            “amount matches” chip — a hint about the figure, never a claim that
            it IS the right payment. The candidate list and the “Not in bank”
            bucket come from one query, so the dialog can never offer a payment
            the board doesn&apos;t show.
          </p>
        </Panel>
      </Block>

      <Block
        title="Period lock"
        description="The one destructive control on the screen, and the only dialog in the app that enumerates its own consequences."
      >
        <Panel>
          <Row label="Open">
            <Button size="sm" variant="destructive" onClick={() => setLockOpen(true)}>
              Lock this period
            </Button>
          </Row>
          <p className="text-meta text-text-tertiary">
            It lists what becomes read-only AND what stays possible. The second
            list is not padding: a reader deciding whether to lock needs to know
            it won&apos;t stop them paying anyone. “Are you sure?” is not
            informed consent, and a reader who has to guess a lock&apos;s scope
            will either avoid the feature or discover it by being blocked later.
          </p>
        </Panel>
      </Block>

      <MatchDialog
        line={LINE}
        candidates={CANDIDATES}
        currency={CURRENCY}
        open={matchOpen}
        onOpenChange={setMatchOpen}
        onConfirm={() => setMatchOpen(false)}
      />
      <UnmatchDialog
        open={unmatchOpen}
        onOpenChange={setUnmatchOpen}
        onConfirm={() => setUnmatchOpen(false)}
      />
      <LockDialog
        open={lockOpen}
        onOpenChange={setLockOpen}
        onConfirm={() => setLockOpen(false)}
        periodLabel="1 Aug – 31 Aug 2026"
        matchedCount={31}
        openCount={3}
      />
    </Group>
  );
}
