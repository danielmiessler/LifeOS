#!/usr/bin/env bun
/**
 * DeployCore — LifeOS Core deploy step (Setup step 4.5). Lays down the two
 * things the bare skill SHIPS in its install payload but no prior Setup step
 * installed: the functional skills library and the LIFEOS runtime tree
 * (Algorithm, documentation, tools, Pulse, statusline, version, user-templates).
 * Without it a fresh install has exactly one skill, no runtime, and the active
 * `@LIFEOS/DOCUMENTATION/ARCHITECTURE_SUMMARY.md` import in CLAUDE.md dangles.
 *
 * Every copy goes through InstallEngine.copyMissing — recursive, existsSync-
 * guarded, NEVER overwrites a populated target. So it is idempotent: a second
 * `--apply` copies 0. Dry-run by default (`--apply` to mutate); REFUSES the
 * author's live source tree (`--allow-dev` to override; exit 2). A required
 * payload source dir that is ABSENT is a LOUD blocker that fails the run
 * (exit 1) — never a silent ok (matches DeployComponents' failure contract).
 *
 * Targets the config-root runtime at the ALL-CAPS `<configRoot>/LIFEOS/` so it
 * matches the `@LIFEOS/...` imports in CLAUDE.md (NOT mixed-case `LifeOS`).
 *
 * Usage:
 *   bun DeployCore.ts [--config-root <dir>] [--skill-root <dir>] [--apply] [--allow-dev]
 *   (dry-run by default — reports the plan per target without writing)
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { copyMissing, detectDevTree } from "./InstallEngine";

// Runtime top-level entries this tool does NOT deploy:
//  - USER           shipped separately as a scaffold (ScaffoldUser) + symlinked (LinkUser)
//  - MEMORY         per-install state, never shipped — but scaffoldMemory() creates the
//                   empty tree at install so ISASync/hooks/memory writes have a home
//                   (this is where EmitSkill's "MEMORY scaffolded fresh at setup" becomes true)
//  - node_modules / .git  never deploy
// copyMissing's own SKIP_DIRS covers MEMORY when nested, but these
// are TOP-LEVEL entries of the runtime payload, so we filter them here explicitly.
const RUNTIME_SKIP = new Set(["USER", "MEMORY", "node_modules", ".git"]);

function arg(a: string[], flag: string): string | undefined {
  const i = a.indexOf(flag);
  return i >= 0 && a[i + 1] && !a[i + 1].startsWith("--") ? a[i + 1] : undefined;
}

interface DeployResult {
  what: "skills" | "runtime" | "memory" | "dependencies" | "nested-dependencies";
  src: string;
  dst: string;
  present: boolean;
  copied: number;
  actions: string[];
  blockers: string[];
  failures: string[];
}

/** (a) skills library: install/skills/* → configRoot/skills/ (one copyMissing). */
function deploySkills(payloadInstall: string, configRoot: string, apply: boolean): DeployResult {
  const src = join(payloadInstall, "skills");
  const dst = join(configRoot, "skills");
  const r: DeployResult = { what: "skills", src, dst, present: existsSync(src), copied: 0, actions: [], blockers: [], failures: [] };
  if (!r.present) {
    r.blockers.push(`skills payload missing: ${src} — the bare-skill payload is unpopulated (run EmitSkill, or point --skill-root at a staged release)`);
    return r;
  }
  if (!apply) {
    r.actions.push(`copyMissing ${src} → ${dst} (never overwrites existing skills)`);
    return r;
  }
  const { copied, failures } = copyMissing(src, dst);
  r.copied = copied;
  r.failures = failures;
  return r;
}

/** (b) runtime: install/LIFEOS/<entry> → configRoot/LIFEOS/<entry>, skipping RUNTIME_SKIP. */
function deployRuntime(payloadInstall: string, configRoot: string, apply: boolean): DeployResult {
  // Prefer canonical all-caps LIFEOS (matches @LIFEOS/... imports on case-sensitive FS);
  // fall back to the legacy mixed-case dir so pre-fix tarballs still install.
  const src = existsSync(join(payloadInstall, "LIFEOS")) ? join(payloadInstall, "LIFEOS") : join(payloadInstall, "LifeOS");
  const dst = join(configRoot, "LIFEOS");
  const r: DeployResult = { what: "runtime", src, dst, present: existsSync(src), copied: 0, actions: [], blockers: [], failures: [] };
  if (!r.present) {
    r.blockers.push(`runtime payload missing: ${src} — the bare-skill payload is unpopulated (run EmitSkill, or point --skill-root at a staged release)`);
    return r;
  }
  // Iterate top-level entries so USER (and the other skips) are excluded while the
  // rest of the runtime is copied via the shared, never-overwrite copyMissing.
  const entries = readdirSync(src, { withFileTypes: true })
    .filter((e) => !RUNTIME_SKIP.has(e.name))
    .map((e) => e.name)
    .sort();
  if (entries.length === 0) {
    r.blockers.push(`runtime payload at ${src} has nothing to deploy after skipping ${[...RUNTIME_SKIP].join(", ")}`);
    return r;
  }
  for (const name of entries) {
    const es = join(src, name);
    const ed = join(dst, name);
    if (!apply) {
      r.actions.push(`copyMissing ${es} → ${ed}`);
      continue;
    }
    const { copied, failures } = copyMissing(es, ed);
    r.copied += copied;
    r.failures.push(...failures);
  }
  return r;
}

