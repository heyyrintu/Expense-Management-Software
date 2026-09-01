// Is Row-Level Security actually switched on in the database we're pointed at?
//
// The isolation suite proves tenant isolation twice: once through the app's
// scopedDb wrapper, and once through Postgres RLS as defence-in-depth. The
// second half is silently useless if the connection is a SUPERUSER or the
// table OWNER without FORCE — Postgres exempts both, so every "org B is
// rejected" assertion resolves instead of rejecting and the suite fails in a
// way that looks like a code regression.
//
// Run this before debugging an isolation failure that says "promise resolved
// instead of rejecting". Diagnostic only; it writes nothing.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const [who] = await db.$queryRawUnsafe(
  `select current_user as "user",
          (select usesuper from pg_user where usename = current_user) as "superuser"`
);

const tables = await db.$queryRawUnsafe(
  `select relname as "table", relrowsecurity as "rls", relforcerowsecurity as "forced"
     from pg_class
    where relkind = 'r'
      and relnamespace = 'public'::regnamespace
      and relname in ('expenses','organizations','expense_reports','complaints','reimbursements')
    order by relname`
);

console.log(`connected as: ${who.user}  superuser: ${who.superuser}`);
console.table(tables);

const off = tables.filter((t) => !t.rls || !t.forced);
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
      "re-apply the migrations that ENABLE and FORCE row level security."
  );
  process.exit(1);
}
console.log("\n✔ RLS enabled and forced on every table checked.");
await db.$disconnect();
