// Loading skeleton (D5.1) — reserves the same boxes analytics renders,
// so nothing shifts when the data lands.
import {
  PageHeaderSkeleton,
  PanelSkeleton,
  StatStripSkeleton,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton hasAction />
      <div className="grid gap-6">
        <StatStripSkeleton count={3} />
        <PanelSkeleton />
        <PanelSkeleton height="h-64" />
      </div>
    </>
  );
}
