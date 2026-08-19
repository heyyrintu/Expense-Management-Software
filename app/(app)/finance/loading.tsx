// Loading skeleton (D5.1) — reserves the same boxes finance renders,
// so nothing shifts when the data lands.
import {
  CardListSkeleton,
  PageHeaderSkeleton,
  StatStripSkeleton,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-6">
        <StatStripSkeleton count={2} />
        <CardListSkeleton rows={4} height="h-28" />
      </div>
    </>
  );
}
