#!/usr/bin/env node
// Migration-order lint. Runs as part of `npm run lint`.
//
// ── WHAT THIS CATCHES, AND WHY IT EXISTS ──────────────────────────────────
// Prisma applies migrations in FOLDER-NAME ORDER. A migration whose folder
// sorts before the migration that creates the objects it touches is
// unreplayable: it works forever on the machine where the objects already
// exist, and fails on every fresh database — CI, a new laptop, production.
//
// That happened here. `20260819044600_dep` sorted seventh and altered
// `complaints` (created fifteenth) and dropped an index created seventeenth:
//     P3006 … failed to apply cleanly to the shadow database
//     P1014 The underlying table for model `complaints` does not exist
// It survived 17 commits because the only database anyone ran it against
// already had the objects, created out of band.
//
// CI *does* run `prisma migrate deploy` against a fresh postgres service,
// which is the real end-to-end proof — but it needs a database, a runner and
// a green pipeline, and this bug shipped during a window when CI was red and
// then stopped being pushed to at all. So this check is deliberately the
// cheap one: pure text, no database, no network, runs on every commit in
// `npm run lint`. It would have failed the moment that folder landed.
//
// It is NOT a SQL parser and does not try to be. It tracks object lifetimes
// well enough to answer one question: does any statement touch a table,
// index, constraint or type that no earlier migration has created?
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIR = "prisma/migrations";

/** Strip comments and collapse whitespace so the patterns below can be simple. */
function statements(sql) {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** `"users"` → users. Unquoted identifiers are lowercased, as Postgres does. */
function ident(raw) {
  if (!raw) return null;
  const m = /^"([^"]+)"$/.exec(raw);
  return m ? m[1] : raw.toLowerCase();
}

const RULES = [
  // ---- creations -------------------------------------------------------
  { re: /^CREATE TABLE (?:IF NOT EXISTS )?("?[\w.]+"?)/i, creates: "table" },
  { re: /^CREATE TYPE ("?[\w.]+"?)/i, creates: "type" },
  {
    re: /^CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?("?[\w.]+"?) ON ("?[\w.]+"?)/i,
    creates: "index",
    requires: [{ group: 2, kind: "table" }],
  },
  {
    re: /^CREATE POLICY ("?[\w.]+"?) ON ("?[\w.]+"?)/i,
    creates: "policy",
    requires: [{ group: 2, kind: "table" }],
  },

  // ---- alterations -----------------------------------------------------
  {
    // ADD CONSTRAINT also names the table it REFERENCES, when it is an FK.
    re: /^ALTER TABLE (?:ONLY )?("?[\w.]+"?) ADD CONSTRAINT ("?[\w.]+"?)/i,
    creates: "constraint",
    createsGroup: 2,
    requires: [{ group: 1, kind: "table" }],
    references: /REFERENCES ("?[\w.]+"?)/i,
  },
  {
    re: /^ALTER TABLE (?:ONLY )?("?[\w.]+"?) DROP CONSTRAINT (?:IF EXISTS )?("?[\w.]+"?)/i,
    drops: "constraint",
    dropsGroup: 2,
    requires: [
      { group: 1, kind: "table" },
      { group: 2, kind: "constraint" },
    ],
  },
  {
    re: /^ALTER TABLE (?:ONLY )?("?[\w.]+"?)/i,
    requires: [{ group: 1, kind: "table" }],
  },
  { re: /^ALTER TYPE ("?[\w.]+"?)/i, requires: [{ group: 1, kind: "type" }] },

  // ---- drops -----------------------------------------------------------
  {
    re: /^DROP INDEX (?:IF EXISTS )?("?[\w.]+"?)/i,
    drops: "index",
    requires: [{ group: 1, kind: "index" }],
  },
  {
    re: /^DROP TABLE (?:IF EXISTS )?("?[\w.]+"?)/i,
    drops: "table",
    requires: [{ group: 1, kind: "table" }],
  },

  // ---- grants ----------------------------------------------------------
  {
    re: /^GRANT [\w, ]+ ON (?:TABLE )?("?[\w.]+"?) TO/i,
    requires: [{ group: 1, kind: "table" }],
  },
];

