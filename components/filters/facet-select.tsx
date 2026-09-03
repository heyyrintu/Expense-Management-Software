"use client";

// Multi-select facet (D1.3). A popover of checkboxes, scaling from its
// trigger via origin-popover (§4.4).
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { m } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fadeScale } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { FacetConfig } from "./types";

export function FacetSelect({
  facet,
  selected,
  onChange,
}: {
  // Generic in the key (D4.3): this control never indexes anything by it, so
  // any screen with its own filter state can use it.
  facet: FacetConfig<string>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  function toggle(value: string) {
    onChange(
      selectedSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value]
    );
  }

  if (facet.options.length === 0) return null;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          size="sm"
          variant="secondary"
          // Selected state is carried by the count, not by colouring the
          // trigger: accent means "act here" (§4.1), and a filter that is
          // merely applied is not asking to be acted on.
          className={cn(selected.length > 0 && "border-accent-border")}
        >
          {facet.label}
          {selected.length > 0 ? (
            <span className="bg-accent-subtle text-accent-text rounded-sm px-1 text-meta tabular">
              {selected.length}
            </span>
          ) : null}
          <ChevronDown aria-hidden="true" className="size-4" />
        </Button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={6} asChild>
          <m.div
            variants={fadeScale}
            initial="hidden"
            animate="visible"
            className="border-line bg-bg-surface shadow-overlay origin-popover z-50 w-56 rounded-md border p-1"
          >
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-meta text-text-tertiary">{facet.label}</span>
              {selected.length > 0 ? (
                <Button size="sm" variant="ghost" onClick={() => onChange([])}>
                  Clear
                </Button>
              ) : null}
            </div>
            <ul className="grid max-h-64 overflow-y-auto">
              {facet.options.map((option) => (
                <li key={option.value}>
                  <label className="text-label text-text-secondary hover:bg-bg-subtle flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 transition-colors duration-instant ease-out">
                    <Checkbox
                      checked={selectedSet.has(option.value)}
                      onCheckedChange={() => toggle(option.value)}
                    />
                    <span className="truncate">{option.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </m.div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
