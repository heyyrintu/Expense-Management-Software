// Account mappings (FINAL-AUDIT §4). finance_admin.
//
// The screen is organised BY TARGET, because a mapping only means anything in
// the context of one accounting system — the same category is 6100 in
// QuickBooks and "Travel Expenses" in Tally, and a flat list mixing them would
// read as a contradiction.
//
// The unmapped list is the point of the screen, so it comes first: an export
// that silently dropped a row, or quietly substituted a default account, is
// discovered a month later by an accountant working backwards from a variance.
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { SettingsPanel } from "@/components/settings/settings-panel";
import {
  ACCOUNTING_ENTITY_TYPES,
  adapterFor,
  AVAILABLE_ADAPTERS,
  UNIMPLEMENTED_TARGETS,
  type AccountingEntityType,
  type AccountingTarget,
} from "@/lib/exports/accounting";
import { MappingPanel, type MappableEntity, type MappingView } from "./mapping-panel";

const TARGET_PARAM = "target";

export default async function AccountingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireRole("finance_admin");
  const db = scopedDb(ctx.orgId);
  const raw = await searchParams;

  const requested = Array.isArray(raw[TARGET_PARAM])
    ? raw[TARGET_PARAM][0]
    : raw[TARGET_PARAM];
  const target: AccountingTarget =
    adapterFor(requested as AccountingTarget)?.target ?? "quickbooks";
  const adapter = adapterFor(target);

  const [categories, departments, projects, users, mappings] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.accountingMapping.findMany({
      where: { target },
      select: {
        id: true,
        entityType: true,
        localId: true,
        remoteCode: true,
        remoteName: true,
      },
    }),
  ]);

  const entities: Record<AccountingEntityType, MappableEntity[]> = {
    category: categories as MappableEntity[],
    department: departments as MappableEntity[],
    project: projects as MappableEntity[],
    user: users as MappableEntity[],
    // Tax codes are not a table today — the enum names the concept so a tax
    // mapping can be added without a migration. Nothing to list yet.
    tax: [],
  };

  return (
    <SettingsPanel
      title="Accounting"
      description="Which account code each of your records becomes in your accounting system. An export never guesses: anything unmapped is listed before you can generate a file."
    >
      <MappingPanel
        target={target}
        targets={AVAILABLE_ADAPTERS.map((a) => ({
          target: a.target,
          label: a.label,
          description: a.description,
          requiredEntities: a.requiredEntities,
        }))}
        unavailable={[...UNIMPLEMENTED_TARGETS]}
        requiredEntities={adapter?.requiredEntities ?? []}
        entityTypes={[...ACCOUNTING_ENTITY_TYPES]}
        entities={entities}
        mappings={mappings as MappingView[]}
      />
    </SettingsPanel>
  );
}
