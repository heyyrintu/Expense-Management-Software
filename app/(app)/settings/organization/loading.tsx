// Loading skeleton (D5.1).
//
// Renders INSIDE app/(app)/settings/layout.tsx, so the section nav is already
// on screen — this reserves only the right-hand panel. Wrapping the whole
// shell here would paint a second nav beside the real one.
import {
  FormSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <div className="grid content-start gap-6">
      <PageHeaderSkeleton hasAction={false} />
      <FormSkeleton fields={7} />
    </div>
  );
}
