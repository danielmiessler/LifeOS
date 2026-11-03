#!/usr/bin/env bun
/**
 * OverlaySystem.ts — the update-path counterpart to DeployCore: refresh SYSTEM-OWNED files
 * that already exist, which copyMissing by contract cannot do.
 *
 * Ported from public PR #1771, @bnkath2o (posted by "Abe" on Ben's behalf). Fixes #1770.
 * Adaptation on the way in: an operator's CLAUDE.md and system prompt are BACKED UP to a
 * timestamped file before they are overlaid, so hand-edits to the constitution are
 * recoverable rather than silently lost. See overlayFile()'s backupFirst path.
 *
 * DeployCore is additive: `copyMissing` writes only when the destination is absent, so a
 * populated install can receive NEW files but never an UPDATED one. That is the right
 * contract for a fresh install and the wrong one for an update — `Intents/Update.md`
 * step 3 ("Re-overlay system") describes this tool, which did not previously exist.
 *
 * Scope is deliberately narrow. Only paths LifeOS owns are overwritten:
 *
 *   hooks/ · skills/ · agents/ · commands/ ·
 *   LIFEOS/{TOOLS,DOCUMENTATION,ALGORITHM,RULES,PULSE,ATLAS,HERMES}/
 *   plus CLAUDE.md, LIFEOS/LIFEOS_SYSTEM_PROMPT.md and settings.system.json
 *
 * Never touched: USER/ (the principal's tree), LIFEOS/MEMORY/ (per-install state),
 * settings.json (hook registrations — InstallHooks owns that merge), node_modules, .git.
 *
 * Nothing is ever DELETED. A file is written only where the payload ships one at the same
 * relative path, so operator-authored hooks, skills and tools survive untouched. The one
 * removal path is the payload's own RETIREMENTS.json, and it MOVES paths aside into
 * `.retired-<ts>/` rather than deleting them.
 *
 * After the copies, the overlay finishes the job an update actually needs:
 *   1. retirements   — move payload-retired paths aside
 *   2. substitution  — re-render identity placeholders in the files IT wrote
 *   3. nested deps   — `bun install` the nested package.json manifests (DeployCore)
 *   4. completeness  — every payload file has a counterpart on disk
 *
 * VERSION is written LAST and only on a fully successful, COMPLETE --apply, so a partial
 * update can never present as complete (the failure mode where the marker says the new
 * version while the machinery is still the old one — and where the release check then
 * reports "already current" forever).
 *
 * Dry-run by default (`--apply` to mutate); REFUSES the author's live source tree
 * (`--allow-dev` to override; exit 2), matching DeployCore's failure contract.
 *
 * Usage:
 *   bun OverlaySystem.ts [--config-root <dir>] [--skill-root <dir>] [--apply] [--allow-dev]
 */

import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, writeFileSync, cpSync, type Stats } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { refuseDevInstallWrites, substituteTree, type TemplateVars } from "./InstallEngine";
import { deployNestedDependencies } from "./DeployCore";
import { RETIRED_SYSTEM_TREES, SYSTEM_TREE_MAPPINGS } from "./SystemTrees";

/** Directories inside a system tree that are never overlaid, at any depth. */
export const SKIP_DIRS = new Set(["node_modules", ".git", "MEMORY", "USER", ".next"]);

/**
 * System-owned trees: [payload-relative, configRoot-relative].
 * Anything not listed here is left alone — absence from this list is the safety property.
 */
export const SYSTEM_TREES = SYSTEM_TREE_MAPPINGS;

/**
 * Opt-in trees: agents and commands are DeployComponents extras a user may have declined
 * (NON_LAUNCHD_COMPONENTS). The overlay refreshes them only where they are already installed;
 * creating them would install an enhancement the user never chose (public issue #2258, @coygeek).
 * hooks/ stays out of this set: it is core, and a missing one is a real gap.
 */
export const OPT_IN_TREES: ReadonlySet<string> = new Set(["agents", "commands"]);

/** True when `payloadRel` is an opt-in tree whose destination directory does not exist. */
export function optInNotInstalled(payloadRel: string, dst: string): boolean {
  return OPT_IN_TREES.has(payloadRel) && !existsSync(dst);
}

/** Only descendants of directories owned by the overlay may be retired. */
export function isRetirablePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").some(part => !part || part === "." || part === "..")) return false;
  if (/(?:^|\/)(?:CLAUDE\.md|LIFEOS_SYSTEM_PROMPT\.md|settings[^/]*\.json|\.env[^/]*)$/.test(path)) return false;
  return SYSTEM_TREES.some(([, destination]) => path.startsWith(`${destination}/`)) || RETIRED_SYSTEM_TREES.some((tree) => path.startsWith(`${tree}/`));
}

