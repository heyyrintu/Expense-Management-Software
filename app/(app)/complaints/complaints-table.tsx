"use client";

// Finance complaints inbox (D4.3) — DESIGN-PRD §7.7.
//
// The shared DataTable, with status / type / age facets in its toolbar and an
// SLA column. Unlike the approval queue (§7.3) and the ledger (§7.5), this is
// an ordinary list of records — sortable, filterable, one row per thing — so
// it takes the shared table rather than earning an exception.
//
// ── AGING EMPHASIS ────────────────────────────────────────────────────────
// A breached row carries a 2px DANGER left edge, the same inset-shadow trick
// the approval queue uses for flags: an inset shadow, never a border, so a
// breached row and a fresh one have identical boxes and the table doesn't
// jitter as ages tick over. Amber rows get nothing extra — the SLA badge in
// the column already says "3 of 5 days", and edging two thirds of the inbox
// would leave the reader with no emphasis at all.
import * as React from "react";
import { useRouter } from "next/navigation";

import { DataTable, type DataTableColumn } from "@/components/data-table";
import { FacetSelect } from "@/components/filters";
import { AnimatedStatusBadge } from "@/components/complaints/animated-status-badge";
import { SlaBadge } from "@/components/sla-badge";
import { Avatar } from "@/components/shell/avatar-menu";
import { DateCell } from "@/components/ui/date-cell";
import {
  COMPLAINT_STATUSES,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_TYPES,
  COMPLAINT_TYPE_LABELS,
  type ComplaintStatus,
  type ComplaintType,
} from "@/lib/domain/complaint";
import { cn } from "@/lib/utils";
import type {
  ComplaintAgeFilter,
  ComplaintUrlFilters,
} from "@/lib/domain/complaint-filters";
import { complaintFiltersToParams } from "@/lib/domain/complaint-filters";

export type ComplaintTableRow = {
  id: string;
  type: ComplaintType;
  status: ComplaintStatus;
  description: string;
  /** ISO instants — DateCell parses them (D1.1). */
  createdAt: string;
  resolvedAt: string | null;
  raisedByName: string;
  assignedToName: string | null;
  targetLabel: string;
  messageCount: number;
  /** Computed server-side from the same slaBadge the column renders. */
  breached: boolean;
};

const AGE_OPTIONS = [
  { value: "warning", label: "3+ business days" },
  { value: "breached", label: "Past SLA" },
] as const;

