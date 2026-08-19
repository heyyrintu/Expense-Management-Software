"use client";

// Checkbox · Radio · Switch (§6.1).
//
// All three are Radix primitives so keyboard behaviour, ARIA and label
// association come for free; the styling is tokens only. Each sits inside a
// 44px tap target on coarse pointers without the visible control growing.
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const controlFocus =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app";
const controlDisabled = "disabled:cursor-not-allowed disabled:opacity-50";
/** Invisible 44px hit area around a small control (§6.1 touch targets). */
const tapTarget =
  "relative after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-sm border border-line-strong bg-bg-surface",
        "transition-[background-color,border-color] duration-instant ease-out",
        "hover:border-accent",
        "data-[state=checked]:border-accent-solid data-[state=checked]:bg-accent-solid data-[state=checked]:text-text-on-accent",
        "data-[state=indeterminate]:border-accent-solid data-[state=indeterminate]:bg-accent-solid data-[state=indeterminate]:text-text-on-accent",
        controlFocus,
        controlDisabled,
        tapTarget,
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center text-current">
        {props.checked === "indeterminate" ? (
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
            <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden="true">
            <path
              d="M3.5 8.5l3 3 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "size-4 shrink-0 rounded-full border border-line-strong bg-bg-surface",
        "transition-[border-color] duration-instant ease-out hover:border-accent",
        "data-[state=checked]:border-accent-solid",
        controlFocus,
        controlDisabled,
        tapTarget,
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="grid size-full place-items-center">
        <span className="bg-accent-solid size-2 rounded-full" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // 40×24 with a 16px thumb: every offset lands on the 4px grid.
        "inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent bg-line-strong",
        "transition-colors duration-fast ease-out",
        "data-[state=checked]:bg-accent-solid",
        controlFocus,
        controlDisabled,
        tapTarget,
        className
      )}
      {...props}
    >
      {/* The thumb moves on transform only. */}
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-bg-surface shadow-raised",
          "transition-transform duration-fast ease-out",
          "translate-x-1 data-[state=checked]:translate-x-5"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Checkbox, RadioGroup, RadioGroupItem, Switch };
