"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createReportAction } from "../actions";
import {
  reportCreateSchema,
  type ReportCreateInput,
} from "@/lib/schemas/report";

export function NewReportForm() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const form = useForm<ReportCreateInput>({
    resolver: zodResolver(reportCreateSchema) as Resolver<ReportCreateInput>,
    defaultValues: { title: "" },
  });

  function onSubmit(values: ReportCreateInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await createReportAction(values);
      if (!res.ok) {
        setServerError(res.error);
      } else {
        router.push(`/reports/${res.data.id}`);
        router.refresh();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-md gap-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="August client-visit expenses" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {serverError ? (
          <p role="alert" className="text-destructive text-sm">
            {serverError}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create report"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
