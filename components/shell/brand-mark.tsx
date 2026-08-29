import { cn } from "@/lib/utils";

/**
 * The geometric brand mark — a receipt fold on the accent solid. No
 * illustration set (§3), so this is the product's entire iconographic
 * identity. Extracted from the sidebar in N4.1 so the auth pediment and the
 * shell draw the same mark from one file; it is server-safe (pure SVG).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-accent-solid text-text-on-accent grid size-7 shrink-0 place-items-center rounded-md",
        className
      )}
    >
      <svg viewBox="0 0 16 16" fill="none" className="size-4">
        <path
          d="M4 2.5h8v11l-2-1.2-2 1.2-2-1.2-2 1.2v-11Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M6.5 6h3M6.5 8.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
