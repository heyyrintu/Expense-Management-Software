"use client";

// Button (DESIGN-PRD §6.1).
//
// Variants: primary (filled indigo) · secondary (border + surface) · ghost ·
// destructive · link. Sizes sm/md/lg = 32/36/44px.
//
// The shadcn names this project already uses (`default`, `outline`) are kept
// as aliases so existing screens keep working — D1–D5 migrate call sites to
// the PRD names as each screen is restyled.
//
// Two details the PRD is specific about:
//   * loading REPLACES the label with a spinner while preserving width, so
//     nothing on the page shifts. The label stays in the DOM (invisible) to
//     hold the box open, and aria-live announces the busy state.
//   * active scales to 0.98 — a transform, so it costs nothing to animate.
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md text-body font-medium",
    // Colour changes in 100ms (§6.1); the press is a transform.
    "transition-[background-color,border-color,color,box-shadow] duration-instant ease-out",
    // Pressed state = scale 0.98 (§6.1), and nothing on reduced motion.
    "press-scale",
    // Focus: 2px accent ring, 2px offset — always visible (§5.1).
    "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-accent-solid text-text-on-accent hover:bg-accent-hover active:bg-accent-pressed",
        secondary:
          "border border-line-strong bg-bg-surface text-text-primary hover:bg-bg-subtle",
        ghost: "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
        destructive:
          "bg-status-danger text-text-on-accent hover:opacity-90 focus-visible:ring-status-danger",
        link: "text-accent-text underline-offset-4 hover:underline",
        // ---- aliases for the pre-D0.3 call sites ----
        default:
          "bg-accent-solid text-text-on-accent hover:bg-accent-hover active:bg-accent-pressed",
        outline:
          "border border-line-strong bg-bg-surface text-text-primary hover:bg-bg-subtle",
      },
      size: {
        // 32 / 36 / 44px (§6.1). sm and md are below the 44px touch target,
        // so both carry a transparent tap extension on coarse pointers.
        sm: "h-8 gap-1.5 px-3 text-label after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']",
        md: "h-9 px-4 after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']",
        lg: "h-11 px-6",
        icon: "size-9 after:absolute after:inset-0 after:-m-1 after:content-['']",
        // ---- alias ----
        default: "h-9 px-4 after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

/** Inline spinner. Sized to the text so it never changes the button box. */
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cn("size-4 animate-spin", className)}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Swaps the label for a spinner and disables the button. Width holds. */
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  // asChild renders someone else's element (a Link, usually) — the loading
  // treatment would fight it, so it is only applied to real buttons.
  if (asChild) {
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <button
      data-slot="button"
      data-loading={loading ? "" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* The label keeps its space while hidden — this is what stops the
          layout shift the PRD calls out. */}
      <span className={cn("contents", loading && "invisible")}>{children}</span>
      {loading ? (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
          <span className="sr-only" aria-live="polite">
            Working…
          </span>
        </span>
      ) : null}
    </button>
  );
}

export { Button, buttonVariants };
