"use client";

// Debounced inline policy check for capture forms (3.2).
import * as React from "react";

import type { FlagLike } from "@/components/flag-chips";
import { previewExpenseFlagsAction } from "./actions";

export function usePolicyPreview(input: {
  amount: string;
  date: string;
  merchant: string;
  categoryId: string;
  expenseId?: string;
  receiptCount: number;
}): FlagLike[] {
  const [flags, setFlags] = React.useState<FlagLike[]>([]);
  const key = JSON.stringify(input);

  React.useEffect(() => {
    if (!input.categoryId || !input.amount) {
      setFlags([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await previewExpenseFlagsAction({
        amount: input.amount,
        date: input.date,
        merchant: input.merchant,
        categoryId: input.categoryId,
        expenseId: input.expenseId ?? "",
        receiptCount: input.receiptCount,
      });
      if (res.ok) setFlags(res.data.flags);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return flags;
}
