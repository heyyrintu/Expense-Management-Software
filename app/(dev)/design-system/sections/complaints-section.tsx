"use client";

// Complaints (D4.3) — DESIGN-PRD §7.7.
//
// The thread and the type picker are the two pieces worth reviewing side by
// side, because both are decisions about restraint: a conversation that is
// deliberately NOT a chat app, and a picker that is deliberately not a
// dropdown.
import * as React from "react";

import { AnimatedStatusBadge } from "@/components/complaints/animated-status-badge";
import { ComplaintHeaderCard, ResolutionCard } from "@/components/complaints/complaint-header-card";
import { SlaBadge } from "@/components/sla-badge";
import { Avatar } from "@/components/shell/avatar-menu";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import type { ComplaintStatus } from "@/lib/domain/complaint";
import { Block, Group, Panel, Row } from "./shared";

/** Fixed so the SLA specimens don't change grade overnight. */
const NOW = new Date("2026-08-20T10:00:00Z");
const DAYS_AGO = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const STATUSES: ComplaintStatus[] = ["open", "in_review", "resolved", "wont_fix"];

export function ComplaintsSection() {
  const [status, setStatus] = React.useState<ComplaintStatus>("open");

  return (
    <Group
      id="complaints"
      eyebrow="§7.7 · PLAN 7.3"
      title="Complaints"
      description="A dispute about money, its conversation, and the SLA clock running on both. Every surface reads its colour from the same status map the rest of the app does."
    >
      <Block
        title="Status crossfade"
        description="§7.7 asks the badge to animate on a status change: 150ms, opacity only. Click through the statuses — the badge fades between them rather than snapping, because a badge that swaps instantly looks like it was always that way."
      >
        <Panel>
          <Row label="Status">
            {STATUSES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={status === s ? "primary" : "secondary"}
                onClick={() => setStatus(s)}
              >
                {s.replace("_", " ")}
              </Button>
            ))}
          </Row>
          <Row label="Badge">
            <AnimatedStatusBadge status={status} />
          </Row>
          <p className="text-meta text-text-tertiary">
            Opacity only, so <code>prefers-reduced-motion</code> loses nothing —
            a fade IS the reduced-motion fallback. <code>mode=&quot;popLayout&quot;</code>{" "}
            crossfades in place; <code>mode=&quot;wait&quot;</code> would queue the exit
            after the enter and spend 300ms on a badge.
          </p>
        </Panel>
      </Block>

      <Block
        title="SLA badge"
        description="Five business days, green → amber at three → red at five. Weekend-aware: a complaint raised on Friday is still zero days old on Sunday."
      >
        <Panel>
          <Row label="Open">
            <SlaBadge createdAt={new Date(DAYS_AGO(1))} status="open" now={NOW} />
            <SlaBadge createdAt={new Date(DAYS_AGO(5))} status="open" now={NOW} />
            <SlaBadge createdAt={new Date(DAYS_AGO(12))} status="open" now={NOW} />
          </Row>
          <Row label="Closed">
            <SlaBadge
              createdAt={new Date(DAYS_AGO(12))}
              resolvedAt={new Date(DAYS_AGO(9))}
              status="resolved"
              now={NOW}
            />
          </Row>
          <p className="text-meta text-text-tertiary">
            Once closed the clock FREEZES at the resolution date rather than
            continuing to run — a resolved complaint that keeps ageing into red
            would make a finished job look like an outstanding one forever.
          </p>
        </Panel>
      </Block>

      <Block
        title="Header card and outcome"
        description="The dispute stated once, at the top. It carries no actions — the handler's controls live in their own panel, and mixing “here is the problem” with “here is what you can do” makes both harder to read."
      >
        <Panel>
          <ComplaintHeaderCard
            type="payment_not_received"
            status={status}
            description={
              "The report was marked reimbursed on 14 August but nothing has reached my account. I've checked with the bank and there's no pending credit."
            }
            createdAt={DAYS_AGO(4)}
            resolvedAt={null}
            raisedByName="Arjun Mehta"
            assignedToName="Sana Kapoor"
            target={{
              kind: "payment",
              href: "#",
              reference: "N226081412345678",
              amount: 1_245_600,
              currency: "INR",
              paidAt: DAYS_AGO(6),
              method: "bank_transfer",
            }}
            attachmentUrl="#"
            proofUrl="#"
          />
          <ResolutionCard
            status="resolved"
            note={
              "The transfer bounced on an IFSC mismatch and was returned on 16 August. Bank details corrected and re-sent in today's run — UTR N226082098765432."
            }
            resolvedAt={DAYS_AGO(1)}
          />
          <ResolutionCard
            status="wont_fix"
            note={
              "The ₹450 difference is the per-diem cap in the travel policy, applied correctly. Nothing further is owed on this report."
            }
            resolvedAt={DAYS_AGO(1)}
          />
          <p className="text-meta text-text-tertiary">
            Won&apos;t-fix takes a NEUTRAL card, not a danger one. Declining to
            act is a legitimate outcome, and colouring it red would read as an
            error the employee should chase — which is exactly the wrong thing
            to tell someone whose complaint was answered properly.
          </p>
        </Panel>
      </Block>

      <Block
        title="Thread"
        description="A support conversation, not a chat app: no bubbles, no tails, no right-aligned messages. Every message starts at the same left edge, because this thread is evidence in a dispute about money and gets read back months later."
      >
        <Panel>
          <ol className="border-line divide-line bg-bg-surface grid divide-y rounded-lg border">
            {[
              {
                id: "1",
                name: "Arjun Mehta",
                mine: true,
                when: DAYS_AGO(4),
                body: "Raised this on Friday — still nothing showing.",
              },
              {
                id: "2",
                name: "Sana Kapoor",
                mine: false,
                when: DAYS_AGO(2),
                body: "Checked with the bank — the transfer was returned. Can you confirm the account number ends 4471?",
              },
              {
                id: "3",
                name: "Arjun Mehta",
                mine: true,
                when: DAYS_AGO(1),
                body: "It ends 4477. I updated it in my profile last month.",
              },
            ].map((m) => (
              <li key={m.id} className="flex gap-3 px-4 py-4">
                <Avatar
                  name={m.name}
                  className={m.mine ? "mt-0.5 shrink-0 bg-bg-subtle text-text-secondary" : "mt-0.5 shrink-0"}
                />
                <div className="grid min-w-0 flex-1 gap-1">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="text-label text-text-primary">
                      {m.mine ? "You" : m.name}
                    </span>
                    <DateCell value={m.when} format="relative" tone="muted" />
                  </span>
                  <p className="text-body text-text-secondary">{m.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-meta text-text-tertiary">
            Own messages are marked by a quieter avatar and a “You” label —
            enough to scan by, not enough to split the thread into two columns.
            Right-aligning them would destroy the left edge that makes a long
            thread readable, and in a two-party dispute the reader already
            knows which half is theirs. Timestamps are RELATIVE here and
            nowhere near money: this is an activity context, and the payment
            date in the header card above stays absolute.
          </p>
        </Panel>
      </Block>
    </Group>
  );
}
