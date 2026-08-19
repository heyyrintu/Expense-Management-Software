"use client";

// Ledger controls (D4.1) — entity switcher, entity picker, date range.
//
// All three write to the URL, because the ledger is a server-rendered
// statement: there is no client-side dataset to re-filter, and a URL is what
// makes "the Northwind project, this quarter" something you can paste to your
// accountant.
//
// The date range is the SHARED FilterBar, not a pair of date inputs — same
// presets, same chips, same mobile sheet as every list. The facets array is
// empty on purpose: category and project narrow expenses, and a ledger line
// is a report or a payment, so those facets would offer to filter by
// something these rows do not have.
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FilterBar, useUrlFilters } from "@/components/filters";
import { NativeSelect } from "@/components/ui/native-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { LedgerEntityKind } from "@/lib/analytics/ledger-entity";

/** Not filters, but they must survive one — see useUrlFilters(preserve). */
const PRESERVED_PARAMS = ["entity", "id"] as const;

export type EntityOption = { id: string; name: string };

export function LedgerControls({
  kind,
  entityId,
  options,
  canSwitchEntity,
}: {
  kind: LedgerEntityKind;
  entityId: string;
  /** The pickable entities for the CURRENT kind, resolved server-side. */
  options: EntityOption[];
  /** False below finance_admin: an employee has one ledger, their own. */
  canSwitchEntity: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { filters, setFilters, pending } = useUrlFilters(PRESERVED_PARAMS);

  /** Navigate, keeping the date range and replacing entity/id together. */
  const go = React.useCallback(
    (next: { entity?: LedgerEntityKind; id?: string }) => {
      const params = new URLSearchParams(searchParams);
      if (next.entity !== undefined) {
        params.set("entity", next.entity);
        // Switching KIND invalidates the id — a project id is not a user id,
        // and carrying it over would resolve to nothing and render an empty
        // ledger that looks like a data problem.
        params.delete("id");
      }
      if (next.id !== undefined) {
        if (next.id) params.set("id", next.id);
        else params.delete("id");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="grid gap-3" data-print="hide">
      {canSwitchEntity ? (
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Ledger entity"
            value={kind}
            onChange={(next) => go({ entity: next })}
            segments={[
              { value: "user", label: "User" },
              { value: "project", label: "Project" },
              { value: "department", label: "Department" },
            ]}
          />

          <label className="flex items-center gap-2">
            <span className="sr-only">Choose {kind}</span>
            <NativeSelect
              value={entityId}
              onChange={(e) => go({ id: e.target.value })}
              className="w-56"
            >
              {kind === "user" ? <option value="">Me</option> : null}
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
      ) : null}

      <FilterBar
        config={{ dateRange: true, facets: [] }}
        value={filters}
        onChange={setFilters}
        className={
          pending ? "opacity-60 transition-opacity duration-instant ease-out" : undefined
        }
      />
    </div>
  );
}
