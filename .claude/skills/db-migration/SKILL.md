---
name: db-migration
description: Safe Prisma/Postgres schema-change procedure for the multi-tenant expense app. Use for any model or migration change.
---

# DB Migration

1. Edit `schema.prisma`. Every tenant model must have:
   - `orgId String @db.Uuid` + relation to Organization
   - `@@index([orgId, ...])` — org_id leads every index
   - UUIDv7 ids; money fields as `Int` (minor units); timestamps `createdAt/updatedAt`
2. `npx prisma migrate dev --name <snake_case_change>`
3. In the generated SQL migration, append RLS for any **new** table:
   ```sql
   ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
   ALTER TABLE <t> FORCE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON <t>
     USING (org_id = current_setting('app.current_org_id')::uuid);
   ```
4. Update `scopedDb` typing if the model list changed; update `npm run seed` so both orgs have sample rows.
5. Invoke `tenant-isolation-check` (includes RLS coverage test).
6. Rules:
   - Never edit an already-applied migration — create a new one.
   - Additive first; destructive changes need a backfill/rollback note in the migration file header.
   - Enum changes: add values only; removals require a data migration.
   - No cross-org foreign keys, ever.
7. Verify: `npm run build && npm run test:isolation`, then boot the app with both seed orgs.
