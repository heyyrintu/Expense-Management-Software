"use client";

// Every primitive, every state (D0.3). If a state isn't on this page it
// isn't specified, and if it looks wrong here it looks wrong everywhere —
// this is the page to check before touching a component.
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox, RadioGroup, RadioGroupItem, Switch } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { AmountInput, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/ui/toaster";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge, StatusBadge } from "@/components/status-badge";
import { STATUS_MAP } from "@/lib/design/status";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <span className="text-meta text-text-tertiary">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-line bg-bg-surface grid gap-4 rounded-lg border p-5">
      <h3 className="text-h3 text-text-primary">{title}</h3>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ButtonSpecimens() {
  const [loading, setLoading] = React.useState(false);
  return (
    <Panel title="Button">
      <Row label="Variants (md)">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </Row>
      <Row label="Sizes — 32 / 36 / 44px">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </Row>
      <Row label="Disabled">
        <Button disabled>Primary</Button>
        <Button variant="secondary" disabled>
          Secondary
        </Button>
        <Button variant="ghost" disabled>
          Ghost
        </Button>
      </Row>
      <Row label="Loading — width is preserved, so nothing shifts">
        <Button loading>Submit report</Button>
        <Button variant="secondary" loading>
          Save
        </Button>
        <Button
          onClick={() => {
            setLoading(true);
            window.setTimeout(() => setLoading(false), 1600);
          }}
          loading={loading}
        >
          Click to load
        </Button>
      </Row>
      <p className="text-meta text-text-tertiary">
        Tab to any button to see the 2px accent focus ring at 2px offset. Press
        and hold to see the 0.98 scale.
      </p>
    </Panel>
  );
}

function FieldSpecimens() {
  const [date, setDate] = React.useState<Date | undefined>(new Date("2026-08-12"));
  return (
    <Panel title="Input · Select · DatePicker · Textarea">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Merchant" htmlFor="ds-merchant" helper="Where the money went">
          <Input id="ds-merchant" placeholder="Blue Tokai" />
        </Field>
        <Field label="Merchant" htmlFor="ds-merchant-err" error="Enter a merchant name">
          <Input id="ds-merchant-err" aria-invalid placeholder="Blue Tokai" />
        </Field>
        <Field label="Amount" htmlFor="ds-amount" helper="Right-aligned, tabular figures">
          <AmountInput id="ds-amount" defaultValue="4,500.00" />
        </Field>
        <Field label="Category" htmlFor="ds-category">
          <NativeSelect id="ds-category" defaultValue="travel">
            <option value="travel">Travel</option>
            <option value="meals">Meals</option>
            <option value="software">Software</option>
          </NativeSelect>
        </Field>
        <Field label="Date" htmlFor="ds-date" helper="Calendar opens from the field">
          <DatePicker id="ds-date" value={date} onChange={setDate} />
        </Field>
        <Field label="Disabled" htmlFor="ds-disabled" helper="Not editable right now">
          <Input id="ds-disabled" disabled defaultValue="Locked" />
        </Field>
      </div>
      <Field label="Purpose" htmlFor="ds-purpose" helper="Optional context for the approver">
        <Textarea id="ds-purpose" placeholder="Client dinner after the Mumbai review" />
      </Field>
    </Panel>
  );
}

function ToggleSpecimens() {
  const [checked, setChecked] = React.useState(true);
  const [on, setOn] = React.useState(true);
  return (
    <Panel title="Checkbox · Radio · Switch">
      <Row label="Checkbox">
        <label className="text-body text-text-secondary flex items-center gap-2">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
          Billable to client
        </label>
        <label className="text-body text-text-tertiary flex items-center gap-2">
          <Checkbox disabled />
          Disabled
        </label>
        <label className="text-body text-text-secondary flex items-center gap-2">
          <Checkbox checked="indeterminate" />
          Some selected
        </label>
      </Row>
      <Row label="Radio">
        <RadioGroup defaultValue="amount" className="flex gap-4">
          {[
            ["amount", "By amount"],
            ["percent", "By percent"],
          ].map(([value, label]) => (
            <label
              key={value}
              className="text-body text-text-secondary flex items-center gap-2"
            >
              <RadioGroupItem value={value} />
              {label}
            </label>
          ))}
        </RadioGroup>
      </Row>
      <Row label="Switch">
        <label className="text-body text-text-secondary flex items-center gap-2">
          <Switch checked={on} onCheckedChange={setOn} />
          Send me updates on WhatsApp
        </label>
        <label className="text-body text-text-tertiary flex items-center gap-2">
          <Switch disabled />
          Disabled
        </label>
      </Row>
    </Panel>
  );
}

function BadgeSpecimens() {
  return (
    <Panel title="StatusBadge · Badge">
      <Row label="Every state in the §5.2 map — colour comes from lib/design/status.ts">
        {Object.keys(STATUS_MAP).map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </Row>
      <Row label="Unknown status falls back to neutral, humanised">
        <StatusBadge status="something_new" />
      </Row>
      <Row label="Badge — non-status labels">
        <Badge tone="accent">3 new</Badge>
        <Badge tone="neutral">Draft</Badge>
        <Badge tone="info">Beta</Badge>
      </Row>
    </Panel>
  );
}

function OverlaySpecimens() {
  return (
    <Panel title="Dialog · Sheet · Tooltip · Toast">
      <Row label="Dialog — scale 0.96 → 1 with the scrim, 200ms">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this expense?</DialogTitle>
              <DialogDescription>
                The receipt goes with it. This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Keep it</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="destructive">Delete</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Row>

      <Row label="Sheet — drag to dismiss on mobile, side panel from md up">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Open sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>
                Narrow the list down. Drag the handle to dismiss on a phone.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4">
              <Field label="Status" htmlFor="ds-sheet-status">
                <NativeSelect id="ds-sheet-status">
                  <option>All</option>
                  <option>Submitted</option>
                </NativeSelect>
              </Field>
            </div>
            <SheetFooter>
              <Button variant="ghost">Clear</Button>
              <Button>Apply</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </Row>

      <Row label="Tooltip">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost">Hover or focus me</Button>
          </TooltipTrigger>
          <TooltipContent>Above the ₹5,000 per-expense limit</TooltipContent>
        </Tooltip>
      </Row>

      <Row label="Toast">
        <Button variant="secondary" onClick={() => notify.success("Report submitted")}>
          Success
        </Button>
        <Button
          variant="secondary"
          onClick={() => notify.error("Couldn't read that receipt", "Enter the details yourself.")}
        >
          Error
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            notify.undo("Approved “August travel”", {
              onUndo: () => notify.success("Undone"),
              description: "5 seconds to change your mind.",
            })
          }
        >
          Undo
        </Button>
      </Row>
    </Panel>
  );
}

function TabsSpecimen() {
  return (
    <Panel title="Tabs — the indicator slides between triggers">
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="disabled" disabled>
            Archived
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="text-body text-text-secondary">
          Everything, most recent first.
        </TabsContent>
        <TabsContent value="pending" className="text-body text-text-secondary">
          Waiting on an approver.
        </TabsContent>
        <TabsContent value="paid" className="text-body text-text-secondary">
          Settled and reconciled.
        </TabsContent>
      </Tabs>
    </Panel>
  );
}

function SurfaceSpecimens() {
  return (
    <Panel title="Card · Skeleton · EmptyState">
      <Row label="Card">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="grid gap-1">
              <CardTitle>August travel</CardTitle>
              <CardDescription>4 expenses · submitted 12 Aug</CardDescription>
            </div>
            <CardAction>
              <StatusBadge status="submitted" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <span className="amount text-display">₹12,450.00</span>
          </CardContent>
          <CardFooter>
            <Button size="sm" variant="secondary">
              View
            </Button>
          </CardFooter>
        </Card>
      </Row>

      <Row label="Skeleton — shape-matched, opacity pulse only">
        <div className="border-line grid w-full max-w-sm gap-3 rounded-lg border p-5">
          <Skeleton className="h-5 w-32" />
          <SkeletonText lines={3} />
          <Skeleton className="h-9 w-24" />
        </div>
      </Row>

      <Row label="EmptyState">
        <div className="border-line w-full rounded-lg border">
          <EmptyState
            headline="No expenses yet"
            description="Capture one from a receipt, or add the details yourself."
            action={<Button>Add expense</Button>}
          />
        </div>
      </Row>
    </Panel>
  );
}

export function PrimitiveSpecimens() {
  return (
    <div className="grid gap-6">
      <ButtonSpecimens />
      <FieldSpecimens />
      <ToggleSpecimens />
      <BadgeSpecimens />
      <TabsSpecimen />
      <OverlaySpecimens />
      <SurfaceSpecimens />
    </div>
  );
}
