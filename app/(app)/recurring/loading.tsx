// Loading skeleton (D5.1) — reserves the same boxes recurring renders,
// so nothing shifts when the data lands.
import {
  CardListSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton hasAction />
      <CardListSkeleton rows={4} />
    </>
  );
}
