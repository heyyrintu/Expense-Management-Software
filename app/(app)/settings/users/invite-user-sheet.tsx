"use client";

// Invite a user (D4.4) — a sheet, not a dialog.
//
// Five fields and a result screen is more than a dialog should hold: a dialog
// is for a decision, and this is a small form with an outcome the reader has
// to act on afterwards (copy the link). The sheet gives it room, keeps the
// user list visible behind it, and matches the other multi-field flows in the
// app — the payment run (D3.2), the statement import (D4.2), the complaint
// (D4.3).
//
// The result step replaces the form rather than sitting under it, because
// once the invite exists the fields are history and the only thing that
// matters is the link.
import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";

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
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { inviteUserSchema, type InviteUserInput } from "@/lib/schemas/user";
import { inviteUserAction } from "./actions";

type Opt = { id: string; name: string };

const ROLE_OPTIONS = [
  { value: "employee", label: "Employee", hint: "Files expenses" },
  { value: "approver", label: "Approver", hint: "Decides on their team's reports" },
  { value: "finance_admin", label: "Finance admin", hint: "Pays, reconciles, sets policy" },
  { value: "org_admin", label: "Org admin", hint: "All of the above, plus users" },
] as const;

export function InviteUserSheet({
  departments,
  approvers,
}: {
  departments: Opt[];
  approvers: Opt[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [link, setLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const form = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema) as Resolver<InviteUserInput>,
    defaultValues: {
      name: "",
      email: "",
      role: "employee",
      departmentId: "",
      approverId: "",
    },
  });

  const role = form.watch("role");
  const roleHint = ROLE_OPTIONS.find((r) => r.value === role)?.hint;

  function reset(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      form.reset();
      setLink(null);
      setServerError(null);
      setCopied(false);
    }
  }

  function onSubmit(values: InviteUserInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await inviteUserAction(values);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      setLink(res.data.inviteLink);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Invite user</Button>

      <Sheet open={open} onOpenChange={reset}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{link ? "Invite sent" : "Invite a teammate"}</SheetTitle>
            <SheetDescription>
              {link
                ? "They set their own password through this link."
                : "They'll set a password through the invite link. Role and approver can be changed later."}
            </SheetDescription>
          </SheetHeader>

          {link ? (
            <div className="grid gap-3 px-4">
              <p className="text-body text-text-secondary">
                Share this link — it is valid for seven days.
              </p>
              <code className="bg-bg-subtle border-line block overflow-x-auto rounded-md border p-3 text-meta break-all">
                {link}
              </code>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                    toast.success("Invite link copied.");
                  }}
                >
                  {copied ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : (
                    <Copy aria-hidden="true" className="size-4" />
                  )}
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form
                id="invite-user-form"
                onSubmit={form.handleSubmit(onSubmit)}
                className="grid gap-4 overflow-y-auto px-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Priya Sharma" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="priya@company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <FormControl>
                        <NativeSelect {...field}>
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </NativeSelect>
                      </FormControl>
                      {/* What the chosen role can DO, live. A role name alone
                          is a word people guess at, and guessing wrong here
                          hands someone the payment run. */}
                      {roleHint ? <FormDescription>{roleHint}</FormDescription> : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Department{" "}
                        <span className="text-text-tertiary font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <NativeSelect {...field}>
                          <option value="">No department</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="approverId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Approver{" "}
                        <span className="text-text-tertiary font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <NativeSelect {...field}>
                          <option value="">No approver</option>
                          {approvers.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </FormControl>
                      <FormDescription>
                        Without one, their reports fall to the org&apos;s default
                        approval chain.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {serverError ? (
                  <p
                    role="alert"
                    className="border-status-danger-subtle bg-status-danger-subtle text-status-danger-text rounded-md border p-3 text-body"
                  >
                    {serverError}
                  </p>
                ) : null}
              </form>
            </Form>
          )}

          <SheetFooter>
            {link ? (
              <Button onClick={() => reset(false)}>Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => reset(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" form="invite-user-form" disabled={pending}>
                  {pending ? "Inviting…" : "Send invite"}
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
