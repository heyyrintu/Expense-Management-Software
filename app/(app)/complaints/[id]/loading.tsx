// Loading skeleton (D5.1) — reserves the same boxes complaints/[id] renders,
// so nothing shifts when the data lands.
import {
  PageHeaderSkeleton,
  PanelSkeleton,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid content-start gap-4 lg:col-span-8">
          <PanelSkeleton height="h-56" />
          <PanelSkeleton height="h-96" />
        </div>
        <div className="lg:col-span-4">
          <PanelSkeleton height="h-72" />
        </div>
      </div>
    </>
  );
}