function main() {
  let folders;
  try {
    folders = readdirSync(DIR)
      .filter((f) => statSync(join(DIR, f)).isDirectory())
      .sort(); // exactly how Prisma orders them
  } catch {
    console.log("✔ migration order: no prisma/migrations directory");
    return;
  }

  const read = (folder) => {
    try {
      return readFileSync(join(DIR, folder, "migration.sql"), "utf8");
    } catch {
      return null; // no migration.sql (e.g. a stray directory)
    }
  };

  // PRE-PASS: which folder creates each object, ignoring order. Without this
  // the error can only say "nothing creates it", when the useful message is
  // "created later by X — rename to sort after it".
  const createdBy = new Map(); // "kind:name" → first folder that creates it
  for (const folder of folders) {
    const sql = read(folder);
    if (sql === null) continue;
    for (const stmt of statements(sql)) {
      for (const rule of RULES) {
        const m = rule.re.exec(stmt);
        if (!m) continue;
        if (rule.creates) {
          const name = ident(m[rule.createsGroup ?? 1]);
          const key = `${rule.creates}:${name}`;
          if (name && !createdBy.has(key)) createdBy.set(key, folder);
        }
        break;
      }
    }
  }

  // kind → Set of names that exist at this point in the replay
  const live = { table: new Set(), index: new Set(), constraint: new Set(), type: new Set(), policy: new Set() };
  const violations = [];

  for (const folder of folders) {
    const sql = read(folder);
    if (sql === null) continue;

    for (const stmt of statements(sql)) {
      for (const rule of RULES) {
        const m = rule.re.exec(stmt);
        if (!m) continue;

        for (const req of rule.requires ?? []) {
          const name = ident(m[req.group]);
          if (!name || live[req.kind].has(name)) continue;
          violations.push({
            folder,
            kind: req.kind,
            name,
            stmt: stmt.slice(0, 110),
            createdLater: createdBy.get(`${req.kind}:${name}`) ?? null,
          });
        }

        if (rule.references) {
          const ref = rule.references.exec(stmt);
          const name = ident(ref?.[1]);
          if (name && !live.table.has(name)) {
            violations.push({
              folder,
              kind: "table",
              name,
              stmt: stmt.slice(0, 110),
              createdLater: createdBy.get(`table:${name}`) ?? null,
            });
          }
        }

        if (rule.creates) {
          const name = ident(m[rule.createsGroup ?? 1]);
          if (name) live[rule.creates].add(name);
        }
        if (rule.drops) {
          const name = ident(m[rule.dropsGroup ?? 1]);
          if (name) live[rule.drops].delete(name);
        }
        break; // first matching rule wins
      }
    }
  }

  if (violations.length > 0) {
    console.error(
      `\n✖ ${violations.length} migration-order violation${violations.length === 1 ? "" : "s"}\n`
    );
    for (const v of violations) {
      console.error(`  ${v.folder}`);
      console.error(`    references ${v.kind} "${v.name}" before it exists`);
      console.error(`    ${v.stmt}…`);
      if (v.createdLater) {
        console.error(`    → created later by ${v.createdLater} — rename this folder to sort after it`);
      } else {
        console.error(`    → nothing in prisma/migrations creates it`);
      }
      console.error("");
    }
    console.error(
      "Prisma applies migrations in FOLDER-NAME order. A migration that runs\n" +
        "before its dependencies is unreplayable: it works on a database that\n" +
        "already has the objects and fails on every fresh one.\n\n" +
        "Fix by RENAMING the folder to sort after its dependency. Do not edit\n" +
        "the SQL of an applied migration (CLAUDE.md), and remember to update\n" +
        "_prisma_migrations.migration_name on any database that already ran it.\n"
    );
    process.exit(1);
  }

  console.log(
    `✔ migration order: ${folders.length} migrations replay cleanly in folder order`
  );
}

main();
