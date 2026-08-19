"use client";

// URL synchronisation for the filter bar (D1.3).
//
// THE URL IS THE STATE. Not a mirror of state kept somewhere else — the one
// copy. That is what makes a filtered view survive refresh, back/forward,
// bookmarking and being pasted into chat, and it is why the filter bar is a
// controlled component rather than a stateful one.
//
// The only exception is the search box, which keeps a local draft so typing
// stays responsive; it commits to the URL on a debounce. See below.
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  expenseFiltersToParams,
  parseExpenseFilters,
  searchParamsToRecord,
  type ExpenseFilters,
} from "@/lib/schemas/expense-filters";

/** Long enough to skip most intermediate keystrokes, short enough to feel live. */
export const SEARCH_DEBOUNCE_MS = 300;

export function useUrlFilters(): {
  filters: ExpenseFilters;
  setFilters: (next: ExpenseFilters) => void;
  /** True while the server is re-rendering for a filter change. */
  pending: boolean;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const filters = React.useMemo(
    () => parseExpenseFilters(searchParamsToRecord(new URLSearchParams(searchParams))),
    [searchParams]
  );

  const setFilters = React.useCallback(
    (next: ExpenseFilters) => {
      const params = expenseFiltersToParams(next);
      const query = params.toString();
      startTransition(() => {
        // replace, not push: twenty filter tweaks should not mean twenty
        // presses of the back button to leave the screen.
        //
        // scroll: false because a filter change re-renders the list in place;
        // jumping to the top would lose the reader's position for no reason.
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router]
  );

  return { filters, setFilters, pending };
}

/**
 * A text value that types locally and commits on a debounce.
 *
 * Without this every keystroke would be a server round-trip, and the input
 * would fight the user as results streamed back mid-word. The draft resets
 * when the committed value changes from outside — clearing the filter from a
 * chip has to empty the box too.
 */
export function useDebouncedText(
  committed: string,
  commit: (value: string) => void,
  delayMs: number = SEARCH_DEBOUNCE_MS
): [string, (value: string) => void] {
  const [draft, setDraft] = React.useState(committed);
  const commitRef = React.useRef(commit);
  commitRef.current = commit;

  React.useEffect(() => {
    setDraft(committed);
  }, [committed]);

  React.useEffect(() => {
    if (draft === committed) return;
    const id = window.setTimeout(() => commitRef.current(draft), delayMs);
    // Clearing on every keystroke is what makes it a debounce rather than a
    // queue of pending commits.
    return () => window.clearTimeout(id);
  }, [draft, committed, delayMs]);

  return [draft, setDraft];
}
