"use client";

// Export menu (D4.1) — §7.5's "CSV · Tally XML · Print".
//
// Same Radix Popover + fadeScale + origin-popover pattern as the filter
// facets, rather than a new dropdown-menu dependency for three items. What
// Popover does not supply is menu semantics, so those are declared here
// (`role="menu"` / `role="menuitem"`); arrow-key roving is the one thing a
// real menu primitive would add, and Tab reaches every item without it.
//
// The two exports are plain <a download> straight at the route — no fetch, no
// blob, no progress state. The browser's own download UI is better than any
// of those, and it means the exports still work if this component never
// hydrates.
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { motion } from "framer-motion";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fadeScale } from "@/lib/motion";

const ITEM_CLASS =
  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-body text-text-primary " +
  "hover:bg-bg-subtle transition-colors duration-instant ease-out " +
  "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2";

export function ExportMenu({
  csvHref,
  tallyHref,
}: {
  csvHref: string;
  tallyHref: string;
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <Button variant="secondary">
          <Download aria-hidden="true" className="size-4" />
          Export
        </Button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={6} asChild>
          <motion.div
            variants={fadeScale}
            initial="hidden"
            animate="visible"
            // origin-POPOVER, not origin-dropdown (D5.2). This is built on Radix
            // Popover, so `--radix-dropdown-menu-content-transform-origin` was
            // never set and the menu scaled from its own centre instead of from
            // the Export button — the exact "anchored to its origin" rule §4.4
            // exists for, failing silently because an unset CSS variable falls
            // back to something plausible.
            className="border-line bg-bg-surface shadow-overlay origin-popover z-50 w-64 rounded-md border p-1"
          >
            <div role="menu" aria-label="Export ledger" className="grid gap-0.5">
              <a role="menuitem" href={csvHref} download className={ITEM_CLASS}>
                <FileSpreadsheet aria-hidden="true" className="size-4 shrink-0" />
                <span className="grid">
                  <span>CSV</span>
                  <span className="text-meta text-text-tertiary">
                    Every line, plus a totals row
                  </span>
                </span>
              </a>

              <a role="menuitem" href={tallyHref} download className={ITEM_CLASS}>
                <FileText aria-hidden="true" className="size-4 shrink-0" />
                <span className="grid">
                  <span>Tally XML</span>
                  <span className="text-meta text-text-tertiary">
                    Receipt and payment vouchers
                  </span>
                </span>
              </a>

              <button
                role="menuitem"
                type="button"
                onClick={() => window.print()}
                className={ITEM_CLASS}
              >
                <Printer aria-hidden="true" className="size-4 shrink-0" />
                <span className="grid">
                  <span>Print</span>
                  <span className="text-meta text-text-tertiary">
                    Header repeats on every page
                  </span>
                </span>
              </button>
            </div>
          </motion.div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
