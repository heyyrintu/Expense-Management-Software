"use client";

// Sheet (§6.1): a Vaul bottom sheet with drag-to-dismiss on mobile, a side
// sheet on desktop.
//
// One component, two surfaces. Vaul is Emil's own library, so the drag
// physics already match the project's motion rules — soft spring, snaps
// back if you don't drag far enough, never leaves a stuck state.
import * as React from "react";
import { Drawer } from "vaul";

import { cn } from "@/lib/utils";

type SheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

/** `side` is honoured from md up; below that it is always a bottom sheet. */
function Sheet({ open, onOpenChange, children }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Drawer.Root>
  );
}

const SheetTrigger = Drawer.Trigger;
const SheetClose = Drawer.Close;

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof Drawer.Content> & { side?: "right" | "bottom" }) {
  return (
    <Drawer.Portal>
      <Drawer.Overlay className="bg-scrim fixed inset-0 z-50" />
      <Drawer.Content
        data-slot="sheet-content"
        className={cn(
          "bg-bg-surface border-line fixed z-50 flex flex-col outline-none",
          // Mobile: bottom sheet, rounded top, drag handle.
          "inset-x-0 bottom-0 max-h-sheet rounded-t-lg border-t",
          // Desktop: side sheet.
          side === "right" &&
            "md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-full md:max-w-md md:rounded-none md:rounded-l-lg md:border-t-0 md:border-l",
          className
        )}
        {...props}
      >
        {/* The grabber. Present only where the sheet is draggable. */}
        <div
          aria-hidden="true"
          className="bg-line-strong mx-auto mt-3 h-1 w-10 shrink-0 rounded-full md:hidden"
        />
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </Drawer.Content>
    </Drawer.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("grid gap-1 pb-4", className)} {...props} />;
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof Drawer.Title>) {
  return (
    <Drawer.Title
      data-slot="sheet-title"
      className={cn("text-h2 text-text-primary", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof Drawer.Description>) {
  return (
    <Drawer.Description
      data-slot="sheet-description"
      className={cn("text-body text-text-secondary", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("border-line mt-4 flex items-center justify-end gap-2 border-t pt-4", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
