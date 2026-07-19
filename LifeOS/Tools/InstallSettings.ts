#!/usr/bin/env bun
/**
 * InstallSettings — Setup step 4's settings placement, as a deterministic tool.
 * Places the payload's `install/settings.system.json` into the harness
 * `settings.json` with the one transform the copy-by-hand step kept getting
 * wrong: **`env` values are expanded at write time** (`$HOME`/`${HOME}`/`~` →
 * the real home). The harness injects env values verbatim with NO shell
 * expansion (LifeOS#1404/#1451) — a literal `"$HOME/..."` value creates a real
 * `$HOME/` directory on disk that silently captures runtime state. Command
 * strings (hooks, statusLine) are shell-evaluated and ship untouched.
 *
 * Custom LifeOS home (LIFEOS_HOME / --config-root ≠ ~/.claude): the template
 * hardcodes `~/.claude` in env values, permission globs, and permission-guidance
 * prose. Permission globs expand NO variables, so every one of those strings is
 * retargeted to the real config root at write time. A default install is
 * byte-identical to before. `env.LIFEOS_CONFIG_DIR` is pointed at the private
 * user-data home (configDir) so the installers and the runtime agree on it.
 *
 * Semantics match the sibling installers (DeployCore/InstallHooks):
 *   - settings.json absent → write the expanded template whole.
 *   - settings.json present → additive merge: only ABSENT top-level keys and
 *     ABSENT env keys are added (expanded); existing values are never touched
 *     except the one known legacy LIFEOS_CONFIG_DIR self-link value, which is
 *     repaired to the resolved private data home.
 *   - Dry-run by default; `--apply` mutates; backup before every write.
 *   - REFUSES the author's live source tree (`--allow-dev` to override).
 *
 * Usage:
 *   bun InstallSettings.ts [--config-root <dir>] [--config-dir <dir>] [--skill-root <dir>] [--apply] [--allow-dev]
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { detectDevTree, resolveConfigDir, resolveConfigRoot } from "./InstallEngine";

interface Args { configRoot: string; configDir: string; skillRoot: string; apply: boolean; allowDev: boolean; }

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = a.indexOf(flag);
    return i >= 0 && a[i + 1] && !a[i + 1].startsWith("--") ? a[i + 1] : undefined;
  };
  const configRoot = resolveConfigRoot(get("--config-root"));
  return {
    configRoot,
    configDir: resolveConfigDir(configRoot, get("--config-dir")),
    skillRoot: get("--skill-root") || join(import.meta.dir, ".."),
    apply: a.includes("--apply"),
    allowDev: a.includes("--allow-dev"),
  };
}

/** Expand a LEADING $HOME / ${HOME} / ~ path segment. Mid-string refs are left alone. */
export function expandLeadingHome(value: string, home: string): string {
  if (!home) return value;
  if (value === "$HOME" || value === "${HOME}" || value === "~") return home;
  if (value.startsWith("$HOME/")) return home + value.slice("$HOME".length);
  if (value.startsWith("${HOME}/")) return home + value.slice("${HOME}".length);
  if (value.startsWith("~/")) return home + value.slice(1);
  return value;
}

function expandEnvBlock(settings: Record<string, unknown>, home: string): number {
  const env = settings.env;
  if (!env || typeof env !== "object") return 0;
  let n = 0;
  for (const [k, v] of Object.entries(env as Record<string, unknown>)) {
    if (typeof v === "string") {
      const expanded = expandLeadingHome(v, home);
      if (expanded !== v) { (env as Record<string, unknown>)[k] = expanded; n++; }
    }
  }
  return n;
}

// Every spelling of the default root that appears in the shipped template. The
// longest-prefix forms sort first so `${HOME}/.claude` never half-matches.
const DEFAULT_ROOT_FORMS = ["${HOME}/.claude", "$HOME/.claude", "~/.claude"];

/**
 * Deep-walk every STRING value in the template and retarget the default-root
 * spellings to the real config root. Covers env values, permission globs
 * (`Write(~/.claude/**)` — globs expand no variables, so they must carry the
 * absolute custom path), and permission-guidance prose. Returns replacements.
 */
function retargetStrings(node: unknown, configRoot: string): { node: unknown; replaced: number } {
  let replaced = 0;
  const rewrite = (s: string): string => {
    let out = s;
    for (const form of DEFAULT_ROOT_FORMS) {
      const parts = out.split(form);
      replaced += parts.length - 1;
      out = parts.join(configRoot);
    }
    return out;
  };
  const walk = (n: unknown): unknown => {
    if (typeof n === "string") return rewrite(n);
    if (Array.isArray(n)) return n.map(walk);
    if (n && typeof n === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(n as Record<string, unknown>)) o[k] = walk(v);
      return o;
    }
    return n;
  };
  return { node: walk(node), replaced };
}

