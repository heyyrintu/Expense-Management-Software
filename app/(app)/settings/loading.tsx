// Loading skeleton (D5.1) for the settings shell itself — the nav is
// role-filtered on the server, so it resolves with the layout rather than
// being present already.
import { SettingsShellSkeleton } from "@/components/ui/page-skeleton";

export default function Loading() {
  return <SettingsShellSkeleton />;
}
