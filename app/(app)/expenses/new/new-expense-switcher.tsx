"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import type { ExpenseInput, MileageInput } from "@/lib/schemas/expense";
import { createExpenseAction, createMileageExpenseAction } from "../actions";
import { ExpenseForm, type ClientOption, type Option } from "../expense-form";
import { MileageForm } from "../mileage-form";

export function NewExpenseSwitcher({
  regularDefaults,
  mileageDefaults,
  categories,
  projects,
  clients,
  currency,
  ratePerKmMinor,
}: {
  regularDefaults: ExpenseInput;
  mileageDefaults: MileageInput;
  categories: Option[];
  projects: Option[];
  clients: ClientOption[];
  currency: string;
  ratePerKmMinor: number;
}) {
  const [type, setType] = React.useState<"regular" | "mileage">("regular");

  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Expense type" className="flex w-fit gap-1 rounded-lg border p-1">
        <Button
          role="tab"
          aria-selected={type === "regular"}
          variant={type === "regular" ? "default" : "ghost"}
          size="sm"
          onClick={() => setType("regular")}
        >
          Regular
        </Button>
        <Button
          role="tab"
          aria-selected={type === "mileage"}
          variant={type === "mileage" ? "default" : "ghost"}
          size="sm"
          onClick={() => setType("mileage")}
        >
          Mileage
        </Button>
      </div>
      {type === "regular" ? (
        <ExpenseForm
          defaults={regularDefaults}
          categories={categories}
          projects={projects}
          clients={clients}
          currency={currency}
          action={createExpenseAction}
        />
      ) : (
        <MileageForm
          defaults={mileageDefaults}
          categories={categories}
          projects={projects}
          currency={currency}
          ratePerKmMinor={ratePerKmMinor}
          action={createMileageExpenseAction}
        />
      )}
    </div>
  );
}
