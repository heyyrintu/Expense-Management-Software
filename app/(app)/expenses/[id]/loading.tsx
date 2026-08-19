// Loading skeleton (D5.1) — reserves the same boxes expenses/[id] renders,
// so nothing shifts when the data lands.
import {
  FormSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton hasAction />
      <FormSkeleton fields={6} />
    </>
  );
}
