"use client";

import { updateOrgSettingsAction } from "../actions";
import { orgSettingsSchema, type OrgSettingsInput } from "@/lib/schemas/org-settings";
import { SettingsForm } from "../components/settings-form";

export function OrgSettingsForm({ defaults }: { defaults: OrgSettingsInput }) {
  return (
    <SettingsForm
      schema={orgSettingsSchema}
      defaults={defaults}
      submitLabel="Save settings"
      action={updateOrgSettingsAction}
      fields={[
        { name: "name", label: "Organization name" },
        { name: "currency", label: "Currency", placeholder: "INR", description: "3-letter ISO code" },
        { name: "mileageRate", label: "Mileage rate", placeholder: "12.00", description: "Amount per km, in your currency" },
      ]}
    />
  );
}
