// Is Row-Level Security actually switched on in the database we're pointed at?
//
// The isolation suite proves tenant isolation twice: once through the app's
// scopedDb wrapper, and once through Postgres RLS as defence-in-depth. The
// second half is silently useless if the connection is a SUPERUSER or the
// table OWNER without FORCE — Postgres exempts both, so every "org B is
// rejected" assertion resolves instead of rejecting and the suite fails in a
// way that looks like a code regression.
//
// The table list is DERIVED: every table in `public` with an `org_id` column
// is a tenant table and must have RLS enabled, forced, and carry a policy —
// the same rule tests/isolation/rls.test.ts asserts. It used to be a
// hand-written list of five names that included `organizations`, which is the
// tenant ROOT (it has no org_id and no policy), so the script went red on
// every correctly-migrated database and the deploy checklist could never be
// ticked.
//
// Run this before debugging an isolation failure that says "promise resolved
// instead of rejecting", and as step 1 of docs/DEPLOY.md. Diagnostic only; it
// writes nothing.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const [who] = await db.$queryRawUnsafe(
  `select current_user as "user",
          (select usesuper from pg_user where usename = current_user) as "superuser"`
);

const tables = await db.$queryRawUnsafe(
  `select c.relname as "table",
          c.relrowsecurity as "rls",
          c.relforcerowsecurity as "forced",
          exists (select 1 from pg_policy p where p.polrelid = c.oid) as "policy"
     from pg_class c
     join pg_attribute a
       on a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped
    where c.relkind = 'r'
      and c.relnamespace = 'public'::regnamespace
    order by c.relname`
);

console.log(`connected as: ${who.user}  superuser: ${who.superuser}`);
console.table(tables);

if (tables.length === 0) {
  console.log(
    "\n✖ No table with an org_id column found — the migrations have not been applied to this database."
  );
  process.exit(1);
}

const off = tables.filter((t) => !t.rls || !t.forced || !t.policy);
if (who.superuser) {
  console.log(
    "\n✖ RLS is BYPASSED: superusers ignore row security entirely.\n" +
      "  The app is safe (scopedDb still scopes every query), but the RLS half\n" +
      "  of the isolation suite cannot pass against this connection. Point\n" +
      "  DATABASE_URL at a non-superuser role that owns nothing."
  );
  process.exit(1);
}
if (off.length > 0) {
  console.log(
    `\n✖ Not enforced on: ${off.map((t) => t.table).join(", ")} — ` +
      "re-apply the migrations that ENABLE and FORCE row level security and create the tenant_isolation policy."
  );
  process.exit(1);
}
console.log(`\n✔ RLS enabled, forced and policied on all ${tables.length} tenant tables.`);
await db.$disconnect();
