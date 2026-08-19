// Loading skeleton (D5.1) — reserves the same boxes profile renders,
// so nothing shifts when the data lands.
import {
  PageHeaderSkeleton,
  PanelSkeleton,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-6">
        <PanelSkeleton height="h-96" />
        <PanelSkeleton height="h-64" />
      </div>
    </>
  );
}
