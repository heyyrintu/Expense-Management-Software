#!/usr/bin/env node
// Competing-lockfile lint. Runs as part of `npm run lint`.
//
// ── WHAT THIS CATCHES ─────────────────────────────────────────────────────
// Two lockfiles for two package managers in one repo. The symptom is not an
// error — it is a node_modules that no single lockfile describes, because
// whichever manager ran last flattened its tree over the other's and neither
// removes the other's artefacts.
//
// This repo had exactly that: a 550-package `node_modules/.pnpm` store from
// one install sitting under a flat npm tree from another, resolving
// @aws-sdk/client-s3 to 3.1112.0 in one and 3.1113.0 in the other. Next.js
// also inspects lockfiles to decide which package manager to shell out to,
// so a stray pnpm-lock.yaml makes `next build` try to run pnpm even when npm
// installed everything.
//
// Cheap to check, and the failure it prevents is expensive to diagnose:
// "works on the machine where the tree happens to be coherent".
import { existsSync } from "node:fs";

/** Every lockfile we know how to recognise, and who owns it. */
const LOCKFILES = [
  { file: "package-lock.json", manager: "npm" },
  { file: "npm-shrinkwrap.json", manager: "npm" },
  { file: "pnpm-lock.yaml", manager: "pnpm" },
  { file: "yarn.lock", manager: "yarn" },
  { file: "bun.lockb", manager: "bun" },
];

/** Files that only make sense alongside a given manager's lockfile. */
const ORPHAN_CONFIGS = [{ file: "pnpm-workspace.yaml", manager: "pnpm" }];

const present = LOCKFILES.filter((l) => existsSync(l.file));
const managers = [...new Set(present.map((l) => l.manager))];

const problems = [];

if (managers.length > 1) {
  problems.push(
    `${present.length} lockfiles for ${managers.length} package managers:\n` +
      present.map((l) => `      ${l.file}  (${l.manager})`).join("\n") +
      `\n\n    Whichever manager runs last lays its tree over the other's, and\n` +
      `    neither cleans up after the other — so node_modules ends up matching\n` +
      `    NEITHER lockfile. Next.js also picks a package manager by sniffing\n` +
      `    these files, so a stray one changes how the build shells out.\n\n` +
      `    Keep one. If npm (the packageManager field in package.json), delete\n` +
      `    the others, then: rm -rf node_modules && npm ci && npx prisma generate`
  );
}

for (const orphan of ORPHAN_CONFIGS) {
  if (!existsSync(orphan.file)) continue;
  const ownerPresent = present.some((l) => l.manager === orphan.manager);
  if (!ownerPresent) {
    problems.push(
      `${orphan.file} is a ${orphan.manager}-only config, but there is no\n` +
        `    ${orphan.manager} lockfile. It is doing nothing except confusing\n` +
        `    tooling that sniffs for it. Delete it.`
    );
  }
}

// A declared packageManager that disagrees with the lockfile on disk is the
// same class of bug, one layer up.
if (existsSync("package.json")) {
  const { readFileSync } = await import("node:fs");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const declared = pkg.packageManager?.split("@")[0];
  if (declared && present.length > 0 && !present.some((l) => l.manager === declared)) {
    problems.push(
      `package.json declares packageManager "${pkg.packageManager}" but the only\n` +
        `    lockfile present belongs to ${present.map((l) => l.manager).join("/")}.`
    );
  }
}

if (problems.length > 0) {
  console.error(`\n✖ ${problems.length} lockfile problem${problems.length === 1 ? "" : "s"}\n`);
  for (const p of problems) console.error(`    ${p}\n`);
  process.exit(1);
}

console.log(
  `✔ lockfiles: one package manager (${managers[0] ?? "none"}), no orphaned configs`
);
