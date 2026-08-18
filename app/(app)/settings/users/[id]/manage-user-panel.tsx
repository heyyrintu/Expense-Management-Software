"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { NativeSelect } from "@/components/ui/native-select";
import {
  deactivateUserAction,
  reactivateUserAction,
  resendInviteAction,
  revokeInviteAction,
  updateUserAction,
} from "../actions";

const formSchema = z.object({
  role: z.enum(["employee", "approver", "finance_admin", "org_admin"]),
  departmentId: z.union([z.literal(""), z.string().uuid()]),
  approverId: z.union([z.literal(""), z.string().uuid()]),
});
type FormValues = z.infer<typeof formSchema>;

type Opt = { id: string; name: string };

export function ManageUserPanel({
  user,
  isSelf,
  departments,
  approvers,
}: {
  user: { id: string; role: string; status: string; departmentId: string; approverId: string };
  isSelf: boolean;
  departments: Opt[];
  approvers: Opt[];
}) {
  const router = useRouter();
  const [message, setMessage] = React.useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      role: user.role as FormValues["role"],
      departmentId: user.departmentId,
      approverId: user.approverId,
    },
  });

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error ?? "Something went wrong." });
      } else {
        setMessage({ kind: "ok", text: okText });
        router.refresh();
      }
    });
  }

  function onSubmit(values: FormValues) {
    run(() => updateUserAction({ id: user.id, ...values }), "Saved.");
  }

  return (
    <div className="grid max-w-md gap-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
                <FormLabel>Department</FormLabel>
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
                <FormLabel>Assigned approver</FormLabel>
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
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Form>

      <div className="grid gap-2 border-t pt-4">
        {user.status === "invited" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await resendInviteAction({ id: user.id });
                  if (res.ok) {
                    setInviteLink(res.data.inviteLink);
                    setMessage(null);
                  } else {
                    setMessage({ kind: "error", text: res.error });
                  }
                })
              }
            >
              Get new invite link
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => revokeInviteAction({ id: user.id }), "Invite revoked.")}
            >
              Revoke invite
            </Button>
          </div>
        ) : null}
        {user.status === "active" && !isSelf ? (
          <Button
            variant="destructive"
            disabled={pending}
            className="w-fit"
            onClick={() =>
              run(() => deactivateUserAction({ id: user.id }), "User deactivated.")
            }
          >
            Deactivate user
          </Button>
        ) : null}
        {user.status === "deactivated" ? (
          <Button
            variant="outline"
            disabled={pending}
            className="w-fit"
            onClick={() =>
              run(() => reactivateUserAction({ id: user.id }), "User reactivated.")
            }
          >
            Reactivate user
          </Button>
        ) : null}
        {isSelf ? (
          <p className="text-muted-foreground text-xs">
            You can&apos;t deactivate your own account.
          </p>
        ) : null}
      </div>

      {inviteLink ? (
        <div className="grid gap-2">
          <p className="text-sm">New invite link (valid 7 days):</p>
          <code className="bg-muted block overflow-x-auto rounded-md p-2 text-xs break-all">
            {inviteLink}
          </code>
          <Button
            type="button"
            size="sm"
            className="w-fit"
            onClick={() => navigator.clipboard.writeText(inviteLink)}
          >
            Copy link
          </Button>
        </div>
      ) : null}

      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={message.kind === "error" ? "text-destructive text-sm" : "text-sm text-green-700"}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
