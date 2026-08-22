"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import type {
  ExpenseInput,
  MileageInput,
  PerDiemInput,
} from "@/lib/schemas/expense";
import {
  createExpenseAction,
  createMileageExpenseAction,
  createPerDiemExpenseAction,
} from "../actions";
import { ExpenseForm, type ClientOption, type Option } from "../expense-form";
import { MileageForm } from "../mileage-form";
import { PerDiemForm, type PerDiemRateOption } from "../per-diem-form";

const TYPES = [
  { key: "regular", label: "Regular" },
  { key: "mileage", label: "Mileage" },
  { key: "per_diem", label: "Per diem" },
] as const;

type ExpenseKind = (typeof TYPES)[number]["key"];

export function NewExpenseSwitcher({
  regularDefaults,
  mileageDefaults,
  perDiemDefaults,
  categories,
  projects,
  clients,
  currency,
  ratePerKmMinor,
  perDiemRates,
}: {
  regularDefaults: ExpenseInput;
  mileageDefaults: MileageInput;
  perDiemDefaults: PerDiemInput;
  categories: Option[];
  projects: Option[];
  clients: ClientOption[];
  currency: string;
  ratePerKmMinor: number;
  perDiemRates: PerDiemRateOption[];
}) {
  const [type, setType] = React.useState<ExpenseKind>("regular");

  return (
    <div className="grid gap-4">
      <div
        role="tablist"
        aria-label="Expense type"
        className="border-line flex w-fit gap-1 rounded-lg border p-1"
      >
        {TYPES.map((t) => (
          <Button
            key={t.key}
            role="tab"
            aria-selected={type === t.key}
            variant={type === t.key ? "default" : "ghost"}
            size="sm"
            onClick={() => setType(t.key)}
          >
            {t.label}
          </Button>
        ))}
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
      ) : type === "mileage" ? (
        <MileageForm
          defaults={mileageDefaults}
          categories={categories}
          projects={projects}
          currency={currency}
          ratePerKmMinor={ratePerKmMinor}
          action={createMileageExpenseAction}
        />
      ) : (
        <PerDiemForm
          defaults={perDiemDefaults}
          categories={categories}
          projects={projects}
          currency={currency}
          rates={perDiemRates}
          action={createPerDiemExpenseAction}
        />
      )}
    </div>
  );
}
