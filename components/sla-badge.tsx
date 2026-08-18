// SLA chip for complaints (7.3). Colour comes from lib/domain/complaint so the
// badge can never drift from the business-day maths behind it.
import { slaBadge, type ComplaintStatus } from "@/lib/domain/complaint";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  green: "border-green-200 bg-green-50 text-green-800",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-red-200 bg-red-50 text-red-800",
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
      role="status"
      aria-label={`Service level: ${badge.label}`}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        STYLES[badge.level],
        className
      )}
    >
      {badge.label}
    </span>
  );
}

const STATUS_STYLES: Record<ComplaintStatus, string> = {
  open: "border-blue-200 bg-blue-50 text-blue-800",
  in_review: "border-amber-200 bg-amber-50 text-amber-900",
  resolved: "border-green-200 bg-green-50 text-green-800",
  wont_fix: "border-gray-200 bg-gray-100 text-gray-700",
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
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      {labels[status]}
    </span>
  );
}
