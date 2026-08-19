// StatusBadge — the single component that renders a status (DESIGN-PRD §5.2).
//
// Colour comes from lib/design/status.ts and nowhere else. If a screen needs
// a new state, add it to STATUS_MAP; never colour a status inline.
import { statusEntry, TONE_CLASSES, type StatusTone } from "@/lib/design/status";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const entry = statusEntry(status);
  const tone = TONE_CLASSES[entry.tone];
  return (
    <span
      role="status"
      aria-label={`Status: ${entry.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-meta font-medium",
        tone.chip,
        className
      )}
    >
      {/* Dot + label: status is never communicated by colour alone. */}
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone.dot,
          !entry.solidDot && "opacity-70"
        )}
      />
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
