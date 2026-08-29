// StatusBadge — the single component that renders a status (DESIGN-PRD §5.2).
//
// Colour comes from lib/design/status.ts and nowhere else. If a screen needs
// a new state, add it to STATUS_MAP; never colour a status inline.
import { SEAL_CLASSES, statusEntry, TONE_CLASSES, type StatusTone } from "@/lib/design/status";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const entry = statusEntry(status);
  // Terminal money states carry the gilt seal (N2.3) instead of their tone
  // chip — Paid and Settled are the two states where money has finished
  // moving, and gilt is the mark reserved for exactly that.
  const tone = entry.solidDot ? { ...TONE_CLASSES[entry.tone], ...SEAL_CLASSES } : TONE_CLASSES[entry.tone];
  return (
    <span
      // NOT role="status" (D5.3). That is an aria-live region, so a table of
      // fifty badges became fifty live regions and every re-render fired a
      // burst of announcements. The label is visible text; a screen reader
      // reads it in place, which is what a static status wants. The sr-only
      // prefix supplies the word "Status" that the colour carries visually.
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-meta font-medium",
        tone.chip,
        className
      )}
    >
      {/* Dot + label: status is never communicated by colour alone. */}
      <span
        aria-hidden="true"
        // Full opacity, always. The dot used to render non-terminal states
        // at opacity-70, which dropped the status fill to roughly 2.4:1 on
        // its own chip — below the 3:1 that WCAG 1.4.11 asks of a meaningful
        // graphic, and it quietly undid the token darkening the contrast
        // checker enforces on the source colour. The seal already reads as
        // different through hue and chip background; it never needed the
        // other dots dimmed to stand out.
        className={cn("size-1.5 shrink-0 rounded-full", tone.dot)}
      />
      <span className="sr-only">Status: </span>
      {entry.label}
    </span>
  );
}

/** Generic badge for non-status labels (counts, tags, chips). */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: StatusTone | "accent";
  className?: string;
  children: React.ReactNode;
}) {
  const chip =
    tone === "accent"
      ? "bg-accent-subtle text-accent-text"
      : TONE_CLASSES[tone].chip;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-meta font-medium",
        chip,
        className
      )}
    >
      {children}
    </span>
  );
}
