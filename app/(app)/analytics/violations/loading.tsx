// Loading skeleton (D5.1).
import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <TableSkeleton rows={10} />
    </>
  );
}
