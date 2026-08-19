// Loading skeleton (D5.1). The auth screens have no app chrome, so this
// reserves the card the form lands in rather than a page header.
import { FormSkeleton } from "@/components/ui/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto grid min-h-screen max-w-md content-center gap-6 p-6">
      <div className="grid gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-64 max-w-full" />
      </div>
      <FormSkeleton fields={4} />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
