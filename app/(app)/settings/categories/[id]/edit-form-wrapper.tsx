"use client";

import { updateCategoryAction } from "../../actions";
import type { CategoryInput } from "@/lib/schemas/category";
import { CategoryForm } from "../category-form";

export function EditCategoryFormWrapper({
  categoryId,
  defaults,
}: {
  categoryId: string;
  defaults: CategoryInput;
}) {
  return (
    <CategoryForm
      defaults={defaults}
      categoryId={categoryId}
      action={(input) => updateCategoryAction({ id: categoryId, ...input })}
    />
  );
}
