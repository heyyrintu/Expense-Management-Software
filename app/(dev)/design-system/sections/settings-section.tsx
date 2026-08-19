"use client";

// Settings and admin (D4.4) — DESIGN-PRD §6.
//
// Three patterns that every admin screen shares, shown once here so they
// cannot be re-invented eleven times: the dirty save bar, the destructive
// confirmation, and a masked value with a reveal.
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDestructiveDialog } from "@/components/ui/confirm-destructive-dialog";
import { DirtySaveBar } from "@/components/ui/dirty-save-bar";
import { Input } from "@/components/ui/input";
import { MaskedValue } from "@/components/ui/masked-value";
import { SettingsNav } from "@/components/settings/settings-nav";
import { visibleSettingsGroups } from "@/lib/settings/nav";
import type { Role } from "@/lib/auth/roles";
import { Block, Group, Panel, Row } from "./shared";

const ROLES: Role[] = ["employee", "finance_admin", "org_admin"];

export function SettingsSectionDemo() {
  const [role, setRole] = React.useState<Role>("org_admin");
  const [value, setValue] = React.useState("Acme Logistics");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const DEFAULT_VALUE = "Acme Logistics";
  const dirty = value !== DEFAULT_VALUE;

  return (
    <Group
      id="settings"
      eyebrow="§6 · PLAN 2.0"
      title="Settings and admin"
      description="Eleven screens that must feel like one. The nav, the panel wrapper and the three patterns below are what make that true without each screen agreeing to it separately."
    >
      <Block
        title="Section nav"
        description="Grouped and vertical from md, a horizontal scroller below it. Every minRole MIRRORS a guard the route already runs — hiding a link is not a permission, and tests/unit/settings-nav.test.ts holds the two together."
      >
        <Row label="Role">
          {ROLES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={role === r ? "primary" : "secondary"}
              onClick={() => setRole(r)}
            >
              {r.replace("_", " ")}
            </Button>
          ))}
        </Row>
        <Panel>
          <div className="max-w-xs">
            <SettingsNav groups={visibleSettingsGroups(role)} />
          </div>
          <p className="text-meta text-text-tertiary">
            Switch to employee and everything but Profile disappears — including
            the group headings, because a heading over nothing is furniture. An
            employee reaching /settings by URL is redirected by the layout;
            this nav only decides what is worth offering.
          </p>
        </Panel>
      </Block>

      <Block
        title="Dirty save bar"
        description="Edit the field and the bar appears; put the value back and it goes away again. Dirtiness is a real comparison against the last saved state, not “has been focused”."
      >
        <Panel>
          <div className="grid max-w-lg gap-4">
            <label className="grid gap-1">
              <span className="text-label text-text-primary">Organisation name</span>
              <Input value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
            <DirtySaveBar
              dirty={dirty}
              onDiscard={() => setValue(DEFAULT_VALUE)}
              onSave={() => setValue(DEFAULT_VALUE)}
            />
          </div>
          <p className="text-meta text-text-tertiary">
            A permanently visible Save button is wrong most of the time —
            nothing has changed, so pressing it does nothing, and a reader who
            HAS edited something gets no signal the app noticed. The bar
            appearing is that signal; its absence is the confirmation
            everything is stored. Discard sits beside Save because the bar
            creates the obligation.
          </p>
        </Panel>
      </Block>

      <Block
        title="Destructive confirmation"
        description="Names the exact entity, enumerates what changes AND what survives, and never puts focus on the confirm button."
      >
        <Panel>
          <Row label="Open">
            <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)}>
              Deactivate a user
            </Button>
          </Row>
          <p className="text-meta text-text-tertiary">
            Three rules, each from a specific failure. “Deactivate this user?”
            is a question about an abstraction — the NAME is how someone who
            opened the wrong row finds out while it is still free. The confirm
            button is second in the DOM and opts out of autofocus, so Enter on
            an unread dialog destroys nothing. And the “what stays the same”
            list matters as much as the warning: a reader who fears
            deactivation deletes expenses will avoid the feature and leave
            stale accounts active instead.
          </p>
        </Panel>
      </Block>

      <Block
        title="Masked value"
        description="The unmasked value is never in the page. Reveal is a server action that returns it on request, and hiding drops it from state entirely."
      >
        <Panel>
          <MaskedValue
            masked="••••••4477"
            label="account number"
            onReveal={async () => {
              await new Promise((r) => setTimeout(r, 400));
              return "50100234564477";
            }}
          />
          <p className="text-meta text-text-tertiary">
            A component that renders the full number and CSS-hides it has
            already shipped it — to the DOM, to view-source, to any extension
            on the page. Masking is a property of what was SENT, not of what is
            displayed. The real action takes no id and resolves identity from
            the session, so it cannot be aimed at another person&apos;s row;
            finance&apos;s view of somebody else&apos;s details stays
            presence-only.
          </p>
        </Panel>
      </Block>

      <ConfirmDestructiveDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => setConfirmOpen(false)}
        entityName="Priya Raman"
        verb="Deactivate"
        description="They lose access immediately. Nothing they have filed is removed — deactivation is an access change, not a deletion."
        consequences={[
          "they can no longer sign in",
          "reports still waiting on them as approver need reassigning",
        ]}
        preserved={[
          "every expense, report and payment in their history",
          "their ledger, which finance can still open and export",
          "the account itself — you can reactivate it later",
        ]}
      />
    </Group>
  );
}
