// Loading skeleton (D5.1) — reserves the same boxes approvals renders,
// so nothing shifts when the data lands.
import {
  CardListSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <CardListSkeleton rows={4} height="h-32" />
    </>
  );
}
