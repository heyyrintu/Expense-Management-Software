---
name: tenant-isolation-check
description: Write cross-tenant isolation tests and verify RLS whenever data access is added or changed. Mandatory before completing any PLAN.md task that touches the database.
---

# Tenant Isolation Check

Goal: prove org B can never read or write org A's data through the new/changed code path.

## Test pattern (`tests/isolation/<feature>.test.ts`)

For each new query/action, using seed orgs acme (A) and globex (B):

1. **Read leak**: create record as A → fetch as B → expect not-found/empty (never a permission error that confirms existence).
2. **Write leak**: attempt update/delete of A's record as B → expect rejection; verify A's record unchanged.
3. **ID probing**: call B's session with A's record UUID directly → not-found.
4. **List scoping**: list endpoint as B returns only B's records after A has data.
5. **Storage**: for receipts, B cannot obtain a signed URL for A's receipt.
6. **Role bypass**: B's org_admin has no more cross-tenant access than B's employee.

## RLS checklist (any new table)

- [ ] `org_id UUID NOT NULL` + FK to organizations
- [ ] `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;` + policy `USING (org_id = current_setting('app.current_org_id')::uuid)`
- [ ] `FORCE ROW LEVEL SECURITY` so the app role can't bypass
- [ ] Composite indexes lead with `org_id`
- [ ] Table added to the RLS coverage assertion test (`tests/isolation/rls-coverage.test.ts` — queries pg_policies and fails if any tenant table lacks a policy)

## Done when
`npm run test:isolation` passes and includes the new cases; no endpoint trusts client-supplied org/user IDs.
