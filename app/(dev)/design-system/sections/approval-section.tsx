"use client";

// Approval queue (D3.1) — DESIGN-PRD §7.3.
//
// The states worth reviewing here are the ones that need a colleague, a
// stopwatch and a flagged report to reach on the real screen.
import * as React from "react";

import { Amount } from "@/components/ui/amount";
import { Avatar } from "@/components/shell/avatar-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateCell } from "@/components/ui/date-cell";
import { DecisionDialog, type DecisionKind } from "@/components/ui/decision-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PolicyFlagChips } from "@/components/ui/policy-flag-chip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { notify } from "@/components/ui/toaster";
import { sortApprovalQueue, type QueueItem } from "@/lib/domain/approval-queue";
import { Check } from "lucide-react";
import { Block, Group, Panel, Row } from "./shared";

const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000);

const QUEUE: QueueItem[] = [
  {
    id: "r1",
    title: "August travel — Mumbai",
    total: 1_245_600,
    submittedAt: daysAgo(2),
    ownerName: "Arjun Mehta",
    expenseCount: 6,
    level: 1,
    flagged: false,
    categories: ["Travel", "Meals"],
    flags: [],
  },
  {
    id: "r2",
    title: "Client dinner series",
    total: 486_000,
    submittedAt: daysAgo(9),
    ownerName: "Priya Raman",
    expenseCount: 3,
    level: 1,
    flagged: true,
    categories: ["Meals"],
    flags: [
      { rule: "per_expense_limit", message: "Above the ₹5,000 per-expense limit for Meals" },
      { rule: "duplicate", message: "Same amount, date and merchant as EXP-2261" },
    ],
  },
  {
    id: "r3",
    title: "Q3 offsite",
    total: 8_940_000,
    submittedAt: daysAgo(1),
    ownerName: "Sana Kapoor",
    expenseCount: 14,
    level: 2,
    flagged: false,
    categories: ["Lodging", "Travel", "Meals", "Software"],
    flags: [],
  },
];

