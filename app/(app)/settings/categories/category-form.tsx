"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ConfirmDestructiveDialog } from "@/components/ui/confirm-destructive-dialog";
import { toast } from "sonner";
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
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    if (!categoryId) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteCategoryAction({ id: categoryId });
      if (!res.ok) {
        setDeleteError(res.error);
        setConfirmOpen(false);
      } else {
        toast.success(`Deleted ${defaults.name}.`);
        router.push("/settings/categories");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid max-w-lg gap-6">
      <SettingsForm
        schema={categoryInputSchema}
        defaults={defaults}
        submitLabel={categoryId ? "Save category" : "Create category"}
        action={action}
        successPath="/settings/categories"
        fields={FIELDS}
      />
      {categoryId ? (
        <div className="border-line grid gap-2 border-t pt-4">
          {/* Secondary, not destructive-filled: the danger styling belongs on
              the CONFIRM inside the dialog, not on the control that merely
              opens it. A red button on the page invites a misclick that the
              dialog then has to catch. */}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmOpen(true)}
            disabled={pending}
            className="w-fit"
          >
            Delete category
          </Button>
          {deleteError ? (
            <p role="alert" className="text-status-danger-text text-meta">
              {deleteError}
            </p>
          ) : null}

          <ConfirmDestructiveDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            onConfirm={onDelete}
            pending={pending}
            entityName={defaults.name}
            verb="Delete"
            description="Categories are only deletable while nothing uses them. If any expense references this one, the server will refuse and say so."
            consequences={[
              "it disappears from the category picker on new expenses",
              "its limits and receipt threshold stop applying",
            ]}
            preserved={[
              "every expense already filed — none are deleted or recategorised",
              "reports, approvals and payments, all untouched",
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
