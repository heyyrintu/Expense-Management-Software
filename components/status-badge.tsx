// One shared status badge (ui-screen skill): Draft=gray, Submitted=blue,
// Approved=green, Rejected=red, SentBack=amber, Reimbursed=violet.
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  sent_back: "bg-amber-100 text-amber-800",
  partially_reimbursed: "bg-teal-100 text-teal-700",
  reimbursed: "bg-violet-100 text-violet-700",
  disbursed: "bg-indigo-100 text-indigo-700",
  partially_settled: "bg-teal-100 text-teal-700",
  settled: "bg-violet-100 text-violet-700",
};

const LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  sent_back: "Sent back",
  partially_reimbursed: "Partially reimbursed",
  reimbursed: "Reimbursed",
  disbursed: "Disbursed",
  partially_settled: "Partially settled",
  settled: "Settled",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      role="status"
      aria-label={`Status: ${LABELS[status] ?? status}`}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STYLES[status] ?? "bg-gray-100 text-gray-700"
      )}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
