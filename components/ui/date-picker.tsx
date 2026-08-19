"use client";

// DatePicker (§6.1): a calendar in a popover, matching the input surface.
//
// The trigger is a real button showing the formatted date, so the control is
// keyboard-operable and announces its value; react-day-picker handles arrow
// navigation inside the grid. A hidden input carries the yyyy-mm-dd value so
// the component drops into an existing <form> without extra wiring.
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { formatDate, toDateInputValue } from "@/lib/format";
import { fadeScale } from "@/lib/motion";
import { FIELD_HEIGHT } from "./field";

export type DatePickerProps = {
  id: string;
  name?: string;
  value?: Date | null;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
};

function DatePicker({
  id,
  name,
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  invalid,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Date | undefined>(value ?? undefined);

  React.useEffect(() => {
    setSelected(value ?? undefined);
  }, [value]);

  function handleSelect(date: Date | undefined) {
    setSelected(date);
    onChange?.(date);
    // Closing on pick is the behaviour people expect; Esc and click-away
    // also close, both handled by Radix.
    if (date) setOpen(false);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          // aria-invalid isn't valid on a plain button role, so the invalid
          // state is carried as data and announced via the Field's error text.
          data-invalid={invalid ? "" : undefined}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-sm border border-line-strong bg-bg-surface px-3",
            "text-body text-text-primary transition-[border-color,box-shadow] duration-instant ease-out",
            "outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app",
            "disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-tertiary",
            "data-[invalid]:border-status-danger",
            FIELD_HEIGHT,
            className
          )}
        >
          <span className={cn(!selected && "text-text-tertiary")}>
            {selected ? formatDate(selected) : placeholder}
          </span>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-text-secondary size-4">
            <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </PopoverPrimitive.Trigger>

      {name ? (
        <input type="hidden" name={name} value={selected ? toDateInputValue(selected) : ""} />
      ) : null}

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={6} asChild>
          {/* Scales from the trigger — animation anchored to its origin. */}
          <motion.div
            variants={fadeScale}
            initial="hidden"
            animate="visible"
            className="border-line bg-bg-surface shadow-overlay origin-popover z-50 rounded-lg border p-3"
          >
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={handleSelect}
              showOutsideDays
              classNames={{
                months: "grid gap-4",
                month: "grid gap-3",
                month_caption: "flex h-9 items-center",
                caption_label: "text-h3 text-text-primary",
                nav: "flex items-center gap-1 absolute right-0 top-0",
                button_previous:
                  "grid size-9 place-items-center rounded-md text-text-secondary hover:bg-bg-subtle outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
                button_next:
                  "grid size-9 place-items-center rounded-md text-text-secondary hover:bg-bg-subtle outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
                chevron: "size-4 fill-current",
                month_grid: "w-full border-collapse",
                weekdays: "flex",
                weekday: "text-meta text-text-tertiary w-9 font-normal",
                week: "flex w-full",
                day: "p-0",
                day_button:
                  "grid size-9 place-items-center rounded-md text-body text-text-primary tabular hover:bg-bg-subtle outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
                selected:
                  "[&_button]:bg-accent-solid [&_button]:text-text-on-accent [&_button]:hover:bg-accent-hover",
                today: "[&_button]:text-accent-text [&_button]:font-medium",
                outside: "[&_button]:text-text-tertiary",
                disabled: "[&_button]:text-text-tertiary [&_button]:opacity-50",
                root: "relative",
              }}
            />
          </motion.div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export { DatePicker };
