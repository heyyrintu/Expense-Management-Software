"use client";

// Tabs / segmented control (§6.1).
//
// The active indicator is a shared layout animation: one motion element with
// a stable layoutId slides between triggers instead of the highlight jumping.
// Framer animates it on transform, and reduced motion turns the slide into a
// plain swap.
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { DURATION, EASE, seconds } from "@/lib/motion";

const TabsContext = React.createContext<string>("tabs");

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  // Each Tabs instance gets its own layout group, or two tab bars on one
  // page would animate into each other.
  const id = React.useId();
  return (
    <TabsContext.Provider value={id}>
      <TabsPrimitive.Root
        data-slot="tabs"
        className={cn("grid gap-4", className)}
        {...props}
      />
    </TabsContext.Provider>
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("border-line inline-flex items-center gap-1 border-b", className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const groupId = React.useContext(TabsContext);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // 44px tall: a tab is a primary navigation target.
        "group relative inline-flex h-11 items-center px-3 text-body font-medium",
        "text-text-secondary transition-colors duration-instant ease-out",
        "hover:text-text-primary data-[state=active]:text-text-primary",
        "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {/* Rendered only for the active tab; the shared layoutId is what makes
          it slide rather than jump. */}
      <span className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 group-data-[state=inactive]:hidden">
        <motion.span
          layoutId={`${groupId}-tab-indicator`}
          className="bg-accent block size-full rounded-full"
          transition={{ duration: seconds(DURATION.base), ease: [...EASE.out] }}
        />
      </span>
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
