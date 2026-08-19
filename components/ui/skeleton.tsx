import { cn } from "@/lib/utils";

/**
 * Skeleton (§6.1): shape-matched block in bg-subtle with a slow opacity
 * pulse. Opacity only — nothing here moves, so it stays calm at the edge of
 * vision and costs nothing on reduced motion (the pulse simply stops).
 *
 * Use only where content is genuinely pending; instant content is better
 * than a skeleton that flashes.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("bg-bg-subtle skeleton-pulse rounded-sm", className)}
      {...props}
    />
  );
}

/** Text placeholder that matches a line of body copy. */
function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 && lines > 1 && "w-2/3")}
        />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonText };
