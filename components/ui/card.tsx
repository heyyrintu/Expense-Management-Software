import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Card (§6.1): white surface, 1px border, lg radius, 20px padding, no shadow
 * at rest. Border OR shadow, never both (§4.2) — an interactive card raises
 * on hover instead of adding weight to its border.
 */
function Card({
  className,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "border-line bg-bg-surface text-text-primary flex flex-col gap-5 rounded-lg border p-5",
        // A hover TINT, not a shadow (D5.2). §4.2 allows a border or a
        // shadow, never both, and this card already has a border — so the
        // hover shadow was stacking the two. Box-shadow is also outside
        // "transform and opacity only": it repaints, and on a grid of cards
        // that is a repaint per card per pointer move. StatCard already made
        // this call; the base Card now agrees with it.
        interactive &&
          "hover:bg-bg-subtle transition-colors duration-instant ease-out",
        className
      )}
      {...props}
    />
  );
}

/** Header row: title left, optional action right (§6.1). */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 [&>*:only-child]:w-full",
        className
      )}
      {...props}
    />
  );
}

/**
 * `as` exists because a card title is sometimes the only heading on a screen.
 * The auth screens are the case that forced it: their card carries the page's
 * real title ("Sign in", "Join your team"), so rendering it as a bare <div>
 * left login, signup and invite with NO heading element at all — nothing for
 * a screen reader to jump to, and a heading-order violation that axe would
 * flag the moment it ran. Cards nested inside a page that already has an h1
 * keep the default: a heading here would compete with the page title.
 */
function CardTitle({
  className,
  as: Tag = "div",
  ...props
}: React.ComponentProps<"div"> & { as?: "div" | "h1" | "h2" | "h3" }) {
  return (
    <Tag
      data-slot="card-title"
      className={cn("text-h3 text-text-primary", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-label text-text-secondary", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-action" className={cn("shrink-0", className)} {...props} />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("grid gap-3", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("border-line flex items-center gap-3 border-t pt-4", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
};
