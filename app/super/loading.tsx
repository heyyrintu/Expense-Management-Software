// Loading skeleton (D5.1) for the platform admin screen.
import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} />
    </>
  );
}
