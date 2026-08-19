// Loading skeleton (D5.1) — reserves the same boxes complaints renders,
// so nothing shifts when the data lands.
import {
  PageHeaderSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton hasAction />
      <div className="grid gap-4">
        <ToolbarSkeleton />
        <TableSkeleton />
      </div>
    </>
  );
}
