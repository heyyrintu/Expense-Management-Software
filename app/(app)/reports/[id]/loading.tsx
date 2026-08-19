// Loading skeleton (D5.1) — reserves the same boxes reports/[id] renders,
// so nothing shifts when the data lands.
import {
  PageHeaderSkeleton,
  PanelSkeleton,
  TableSkeleton,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton hasAction />
      <div className="grid gap-6">
        <PanelSkeleton height="h-40" />
        <TableSkeleton rows={4} />
      </div>
    </>
  );
}
