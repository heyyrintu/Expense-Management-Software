// SLA chip for complaints (7.3). Colour comes from lib/domain/complaint so the
// badge can never drift from the business-day maths behind it.
import { slaBadge, type ComplaintStatus } from "@/lib/domain/complaint";
import { TONE_CLASSES } from "@/lib/design/status";
import { cn } from "@/lib/utils";

// SLA level maps onto the same semantic tones every other status uses —
// no separate colour vocabulary for complaints (§5.2).
const STYLES: Record<string, string> = {
  green: TONE_CLASSES.success.chip,
  amber: TONE_CLASSES.warning.chip,
  red: TONE_CLASSES.danger.chip,
};

export function SlaBadge({
  createdAt,
  resolvedAt,
  status,
  now,
  className,
}: {
  createdAt: Date;
  resolvedAt?: Date | null;
  status: ComplaintStatus;
  now?: Date;
  className?: string;
}) {
  const badge = slaBadge({ createdAt, resolvedAt, status }, now ?? new Date());
  return (
    <span
      // Not a live region — see the note in components/status-badge.tsx. The
      // inbox renders one of these per row.
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-meta font-medium",
        STYLES[badge.level],
        className
      )}
    >
      <span className="sr-only">Service level: </span>
      {badge.label}
    </span>
  );
}

const STATUS_STYLES: Record<ComplaintStatus, string> = {
  open: TONE_CLASSES.info.chip,
  in_review: TONE_CLASSES.warning.chip,
  resolved: TONE_CLASSES.success.chip,
  wont_fix: TONE_CLASSES.neutral.chip,
};

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  const labels: Record<ComplaintStatus, string> = {
    open: "Open",
    in_review: "In review",
    resolved: "Resolved",
    wont_fix: "Won't fix",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-meta font-medium",
        STATUS_STYLES[status]
      )}
    >
      {labels[status]}
    </span>
  );
}
