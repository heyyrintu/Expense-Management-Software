"use client";

// Shared RHF + Zod + server-action form for the settings screens.
//
// D4.4 moved the submit button out of the form body and into a STICKY SAVE
// BAR that appears only once the form is dirty. React Hook Form already
// tracks `formState.isDirty` against the defaults, so "dirty" is a real
// comparison rather than "has been focused" — typing a character and deleting
// it again puts the bar away, which is the behaviour that makes it
// trustworthy.
//
// Every settings screen using this component inherits the pattern; none of
// them re-implement it.
import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
} from "react-hook-form";
import type { z } from "zod";

import { DirtySaveBar } from "@/components/ui/dirty-save-bar";
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
  const [pending, startTransition] = React.useTransition();
  const form = useForm<T>({
    // settings schemas have no transforms: input === output === T
    resolver: zodResolver(schema) as Resolver<T>,
    defaultValues: defaults,
  });

  // A CREATE form starts dirty-less but has nothing to go back to, so its bar
  // must be visible from the start; an EDIT form's bar appears on first edit.
  const isCreate = successPath !== undefined;
  const dirty = isCreate || form.formState.isDirty;

  function onSubmit(values: T) {
    setServerError(null);
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      if (successPath) {
        router.push(successPath);
        router.refresh();
        return;
      }
      // Re-baseline so the bar retracts: the saved values ARE the new
      // defaults, and leaving the old ones in place would keep the form
      // "dirty" against a state that no longer exists anywhere.
      form.reset(values);
      toast.success("Saved.");
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-lg gap-4">
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
          <p
            role="alert"
            className="border-status-danger-subtle bg-status-danger-subtle text-status-danger-text rounded-md border p-3 text-body"
          >
            {serverError}
          </p>
        ) : null}

        <DirtySaveBar
          dirty={dirty}
          pending={pending}
          saveLabel={submitLabel}
          // Back to the values the server last confirmed — not to empty.
          onDiscard={() => {
            form.reset(defaults);
            setServerError(null);
          }}
        />
      </form>
    </Form>
  );
}
