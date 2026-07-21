#!/usr/bin/env node
/**
 * jeeva doctor — run before dev/build.
 *
 * TWO JOBS.
 *
 * 1. SLUG COLLISIONS. Next.js allows exactly ONE dynamic slug name per path
 *    position. Two names for the same position ("[patientId]" and "[displayId]"
 *    both under /patients) kills the route manifest, and the dev server dies with
 *    a message that doesn't name the offending folder. This finds it and names it.
 *
 * 2. FILES STRANDED BY A ZIP DROP. This project is delivered as zips. Extracting a
 *    zip only ever ADDS and OVERWRITES — it can never DELETE. So every time a file
 *    is moved or removed upstream, the old copy stays on disk forever, quietly,
 *    until it breaks something. That's exactly how the slug collision above
 *    happened: a route was moved, and both copies then existed locally.
 *
 *    STALE below is the list of paths that upstream has deleted. They're removed
 *    on sight. Nothing outside that list is ever touched.
 */
import { existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, relative } from "node:path";

const APP = "src/app";

/** Paths upstream has deleted. A zip can't remove them, so we do. */
const STALE = [
  // moved to patients/[displayId]/admission — Next allows one slug per position
  "src/app/api/v1/reception/patients/[patientId]",
];

let problems = 0;

// ── 1. remove anything upstream deleted ──────────────────────────────────────
for (const p of STALE) {
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log(`  🧹 removed stale path (a zip can't delete): ${p}`);
  }
}

// ── 2. one slug name per path position ───────────────────────────────────────
/** parent dir -> the slug names found directly inside it */
const slugs = new Map();

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name === "node_modules" || name.startsWith(".")) continue;

    if (name.startsWith("[") && name.endsWith("]")) {
      if (!slugs.has(dir)) slugs.set(dir, new Set());
      slugs.get(dir).add(name);
    }
    walk(full);
  }
}
if (existsSync(APP)) walk(APP);

for (const [parent, names] of slugs) {
  if (names.size > 1) {
    problems++;
    console.error(`\n  ❌ SLUG COLLISION in ${relative(process.cwd(), parent)}`);
    console.error(`     Next.js allows ONE dynamic slug name per path position.`);
    console.error(`     Found: ${[...names].join("  and  ")}`);
    console.error(`     Keep whichever the rest of the app already uses, delete the other:`);
    for (const n of names) {
      console.error(`       rm -rf "${join(relative(process.cwd(), parent), n)}"`);
    }
  }
}

if (problems > 0) {
  console.error(`\n  The dev server will NOT start until this is fixed.\n`);
  process.exit(1);
}
