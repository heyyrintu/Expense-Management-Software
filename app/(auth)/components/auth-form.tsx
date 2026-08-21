"use client";

// Shared RHF + Zod + server-action form shell for the auth screens.
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
} from "react-hook-form";
import type { z } from "zod";

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
import type { Result } from "@/lib/errors";

export type FieldSpec<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
};

export function AuthForm<T extends FieldValues>({
  schema,
  defaults,
  fields,
  submitLabel,
  action,
  onSuccess,
}: {
  schema: z.ZodType<T, T>;
  defaults: DefaultValues<T>;
  fields: FieldSpec<T>[];
  submitLabel: string;
  action: (input: T) => Promise<Result>;
  onSuccess?: () => void;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const form = useForm<T>({
    // our auth schemas have no transforms, so input === output === T
    resolver: zodResolver(schema) as Resolver<T>,
    defaultValues: defaults,
  });

  function onSubmit(values: T) {
    setServerError(null);
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        setServerError(result.error);
      } else {
        onSuccess?.();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        {fields.map((f) => (
          <FormField
            key={f.name}
            control={form.control}
            name={f.name}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{f.label}</FormLabel>
                <FormControl>
                  <Input
                    type={f.type ?? "text"}
                    placeholder={f.placeholder}
                    autoComplete={f.autoComplete}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
        {serverError ? (
          <p role="alert" className="text-status-danger-text text-sm">
            {serverError}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Please wait…" : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
