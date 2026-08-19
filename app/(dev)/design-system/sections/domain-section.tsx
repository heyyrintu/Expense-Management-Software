"use client";

// Domain components (D0.5) — DESIGN-PRD §6.2.
//
// Two halves, and the second half is the point. The top shows what is built;
// the bottom is a roster of every §6.2 component that ISN'T, with the task
// that delivers it. A gallery that only lists finished work looks complete
// long before it is, and a review surface that flatters the project is
// useless. Each row moves up as its task lands.
import { asFlags, FlagChips } from "@/components/flag-chips";
import { ComplaintStatusBadge, SlaBadge } from "@/components/sla-badge";
import { StatusBadge } from "@/components/status-badge";
import { Block, Group, Panel, Row } from "./shared";

// Charts moved to the StatCard-and-charts section in D1.4, where they sit
// beside the theme that governs them.

/** Fixed dates so the SLA specimens don't change grade overnight. */
const NOW = new Date("2026-08-19T10:00:00Z");
const DAYS = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

/** §6.2 components not yet built, with the task that delivers each. */
const ROSTER = [
  { name: "PaymentProofViewer", purpose: "Lightbox with zoom and metadata sidebar", task: "D3.2" },
  { name: "LedgerTable", purpose: "Tally-style running balance, sticky totals, print", task: "D4.1" },
  { name: "ReconcileBuckets", purpose: "Three-column board with counts", task: "D4.2" },
] as const;

export function DomainSection() {
  return (
    <Group
      id="domain"
      eyebrow="§6.2"
      title="Domain components"
      description="The pieces that know what an expense is. Everything here reads its colour from the same status map the primitives do — a policy flag is the warning token, not a shade someone liked."
    >
      <Block
        title="Status and flags"
        description="StatusBadge is the only renderer of status colour. SlaBadge and the complaint badge read the same tones rather than inventing a green/amber/red of their own."
      >
        <Panel>
          <Row label="StatusBadge — report workflow">
            <StatusBadge status="draft" />
            <StatusBadge status="submitted" />
            <StatusBadge status="approved" />
            <StatusBadge status="rejected" />
            <StatusBadge status="sent_back" />
            <StatusBadge status="reimbursed" />
          </Row>
          <Row label="StatusBadge — reconciliation buckets">
            <StatusBadge status="matched" />
            <StatusBadge status="missing_in_bank" />
            <StatusBadge status="missing_in_app" />
          </Row>
          <Row label="SlaBadge — business-day maths from lib/domain/complaint">
            <SlaBadge createdAt={DAYS(1)} status="open" now={NOW} />
            <SlaBadge createdAt={DAYS(5)} status="open" now={NOW} />
            <SlaBadge createdAt={DAYS(12)} status="open" now={NOW} />
            <SlaBadge createdAt={DAYS(12)} resolvedAt={DAYS(9)} status="resolved" now={NOW} />
          </Row>
          <Row label="ComplaintStatusBadge">
            <ComplaintStatusBadge status="open" />
            <ComplaintStatusBadge status="in_review" />
            <ComplaintStatusBadge status="resolved" />
            <ComplaintStatusBadge status="wont_fix" />
          </Row>
          <Row label="FlagChips — policy violations warn, never block">
            <FlagChips
              flags={asFlags([
                { rule: "per_expense_limit", message: "Above the ₹5,000 per-expense limit" },
                { rule: "receipt_required", message: "A receipt is required over ₹1,000" },
                { rule: "duplicate", message: "Same amount, date and merchant as EXP-2261" },
              ])}
            />
          </Row>
          <p className="text-meta text-text-tertiary">
            D2.1 paid this off: the chips now read the warning token and carry
            their rule text in a real Tooltip that keyboard users can reach.
            components/flag-chips.tsx re-exports the new implementation, so all
            six call sites were fixed without touching any of them.
          </p>
        </Panel>
      </Block>

      <Block
        title="Not built yet"
        description="The rest of §6.2, with the task that delivers each. These rows move up into the gallery as they land — that is what “added to /design-system in the same commit” means in practice. Amount and DateCell left this table in D1.1; they now have their own section above."
      >
        <div className="border-line bg-bg-surface overflow-hidden rounded-lg border">
          <table className="w-full text-body">
            <thead className="bg-bg-subtle text-text-secondary text-label">
              <tr>
                <th className="p-3 text-left font-medium">Component</th>
                <th className="p-3 text-left font-medium">Purpose</th>
                <th className="p-3 text-left font-medium">Task</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {ROSTER.map((row) => (
                <tr key={row.name}>
                  <td className="text-text-primary p-3">{row.name}</td>
                  <td className="text-text-secondary p-3">{row.purpose}</td>
                  <td className="p-3">
                    <code className="text-label text-text-tertiary">{row.task}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
    </Group>
  );
}