// MEMORY is NOT shipped in the payload (per-install state), but the runtime writes
// to it immediately (ISASync → WORK + STATE, hooks → OBSERVABILITY, memory loop →
// KNOWLEDGE/LEARNING). Without the tree a fresh install throws on first write. This
// makes EmitSkill's "MEMORY scaffolded fresh at setup" claim actually true.
const MEMORY_SUBDIRS = ["WORK", "KNOWLEDGE", "LEARNING", "STATE", "OBSERVABILITY", "SKILLS"];

/** (c) MEMORY scaffold: create the empty per-install state dirs (never overwrites). */
function scaffoldMemory(configRoot: string, apply: boolean): DeployResult {
  const dst = join(configRoot, "LIFEOS", "MEMORY");
  const r: DeployResult = { what: "memory", src: "(scaffold — not shipped)", dst, present: true, copied: 0, actions: [], blockers: [], failures: [] };
  for (const sub of MEMORY_SUBDIRS) {
    const d = join(dst, sub);
    if (existsSync(d)) continue;
    if (!apply) { r.actions.push(`mkdir -p ${d}`); continue; }
    try {
      mkdirSync(d, { recursive: true });
      r.copied++;
    } catch (err) {
      r.failures.push(`mkdir ${d}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return r;
}

/**
 * (d) shared runtime deps: install/package.json → configRoot/package.json, then
 * `bun install` in configRoot. Several deployed hooks/TOOLS scripts (e.g.
 * hooks/lib/identity.ts, LIFEOS/TOOLS/Banner.ts) import npm packages (yaml)
 * that resolve via node_modules walked up from configRoot — without this step
 * those scripts throw "Cannot find package" on first run after a fresh install.
 */
function deployDependencies(payloadInstall: string, configRoot: string, apply: boolean): DeployResult {
  const src = join(payloadInstall, "package.json");
  const dst = join(configRoot, "package.json");
  const r: DeployResult = { what: "dependencies", src, dst, present: existsSync(src), copied: 0, actions: [], blockers: [], failures: [] };
  if (!r.present) {
    r.blockers.push(`dependency manifest missing: ${src} — point --skill-root at a staged release`);
    return r;
  }
  if (!apply) {
    r.actions.push(`copyMissing ${src} → ${dst}`, `bun install --cwd ${configRoot}`);
    return r;
  }
  const { copied, failures } = copyMissing(src, dst);
  r.copied = copied;
  r.failures = failures;
  if (failures.length === 0) {
    const proc = Bun.spawnSync(["bun", "install"], { cwd: configRoot, stdout: "pipe", stderr: "pipe" });
    if (proc.exitCode !== 0) {
      r.failures.push(`bun install --cwd ${configRoot} exited ${proc.exitCode}: ${proc.stderr.toString().trim()}`);
    } else {
      r.actions.push(`bun install --cwd ${configRoot}`);
    }
  }
  return r;
}

/**
 * (e) nested runtime deps: several directories INSIDE the deployed runtime tree
 * ship their OWN package.json (LIFEOS/PULSE, LIFEOS/PULSE/Observability,
 * LIFEOS/TOOLS, ...) — declaring a dependency there does not make bun/node
 * resolve it. Module resolution stops walking up at the first ancestor
 * directory that owns a package.json, so the shared configRoot/node_modules
 * deployDependencies() just installed never satisfies these. This is exactly
 * why a fresh install dies with `Cannot find package 'smol-toml'` on `bun run
 * pulse.ts`: LIFEOS/PULSE/package.json lists smol-toml correctly, but nothing
 * ever ran `bun install` inside LIFEOS/PULSE/. Walk the deployed runtime tree
 * for every package.json (skipping node_modules/.git) and `bun install --cwd`
 * each one it finds. The Observability dashboard additionally needs a build —
 * it ships as a Next.js static export (Observability/out/index.html) that
 * pulse.ts itself already detects as missing and reports as a copy-paste fix
 * command; building it here just does that automatically instead of leaving
 * every fresh Pulse install to 503 until the human runs it by hand.
 */
function findNestedDependencyDirs(runtimeDst: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.isFile() && entry.name === "package.json") {
        found.push(dir);
      }
    }
  };
  walk(runtimeDst);
  return found.sort();
}

function deployNestedDependencies(configRoot: string, apply: boolean): DeployResult {
  const runtimeDst = join(configRoot, "LIFEOS");
  const r: DeployResult = {
    what: "nested-dependencies", src: runtimeDst, dst: runtimeDst,
    present: existsSync(runtimeDst), copied: 0, actions: [], blockers: [], failures: [],
  };
  if (!r.present) return r; // runtime not deployed yet — deployRuntime() already reports that blocker

  const dirs = findNestedDependencyDirs(runtimeDst);
  for (const dir of dirs) {
    const isObservability = dir === join(runtimeDst, "PULSE", "Observability");
    const needsBuild = isObservability && !existsSync(join(dir, "out", "index.html"));

    if (!apply) {
      r.actions.push(`bun install --cwd ${dir}`);
      if (needsBuild) r.actions.push(`bun run build --cwd ${dir}`);
      continue;
    }

    const proc = Bun.spawnSync(["bun", "install"], { cwd: dir, stdout: "pipe", stderr: "pipe" });
    if (proc.exitCode !== 0) {
      r.failures.push(`bun install --cwd ${dir} exited ${proc.exitCode}: ${proc.stderr.toString().trim()}`);
      continue;
    }
    r.copied++;
    r.actions.push(`bun install --cwd ${dir}`);

    // Build the Observability dashboard once its deps resolve — see comment above.
    if (needsBuild) {
      const build = Bun.spawnSync(["bun", "run", "build"], { cwd: dir, stdout: "pipe", stderr: "pipe" });
      if (build.exitCode !== 0) {
        r.failures.push(`bun run build --cwd ${dir} exited ${build.exitCode}: ${build.stderr.toString().trim()}`);
      } else {
        r.actions.push(`bun run build --cwd ${dir}`);
      }
    }
  }
  return r;
}

function main(): void {
  const a = process.argv.slice(2);
  const home = process.env.HOME || homedir();
  const configRoot = arg(a, "--config-root") || process.env.CLAUDE_CONFIG_DIR || join(home, ".claude");
  const skillRoot = arg(a, "--skill-root") || join(import.meta.dir, "..");
  const payloadInstall = join(skillRoot, "install");
  const apply = a.includes("--apply");
  const allowDev = a.includes("--allow-dev");

  if (detectDevTree(configRoot) && !allowDev) {
    console.log(JSON.stringify({
      ok: false,
      refused: "dev-tree",
      detail: `${configRoot} is a LifeOS source tree (skills/_LIFEOS present) — refusing to deploy core. Use --allow-dev only in a sandbox.`,
    }, null, 2));
    process.exit(2);
  }

  const results = [
    deploySkills(payloadInstall, configRoot, apply),
    deployRuntime(payloadInstall, configRoot, apply),
    scaffoldMemory(configRoot, apply),
    deployDependencies(payloadInstall, configRoot, apply),
    deployNestedDependencies(configRoot, apply),
  ];

  // A missing required payload source (blocker) or a copy failure is a hard
  // failure, not a silent success — `ok` requires both lists empty.
  const blockers = results.flatMap((r) => r.blockers);
  const failures = results.flatMap((r) => r.failures);
  const ok = blockers.length === 0 && failures.length === 0;
  const skillsCopied = results.find((r) => r.what === "skills")?.copied ?? 0;
  const runtimeCopied = results.find((r) => r.what === "runtime")?.copied ?? 0;

  console.log(JSON.stringify({
    ok,
    dryRun: !apply,
    configRoot,
    payloadInstall,
    skillsDst: join(configRoot, "skills"),
    runtimeDst: join(configRoot, "LIFEOS"),
    skillsCopied,
    runtimeCopied,
    blockers,
    failures,
    results,
    note: apply ? undefined : "dry-run — re-run with --apply to deploy (a blocked source fails the run in both modes)",
  }, null, 2));
  process.exit(ok ? 0 : 1);
}

main();
