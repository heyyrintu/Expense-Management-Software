"use client";

// Bulk "Add to report" (D2.3) — the action the D1.2 floating bar was built
// for and deliberately shipped without.
//
// Existing report or a new one, from the same popover: the two are one
// decision ("where does this go?"), and splitting them across two buttons
// makes the reader answer a question they didn't ask.
//
// It calls the EXISTING addExpenseToReportAction once per expense — the
// action is per-expense and D2.3 is not the task that changes it. That is a
// real trade-off: n round-trips, and a partial failure leaves some expenses
// attached. So failures are counted and named rather than swallowed, and the
// list refreshes either way so the reader sees exactly what landed.
import * as React from "react";
import { useRouter } from "next/navigation";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { motion } from "framer-motion";
import { FilePlus2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fadeScale } from "@/lib/motion";
import { notify } from "@/components/ui/toaster";
import { addExpenseToReportAction, createReportAction } from "../reports/actions";
import { cn } from "@/lib/utils";

export type OpenReport = { id: string; title: string; expenseCount: number };

export function AddToReport({
  expenseIds,
  skippedCount = 0,
  reports,
  onDone,
}: {
  /** Only the expenses that can actually be attached. */
  expenseIds: string[];
  /** Selected rows that can't be — already on a report, or past draft. */
  skippedCount?: number;
  /** The user's draft / sent-back reports — the only ones that accept rows. */
  reports: OpenReport[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function attachAll(reportId: string) {
    let attached = 0;
    const failures: string[] = [];
    for (const expenseId of expenseIds) {
      const res = await addExpenseToReportAction({ reportId, expenseId });
      if (res.ok) attached += 1;
      else failures.push(res.error);
    }
    return { attached, failures };
  }

  async function run(fn: () => Promise<{ attached: number; failures: string[] }>) {
    setPending(true);
    setError(null);
    try {
      const { attached, failures } = await fn();
      if (attached > 0) {
        notify.success(
          `${attached} expense${attached === 1 ? "" : "s"} added to the report`
        );
      }
      if (failures.length > 0) {
        // Name what failed. "Some expenses couldn't be added" makes the reader
        // compare two lists by hand to work out which.
        setError(
          `${failures.length} couldn't be added — ${failures[0]}`
        );
      } else {
        setOpen(false);
        onDone();
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function addToExisting(reportId: string) {
    await run(() => attachAll(reportId));
  }

  async function createAndAdd() {
    await run(async () => {
      const created = await createReportAction({ title: title.trim() });
      if (!created.ok) return { attached: 0, failures: [created.error] };
      const result = await attachAll(created.data.id);
      // A new report with nothing in it is litter, but deleting it here would
      // be inventing cleanup logic. Say where it went instead.
      if (result.attached > 0) router.push(`/reports/${created.data.id}`);
      return result;
    });
  }

  const label = `Add to report`;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button size="sm" disabled={expenseIds.length === 0}>
          {label}
        </Button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" side="top" sideOffset={8} asChild>
          <motion.div
            variants={fadeScale}
            initial="hidden"
            animate="visible"
            className="border-line bg-bg-surface shadow-overlay origin-popover z-50 w-72 rounded-md border p-2"
          >
            <p className="text-meta text-text-tertiary px-2 py-1">
              Add {expenseIds.length} expense{expenseIds.length === 1 ? "" : "s"} to
            </p>
            {skippedCount > 0 ? (
              // Said BEFORE the reader commits, not as n error messages after.
              // Only a draft expense can join a report; anything already
              // submitted stays where it is.
              <p className="text-meta text-status-warning-text px-2 pb-1">
                {skippedCount} selected {skippedCount === 1 ? "expense is" : "expenses are"}{" "}
                already on a report or past draft, and will be left alone.
              </p>
            ) : null}

            {creating ? (
              <div className="grid gap-2 p-2">
                <label htmlFor="new-report-title" className="text-label text-text-secondary">
                  New report title
                </label>
                <Input
                  id="new-report-title"
                  autoFocus
                  value={title}
                  placeholder="August travel"
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && title.trim()) void createAndAdd();
                  }}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                    Back
                  </Button>
                  <Button
                    size="sm"
                    loading={pending}
                    disabled={!title.trim()}
                    onClick={() => void createAndAdd()}
                  >
                    Create and add
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ul className="grid max-h-56 overflow-y-auto">
                  {reports.map((report) => (
                    <li key={report.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void addToExisting(report.id)}
                        className={cn(
                          "text-label text-text-secondary hover:bg-bg-subtle flex h-11 w-full items-center justify-between gap-2 rounded-md px-3 text-left",
                          "transition-colors duration-instant ease-out",
                          "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
                        )}
                      >
                        <span className="truncate">{report.title}</span>
                        <span className="text-meta text-text-tertiary tabular shrink-0">
                          {report.expenseCount}
                        </span>
                      </button>
                    </li>
                  ))}
                  {reports.length === 0 ? (
                    <li className="text-meta text-text-tertiary px-3 py-2">
                      No open reports yet.
                    </li>
                  ) : null}
                </ul>

                <div className="bg-line my-1 h-px" role="none" />
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className={cn(
                    "text-label text-accent-text hover:bg-bg-subtle flex h-11 w-full items-center gap-2 rounded-md px-3",
                    "transition-colors duration-instant ease-out",
                    "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
                  )}
                >
                  {reports.length === 0 ? (
                    <FilePlus2 aria-hidden="true" className="size-4" />
                  ) : (
                    <Plus aria-hidden="true" className="size-4" />
                  )}
                  New report…
                </button>
              </>
            )}

            {error ? (
              <p role="alert" className="text-meta text-status-danger-text px-3 py-2">
                {error}
              </p>
            ) : null}
          </motion.div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