export function ComplaintsTable({
  rows,
  filters,
}: {
  rows: ComplaintTableRow[];
  filters: ComplaintUrlFilters;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const setFilters = React.useCallback(
    (next: ComplaintUrlFilters) => {
      const query = complaintFiltersToParams(next).toString();
      startTransition(() => {
        // replace, not push — twenty filter tweaks shouldn't mean twenty
        // presses of Back to leave the inbox.
        router.replace(query ? `/complaints?${query}` : "/complaints", {
          scroll: false,
        });
      });
    },
    [router]
  );

  const columns: DataTableColumn<ComplaintTableRow>[] = React.useMemo(
    () => [
      {
        id: "type",
        accessorFn: (row) => COMPLAINT_TYPE_LABELS[row.type],
        header: "Complaint",
        meta: { label: "Complaint", alwaysVisible: true, skeletonWidth: "16rem" },
        cell: ({ row }) => (
          <span className="grid gap-1">
            <span className="text-body text-text-primary">
              {COMPLAINT_TYPE_LABELS[row.original.type]}
            </span>
            <span className="text-meta text-text-tertiary line-clamp-1">
              {row.original.description}
            </span>
          </span>
        ),
      },
      {
        id: "raisedBy",
        accessorFn: (row) => row.raisedByName,
        header: "Raised by",
        meta: { label: "Raised by", skeletonWidth: "10rem" },
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Avatar name={row.original.raisedByName} className="size-6 shrink-0" />
            <span className="text-body text-text-secondary truncate">
              {row.original.raisedByName}
            </span>
          </span>
        ),
      },
      {
        id: "target",
        accessorFn: (row) => row.targetLabel,
        header: "About",
        meta: { label: "About", skeletonWidth: "12rem" },
        cell: ({ row }) => (
          <span className="text-meta text-text-tertiary truncate">
            {row.original.targetLabel}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => row.status,
        header: "Status",
        meta: { label: "Status", skeletonWidth: "6rem" },
        cell: ({ row }) => <AnimatedStatusBadge status={row.original.status} />,
      },
      {
        id: "sla",
        // Sorts by AGE, not by the badge's words: a reader clicking this
        // column wants the oldest first, and "3 of 5 business days" sorts
        // alphabetically into nonsense.
        accessorFn: (row) => new Date(row.createdAt).getTime(),
        header: "SLA",
        meta: { label: "SLA", skeletonWidth: "9rem" },
        cell: ({ row }) => (
          <SlaBadge
            createdAt={new Date(row.original.createdAt)}
            resolvedAt={row.original.resolvedAt ? new Date(row.original.resolvedAt) : null}
            status={row.original.status}
          />
        ),
      },
      {
        id: "assignedTo",
        accessorFn: (row) => row.assignedToName ?? "",
        header: "Handler",
        meta: { label: "Handler", skeletonWidth: "9rem" },
        cell: ({ row }) =>
          row.original.assignedToName ? (
            <span className="text-body text-text-secondary truncate">
              {row.original.assignedToName}
            </span>
          ) : (
            // Unassigned is a state finance acts on, not a blank.
            <span className="text-meta text-status-warning-text">Unassigned</span>
          ),
      },
      {
        id: "raised",
        accessorFn: (row) => new Date(row.createdAt).getTime(),
        header: "Raised",
        meta: { label: "Raised", align: "right", skeletonWidth: "7rem" },
        cell: ({ row }) => (
          // Relative is right here: this is an activity column, and it sits
          // beside the SLA badge that carries the precise business-day count.
          <DateCell value={row.original.createdAt} format="relative" tone="muted" />
        ),
      },
    ],
    []
  );

  return (
    <DataTable
      label="Complaints"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      onRowClick={(row) => router.push(`/complaints/${row.id}`)}
      // Aging emphasis (§7.7). Only breached rows — edging the amber ones
      // too would mark two thirds of a busy inbox and leave no emphasis at
      // all. An inset shadow, so the row's box is unchanged.
      rowClassName={(row) => (row.breached ? "overdue-edge" : undefined)}
      pagination={{ mode: "client" }}
      empty={{
        headline: "Nothing matches these filters",
        description: "Clear a filter to widen the inbox.",
      }}
      toolbar={
        <span
          className={cn(
            "flex flex-wrap items-center gap-2",
            pending && "opacity-60 transition-opacity duration-instant ease-out"
          )}
        >
          {/* FacetSelect, not a hand-rolled row of pills: same menu, same
              chips, same behaviour as every other list. The FilterBar wrapper
              is bound to the expense URL schema, so the complaints inbox
              composes the control directly with its own state (D4.3). */}
          <FacetSelect
            facet={{
              key: "status",
              label: "Status",
              options: COMPLAINT_STATUSES.map((s) => ({
                value: s,
                label: COMPLAINT_STATUS_LABELS[s],
              })),
            }}
            selected={filters.status}
            // FacetSelect is key-generic and hands back plain strings; the
            // screen owns the narrowing, since only it knows which union the
            // values belong to.
            onChange={(next) =>
              setFilters({ ...filters, status: next as ComplaintStatus[] })
            }
          />
          <FacetSelect
            facet={{
              key: "type",
              label: "Type",
              options: COMPLAINT_TYPES.map((t) => ({
                value: t,
                label: COMPLAINT_TYPE_LABELS[t],
              })),
            }}
            selected={filters.type}
            onChange={(next) =>
              setFilters({ ...filters, type: next as ComplaintType[] })
            }
          />
          <FacetSelect
            facet={{
              key: "age",
              label: "Age",
              options: AGE_OPTIONS.map((a) => ({ value: a.value, label: a.label })),
            }}
            selected={filters.age}
            onChange={(next) =>
              setFilters({ ...filters, age: next as ComplaintAgeFilter[] })
            }
          />
        </span>
      }
      renderCard={(row) => (
        <span className="grid gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-body text-text-primary">
              {COMPLAINT_TYPE_LABELS[row.original.type]}
            </span>
            <AnimatedStatusBadge status={row.original.status} />
            <SlaBadge
              createdAt={new Date(row.original.createdAt)}
              resolvedAt={
                row.original.resolvedAt ? new Date(row.original.resolvedAt) : null
              }
              status={row.original.status}
            />
          </span>
          <span className="text-meta text-text-tertiary line-clamp-2">
            {row.original.description}
          </span>
          <span className="text-meta text-text-tertiary flex flex-wrap items-center gap-2">
            <Avatar name={row.original.raisedByName} className="size-5 shrink-0" />
            {row.original.raisedByName} · {row.original.targetLabel}
          </span>
        </span>
      )}
    />
  );
}
