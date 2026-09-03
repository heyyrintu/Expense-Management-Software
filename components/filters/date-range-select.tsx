"use client";

// Date-range control (D1.3): three presets and Custom.
//
// The URL stores the resolved DATES, never the preset name. "This month" in a
// link shared on 31 August must still mean August when it is opened on
// 1 September — a link that quietly changes what it points to is worse than
// no link. presetForRange() reads the dates back and lights up the matching
// preset, so the shorthand survives in the UI without living in the URL.
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { m } from "framer-motion";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fadeScale } from "@/lib/motion";
import {
  PRESET_LABELS,
  RANGE_PRESETS,
  presetForRange,
  resolvePreset,
  type RangePreset,
} from "@/lib/date-range";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DateRangeSelect({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (next: { from?: string; to?: string }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const active = presetForRange({ from, to });
  const hasRange = Boolean(from || to);

  function applyPreset(preset: RangePreset) {
    if (preset === "custom") return; // Custom means "use the two inputs".
    const range = resolvePreset(preset);
    if (range) onChange(range);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className={cn(hasRange && "border-accent-border")}
        >
          <CalendarDays aria-hidden="true" className="size-4" />
          {hasRange ? rangeLabel(from, to, active) : "Any date"}
        </Button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={6} asChild>
          <m.div
            variants={fadeScale}
            initial="hidden"
            animate="visible"
            className="border-line bg-bg-surface shadow-overlay origin-popover z-50 w-72 rounded-md border p-3"
          >
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                {RANGE_PRESETS.filter((p) => p !== "custom").map((preset) => (
                  <Button
                    key={preset}
                    size="sm"
                    variant={active === preset ? "primary" : "secondary"}
                    onClick={() => applyPreset(preset)}
                  >
                    {PRESET_LABELS[preset]}
                  </Button>
                ))}
              </div>

              <div className="grid gap-2">
                <span className="text-meta text-text-tertiary">
                  {PRESET_LABELS.custom}
                </span>
                <div className="flex items-center gap-2">
                  <label className="grid flex-1 gap-1">
                    <span className="text-meta text-text-tertiary">From</span>
                    <Input
                      type="date"
                      value={from ?? ""}
                      max={to}
                      onChange={(e) => onChange({ from: e.target.value || undefined, to })}
                    />
                  </label>
                  <label className="grid flex-1 gap-1">
                    <span className="text-meta text-text-tertiary">To</span>
                    <Input
                      type="date"
                      value={to ?? ""}
                      min={from}
                      onChange={(e) => onChange({ from, to: e.target.value || undefined })}
                    />
                  </label>
                </div>
              </div>

              {hasRange ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange({ from: undefined, to: undefined })}
                >
                  Clear dates
                </Button>
              ) : null}
            </div>
          </m.div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * A preset shows its name; anything else shows the dates. Plain strings, not
 * <DateCell>: this is a button label, and a label needs text.
 */
export function rangeLabel(from?: string, to?: string, preset?: RangePreset): string {
  const resolved = preset ?? presetForRange({ from, to });
  if (resolved !== "custom") return PRESET_LABELS[resolved];
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Until ${formatDate(to)}`;
  return "Any date";
}
