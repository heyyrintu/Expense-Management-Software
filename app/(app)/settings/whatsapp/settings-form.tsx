"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { disableWhatsAppAction, saveWhatsAppSettingsAction } from "./actions";

export type WhatsAppSettingsView = {
  enabled: boolean;
  phoneNumberId: string;
  businessPhone: string;
  tokenHint: string;
  appSecretHint: string;
  verifyTokenHint: string;
  hasEncryptionKey: boolean;
  webhookUrl: string;
};

export function WhatsAppSettingsForm({ view }: { view: WhatsAppSettingsView }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid max-w-xl gap-4">
      {!view.hasEncryptionKey ? (
        <p className="border-status-warning bg-status-warning-subtle text-status-warning-text rounded-lg border p-3 text-sm">
          Set <code>APP_ENCRYPTION_KEY</code> on the server before saving
          credentials — they are encrypted at rest and cannot be stored without it.
        </p>
      ) : null}

      <form
        className="grid gap-4"
        action={(formData) => run(() => saveWhatsAppSettingsAction(formData))}
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={view.enabled}
            className="size-4"
          />
          Enable WhatsApp for this organization
        </label>

        <div className="grid gap-1">
          <label htmlFor="phoneNumberId" className="text-sm font-medium">
            Phone number ID
          </label>
          <Input
            id="phoneNumberId"
            name="phoneNumberId"
            defaultValue={view.phoneNumberId}
            placeholder="123456789012345"
          />
          <p className="text-text-tertiary text-xs">
            From Meta ▸ WhatsApp ▸ API setup. This is how inbound messages find
            your organization, so it must be unique.
          </p>
        </div>

        <div className="grid gap-1">
          <label htmlFor="businessPhone" className="text-sm font-medium">
            Business number
          </label>
          <Input
            id="businessPhone"
            name="businessPhone"
            defaultValue={view.businessPhone}
            placeholder="+91 98765 43210"
          />
        </div>

        {(
          [
            ["token", "Access token", view.tokenHint],
            ["appSecret", "App secret", view.appSecretHint],
            ["verifyToken", "Webhook verify token", view.verifyTokenHint],
          ] as const
        ).map(([name, label, hint]) => (
          <div key={name} className="grid gap-1">
            <label htmlFor={name} className="text-sm font-medium">
              {label}
            </label>
            <Input id={name} name={name} type="password" placeholder="Leave blank to keep" />
            <p className="text-text-tertiary text-xs">Stored: {hint}</p>
          </div>
        ))}

        <div className="grid gap-1 rounded-lg border p-3 text-sm">
          <p className="font-medium">Webhook URL</p>
          <code className="text-xs break-all">{view.webhookUrl}</code>
          <p className="text-text-tertiary text-xs">
            Paste this into Meta ▸ Configuration ▸ Webhook, with the verify token above.
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-status-danger-text text-sm">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="text-status-success-text text-sm">
            Saved.
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {view.enabled ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => disableWhatsAppAction())}
            >
              Turn off
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
