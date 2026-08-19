"use client";

// Which statement is open (D4.2).
//
// A select that navigates on change, replacing the select-plus-"Open"-button
// form it succeeds. A two-control form to choose which of your own documents
// to look at is one control too many: nothing is being submitted, and the
// second click only existed because the page had no client component to
// navigate from.
//
// `replace`, not `push`: flicking through statements should not build a back
// stack you have to unwind to leave the screen.
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { NativeSelect } from "@/components/ui/native-select";

export function StatementPicker({
  value,
  options,
}: {
  value: string;
  options: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (options.length < 2) return null;

  return (
    <label className="flex flex-wrap items-center gap-2">
      <span className="text-label text-text-secondary">Statement</span>
      <NativeSelect
        value={value}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams);
          params.set("import", e.target.value);
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }}
        className="min-w-64 flex-1"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