/**
 * System-owned single files: [payload-relative, configRoot-relative, backupFirst].
 * backupFirst files are ones an operator is likely to have hand-edited (the constitution
 * and the system prompt), so we snapshot the existing copy before overwriting it.
 */
const SYSTEM_FILES: Array<[string, string, boolean]> = [
  ["LIFEOS/LIFEOS_SYSTEM_PROMPT.md", "LIFEOS/LIFEOS_SYSTEM_PROMPT.md", true],
  ["skills/LifeOS/install/CLAUDE.template.md", "CLAUDE.md", true],
  // The system half of the settings layer. SessionStart regenerates settings.json
  // by merging settings.system.json + USER/CONFIG/settings.user.json, so leaving
  // the system layer stale meant an update shipped new hooks and defaults that the
  // very next merge overwrote with the old ones (public issue #1851, @DRAZY;
  // #1860, @hjbrandt). Backed up first — an operator may have hand-edited it.
  ["settings.system.json", "settings.system.json", true],
  // Two more system files an update left stale: the Cortex index policy (a
  // runtime writer may have touched it — backed up) and the statusline script,
  // which DeployComponents only places when absent (public issue #1950, @mj-deving).
  ["LIFEOS/CORTEX_INDEX_POLICY.json", "LIFEOS/CORTEX_INDEX_POLICY.json", true],
  ["LIFEOS/LIFEOS_StatusLine.sh", "LIFEOS/LIFEOS_StatusLine.sh", true],
];

function arg(a: string[], flag: string): string | undefined {
  const i = a.indexOf(flag);
  return i >= 0 && a[i + 1] && !a[i + 1].startsWith("--") ? a[i + 1] : undefined;
}

function sameBytes(a: string, b: string): boolean {
  try {
    const x = readFileSync(a);
    const y = readFileSync(b);
    return x.length === y.length && x.equals(y);
  } catch {
    return false;
  }
}

/** Timestamp safe for a filename: 2026-08-06T05-59-00-000Z. */
function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

