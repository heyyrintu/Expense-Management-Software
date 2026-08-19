"use client";

// App shell specimens (D0.4). The live shell needs a session, so the gallery
// renders its parts statically at both widths instead of embedding it: the
// sidebar expanded and as a rail, the top bar, the mobile tab bar, and the
// page header with and without breadcrumbs.
//
// Role is switchable here because role-aware nav is the part most likely to
// regress — flipping to `employee` should make Approvals, Finance and
// Settings disappear from every surface at once.
import * as React from "react";
import { Bell, Menu, Plus, Search } from "lucide-react";

import { Avatar } from "@/components/shell/avatar-menu";
import { TAB_BAR_ITEMS, visibleSections } from "@/components/shell/nav";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ROLES, type Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

export function ShellSection() {
  const [role, setRole] = React.useState<Role>("finance_admin");
  const sections = visibleSections(role);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label text-text-secondary">Role</span>
        {ROLES.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={r === role ? "primary" : "secondary"}
            onClick={() => setRole(r)}
          >
            {r.replace("_", " ")}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen label="Sidebar — 240px">
          <div className="w-sidebar border-line bg-bg-surface border-r p-2">
            {sections.map((section) => (
              <div key={section.id} className="mt-4 first:mt-0">
                {section.label ? (
                  <h4 className="text-meta text-text-tertiary px-2 pb-1 uppercase">
                    {section.label}
                  </h4>
                ) : null}
                <ul className="grid gap-1">
                  {section.items.map((item, i) => (
                    <li
                      key={item.href}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-md px-3 text-label",
                        section.id === "expenses" && i === 0
                          ? "bg-accent-subtle text-accent-text"
                          : "text-text-secondary"
                      )}
                    >
                      <item.icon aria-hidden="true" className="size-4" />
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Specimen>

        <Specimen label="Rail — 64px (labels become tooltips)">
          <div className="w-sidebar-rail border-line bg-bg-surface border-r p-2">
            {sections.map((section) => (
              <ul key={section.id} className="mt-4 grid gap-1 first:mt-0">
                {section.items.map((item, i) => (
                  <li
                    key={item.href}
                    className={cn(
                      "grid h-11 place-items-center rounded-md",
                      section.id === "expenses" && i === 0
                        ? "bg-accent-subtle text-accent-text"
                        : "text-text-secondary"
                    )}
                  >
                    <item.icon aria-hidden="true" className="size-4" />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </Specimen>
      </div>

      <Specimen label="Top bar — sticky, 1px border, no shadow">
        <div className="border-line bg-bg-surface flex h-topbar items-center gap-3 border-b px-6">
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="text-h3 text-text-primary">Expenses</span>
            <span className="text-meta text-text-tertiary">Acme Inc</span>
          </div>
          <span className="border-line bg-bg-app text-text-tertiary flex h-9 w-56 items-center gap-2 rounded-md border px-3">
            <Search aria-hidden="true" className="size-4" />
            <span className="text-label flex-1">Search</span>
            <kbd className="text-meta border-line bg-bg-surface rounded-sm border px-1">⌘K</kbd>
          </span>
          <span className="text-text-secondary relative grid size-11 place-items-center rounded-md">
            <Bell aria-hidden="true" className="size-5" />
            <span className="bg-accent border-bg-surface absolute top-2 right-2 size-2 rounded-full border-2" />
          </span>
          <Avatar name="Riya Kapoor" />
        </div>
      </Specimen>

      <Specimen label="Mobile tab bar — Add is the accent circle">
        <div className="border-line bg-bg-surface border-t">
          <ul className="grid h-tabbar grid-cols-5 items-center">
            {[TAB_BAR_ITEMS[0], TAB_BAR_ITEMS[1]].map((item, i) => (
              <li
                key={item.href}
                className={cn(
                  "grid gap-1 justify-items-center",
                  i === 1 ? "text-accent-text" : "text-text-secondary"
                )}
              >
                <item.icon aria-hidden="true" className="size-5" />
                <span className="text-meta">{item.label}</span>
              </li>
            ))}
            <li className="grid place-items-center">
              <span className="bg-accent-solid text-text-on-accent grid size-11 place-items-center rounded-full">
                <Plus aria-hidden="true" className="size-5" />
              </span>
            </li>
            <ReportsTab />

            <li className="text-text-secondary grid justify-items-center gap-1">
              <Menu aria-hidden="true" className="size-5" />
              <span className="text-meta">More</span>
            </li>
          </ul>
        </div>
      </Specimen>

      <Specimen label="PageHeader — title, description, one primary action">
        <div className="p-6">
          <PageHeader
            title="Expenses"
            description="Everything you've captured, across every report."
            action={<Button>New expense</Button>}
          />
          <PageHeader
            breadcrumbs={[{ label: "Reports", href: "/reports" }, { label: "R-1042" }]}
            title="R-1042"
            description="Four expenses · submitted 12 Aug"
            action={<Button variant="secondary">Export</Button>}
            className="pb-0"
          />
        </div>
      </Specimen>
    </div>
  );
}

function ReportsTab() {
  const item = TAB_BAR_ITEMS[2];
  return (
    <li className="text-text-secondary grid justify-items-center gap-1">
      <item.icon aria-hidden="true" className="size-5" />
      <span className="text-meta">{item.label}</span>
    </li>
  );
}

function Specimen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <span className="text-meta text-text-tertiary">{label}</span>
      <div className="border-line bg-bg-app overflow-hidden rounded-lg border">{children}</div>
    </div>
  );
}
