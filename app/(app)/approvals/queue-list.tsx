"use client";

// Approval queue (D3.1) — DESIGN-PRD §7.3.
//
// A queue, not a table. CLAUDE.md says every list uses components/data-table,
// and this is the sanctioned exception: §7.3 asks for a 2px left-edge accent,
// a row that COLLAPSES out on approval, and inline decisions — none of which
// a column-oriented table gives without fighting it. The unit of work here is
// a decision, not a cell.
//
// PRESENTATION AND INTERACTION ONLY. decideReportAction, decideReport, the
// state machine, the guards and the AuditLog are untouched.
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

import { PolicyFlagChips } from "@/components/ui/policy-flag-chip";
import type { FlagLike } from "@/lib/domain/policy-flags";
import { Amount } from "@/components/ui/amount";
import { Avatar } from "@/components/shell/avatar-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateCell } from "@/components/ui/date-cell";
import { DecisionDialog, type DecisionKind } from "@/components/ui/decision-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { notify } from "@/components/ui/toaster";
import { collapseRow } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { bulkApproveAction, decideReportAction } from "./actions";

export type QueueItemView = {
  id: string;
  title: string;
  total: number;
  submittedAt: string | null;
  ownerName: string;
  expenseCount: number;
  level: 1 | 2;
  flagged: boolean;
  categories: string[];
  flags: FlagLike[];
};