export function ApprovalSection() {
  const [dialog, setDialog] = React.useState<DecisionKind | null>(null);
  const [empty, setEmpty] = React.useState(false);
  const sorted = sortApprovalQueue(QUEUE);

  return (
    <Group
      id="approval"
      eyebrow="§7.3"
      title="Approval queue"
      description="A work queue, not a table. Every row carries enough to decide without opening it, and approving is undoable for five seconds."
    >
      <Block
        title="Rows"
        description="Flagged first, then oldest first. A flagged row takes a 2px warning left edge — drawn as an inset shadow, so a flagged row and a clean one have identical boxes and the queue doesn't jitter as flags load."
      >
        <Row label="State">
          <Button size="sm" variant={empty ? "secondary" : "primary"} onClick={() => setEmpty(false)}>
            Queue
          </Button>
          <Button size="sm" variant={empty ? "primary" : "secondary"} onClick={() => setEmpty(true)}>
            Empty
          </Button>
        </Row>

        {empty ? (
          <div className="border-line bg-bg-surface rounded-lg border">
            <EmptyState
              icon={<Check aria-hidden="true" className="size-5" />}
              headline="Nothing waiting on you"
              description="Reports appear here the moment someone submits one."
            />
          </div>
        ) : (
          <ul className="grid gap-2">
            {sorted.map((item) => (
              <li key={item.id}>
                <SpecimenRow item={item} />
              </li>
            ))}
          </ul>
        )}

        <Panel>
          <ul className="text-meta text-text-secondary grid gap-2">
            <li>
              <strong className="text-text-primary">Flagged first is not cosmetic.</strong>{" "}
              Flagged reports need an individual decision that bulk approve
              deliberately can&apos;t give them, so burying them under fifty clean
              ones is how they age out. Within each group, oldest first.
            </li>
            <li>
              <strong className="text-text-primary">Approve is bordered, not filled.</strong>{" "}
              §4.6 allows one filled button in view, and a queue of twenty
              filled Approves would be twenty of them. The screen&apos;s one
              primary is &ldquo;Approve selected&rdquo;.
            </li>
            <li>
              <strong className="text-text-primary">Age, not date.</strong> &ldquo;How long has
              this been waiting&rdquo; is the decision signal. This is the
              activity context where relative time belongs.
            </li>
          </ul>
        </Panel>
      </Block>

      <Block
        title="Bulk approve gating"
        description="Enabled only when nothing selected is flagged. When it isn't, the tooltip names the reports responsible — hover or focus the disabled button."
      >
        <Panel>
          <Row label="Blocked by a flagged selection">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
                >
                  <Button size="sm" disabled>
                    Approve selected (2)
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Client dinner series carries a policy flag — flagged reports need
                an individual decision.
              </TooltipContent>
            </Tooltip>
          </Row>
          <p className="text-meta text-text-tertiary">
            The tooltip hangs off a WRAPPER, not the button. A disabled button
            fires no pointer events, so a tooltip attached to it never appears
            — the classic way a &ldquo;the button explains itself&rdquo;
            requirement silently doesn&apos;t. The wrapper is focusable too, so the
            explanation is reachable by keyboard, which a disabled button never is.
          </p>
        </Panel>
      </Block>

      <Block
        title="Optimistic approve"
        description="The row collapses out and a toast holds the decision for five seconds. Press Undo and it comes back."
      >
        <Panel>
          <Row label="Try it">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                notify.undo("Approved August travel — Mumbai", {
                  description: "Undo within 5 seconds.",
                  onUndo: () => notify.success("Put back"),
                  onCommit: () => notify.success("Sent to the server"),
                })
              }
            >
              Approve (demo toast)
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                notify.error("Couldn't approve August travel — Mumbai", "Report not found.")
              }
            >
              Server refused
            </Button>
          </Row>
          <p className="text-meta text-text-tertiary">
            <strong className="text-text-primary">The commit is deferred, not reversed.</strong>{" "}
            Approving hides the row and starts the window; the action fires only
            when the window closes untouched, and Undo simply cancels it. The
            alternative — approve immediately, un-approve on undo — needs a
            reversal action that doesn&apos;t exist and would write an AuditLog
            entry for something that never really happened. If the server then
            refuses, the row comes back and an error toast says why: an
            optimistic UI that swallows a rejection is a lie.
          </p>
        </Panel>
      </Block>

      <Block
        title="Reject and Send back"
        description="Both demand a reason, and the confirm button stays disabled until there is one. Rejecting someone's claim without saying why is how a finance tool becomes a grievance."
      >
        <Panel>
          <Row label="Open one">
            <Button size="sm" variant="secondary" onClick={() => setDialog("send_back")}>
              Send back
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog("reject")}>
              Reject
            </Button>
          </Row>
        </Panel>

        <DecisionDialog
          kind={dialog}
          reportTitle="Client dinner series"
          open={dialog !== null}
          onOpenChange={(open) => !open && setDialog(null)}
          onConfirm={() => setDialog(null)}
        />
      </Block>
    </Group>
  );
}

/** A static copy of the real row, so the gallery needs no server actions. */
function SpecimenRow({ item }: { item: QueueItem }) {
  const categories =
    item.categories.length <= 2
      ? item.categories.join(", ")
      : `${item.categories.slice(0, 2).join(", ")} +${item.categories.length - 2}`;

  return (
    <div
      className={`border-line bg-bg-surface flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
        item.flagged ? "flagged-edge" : ""
      }`}
    >
      <Checkbox aria-label={`Select ${item.title}`} disabled={item.flagged} />
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={item.ownerName} />
        <span className="grid min-w-0">
          <span className="text-text-primary truncate font-medium">{item.title}</span>
          <span className="text-meta text-text-tertiary truncate">
            {item.ownerName} · {item.expenseCount} expenses · {categories}
          </span>
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {item.level === 2 ? (
          <span className="bg-accent-subtle text-accent-text rounded-sm px-2 py-1 text-meta">
            2nd approval
          </span>
        ) : null}
        <PolicyFlagChips flags={item.flags} />
      </span>
      <DateCell value={item.submittedAt} format="relative" />
      <Amount value={item.total} currency="INR" align="right" className="whitespace-nowrap" />
      <span className="flex items-center gap-1">
        <Button size="sm" variant="secondary">
          Approve
        </Button>
        <Button size="sm" variant="ghost">
          Send back
        </Button>
        <Button size="sm" variant="ghost">
          Reject
        </Button>
      </span>
    </div>
  );
}