const args = parseArgs();
const home = process.env.HOME || homedir();
const templatePath = join(args.skillRoot, "install", "settings.system.json");
const targetPath = join(args.configRoot, "settings.json");
const isCustomRoot = home !== "" && resolve(args.configRoot) !== resolve(join(home, ".claude"));

if (detectDevTree(args.configRoot) && !args.allowDev) {
  console.log(JSON.stringify({ ok: false, error: "dev tree detected — refusing to touch the author's live settings (--allow-dev to override)" }, null, 2));
  process.exit(2);
}
if (!existsSync(templatePath)) {
  console.log(JSON.stringify({ ok: false, error: `payload settings.system.json not found at ${templatePath}` }, null, 2));
  process.exit(1);
}
// A custom home (and ~/.claude on a clean machine) may not exist yet — writes
// below assume the config root is a directory.
if (args.apply) mkdirSync(args.configRoot, { recursive: true });

let template = JSON.parse(readFileSync(templatePath, "utf8")) as Record<string, unknown>;
let retargetedCount = 0;
if (isCustomRoot) {
  const retargeted = retargetStrings(template, args.configRoot);
  template = retargeted.node as Record<string, unknown>;
  retargetedCount = retargeted.replaced;
}
// LIFEOS_CONFIG_DIR is the private user-data home, NOT <configRoot>/LIFEOS.
// Pin it on every install so a later setup/update session cannot reinterpret
// the old runtime-system value and collapse the USER symlink onto itself.
if (template.env && typeof template.env === "object") {
  const templateEnv = template.env as Record<string, unknown>;
  templateEnv.LIFEOS_CONFIG_DIR = args.configDir;
  // Persist the dedicated root into future project-scoped sessions too. Runtime
  // consumers still use LIFEOS_DIR; this value is for installer/update tools.
  if (isCustomRoot) templateEnv.LIFEOS_HOME = args.configRoot;
}
const expandedCount = expandEnvBlock(template, home);

const report: Record<string, unknown> = { ok: true, apply: args.apply, target: targetPath, envValuesExpanded: expandedCount, customRoot: isCustomRoot ? args.configRoot : undefined, retargetedStrings: isCustomRoot ? retargetedCount : undefined };

if (!existsSync(targetPath)) {
  report.mode = "create";
  report.topLevelKeys = Object.keys(template).length;
  if (args.apply) writeFileSync(targetPath, JSON.stringify(template, null, 2) + "\n");
} else {
  const current = JSON.parse(readFileSync(targetPath, "utf8")) as Record<string, unknown>;
  const addedKeys: string[] = [];
  for (const [k, v] of Object.entries(template)) {
    if (k === "env") continue;               // handled per-key below
    if (!(k in current)) { current[k] = v; addedKeys.push(k); }
  }
  const curEnv = (current.env && typeof current.env === "object" ? current.env : (current.env = {})) as Record<string, unknown>;
  const tplEnv = (template.env || {}) as Record<string, unknown>;
  const addedEnv: string[] = [];
  const updatedEnv: string[] = [];
  for (const [k, v] of Object.entries(tplEnv)) {
    if (!(k in curEnv)) {
      curEnv[k] = v;
      addedEnv.push(k);
      continue;
    }
    // Narrow migration for the shipped legacy collision only; arbitrary user
    // overrides remain untouched.
    if (
      k === "LIFEOS_CONFIG_DIR" &&
      typeof curEnv[k] === "string" &&
      resolve(expandLeadingHome(curEnv[k] as string, home)) === resolve(join(args.configRoot, "LIFEOS")) &&
      curEnv[k] !== v
    ) {
      curEnv[k] = v;
      updatedEnv.push(k);
    }
  }
  report.mode = "merge";
  report.addedKeys = addedKeys;
  report.addedEnv = addedEnv;
  report.updatedEnv = updatedEnv;
  if (args.apply && (addedKeys.length || addedEnv.length || updatedEnv.length)) {
    copyFileSync(targetPath, targetPath + ".backup-" + new Date().toISOString().replace(/[:.]/g, "-"));
    writeFileSync(targetPath, JSON.stringify(current, null, 2) + "\n");
  } else if (args.apply) {
    report.note = "nothing to add — no write, no backup";
  }
}

console.log(JSON.stringify(report, null, 2));
process.exit(0);
