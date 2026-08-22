"use client";

// Mapping editor. One row per local record, grouped by entity type.
//
// Every mappable record gets a row whether or not it is mapped — a screen
// that listed only the mappings you already had would make "what is still
// missing" the one question it could not answer, which is the question the
// reader came with.
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  AccountingEntityType,
  AccountingTarget,
} from "@/lib/exports/accounting/types";
import { deleteMappingAction, saveMappingAction } from "./actions";

export type MappableEntity = { id: string; name: string };
export type MappingView = {
  id: string;
  entityType: AccountingEntityType;
  localId: string;
  remoteCode: string;
  remoteName: string | null;
};

const ENTITY_LABEL: Record<AccountingEntityType, string> = {
  category: "Categories",
  department: "Departments",
  project: "Projects",
  user: "People",
  tax: "Tax codes",
};

export function MappingPanel({
  target,
  targets,
  unavailable,
  requiredEntities,
  entityTypes,
  entities,
  mappings,
}: {
  target: AccountingTarget;
  targets: Array<{
    target: AccountingTarget;
    label: string;
    description: string;
    requiredEntities: AccountingEntityType[];
  }>;
  unavailable: AccountingTarget[];
  requiredEntities: AccountingEntityType[];
  entityTypes: AccountingEntityType[];
  entities: Record<AccountingEntityType, MappableEntity[]>;
  mappings: MappingView[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const byKey = React.useMemo(() => {
    const m = new Map<string, MappingView>();
    for (const row of mappings) m.set(`${row.entityType}:${row.localId}`, row);
    return m;
  }, [mappings]);

  function switchTarget(next: AccountingTarget) {
    const params = new URLSearchParams(searchParams);
    params.set("target", next);
    router.replace(`/settings/accounting?${params.toString()}`);
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "That didn't save.");
      else router.refresh();
    });
  }

  const active = targets.find((t) => t.target === target);
  // Only entity types this target actually needs, plus any already mapped —
  // showing all five for a target that needs none is five empty tables.
  const shown = entityTypes.filter(
    (t) =>
      requiredEntities.includes(t) ||
      mappings.some((m) => m.entityType === t)
  );

  const unmappedCount = requiredEntities.reduce(
    (n, t) => n + entities[t].filter((e) => !byKey.has(`${t}:${e.id}`)).length,
    0
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <span className="text-label text-text-secondary">Accounting system</span>
        <div role="tablist" aria-label="Accounting system" className="flex flex-wrap gap-2">
          {targets.map((t) => (
            <Button
              key={t.target}
              role="tab"
              aria-selected={t.target === target}
              size="sm"
              variant={t.target === target ? "default" : "secondary"}
              onClick={() => switchTarget(t.target)}
            >
              {t.label}
            </Button>
          ))}
          {unavailable.map((t) => (
            // Shown, not hidden: the roadmap is legible from the product
            // rather than from a backlog nobody outside the team reads.
            <Button key={t} size="sm" variant="ghost" disabled>
              {t} — not yet
            </Button>
          ))}
        </div>
        {active ? (
          <p className="text-meta text-text-tertiary">{active.description}</p>
        ) : null}
      </div>

      {requiredEntities.length === 0 ? (
        <p className="border-line bg-bg-subtle text-body text-text-secondary rounded-lg border p-4">
          {active?.label} posts against ledger names from your organisation
          settings, so it needs no account mapping.
        </p>
      ) : unmappedCount > 0 ? (
        <p className="border-status-warning bg-status-warning-subtle text-status-warning-text rounded-lg border p-4 text-body">
          {unmappedCount} record{unmappedCount === 1 ? "" : "s"} still need an
          account code. An export will refuse to run until they have one —
          guessing would post costs to the wrong ledger.
        </p>
      ) : (
        <p className="border-status-success bg-status-success-subtle text-status-success-text rounded-lg border p-4 text-body">
          Everything {active?.label} needs is mapped.
        </p>
      )}

      {shown.map((entityType) => (
        <section key={entityType} className="grid gap-2">
          <h2 className="text-h3 text-text-primary">
            {ENTITY_LABEL[entityType]}
            {requiredEntities.includes(entityType) ? (
              <Badge tone="neutral" className="ml-2">Required</Badge>
            ) : (
              <Badge tone="neutral" className="ml-2">Optional</Badge>
            )}
          </h2>
          {entities[entityType].length === 0 ? (
            <p className="text-meta text-text-tertiary">Nothing to map here yet.</p>
          ) : (
            <ul className="border-line divide-line divide-y rounded-lg border">
              {entities[entityType].map((entity) => (
                <MappingRow
                  key={entity.id}
                  entityType={entityType}
                  entity={entity}
                  target={target}
                  existing={byKey.get(`${entityType}:${entity.id}`) ?? null}
                  required={requiredEntities.includes(entityType)}
                  pending={pending}
                  run={run}
                />
              ))}
            </ul>
          )}
        </section>
      ))}

      {error ? (
        <p role="alert" className="text-status-danger-text text-body">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function MappingRow({
  entityType,
  entity,
  target,
  existing,
  required,
  pending,
  run,
}: {
  entityType: AccountingEntityType;
  entity: MappableEntity;
  target: AccountingTarget;
  existing: MappingView | null;
  required: boolean;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [code, setCode] = React.useState(existing?.remoteCode ?? "");
  const [name, setName] = React.useState(existing?.remoteName ?? "");
  const dirty = code !== (existing?.remoteCode ?? "") || name !== (existing?.remoteName ?? "");
  const missing = required && !existing;

  return (
    <li
      className={cn(
        "grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-end",
        // An inset edge, not a border: a border would change the row's box
        // and shift every field 2px as codes are filled in.
        missing && "overdue-edge"
      )}
    >
      <div className="grid gap-2 sm:grid-cols-3 sm:items-end">
        <span className="text-body text-text-primary self-center">
          {entity.name}
          {missing ? (
            <span className="text-meta text-status-warning-text block">
              No account code
            </span>
          ) : null}
        </span>
        <span className="grid gap-1">
          <label htmlFor={`code-${entity.id}`} className="text-text-tertiary text-xs">
            Account code
          </label>
          <Input
            id={`code-${entity.id}`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6100"
          />
        </span>
        <span className="grid gap-1">
          <label htmlFor={`name-${entity.id}`} className="text-text-tertiary text-xs">
            Account name (optional)
          </label>
          <Input
            id={`name-${entity.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Travel expenses"
          />
        </span>
      </div>
      <span className="flex gap-2">
        {/* Appears only when there is something to save — a permanently
            enabled Save on 40 rows is 40 buttons that mostly do nothing. */}
        {dirty && code.trim() !== "" ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() =>
                saveMappingAction({
                  target,
                  entityType,
                  localId: entity.id,
                  remoteCode: code,
                  remoteName: name,
                })
              )
            }
          >
            Save
          </Button>
        ) : null}
        {existing ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => deleteMappingAction({ id: existing.id }))}
          >
            Clear
          </Button>
        ) : null}
      </span>
    </li>
  );
}
