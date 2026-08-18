"use client";

// Shared RHF + Zod + server-action form for the settings screens.
import * as React from "react";
import { useRouter } from "next/navigation";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Result } from "@/lib/errors";

export type SettingsField<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  description?: string;
  placeholder?: string;
};

export function SettingsForm<T extends FieldValues>({
  schema,
  defaults,
  fields,
  submitLabel,
  action,
  successPath,
}: {
  schema: z.ZodType<T, T>;
  defaults: DefaultValues<T>;
  fields: SettingsField<T>[];
  submitLabel: string;
  action: (input: T) => Promise<Result | Result<{ id: string }>>;
  successPath?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const form = useForm<T>({
    // settings schemas have no transforms: input === output === T
    resolver: zodResolver(schema) as Resolver<T>,
    defaultValues: defaults,
  });

  function onSubmit(values: T) {
    setServerError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        setServerError(result.error);
      } else if (successPath) {
        router.push(successPath);
        router.refresh();
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-md gap-4">
        {fields.map((f) => (
          <FormField
            key={f.name}
            control={form.control}
            name={f.name}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{f.label}</FormLabel>
                <FormControl>
                  <Input placeholder={f.placeholder} inputMode="text" {...field} />
                </FormControl>
                {f.description ? (
                  <FormDescription>{f.description}</FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
        {serverError ? (
          <p role="alert" className="text-destructive text-sm">
            {serverError}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="text-sm text-green-700">
            Saved.
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
