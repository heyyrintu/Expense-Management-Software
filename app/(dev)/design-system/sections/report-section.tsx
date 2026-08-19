"use client";

// Report builder (D2.3) — DESIGN-PRD §7.2.
import * as React from "react";

import { StatusBadge } from "@/components/status-badge";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { PolicyFlagChips } from "@/components/ui/policy-flag-chip";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { SubmitDialog, type SubmitPreview } from "@/app/(app)/reports/[id]/submit-dialog";
import { buildReportTimeline } from "@/lib/domain/report-timeline";
import type { ReportStatus } from "@/lib/domain/report-workflow";
import { Block, Group, Panel, Row } from "./shared";

const SUBMITTED = new Date("2026-08-12T09:00:00Z");
const APPROVED = new Date("2026-08-13T11:00:00Z");
const PAID = new Date("2026-08-15T16:00:00Z");

const FLAGS = [
  { rule: "per_expense_limit", message: "Above the ₹5,000 per-expense limit for Meals" },
  { rule: "receipt_required", message: "A receipt is required over ₹1,000" },
];

const PREVIEW: SubmitPreview = {
  expenseCount: 4,
  total: 1_245_600,
  currency: "INR",
  approverName: "Priya Raman",
  needsSecondApproval: true,
  flags: FLAGS,
};

const TIMELINE_CASES: Array<{ label: string; status: ReportStatus; dates: Partial<Record<"submittedAt" | "approvedAt" | "paidAt", Date | null>> }> = [
  { label: "Submitted — waiting", status: "submitted", dates: { submittedAt: SUBMITTED } },
  {
    label: "Approved — waiting on payment",
    status: "approved",
    dates: { submittedAt: SUBMITTED, approvedAt: APPROVED },
  },
  {
    label: "Partly paid — NOT done",
    status: "partially_reimbursed",
    dates: { submittedAt: SUBMITTED, approvedAt: APPROVED, paidAt: PAID },
  },
  {
    label: "Reimbursed",
    status: "reimbursed",
    dates: { submittedAt: SUBMITTED, approvedAt: APPROVED, paidAt: PAID },
  },
  { label: "Rejected — stops, doesn't reverse", status: "rejected", dates: { submittedAt: SUBMITTED } },
  { label: "Sent back", status: "sent_back", dates: { submittedAt: SUBMITTED } },
];

export function ReportSection() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [noApprover, setNoApprover] = React.useState(false);

  return (
    <Group
      id="report"
      eyebrow="§7.2"
      title="Report builder"
      description="Where expenses become a claim. The header leads with the total, the timeline says where it is, and nothing gets submitted without the reader seeing exactly what goes."
    >
      <Block
        title="Header"
        description="Title, status, and the total at display size — §4.3, the number is the hero. The same figure appears in the totals footer, computed once, so a reader who scrolls can't be told two different numbers."
      >
        <Panel>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid gap-1">
              <span className="text-label text-text-secondary">Total</span>
              <Amount value={1_245_600} currency="INR" size="display" />
            </div>
            <StatusBadge status="submitted" />
          </div>
        </Panel>
      </Block>

      <Block
        title="Status timeline"
        description="Submitted → Approved → Paid, current step in accent. A vertical stack below sm: three steps with timestamps do not fit across 360px, and a stepper that truncates its own dates is worse than one that wraps."
      >
        <div className="grid gap-4">
          {TIMELINE_CASES.map((testCase) => (
            <div key={testCase.label} className="grid gap-2">
              <span className="text-meta text-text-tertiary">{testCase.label}</span>
              <StatusTimeline
                steps={buildReportTimeline({
                  status: testCase.status,
                  submittedAt: null,
                  approvedAt: null,
                  paidAt: null,
                  ...testCase.dates,
                })}
              />
            </div>
          ))}
        </div>
        <Panel>
          <ul className="text-meta text-text-secondary grid gap-2">
            <li>
              <strong className="text-text-primary">Partly paid is not paid.</strong> The
              final step stays current while money is owed — the one lie this
              component could tell that costs somebody real money.
            </li>
            <li>
              <strong className="text-text-primary">A rejection stops, it doesn&apos;t reverse.</strong>{" "}
              Submitted stays done, because it happened; the approval step is
              marked stopped and says why. Running the stepper backwards would
              suggest the submission was undone. It wasn&apos;t — it was answered.
            </li>
            <li>
              <strong className="text-text-primary">State is in the text too.</strong> A
              filled dot and a hollow one are the same shape to anyone who
              can&apos;t see the accent, so each step carries its state for screen
              readers (§5.1: never colour alone).
            </li>
          </ul>
        </Panel>
      </Block>

      <Block
        title="Policy flag summary"
        description="A strip at the top, so the reader knows something is flagged before scrolling four expenses to find it. Informational — flags never block submission."
      >
        <Panel>
          <div className="border-status-warning-subtle bg-status-warning-subtle grid gap-2 rounded-lg border p-3">
            <p className="text-label text-status-warning-text">
              2 policy flags on this report
            </p>
            <PolicyFlagChips flags={FLAGS} />
            <p className="text-meta text-status-warning-text">
              Your approver sees these and can approve anyway.
            </p>
          </div>
        </Panel>
      </Block>

      <Block
        title="Submit confirmation"
        description="§7.2: the user should never be surprised by what was submitted. Count, total, who it goes to, and what's flagged — the four things you'd otherwise have to reconstruct afterwards."
      >
        <Panel>
          <Row label="Open it">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setNoApprover(false);
                setDialogOpen(true);
              }}
            >
              With an approver
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setNoApprover(true);
                setDialogOpen(true);
              }}
            >
              No approver assigned
            </Button>
          </Row>
          <p className="text-meta text-text-tertiary">
            The approver name is resolved SERVER-side by the same{" "}
            <code>resolveChain</code> the submit action uses. Computing it
            separately in the browser would risk naming one person in the dialog
            and notifying another — the exact surprise §7.2 forbids. When the
            chain resolves to nobody, the dialog says so rather than submitting
            into silence.
          </p>
        </Panel>

        <SubmitDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          preview={noApprover ? { ...PREVIEW, approverName: null } : PREVIEW}
          onConfirm={() => setDialogOpen(false)}
          pending={false}
          resubmit={false}
        />
      </Block>
    </Group>
  );
}
