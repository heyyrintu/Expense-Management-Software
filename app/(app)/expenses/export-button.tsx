"use client";

// Export the expense list as CSV (G1).
//
// The route behind this button (app/api/exports/expenses/route.ts) has been
// complete since 4.2 and had no caller — a shipped feature nobody could
// reach. What it needed was not a button so much as a guarantee: the file has
// to be the rows on screen, or it is worse than no export at all, because a
// wrong CSV is one nobody discovers until it has been mailed to an accountant.
//
// That guarantee lives in lib/domain/expense-list-query.ts, which the screen
// and the route both call. Here it is just serialisation: `expenseExportHref`
// runs the SAME `expenseFiltersToParams` the list's own URL uses, so whatever
// the reader has filtered to is what the query string says.
//
// A plain <a download>, like the ledger's export menu — no fetch, no blob, no
// progress state. The browser's own download UI is better than anything built
// here, and the link still works if this component never hydrates.
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  EXPENSE_EXPORT_MAX_ROWS,
  expenseExportHref,
} from "@/lib/domain/expense-list-query";
import type { ExpenseViewScope } from "@/lib/domain/expense-scope";
import { formatCount } from "@/lib/format";
import type { ExpenseFilters } from "@/lib/schemas/expense-filters";

export function ExportButton({
  filters,
  scope,
  totalRows,
}: {
  filters: ExpenseFilters;
  /** The scope the SERVER resolved, not the one the URL asked for — so the
   *  export carries the width the reader actually has. */
  scope: ExpenseViewScope;
  /** Rows the current filters match, for the cap disclosure below. */
  totalRows: number;
}) {
  const capped = totalRows > EXPENSE_EXPORT_MAX_ROWS;

  return (
    <span className="grid justify-items-end gap-1">
      <Button asChild variant="secondary">
        <a href={expenseExportHref(filters, { scope })} download>
          <Download aria-hidden="true" className="size-4" />
          Export CSV
        </a>
      </Button>

      {/* A cap is a lie the moment it is silently hit. If the filtered set is
          larger than one file holds, the reader is told BEFORE clicking —
          finding out afterwards means finding out from a total that is short
          by an amount nothing on screen explains. */}
      {capped ? (
        <span className="text-meta text-text-tertiary">
          First {formatCount(EXPENSE_EXPORT_MAX_ROWS)} of {formatCount(totalRows)}
          {" "}— narrow the filters for the rest
        </span>
      ) : null}
    </span>
  );
}
