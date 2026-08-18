"use client";

import { updateMileageExpenseAction } from "../actions";
import type { MileageInput } from "@/lib/schemas/expense";
import type { Option } from "../expense-form";
import { MileageForm } from "../mileage-form";

export function EditMileageWrapper({
  expenseId,
  defaults,
  categories,
  projects,
  currency,
  ratePerKmMinor,
}: {
  expenseId: string;
  defaults: MileageInput;
  categories: Option[];
  projects: Option[];
  currency: string;
  ratePerKmMinor: number;
}) {
  return (
    <MileageForm
      defaults={defaults}
      categories={categories}
      projects={projects}
      currency={currency}
      ratePerKmMinor={ratePerKmMinor}
      expenseId={expenseId}
      action={(input) => updateMileageExpenseAction({ id: expenseId, ...input })}
    />
  );
}
