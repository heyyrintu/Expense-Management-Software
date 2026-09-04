// Back up a database and PROVE the backup restores.
//
// docs/DEPLOY.md says "take a backup before every migration" and
// docs/PRODUCTION-CHECKLIST.md recorded, for weeks, that nobody had ever
// restored one. A backup that has never been restored is a hope, not a
// backup. This script is the procedure, so it can be run before every
// migration and on a schedule:
//
//   1. pg_dump the SOURCE (custom format, schema + data, no owners or
//      grants — roles differ between hosts) into backups/<timestamp>.dump.
//   2. Create a fresh scratch database on the LOCAL docker-compose Postgres
//      and pg_restore the dump into it.
//   3. Count rows in every public table on both sides and refuse to report
//      success unless every count matches.
//
// The dump and restore tools come from the docker-compose Postgres container
// (the same major version as the server), so nothing needs installing on the
// host. The source URL is DIRECT_DATABASE_URL from .env unless
// BACKUP_SOURCE_URL is set; it reaches the container as an environment
// variable, never on a command line.
//
//   node scripts/backup-restore-test.mjs            # source = DIRECT_DATABASE_URL
//   BACKUP_SOURCE_URL=postgresql://... node scripts/backup-restore-test.mjs
//
// Exit code 0 means: dump written, restored, every table's row count equal.
// backups/ is git-ignored; a dump holds every row, secrets included.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { config } from "dotenv";

config();

const SOURCE = process.env.BACKUP_SOURCE_URL ?? process.env.DIRECT_DATABASE_URL;
if (!SOURCE) fail("set BACKUP_SOURCE_URL or DIRECT_DATABASE_URL", 2);

// The docker-compose Postgres, as the owner role, pointed at the maintenance
// database. Override for a different restore target; the point is that it is
// NEVER the source.
const RESTORE_ADMIN_URL =
  process.env.BACKUP_RESTORE_ADMIN_URL ?? "postgresql://expense:expense@localhost:5432/postgres";
const SCRATCH_DB = "restore_test";
const restoreUrl = RESTORE_ADMIN_URL.replace(/\/[^/?]+(\?|$)/, `/${SCRATCH_DB}$1`);

const source = new URL(SOURCE);
if (source.hostname === new URL(restoreUrl).hostname && source.pathname === `/${SCRATCH_DB}`) {
  fail("refusing to restore over the source database", 2);
}

const containerId = execFileSync("docker", ["compose", "ps", "-q", "postgres"], {
  encoding: "utf8",
}).trim();
if (!containerId) fail("the docker-compose postgres service is not running", 2);

/**
 * Run a Postgres client tool inside the container. The URL travels as an
 * environment variable and is expanded by the container's shell, so it never
 * appears in a process listing on the host.
 */
function pg(tool, args, { url, input } = {}) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", "-e", `PGURL=${url}`, containerId, "sh", "-c", `${tool} --dbname="$PGURL" ${args.join(" ")}`],
    { input, maxBuffer: 1 << 30 }
  );
  if (result.status !== 0) throw new Error(`${tool} failed:\n${result.stderr.toString()}`);
  return result.stdout;
}

function sql(url, statement) {
  return pg("psql", ["-At", "-v", "ON_ERROR_STOP=1", "-c", `'${statement.replace(/'/g, "''")}'`], { url })
    .toString()
    .trim();
}

function rowCounts(url) {
  const tables = sql(url, "select tablename from pg_tables where schemaname = 'public' order by 1")
    .split("\n")
    .filter(Boolean);
  const counts = new Map();
  for (const t of tables) counts.set(t, Number(sql(url, `select count(*) from "${t}"`)));
  return counts;
}

function fail(message, code = 1) {
  console.error(`backup: ${message}`);
  process.exit(code);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dumpDir = join(process.cwd(), "backups");
mkdirSync(dumpDir, { recursive: true });
const dumpFile = join(dumpDir, `${stamp}.dump`);

console.log(`1/3 dumping ${source.hostname}${source.pathname} → ${dumpFile}`);
const dump = pg("pg_dump", ["--format=custom", "--no-owner", "--no-privileges"], { url: SOURCE });
if (dump.length === 0) fail("dump is empty");
writeFileSync(dumpFile, dump);
console.log(`    ${(dump.length / 1024).toFixed(0)} KB`);

console.log(`2/3 restoring into ${new URL(restoreUrl).hostname}/${SCRATCH_DB}`);
sql(RESTORE_ADMIN_URL, `drop database if exists ${SCRATCH_DB}`);
sql(RESTORE_ADMIN_URL, `create database ${SCRATCH_DB}`);
// --no-owner/--no-privileges again on restore: the scratch database's owner
// is whoever we connect as. RLS policies reference the expense_app role,
// which docker/postgres-init creates, so they restore intact.
pg("pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error"], { url: restoreUrl, input: dump });

console.log("3/3 comparing row counts");
const before = rowCounts(SOURCE);
const after = rowCounts(restoreUrl);
let mismatched = 0;
let total = 0;
for (const [table, n] of before) {
  const m = after.get(table);
  total += n;
  const ok = m === n;
  if (!ok) mismatched += 1;
  console.log(
    `    ${ok ? "✔" : "✖"} ${table.padEnd(28)} ${String(n).padStart(6)} → ${String(m ?? "missing").padStart(7)}`
  );
}
for (const table of after.keys()) {
  if (!before.has(table)) {
    mismatched += 1;
    console.log(`    ✖ ${table.padEnd(28)} only in the restore`);
  }
}
if (mismatched > 0) fail(`restore does not match the source: ${mismatched} table(s) differ`);
console.log(`\n✔ ${before.size} tables, ${total} rows: the backup at ${dumpFile} restores exactly.`);