const BACKUP_DIR = ".lifeos-overlay-backups";
/** Backups live beside served system trees, never inside a destination such as PULSE/Observability/out. */
export function overlayBackupPath(configRoot: string, destination: string, backupStamp = stamp()): string {
  const rel = relative(resolve(configRoot), resolve(destination));
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`)) throw new Error(`backup destination escapes config root: ${destination}`);
  return join(configRoot, BACKUP_DIR, backupStamp, rel + ".bak");
}

interface OverlayResult {
  what: string;
  src: string;
  dst: string;
  present: boolean;
  /** existed and differed → rewritten */
  updated: number;
  /** already byte-identical → untouched */
  current: number;
  /** absent → created */
  created: number;
  /** path of the backup written before an operator-owned file was overlaid, if any */
  backupPath?: string;
  /**
   * Backups written before overwriting differing files in a TREE overlay. Only
   * three named single files ever got backupPath; every file under hooks/,
   * skills/, agents/, commands/ and the LIFEOS/* trees was clobbered outright,
   * which cost a reporter an Observability fallback and a hand-merged
   * integration, twice (public issue #1891, @waveman2020-sudo).
   */
  backups: string[];
  /** absolute destination paths this overlay wrote (or, in dry-run, would write) */
  written: string[];
  failures: string[];
}

/**
 * True when target, symlinks dereferenced, stays inside root. resolve() is lexical, so a symlinked
 * component can point a write outside the tree: realpath the nearest EXISTING ancestor of target
 * (target itself when present) and require it inside realpath(root).
 */
export function insideRealRoot(target: string, root: string): boolean {
  let probe = target;
  while (lstatSync(probe, { throwIfNoEntry: false }) === undefined) {
    const parent = dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const probeReal = realpathSync(probe);
  const rootReal = realpathSync(root);
  return probeReal === rootReal || probeReal.startsWith(rootReal + sep);
}

/**
 * Walk the payload tree and write each file to the matching relative path under dst.
 * Updates and creations are both performed; deletions never are. A destination whose
 * real path leaves configRoot (a symlinked directory or file pointing elsewhere) is
 * refused, never written through.
 */
export function overlayTree(src: string, dst: string, what: string, apply: boolean, configRoot: string, backupStamp = stamp()): OverlayResult {
  const r: OverlayResult = { what, src, dst, present: existsSync(src), updated: 0, current: 0, created: 0, written: [], failures: [], backups: [] };
  if (!r.present) return r;

  const walk = (s: string, d: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(s);
    } catch (err) {
      r.failures.push(`readdir ${s}: ${String(err)}`);
      return;
    }
    for (const name of entries) {
      const sp = join(s, name);
      const dp = join(d, name);
      let st: Stats;
      try {
        st = lstatSync(sp);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) continue; // never follow or replace symlinks (USER is one)
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        walk(sp, dp);
        continue;
      }
      if (!st.isFile()) continue;
      try {
        if (!insideRealRoot(dp, configRoot)) {
          r.failures.push(`refused ${dp}: a symlinked component leaves ${configRoot}`);
          continue;
        }
      } catch (err) {
        r.failures.push(`refused ${dp}: boundary realpath failed: ${String(err)}`);
        continue;
      }
      if (existsSync(dp)) {
        if (sameBytes(sp, dp)) {
          r.current++;
          continue;
        }
        if (apply) {
          // Same guarantee overlayFile already gave its three named files: a
          // file that EXISTS and DIFFERS may be carrying local edits, and the
          // overlay cannot tell an upstream change from someone's patch. Snapshot
          // before overwriting. A failed backup ABORTS this file's overwrite —
          // losing the edit is the harm we are preventing, so refusing to
          // proceed is the safe direction (public issue #1891, @waveman2020-sudo).
          const bak = overlayBackupPath(configRoot, dp, backupStamp);
          try {
            mkdirSync(dirname(bak), { recursive: true });
            cpSync(dp, bak);
            r.backups.push(bak);
          } catch (err) {
            r.failures.push(`backup ${dp}: ${String(err)}`);
            continue;
          }
          try {
            cpSync(sp, dp);
          } catch (err) {
            r.failures.push(`copy ${sp}: ${String(err)}`);
            continue;
          }
        }
        r.updated++;
        r.written.push(dp);
      } else {
        if (apply) {
          try {
            mkdirSync(dirname(dp), { recursive: true });
            cpSync(sp, dp);
          } catch (err) {
            r.failures.push(`copy ${sp}: ${String(err)}`);
            continue;
          }
        }
        r.created++;
        r.written.push(dp);
      }
    }
  };

  walk(src, dst);
  return r;
}

/** One system file to its configRoot path, under the same boundary rule as overlayTree: a symlinked dst that leaves configRoot is refused. */
export function overlayFile(src: string, dst: string, what: string, apply: boolean, backupFirst: boolean, configRoot: string, backupStamp: string): OverlayResult {
  const r: OverlayResult = { what, src, dst, present: existsSync(src), updated: 0, current: 0, created: 0, written: [], failures: [], backups: [] };
  if (!r.present) return r;
  try {
    if (!insideRealRoot(dst, configRoot)) {
      r.failures.push(`refused ${dst}: a symlinked component leaves ${configRoot}`);
      return r;
    }
  } catch (err) {
    r.failures.push(`refused ${dst}: boundary realpath failed: ${String(err)}`);
    return r;
  }
  const exists = existsSync(dst);
  if (exists && sameBytes(src, dst)) {
    r.current = 1;
    return r;
  }
  if (apply) {
    // Preserve an operator's hand-edited file before overwriting it (adaptation from the
    // ported PR): CLAUDE.md especially is expected to carry local edits, and the overlay
    // restores it from the template. A recoverable snapshot beats a silent clobber.
    if (exists && backupFirst) {
      const bak = overlayBackupPath(configRoot, dst, backupStamp);
      try {
        mkdirSync(dirname(bak), { recursive: true });
        cpSync(dst, bak);
        r.backupPath = bak;
        r.backups.push(bak); // uniform with overlayTree so one report field lists every snapshot
      } catch (err) {
        r.failures.push(`backup ${dst}: ${String(err)}`);
        return r;
      }
    }
    try {
      mkdirSync(dirname(dst), { recursive: true });
      cpSync(src, dst);
    } catch (err) {
      r.failures.push(`copy ${src}: ${String(err)}`);
      return r;
    }
  }
  if (exists) r.updated = 1;
  else r.created = 1;
  r.written.push(dst);
  return r;
}

// ── identity substitution over the overlaid files (public issue #1851, @DRAZY) ──

/**
 * Minimal section-aware TOML reader: "section.key" → string value. The install
 * skill ships without dependencies, so it cannot import the runtime's
 * LifeosConfig.ts (which lives in the tree being overlaid and may itself be
 * mid-update). Only quoted scalars are read, which is all the identity keys are.
 */
function tomlStrings(src: string): Map<string, string> {
  const out = new Map<string, string>();
  let section = "";
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const sec = line.match(/^\[([^\]]+)\]$/);
    if (sec) { section = sec[1].trim(); continue; }
    // Quoted strings, plus bare booleans (read as "true"/"false") for flags such as `[da] confirmed = true`.
    const kv = line.match(/^([A-Za-z0-9_]+)\s*=\s*(?:"([^"]*)"|(true|false)\b)/);
    if (kv) out.set(section ? `${section}.${kv[1]}` : kv[1], kv[2] ?? kv[3]);
  }
  return out;
}

export interface IdentityVars {
  vars: TemplateVars;
  configPath: string;
  /** Required tokens with no value at all (config absent, or the key absent or empty). */
  missing: string[];
  /** Required tokens whose value is still the shipped scaffold name: the Interview has not run yet. */
  pending: string[];
}

/**
 * The tokens every install must render before it is identity-correct. Each one has a
 * value the Interview always captures (or the payload always ships). The voice ids are
 * deliberately NOT here: a Fish voice, a no-key install or a declined voice leaves them
 * unset, and a required-but-optional token used to block the whole substitution pass.
 */
export const REQUIRED_IDENTITY_TOKENS: readonly string[] = [
  "LIFEOS_VERSION", "PRINCIPAL_NAME", "PRINCIPAL_FULL_NAME", "DA_NAME", "DA_FULL_NAME",
].map((n) => "{{" + n + "}}");

/**
 * The names the shipped LIFEOS_CONFIG.toml scaffold carries before the Interview runs.
 * Mirrors the name entries of `SCAFFOLD_SENTINELS` in hooks/lib/identity.ts (this skill
 * runs before hooks/ exists, so it cannot import it; a test holds the two in step).
 * A sentinel is never rendered into the tree: once baked, the token is gone and the
 * Interview's real answer has nothing left to fill (upgrade record 20261014-162518).
 */
export const SCAFFOLD_NAMES: ReadonlySet<string> = new Set(["Your Name", "Aria"]);

/**
 * Resolve the identity placeholders from this install's own config — the same
 * source the Interview writes and Setup step 9(d) substitutes from. Returns the
 * unresolved REQUIRED keys in `missing` so the caller can refuse to substitute
 * (and say so loudly) rather than baking an empty string into the tree.
 * An empty `full_name = ""` (the shipped template default since 7.x) falls back to the name: `||`, never `??`,
 * or every upgrading install with the default left in place refuses to substitute (found by the upgrade boot, 2026-10-12).
 */
export function resolveIdentityVars(configRoot: string, payloadInstall: string, explicitConfigPath?: string): IdentityVars {
  const configPath = explicitConfigPath
    || process.env.LIFEOS_CONFIG_PATH
    || join(configRoot, "LIFEOS", "USER", "CONFIG", "LIFEOS_CONFIG.toml");
  const vars: TemplateVars = {};
  const missing: string[] = [];
  const pending: string[] = [];

  const versionSrc = join(payloadInstall, "LIFEOS", "VERSION");
  if (existsSync(versionSrc)) {
    try { vars["{{LIFEOS_VERSION}}"] = readFileSync(versionSrc, "utf8").trim(); } catch { /* reported via missing below */ }
  }
  if (!vars["{{LIFEOS_VERSION}}"]) missing.push("{{LIFEOS_VERSION}}");

  let toml: Map<string, string>;
  try {
    toml = tomlStrings(readFileSync(configPath, "utf8"));
  } catch {
    return { vars, configPath, missing: [...missing, "{{PRINCIPAL_NAME}}", "{{PRINCIPAL_FULL_NAME}}", "{{DA_NAME}}", "{{DA_FULL_NAME}}"], pending };
  }

  // `confirmed = true` in [principal] / [da] marks a name the Interview captured that happens to equal a
  // scaffold default (a DA really named "Aria"); without it that name would stay pending forever.
  const set = (token: string, value: string | undefined, confirmed = false): void => {
    const required = REQUIRED_IDENTITY_TOKENS.includes(token);
    if (value && SCAFFOLD_NAMES.has(value.trim()) && !confirmed) { if (required) pending.push(token); }
    else if (value) vars[token] = value;
    else if (required) missing.push(token);
  };
  const principal = toml.get("principal.name");
  const da = toml.get("da.name");
  const principalConfirmed = toml.get("principal.confirmed") === "true";
  const daConfirmed = toml.get("da.confirmed") === "true";
  set("{{PRINCIPAL_NAME}}", principal, principalConfirmed);
  set("{{PRINCIPAL_FULL_NAME}}", toml.get("principal.full_name") || principal, principalConfirmed);
  set("{{DA_NAME}}", da, daConfirmed);
  set("{{DA_FULL_NAME}}", toml.get("da.full_name") || da, daConfirmed);
  set("{{PRIMARY_VOICE_ID}}", toml.get("da.voices.main.voice_id") || toml.get("da.voices.main.fish_reference_id"));
  set("{{SECONDARY_VOICE_ID}}", toml.get("da.voices.secondary.voice_id") || toml.get("da.voices.secondary.fish_reference_id"));
  // The principal's own zone when the config names a real one; an unrendered token is
  // left to substituteTree, which fills it from the machine.
  const tz = toml.get("principal.timezone");
  if (tz && !tz.includes("{")) vars["{{TIMEZONE}}"] = tz;
  return { vars, configPath, missing, pending };
}

/**
 * Re-render identity placeholders in the files THIS overlay just wrote.
 *
 * The payload ships generic — every file carrying an identity token arrives
 * un-rendered, so an update quietly un-personalized whatever it refreshed and
 * the install started addressing its owner by a raw token again. Scoped to the
 * overlay's own write list: nothing else on disk is touched, and the payload
 * copy under skills/LifeOS/install/ stays generic for the next install.
 */
function substituteWritten(written: string[], ident: IdentityVars, apply: boolean): {
  files: number; excluded: number; applied: number; modified: number; skipped: boolean; instruction?: string;
} {
  // substituteTree()'s directory skips do NOT apply when it is handed a single
  // FILE path, and the overlay legitimately writes into the nested redistribution
  // payload (skills/LifeOS/install/) — so rendering the write list wholesale would
  // bake THIS user's identity into the copy the NEXT install ships from, which is
  // the exact regression #1828 fixed. Excluded here instead.
  const generic = (p: string): boolean =>
    p.includes(`${sep}skills${sep}LifeOS${sep}install${sep}`)
    || p.includes(`${sep}skills${sep}LifeOS${sep}Tools${sep}`)
    || p.includes(`${sep}skills${sep}LifeOS${sep}Intents${sep}`);
  const targets = written.filter((p) => !generic(p));
  const excluded = written.length - targets.length;
  written = targets;

  if (ident.missing.length > 0) {
    return {
      files: written.length, excluded, applied: 0, modified: 0, skipped: true,
      instruction:
        `IDENTITY SUBSTITUTION SKIPPED — could not resolve ${ident.missing.join(", ")} from ${ident.configPath}. `
        + `The ${written.length} overlaid file(s) still carry raw identity placeholders. `
        + `Fix the config, then re-run this overlay or the Setup.md step 9(d) substitution pass over the config root, before using this install.`,
    };
  }
  // Scaffold names are not rendered (a baked sentinel leaves the Interview nothing to fill);
  // everything else is, and the note says the names wait for the Interview's RenderIdentity run.
  const instruction = ident.pending.length
    ? `IDENTITY PENDING — ${ident.pending.join(", ")} still carry the shipped scaffold names in ${ident.configPath}; `
      + `they stay as tokens until the Interview captures real names and runs Tools/RenderIdentity.ts --apply --strict.`
    : undefined;
  if (!apply) return { files: written.length, excluded, applied: 0, modified: 0, skipped: false, ...(instruction ? { instruction } : {}) };
  let applied = 0;
  let modified = 0;
  for (const f of written) {
    const r = substituteTree(f, ident.vars);
    applied += r.applied;
    modified += r.modified;
  }
  return { files: written.length, excluded, applied, modified, skipped: false, ...(instruction ? { instruction } : {}) };
}

// ── retirement pass (public issue #1862, @hjbrandt) ──

interface Retirement { path: string; retired?: string; note?: string }

interface RetirementReport {
  present: boolean;
  moved: string[];
  skipped: string[];
  refused: string[];
  failures: string[];
  /** where the moved paths went, set once the first move lands */
  retiredDir?: string;
}

/**
 * Move install-tree paths the payload has RETIRED aside into `.retired-<ts>/`.
 *
 * The overlay never deletes, which is the right default and also means a file
 * LifeOS removed upstream lives on the user's disk forever — stale hooks kept
 * firing and retired tools kept resolving. A payload-shipped RETIREMENTS.json
 * makes removal explicit and auditable: entries are MOVED, never deleted, so a
 * wrong entry costs nothing. Accepts a bare array or `{ retirements: [...] }`.
 */
export function applyRetirements(payloadInstall: string, configRoot: string, apply: boolean): RetirementReport {
  const out: RetirementReport = { present: false, moved: [], skipped: [], refused: [], failures: [] };
  const manifest = join(payloadInstall, "RETIREMENTS.json");
  if (!existsSync(manifest)) return out;
  out.present = true;
  let entries: Retirement[];
  try {
    const parsed = JSON.parse(readFileSync(manifest, "utf8"));
    entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.retirements) ? parsed.retirements : [];
  } catch (err) {
    out.failures.push(`parse ${manifest}: ${String(err)}`);
    return out;
  }
  // Include each shipped file and its ancestors so a directory retirement cannot
  // remove a newly shipped child. Compare names independently of the host volume.
  const shipped = new Set<string>();
  const collectShipped = (dir: string, prefix = ""): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = lstatSync(full);
      if (stat.isDirectory()) collectShipped(full, prefix ? `${prefix}/${name}` : name);
      else if (stat.isFile()) {
        const parts = (prefix ? `${prefix}/${name}` : name).toLowerCase().split("/");
        for (let i = 1; i <= parts.length; i++) shipped.add(parts.slice(0, i).join("/"));
      }
    }
  };
  collectShipped(payloadInstall);
  const retiredDir = join(configRoot, `.retired-${stamp()}`);
  const rootReal = resolve(configRoot);
  // Parents before children: the manifest lists a retired directory and files under it, and moving a child first
  // creates the parent inside retiredDir, so the parent's rename then fails ENOTEMPTY and the overlay goes red
  // (v7.40.4 -> 8.5.0 upgrade boot, skills/Evals, 2026-10-12). With the parent moved first, each child is already absent.
  const depth = (e: Retirement): number => (typeof e?.path === "string" ? e.path.replace(/\/$/, "").split("/").length : 0);
  entries = entries.map((e, i) => ({ e, i })).sort((a, b) => depth(a.e) - depth(b.e) || a.i - b.i).map(({ e }) => e);
  for (const e of entries) {
    const rel = typeof e?.path === "string" ? e.path : "";
    const normalizedRel = rel.replace(/\/$/, "");
    // Containment: relative, no traversal, and resolving inside configRoot. A
    // manifest is payload data, so it is treated as untrusted input.
    if (!isRetirablePath(normalizedRel)) {
      out.refused.push(`${rel || "(empty)"} — not a safe relative path`);
      continue;
    }
    if (shipped.has(normalizedRel.toLowerCase())) {
      out.skipped.push(`${rel} — payload ships this path`);
      continue;
    }
    const target = resolve(join(configRoot, rel));
    if (target !== rootReal && !target.startsWith(rootReal + sep)) {
      out.refused.push(`${rel} — resolves outside ${configRoot}`);
      continue;
    }
    // Symlink-dereferenced boundary check (the PurgeArchives/AppleHealthImport
    // class — codified path-boundary rule; Astra review finding 1, 2026-08-17).
    try {
      if (!insideRealRoot(target, rootReal)) {
        out.refused.push(`${rel} — symlinked component escapes ${configRoot}`);
        continue;
      }
    } catch (err) {
      out.refused.push(`${rel} — boundary realpath failed: ${String(err)}`);
      continue;
    }
    if (lstatSync(target, { throwIfNoEntry: false }) === undefined) {
      out.skipped.push(`${rel} — already absent`);
      continue;
    }
    if (!apply) { out.moved.push(`${rel} → ${join(retiredDir, rel)}`); continue; }
    try {
      const dst = join(retiredDir, rel);
      mkdirSync(dirname(dst), { recursive: true });
      renameSync(target, dst);
      out.moved.push(`${rel} → ${dst}`);
      out.retiredDir = retiredDir;
    } catch (err) {
      out.failures.push(`retire ${rel}: ${String(err)}`);
    }
  }
  return out;
}

export interface StaleService {
  label: string;
  plist: string;
  paths: string[];
}

/**
 * Find launchd definitions that still point at a retired or missing executable.
 * This is deliberately read-only: stopping and moving a service need explicit
 * operator consent because a plist can be locally owned even when its label is
 * LifeOS-shaped.
 */
export function staleServices(launchAgentsDir: string, movedAside: string[]): StaleService[] {
  let plists: string[];
  try { plists = readdirSync(launchAgentsDir).filter((name) => /^com\.lifeos\..+\.plist$/.test(name)); }
  catch { return []; }
  const moved = new Set(movedAside.map((path) => resolve(path)));
  const home = homedir();
  const pathArg = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    if (value.startsWith("$HOME/")) return join(home, value.slice("$HOME/".length));
    if (value.startsWith("${HOME}/")) return join(home, value.slice("${HOME}/".length));
    if (value.startsWith("~/")) return join(home, value.slice(2));
    return value.startsWith("/") ? value : null;
  };
  const found: StaleService[] = [];
  for (const name of plists) {
    const plist = join(launchAgentsDir, name);
    let parsed: { Label?: unknown; ProgramArguments?: unknown };
    try {
      parsed = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", plist], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    } catch { continue; }
    const paths = ((Array.isArray(parsed.ProgramArguments) ? parsed.ProgramArguments : []) as unknown[])
      .map(pathArg)
      .filter((path): path is string => path !== null)
      .filter((path) => moved.has(resolve(path)) || !existsSync(path));
    if (paths.length > 0) {
      found.push({
        label: typeof parsed.Label === "string" ? parsed.Label : name.replace(/\.plist$/, ""),
        plist,
        paths,
      });
    }
  }
  return found;
}

// ── completeness walk (VERSION gate) ──

/**
 * Every payload file under a system tree/file must have a counterpart in the
 * config root. VERSION is the install's claim about what version it IS, so it is
 * written only after that holds — a partial overlay that stamped the new version
 * left the user with a marker that lied and an update that could never self-heal
 * (it would report "already current" forever).
 */
export function completenessGaps(payloadInstall: string, configRoot: string): string[] {
  const gaps: string[] = [];
  const walk = (s: string, d: string, rel: string): void => {
    let entries: string[];
    try { entries = readdirSync(s); } catch { return; }
    for (const name of entries) {
      const sp = join(s, name);
      let st: Stats;
      try { st = lstatSync(sp); } catch { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        walk(sp, join(d, name), join(rel, name));
        continue;
      }
      if (!st.isFile()) continue;
      if (!existsSync(join(d, name))) gaps.push(join(rel, name));
    }
  };
  for (const [ps, ds] of SYSTEM_TREES) {
    const src = join(payloadInstall, ps);
    if (optInNotInstalled(ps, join(configRoot, ds))) continue; // declined enhancement, not a gap (#2258)
    if (existsSync(src)) walk(src, join(configRoot, ds), ds);
  }
  for (const [ps, ds] of SYSTEM_FILES) {
    if (existsSync(join(payloadInstall, ps)) && !existsSync(join(configRoot, ds))) gaps.push(ds);
  }
  return gaps;
}

function main(): void {
  const a = process.argv.slice(2);
  const apply = a.includes("--apply");
  const allowDev = a.includes("--allow-dev");
  const configRoot = resolve(arg(a, "--config-root") || process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"));
  const skillRoot = arg(a, "--skill-root") || join(configRoot, "skills", "LifeOS");
  const launchAgentsDir = resolve(arg(a, "--launch-agents-dir") || process.env.LIFEOS_LAUNCH_AGENTS_DIR || join(homedir(), "Library", "LaunchAgents"));
  const payloadInstall = join(skillRoot, "install");
  const backupStamp = stamp();

  refuseDevInstallWrites(configRoot, [join(configRoot, "skills"), join(configRoot, "LIFEOS"), join(configRoot, "hooks")], allowDev);
  if (!existsSync(payloadInstall)) {
    console.log(JSON.stringify({ ok: false, blockers: [`payload absent: ${payloadInstall}`] }, null, 2));
    process.exit(1);
  }

  // Payload-completeness preflight. On an installed system, skills/LifeOS/install/ holds
  // only the bootstrap files (install.sh, templates) — the full system payload exists there
  // only right after the bootstrap has fetched a release. Overlaying from a bootstrap-only
  // dir would report every tree absent and exit ok:true having refreshed nothing, which
  // presents a no-op as a successful update. Refuse instead, and say what to do.
  const missingTrees = SYSTEM_TREES.map(([ps]) => ps).filter((ps) => !existsSync(join(payloadInstall, ps)));
  if (missingTrees.length === SYSTEM_TREES.length) {
    console.log(JSON.stringify({
      ok: false,
      blockers: [
        `payload at ${payloadInstall} is bootstrap-only (no system trees: ${missingTrees.join(", ")}) — run \`bash ${join(skillRoot, "install", "install.sh")}\` to fetch the full release payload, then re-run this overlay`,
      ],
    }, null, 2));
    process.exit(1);
  }
  if (missingTrees.length > 0) {
    console.log(JSON.stringify({
      ok: false,
      blockers: [`payload at ${payloadInstall} is incomplete — missing system tree(s): ${missingTrees.join(", ")}. Re-fetch the release payload before overlaying.`],
    }, null, 2));
    process.exit(1);
  }

  const results: OverlayResult[] = [];
  const skippedTrees: string[] = [];
  for (const [ps, ds] of SYSTEM_TREES) {
    if (optInNotInstalled(ps, join(configRoot, ds))) {
      skippedTrees.push(`${ps} — enhancement not installed`);
      continue;
    }
    results.push(overlayTree(join(payloadInstall, ps), join(configRoot, ds), ps, apply, configRoot, backupStamp));
  }
  for (const [ps, ds, backup] of SYSTEM_FILES) {
    results.push(overlayFile(join(payloadInstall, ps), join(configRoot, ds), ps, apply, backup, configRoot, backupStamp));
  }

  const failures = results.flatMap((r) => r.failures);
  const updated = results.reduce((n, r) => n + r.updated, 0);
  const created = results.reduce((n, r) => n + r.created, 0);
  const current = results.reduce((n, r) => n + r.current, 0);
  const backups = results.flatMap((r) => r.backups);

  // Retire what the payload says is gone (move-aside, never delete).
  const retirements = applyRetirements(payloadInstall, configRoot, apply);
  failures.push(...retirements.failures);
  const movedAside = retirements.moved.map((entry) => entry.split(" → ")[0]!).filter(Boolean).map((rel) => join(configRoot, rel));
  const stale = staleServices(launchAgentsDir, movedAside);

  // Re-render identity placeholders in exactly the files the overlay wrote — the
  // payload ships generic, so without this an update un-personalizes the tree.
  const ident = resolveIdentityVars(configRoot, payloadInstall);
  const substitution = substituteWritten(results.flatMap((r) => r.written), ident, apply);

  // Nested package.json manifests (LIFEOS/PULSE, per-skill tools) — the update
  // path never ran them, so a refreshed tree could import packages nothing had
  // installed (public issue #1873, @GRyndStone).
  const nestedDeps = deployNestedDependencies(payloadInstall, configRoot, apply);
  failures.push(...nestedDeps.failures);

  // Completeness before VERSION: every payload file must have a counterpart on
  // disk. Only meaningful after a real apply — a dry-run legitimately shows the
  // whole delta as absent.
  const gaps = apply ? completenessGaps(payloadInstall, configRoot) : [];
  const ok = failures.length === 0 && gaps.length === 0 && !substitution.skipped;

  // VERSION last, and only when everything else succeeded — a partial update must never
  // leave a marker claiming the new version.
  const version: { from: string | null; to: string | null; written: boolean } = { from: null, to: null, written: false };
  const versionSrc = join(payloadInstall, "LIFEOS", "VERSION");
  const versionDst = join(configRoot, "LIFEOS", "VERSION");
  if (existsSync(versionSrc)) {
    version.to = readFileSync(versionSrc, "utf8").trim();
    version.from = existsSync(versionDst) ? readFileSync(versionDst, "utf8").trim() : null;
    if (apply && ok) {
      try {
        writeFileSync(versionDst, version.to);
        version.written = true;
      } catch (err) {
        failures.push(`write VERSION: ${String(err)}`);
      }
    }
  }

  const notes: string[] = [];
  if (!apply) notes.push("dry-run — re-run with --apply to overlay (VERSION is written only on a successful, complete apply)");
  notes.push("USER/, LIFEOS/MEMORY/ and settings.json are never touched; nothing is ever deleted");
  if (backups.length) {
    notes.push(
      `backed up ${backups.length} operator file(s) before overlay: ${backups.join(", ")} — reconcile any hand-edits from the .bak, then run ActivateImports.ts --apply and read CLAUDE.md back to confirm the identity imports resolve`,
    );
  }
  if (substitution.instruction) notes.push(substitution.instruction);
  if (gaps.length) {
    notes.push(`INCOMPLETE — ${gaps.length} payload file(s) have no counterpart in ${configRoot}; VERSION NOT written. Re-run the overlay, and if they persist re-fetch the release payload.`);
  }
  if (retirements.retiredDir) notes.push(`retired ${retirements.moved.length} path(s) into ${retirements.retiredDir} (moved, not deleted)`);
  if (stale.length) notes.push(`stale LaunchAgent plist(s) found: ${stale.map((service) => service.label).join(", ")} — with the user's consent, boot each out and move its plist aside`);

  // Recomputed after the VERSION write, which can itself fail.
  const finalOk = failures.length === 0 && gaps.length === 0 && !substitution.skipped;
  console.log(JSON.stringify({
    ok: finalOk,
    dryRun: !apply,
    configRoot,
    payloadInstall,
    updated,
    created,
    alreadyCurrent: current,
    backups,
    substitution,
    retirements,
    staleServices: stale,
    skippedTrees,
    nestedDeps: { installed: nestedDeps.copied, actions: nestedDeps.actions, failures: nestedDeps.failures },
    completeness: { checked: apply, missing: gaps.slice(0, 25), missingTotal: gaps.length },
    version,
    failures,
    results,
    note: notes.join(" | "),
  }, null, 2));
  process.exit(finalOk ? 0 : 1);
}

// Keep the overlay importable by its coverage tests without executing an update.
if (import.meta.main) main();
