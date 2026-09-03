"use client";

// Dialog (§6.1): scale 0.96 → 1 plus fade over 200ms ease-out, scrim fades
// with it. Radix handles the focus trap, Esc, and scroll lock.
//
// On mobile a bottom Sheet is the better surface — see components/ui/sheet.
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { DURATION, EASE, seconds } from "@/lib/motion";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "bg-scrim fixed inset-0 z-50",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        asChild
        {...props}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{
            opacity: 1,
            scale: 1,
            transition: { duration: seconds(DURATION.base), ease: [...EASE.out] },
          }}
          className={cn(
            "border-line bg-bg-surface shadow-modal fixed top-1/2 z-50",
            // inset-x-4 + mx-auto keeps a 16px gutter on small screens
            // without a calc(): the box centres itself within the inset.
            "inset-x-4 mx-auto grid max-w-lg -translate-y-1/2 gap-4 rounded-lg border p-6",
            className
          )}
        >
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close
              className={cn(
                "text-text-tertiary hover:text-text-primary absolute top-4 right-4 grid size-11 place-items-center rounded-md",
                "transition-colors duration-instant ease-out",
                "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
              )}
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) : null}
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("grid gap-1 pr-8", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-wrap items-center justify-end gap-2", className)}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-h2 text-text-primary", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-body text-text-secondary", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
