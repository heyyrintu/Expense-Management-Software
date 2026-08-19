// Loading skeleton (D5.1) — reserves the same boxes ledger renders,
// so nothing shifts when the data lands.
import {
  PageHeaderSkeleton,
  PanelSkeleton,
  ToolbarSkeleton,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton hasAction />
      <div className="grid gap-6">
        <ToolbarSkeleton controls={2} />
        <PanelSkeleton height="max-h-ledger h-ledger" />
      </div>
    </>
  );
}
