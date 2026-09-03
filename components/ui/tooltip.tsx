"use client";

// Tooltip (§6.1). Radix handles hover/focus delay, dismissal and ARIA; the
// content fades and scales from its origin using the shared variant.
import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { m } from "framer-motion";

import { cn } from "@/lib/utils";
import { fadeScale } from "@/lib/motion";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content sideOffset={sideOffset} asChild {...props}>
        <m.div
          variants={fadeScale}
          initial="hidden"
          animate="visible"
          className={cn(
            "bg-text-primary text-bg-surface origin-tooltip shadow-overlay z-50 max-w-64 rounded-sm px-2 py-1 text-meta",
            className
          )}
        >
          {children}
        </m.div>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent };
