// Loading skeleton (D5.1) — reserves the same boxes bank-recon renders,
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
        <ToolbarSkeleton controls={1} />
        <PanelSkeleton height="h-32" />
        <div className="grid gap-4 lg:grid-cols-3">
          <PanelSkeleton />
          <PanelSkeleton />
          <PanelSkeleton />
        </div>
      </div>
    </>
  );
}
