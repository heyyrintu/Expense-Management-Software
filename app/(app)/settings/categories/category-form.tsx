"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { deleteCategoryAction } from "../actions";
import { categoryInputSchema, type CategoryInput } from "@/lib/schemas/category";
import { SettingsForm } from "../components/settings-form";
import type { Result } from "@/lib/errors";

const FIELDS = [
  { name: "name" as const, label: "Name", placeholder: "Travel" },
  {
    name: "perExpenseLimit" as const,
    label: "Per-expense limit",
    placeholder: "20000.00",
    description: "Leave empty for no limit",
  },
  {
    name: "monthlyLimit" as const,
    label: "Monthly limit per user",
    placeholder: "100000.00",
    description: "Leave empty for no limit",
  },
  {
    name: "receiptRequiredAbove" as const,
    label: "Receipt required above",
    placeholder: "500.00",
    description: "Leave empty to never require a receipt",
  },
];

export function CategoryForm({
  defaults,
  action,
  categoryId,
}: {
  defaults: CategoryInput;
  action: (input: CategoryInput) => Promise<Result | Result<{ id: string }>>;
  categoryId?: string;
}) {
  const router = useRouter();
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    if (!categoryId) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteCategoryAction({ id: categoryId });
      if (!res.ok) {
        setDeleteError(res.error);
      } else {
        router.push("/settings/categories");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid max-w-md gap-6">
      <SettingsForm
        schema={categoryInputSchema}
        defaults={defaults}
        submitLabel={categoryId ? "Save category" : "Create category"}
        action={action}
        successPath="/settings/categories"
        fields={FIELDS}
      />
      {categoryId ? (
        <div className="grid gap-2 border-t pt-4">
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={pending}
            className="w-fit"
          >
            {pending ? "Deleting…" : "Delete category"}
          </Button>
          {deleteError ? (
            <p role="alert" className="text-destructive text-sm">
              {deleteError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