export function QueueList({
  items,
  currency,
}: {
  items: QueueItemView[];
  currency: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = React.useTransition();
  const [dialog, setDialog] = React.useState<{ kind: DecisionKind; item: QueueItemView } | null>(
    null
  );
  const [dialogPending, setDialogPending] = React.useState(false);

  /**
   * Rows the reader has approved but the server hasn't been told about yet.
   *
   * THE COMMIT IS DEFERRED, NOT REVERSED. Approve hides the row and starts a
   * 5s toast; the action fires only when that window closes untouched. Undo
   * simply cancels it. The alternative — approve immediately and un-approve
   * on undo — would need a reversal action that doesn't exist and would write
   * an AuditLog entry for something that never really happened.
   */
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());
  const timers = React.useRef(new Map<string, () => void>());

  // Client-side navigation unmounts this while a window may still be open.
  // Fire the outstanding commits rather than silently dropping them; the
  // request outlives the component. A full page close still drops them, and
  // that is the safe direction — nothing was recorded.
  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const commit of pending.values()) commit();
      pending.clear();
    };
  }, []);

  const visible = items.filter((i) => !pendingIds.has(i.id));
  const selectedItems = visible.filter((i) => selected.has(i.id));
  const flaggedSelected = selectedItems.filter((i) => i.flagged);
  const selectable = visible.filter((i) => !i.flagged);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function approveOptimistically(item: QueueItemView) {
    setPendingIds((prev) => new Set(prev).add(item.id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });

    const restore = () => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    };

    const commit = () => {
      timers.current.delete(item.id);
      void decideReportAction({ reportId: item.id, action: "approve" }).then((res) => {
        if (res.ok) {
          router.refresh();
          return;
        }
        // The server disagreed. Put the row back exactly where it was and say
        // why — an optimistic UI that swallows a rejection is a lie (§4.5).
        restore();
        notify.error(`Couldn't approve ${item.title}`, res.error);
      });
    };
    timers.current.set(item.id, commit);

    notify.undo(`Approved ${item.title}`, {
      description: "Undo within 5 seconds.",
      onUndo: () => {
        timers.current.delete(item.id);
        restore();
      },
      onCommit: commit,
    });
  }

  function bulkApprove() {
    startBulk(async () => {
      const ids = selectedItems.map((i) => i.id);
      const res = await bulkApproveAction({ reportIds: ids });
      if (!res.ok) {
        notify.error("Couldn't approve the selection", res.error);
        return;
      }
      notify.success(
        `Approved ${res.data.approved} report${res.data.approved === 1 ? "" : "s"}`,
        res.data.skipped > 0 ? `${res.data.skipped} skipped` : undefined
      );
      setSelected(new Set());
      router.refresh();
    });
  }

  async function decide(kind: DecisionKind, item: QueueItemView, reason: string) {
    setDialogPending(true);
    const res = await decideReportAction({ reportId: item.id, action: kind, reason });
    setDialogPending(false);
    if (!res.ok) {
      notify.error(`Couldn't ${kind === "reject" ? "reject" : "send back"} ${item.title}`, res.error);
      return;
    }
    setDialog(null);
    notify.success(kind === "reject" ? `Rejected ${item.title}` : `Sent ${item.title} back`);
    router.refresh();
  }

  if (visible.length === 0) {
    return (
      <div className="border-line bg-bg-surface rounded-lg border">
        <EmptyState
          // A calm check, not a sad face: an empty approval queue is the
          // desired state, and congratulating it beats apologising for it.
          icon={<Check aria-hidden="true" className="size-5" />}
          headline="Nothing waiting on you"
          description="Reports appear here the moment someone submits one."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={selectable.length === 0}
          onClick={() =>
            setSelected(
              selected.size === selectable.length
                ? new Set()
                : new Set(selectable.map((i) => i.id))
            )
          }
        >
          {selected.size === selectable.length && selectable.length > 0
            ? "Clear selection"
            : "Select all unflagged"}
        </Button>

        <BulkApproveButton
          count={selectedItems.length}
          blockedBy={flaggedSelected}
          pending={bulkPending}
          onClick={bulkApprove}
        />
      </div>

      <ul className="grid gap-2">
        <AnimatePresence initial={false}>
          {visible.map((item) => (
            <motion.li
              key={item.id}
              variants={collapseRow}
              initial="visible"
              animate="visible"
              exit="exit"
              // The one sanctioned layout animation: the rows below have to
              // close the gap when this one leaves (lib/motion.ts).
              className="overflow-hidden"
            >
              <QueueRow
                item={item}
                currency={currency}
                selected={selected.has(item.id)}
                onToggle={() => toggle(item.id)}
                onApprove={() => approveOptimistically(item)}
                onSendBack={() => setDialog({ kind: "send_back", item })}
                onReject={() => setDialog({ kind: "reject", item })}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <DecisionDialog
        kind={dialog?.kind ?? null}
        reportTitle={dialog?.item.title ?? ""}
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        pending={dialogPending}
        onConfirm={(reason) => dialog && void decide(dialog.kind, dialog.item, reason)}
      />
    </div>
  );
}

/**
 * Bulk approve is gated on the selection carrying no flags (§7.3), and when
 * it is disabled the tooltip says EXACTLY why and which reports.
 *
 * The tooltip hangs off a wrapper, not the button: a disabled button fires no
 * pointer events, so a tooltip on it never appears — the classic way a
 * "the button explains itself" requirement silently doesn't.
 */
function BulkApproveButton({
  count,
  blockedBy,
  pending,
  onClick,
}: {
  count: number;
  blockedBy: QueueItemView[];
  pending: boolean;
  onClick: () => void;
}) {
  const blocked = blockedBy.length > 0;
  const disabled = pending || count === 0 || blocked;

  const button = (
    <Button size="sm" disabled={disabled} loading={pending} onClick={onClick}>
      Approve selected{count > 0 ? ` (${count})` : ""}
    </Button>
  );

  if (!blocked) return button;

  const names = blockedBy.slice(0, 3).map((i) => i.title).join(", ");
  const more = blockedBy.length > 3 ? ` and ${blockedBy.length - 3} more` : "";

  return (
    <Tooltip>
      {/* tabIndex so the explanation is reachable by keyboard, which a
          disabled button never is. */}
      <TooltipTrigger asChild>
        <span tabIndex={0} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2">
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {blockedBy.length === 1
          ? `${names} carries a policy flag — flagged reports need an individual decision.`
          : `${names}${more} carry policy flags — flagged reports need an individual decision.`}
      </TooltipContent>
    </Tooltip>
  );
}

function QueueRow({
  item,
  currency,
  selected,
  onToggle,
  onApprove,
  onSendBack,
  onReject,
}: {
  item: QueueItemView;
  currency: string;
  selected: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onSendBack: () => void;
  onReject: () => void;
}) {
  const categories =
    item.categories.length <= 2
      ? item.categories.join(", ")
      : `${item.categories.slice(0, 2).join(", ")} +${item.categories.length - 2}`;

  return (
    <div
      className={cn(
        "border-line bg-bg-surface flex flex-wrap items-center gap-3 rounded-lg border p-3",
        "transition-colors duration-instant ease-out",
        selected && "bg-accent-subtle border-accent-border",
        // §7.3's warning left edge. An inset shadow, not a border, so the
        // row's box is identical flagged or not and nothing shifts.
        item.flagged && "flagged-edge"
      )}
    >
      <Checkbox
        aria-label={
          item.flagged
            ? `${item.title} is flagged and can't be bulk approved`
            : `Select ${item.title}`
        }
        checked={selected}
        disabled={item.flagged}
        onCheckedChange={onToggle}
      />

      <span className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={item.ownerName} />
        <span className="grid min-w-0">
          <Link
            href={`/approvals/${item.id}`}
            className="text-text-primary truncate font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
          >
            {item.title}
          </Link>
          <span className="text-meta text-text-tertiary truncate">
            {item.ownerName} · {item.expenseCount} expense
            {item.expenseCount === 1 ? "" : "s"}
            {categories ? ` · ${categories}` : ""}
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

      {/* Age, not the date: "how long has this been waiting" is the decision
          signal, and this is an activity context — the one place relative
          time belongs (CLAUDE.md). */}
      <DateCell value={item.submittedAt} format="relative" />

      <Amount
        value={item.total}
        currency={currency}
        align="right"
        className="whitespace-nowrap"
      />

      {/* Approve is SECONDARY, not filled. §4.6 allows exactly one filled
          button in view, and a queue of twenty filled Approves would be
          twenty of them — the screen's one primary is "Approve selected". */}
      <span className="flex items-center gap-1">
        <Button size="sm" variant="secondary" onClick={onApprove}>
          Approve
        </Button>
        <Button size="sm" variant="ghost" onClick={onSendBack}>
          Send back
        </Button>
        <Button size="sm" variant="ghost" onClick={onReject}>
          Reject
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/approvals/${item.id}`}>Open</Link>
        </Button>
      </span>
    </div>
  );
}
