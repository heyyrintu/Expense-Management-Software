---
name: add-feature-module
description: End-to-end recipe for adding a feature module (schema, scoped data access, domain logic, server actions, UI, tests) to the multi-tenant expense app. Use for every new feature in PLAN.md.
---

# Add Feature Module

Follow this order — do not skip steps:

1. **Read context**: CLAUDE.md rules, the PLAN.md task, and the relevant PRD section.
2. **Schema**: if new tables are needed, invoke `db-migration` skill first.
3. **Zod schema**: `lib/schemas/<entity>.ts` — single source for form + action validation.
4. **Domain logic**: pure functions in `lib/domain/<feature>.ts`. State transitions and policy checks live here, not in components or actions. Money via `lib/money.ts` (minor units).
5. **Data access**: only through `scopedDb(orgId)`. orgId from session (`requireRole()` result), never from client input.
6. **Server actions**: `app/(app)/<feature>/actions.ts` — validate with Zod, guard with `requireRole`, call domain logic, write AuditLog for state changes, return `{ok, error}`.
7. **UI**: invoke `ui-screen` skill. Server components by default.
8. **Tests**:
   - Unit tests for domain functions (vitest)
   - Isolation tests — invoke `tenant-isolation-check` skill
9. **Verify**: `npm run lint && npm run build && npm run test && npm run test:isolation`; manual check with both seed orgs (acme, globex).
10. Check off the PLAN.md task; conventional commit.

## Red flags — stop and fix
- Raw `prisma.` call outside `lib/db/`
- `orgId`/`userId` read from params, body, or headers
- Float arithmetic on money
- State change without AuditLog
- New table without RLS policy or isolation test
