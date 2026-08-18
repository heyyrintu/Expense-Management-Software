"use client";

// Invite dialog (task 2.0): creates an invited user and shows the invite
// link to copy — email delivery arrives with notifications (2.3).
import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { inviteUserSchema, type InviteUserInput } from "@/lib/schemas/user";
import { inviteUserAction } from "./actions";

type Opt = { id: string; name: string };

export function InviteUserDialog({
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
    defaultValues: { name: "", email: "", role: "employee", departmentId: "", approverId: "" },
  });

  function onSubmit(values: InviteUserInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await inviteUserAction(values);
      if (!res.ok) {
        setServerError(res.error);
      } else {
        setLink(res.data.inviteLink);
        router.refresh();
      }
    });
  }

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      form.reset();
      setLink(null);
      setServerError(null);
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button>Invite user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            They&apos;ll set a password through the invite link.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="grid gap-3">
            <p className="text-sm">Share this invite link (valid 7 days):</p>
            <code className="bg-muted block overflow-x-auto rounded-md p-2 text-xs break-all">
              {link}
            </code>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                }}
              >
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <Button type="button" variant="outline" onClick={() => reset(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
                        <option value="employee">employee</option>
                        <option value="approver">approver</option>
                        <option value="finance_admin">finance admin</option>
                        <option value="org_admin">org admin</option>
                      </NativeSelect>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department (optional)</FormLabel>
                    <FormControl>
                      <NativeSelect {...field}>
                        <option value="">No department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
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
                    <FormLabel>Assigned approver (optional)</FormLabel>
                    <FormControl>
                      <NativeSelect {...field}>
                        <option value="">No approver</option>
                        {approvers.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </NativeSelect>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {serverError ? (
                <p role="alert" className="text-destructive text-sm">{serverError}</p>
              ) : null}
              <Button type="submit" disabled={pending}>
                {pending ? "Inviting…" : "Send invite"}
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
