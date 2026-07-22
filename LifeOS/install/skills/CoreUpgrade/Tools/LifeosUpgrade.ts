#!/usr/bin/env bun
/**
 * LifeosUpgrade — scoped major-version upgrade for a LifeOS install.
 *
 * The LifeOS installer is additive (DeployCore = copyMissing, never overwrites
 * a populated target), so it cannot replace the core across a major version.
 * This REPLACES only the LifeOS SYSTEM entries THE NEW PAYLOAD SHIPS, then
 * copies the payload in — preserving everything user-owned and all harness state.
 *
 * SAFE BY CONSTRUCTION:
 *  - dry-run is the default; --apply is required to mutate.
 *  - "replace only what the payload ships": clear-list paths are enumerated ONLY
 *    from the live config-root (never from payload content) and each is cleared
 *    only if isPreserved() passes AND the payload ships a replacement — so a
 *    wrong/malicious payload can never inject a path or clear a preserved zone.
 *  - scoped backup of exactly the to-be-cleared entries, per-entry verified,
 *    BEFORE any delete.
 *  - on ANY error during clear/deploy: rollback removes deploy-created artifacts
 *    AND restores the cleared entries from backup (both through the guarded
 *    delete path), then reports the ACTUAL rollback outcome (partial failures named).
 *  - all deletes go through safeRemove (isPreserved + path-escape, case-insensitive).
 *
 * Known limitations (documented, low-risk): safeRemove's path-escape guard is
 * lexical (does not resolve a symlinked config-root ancestor); "backup precedes
 * delete" is enforced by main()'s call order, not an invariant inside safeRemove.
 *
 * Usage:
 *   bun LifeosUpgrade.ts --payload <install-payload-dir>            # dry-run
 *   bun LifeosUpgrade.ts --payload <dir> --apply                   # execute
 *   flags: --config-root <dir> (default $CLAUDE_CONFIG_DIR or ~/.claude), --backup-dir <dir>,
 *          --split-claude-md (extract CLAUDE.md customizations → USER/CUSTOMIZATIONS/GLOBAL.md,
 *          then replace CLAUDE.md with the payload base), --help
 */
import { existsSync, readdirSync, lstatSync, rmSync, mkdirSync, copyFileSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { join, sep, resolve, dirname } from "node:path";
import { homedir } from "node:os";

const ensureParentDir = (p: string) => mkdirSync(dirname(p), { recursive: true });
const errCode = (e: unknown): string | undefined => (e as { code?: string })?.code;
/** lstat-based existence — sees a symlink ITSELF (existsSync follows links, so a dangling symlink reads as absent and breaks backup/rollback verification). */
const lexists = (p: string): boolean => { try { lstatSync(p); return true; } catch { return false; } };

// ── Zone policy (the load-bearing correctness surface) ──────────────────────

/** Never touched. Prefix-matched (case-insensitive) against a config-root-relative path. */
export const PRESERVE: string[] = [
  "LIFEOS/USER", "LIFEOS/MEMORY", "LIFEOS/ARBOL", "LIFEOS/Backups",
  ".env",
  "CLAUDE.md",                       // payload ships CLAUDE.template.md, not a drop-in; reconcile, never headless-clear
  "settings.json", "settings.user.json", "settings.system.json",
  // harness-owned runtime state (top-level dirs/files only)
  "sessions", "todos", "tasks", "teams", "plugins", "Plugins",
  "cache", "shell-snapshots", "session-env", "paste-cache", "file-history",
  "history.jsonl", "ide", ".git", "downloads", "jobs", "daemon",
];

/**
 * True when a config-root-relative path must never be cleared. Case-insensitive
 * (macOS APFS; fail toward PRESERVING). Private skills (skills/_*) and .env* always preserved;
 * compound entries match exact-or-under; bare entries match at TOP LEVEL only.
 */
export function isPreserved(rel: string): boolean {
  const norm = rel.split(sep).join("/").replace(/^\.?\//, "");
  const lc = norm.toLowerCase();
  const first = lc.split("/")[0];
  const baseName = lc.split("/").pop() || "";
  if (lc.startsWith("skills/_")) return true;
  if (baseName === ".env" || baseName.startsWith(".env.")) return true;
  return PRESERVE.some((p) => {
    const pl = p.toLowerCase();
    if (lc === pl || lc.startsWith(pl + "/")) return true;
    if (pl.includes("/")) return false;
    return first === pl;
  });
}

const isPrivateSkill = (name: string) => name.startsWith("_");

/** Does the payload ship a replacement for this config-relative entry? Rel paths mirror the payload layout 1:1 (runtime dir is canonically `LIFEOS/`). */
export function payloadHas(payloadRoot: string, rel: string): boolean {
  return existsSync(join(payloadRoot, rel));
}

/**
 * SYSTEM entries to clear = per-entry, enumerated from the LIVE config-root, and ONLY
 * where the payload ships a replacement. Every returned path passes isPreserved.
 */
export function computeClearList(configRoot: string, payloadRoot: string): string[] {
  const out: string[] = [];
  const consider = (rel: string) => {
    if (isPreserved(rel)) return;
    if (!existsSync(join(configRoot, rel))) return;
    if (!payloadHas(payloadRoot, rel)) return;
    out.push(rel);
  };
  const lifeos = join(configRoot, "LIFEOS");
  if (existsSync(lifeos)) for (const e of readdirSync(lifeos)) consider(`LIFEOS/${e}`);
  for (const zone of ["commands", "agents"]) {
    const z = join(configRoot, zone);
    if (existsSync(z)) for (const e of readdirSync(z)) consider(`${zone}/${e}`);
  }
  const skills = join(configRoot, "skills");
  if (existsSync(skills)) for (const e of readdirSync(skills)) if (!isPrivateSkill(e)) consider(`skills/${e}`);
  return out.filter((r) => !isPreserved(r));   // belt-and-suspenders vs a future consider() that forgets the check
}

// ── copyMissing (mirrors upstream DeployCore: recursive, never overwrites) ──
// Payload SYMLINKS ARE SKIPPED, exactly like upstream DeployCore (its isFile/isDirectory
// branches never match a symlink) — deploying a payload-authored symlink would let a
// tampered payload plant a link to an arbitrary target (symlink-target injection).
// dst guards use lexists so a dangling symlink at dst is treated as occupied, not absent.
// Only ENOENT on src means "nothing to copy"; real errors propagate → rollback.
export function copyMissing(src: string, dst: string): { copied: number } {
  let copied = 0;
  let st;
  try { st = lstatSync(src); }
  catch (e) { if (errCode(e) === "ENOENT") return { copied }; throw e; }
  if (st.isSymbolicLink()) return { copied };            // never deploy payload symlinks (matches upstream)
  if (st.isDirectory()) {
    if (!lexists(dst)) mkdirSync(dst, { recursive: true });
    for (const e of readdirSync(src)) copied += copyMissing(join(src, e), join(dst, e)).copied;
  } else if (!lexists(dst)) {
    ensureParentDir(dst);
    copyFileSync(src, dst); copied++;
  }
  return { copied };
}

// ── Plan ────────────────────────────────────────────────────────────────────
export interface DeployRoot { src: string; dest: string; }   // payload dir name → canonical config-root dest
export interface Plan {
  configRoot: string; payloadRoot: string;
  clear: string[];
  deployRoots: DeployRoot[];       // one per payload root that ships (LIFEOS/skills/commands/agents)
  warnings: string[];
}

export function planUpgrade(configRoot: string, payloadRoot: string): Plan {
  const clear = computeClearList(configRoot, payloadRoot);
  const deployRoots: DeployRoot[] = [];
  for (const cand of ["LIFEOS", "skills", "commands", "agents"]) {
    if (!existsSync(join(payloadRoot, cand))) continue;
    deployRoots.push({ src: cand, dest: cand });   // runtime dir is canonically LIFEOS/ (payload verified: 0 mixed-case refs)
  }
  const warnings: string[] = [];
  if (clear.some((r) => r.startsWith("LIFEOS/") || r.startsWith("skills/")))
    warnings.push("SYSTEM dirs (LIFEOS/*, public skills) are replaced wholesale — custom code placed INSIDE a shipped dir (e.g. a tool in LIFEOS/TOOLS) is backed up but NOT merged; the payload version wins. Move custom code into a preserved private skills/_* skill before upgrading, or re-apply it from the backup after.");
  warnings.push("PRESERVED, never replaced: CLAUDE.md + settings*.json (they hold your @-imports and hook registrations). Reconcile them by hand against the payload's CLAUDE.template.md + settings templates after deploy.");
  warnings.push("Config reconciliation is a MANUAL post-step (by design — it depends on YOUR customizations): (1) run the payload's InstallHooks.ts to wire new hooks; (2) fold new CLAUDE.md/settings structure in by hand; (3) re-apply any edits to replaced SYSTEM files from the backup dir.");
  return { configRoot, payloadRoot, clear, deployRoots, warnings };
}

// ── Preflight ────────────────────────────────────────────────────────────────
export function preflight(configRoot: string, payloadRoot: string, backupDir?: string): string[] {
  const errs: string[] = [];
  if (!existsSync(configRoot)) errs.push(`config-root does not exist: ${configRoot}`);
  else if (!existsSync(join(configRoot, "LIFEOS")))
    errs.push(`config-root has no LIFEOS/ dir — not a LifeOS install (a stray CLAUDE.md is not enough): ${configRoot}`);
  else if (!existsSync(join(configRoot, "settings.json")) && !existsSync(join(configRoot, "CLAUDE.md")))
    errs.push(`config-root has LIFEOS/ but no settings.json/CLAUDE.md — refusing an ambiguous target: ${configRoot}`);
  // Same predicate as InstallEngine.detectDevTree() — deliberately inlined, not imported:
  // this tool REPLACES the very tree that helper ships in, and skills are self-contained
  // by repo convention (zero cross-skill imports exist anywhere in the payload).
  if (existsSync(join(configRoot, "skills", "_LIFEOS")))
    errs.push("DEV-TREE REFUSAL: skills/_LIFEOS present — refusing to mutate a LifeOS source repo.");
  if (!payloadRoot || !existsSync(payloadRoot)) errs.push(`--payload dir missing or not found: ${payloadRoot}`);
  if (backupDir) {
    // Lexical (non-realpath) comparison — same documented limitation as safeRemove's escape guard.
    const b = resolve(backupDir), c = resolve(configRoot);
    if (b === c || b.startsWith(c + sep)) errs.push(`--backup-dir must be OUTSIDE config-root (would nest the backup inside the tree being cleared): ${backupDir}`);
  }
  return errs;
}

// ── Apply + rollback ──────────────────────────────────────────────────────────
export function safeRemove(configRoot: string, rel: string) {
  if (isPreserved(rel)) throw new Error(`REFUSING to delete preserved path: ${rel}`);      // guard 1
  const abs = resolve(configRoot, rel);
  if (!abs.startsWith(resolve(configRoot) + sep)) throw new Error(`path escapes config-root: ${rel}`); // guard 2 (lexical)
  rmSync(abs, { recursive: true, force: true });
}

export function scopedBackup(configRoot: string, backupDir: string, clear: string[]) {
  if (existsSync(backupDir)) throw new Error(`backup dir already exists: ${backupDir}`);
  mkdirSync(backupDir, { recursive: true });
  for (const rel of clear) {
    const dst = join(backupDir, rel);
    ensureParentDir(dst);
    cpSync(join(configRoot, rel), dst, { recursive: true, errorOnExist: false });
    if (!lexists(dst)) throw new Error(`backup verification failed for ${rel} — aborting before any delete`);
  }
}

/** Snapshot the top-level child set of each deploy destination BEFORE deploy, so rollback can remove new artifacts. */
export function snapshotDeployTargets(configRoot: string, deployRoots: DeployRoot[]): Record<string, string[]> {
  const snap: Record<string, string[]> = {};
  for (const { dest } of deployRoots) {
    const d = join(configRoot, dest);
    snap[dest] = existsSync(d) ? readdirSync(d) : [];     // [] also encodes "dest dir did not exist"
  }
  return snap;
}

/** Rollback: remove deploy-created NEW top-level entries (guarded), then restore cleared entries from backup. Returns names of entries that could NOT be restored. */
export function rollback(configRoot: string, backupDir: string, clear: string[], snapshot: Record<string, string[]>): string[] {
  const failed: string[] = [];
  // 1) remove new artifacts deploy created (children not present pre-run, excluding preserved)
  for (const [dest, before] of Object.entries(snapshot)) {
    const d = join(configRoot, dest);
    if (!existsSync(d)) continue;
    const beforeSet = new Set(before);
    for (const child of readdirSync(d)) {
      const rel = `${dest}/${child}`;
      if (beforeSet.has(child)) continue;                  // pre-existing (cleared ones are restored below)
      if (isPreserved(rel)) continue;
      try { safeRemove(configRoot, rel); }
      catch (e) { console.error(`  rollback: could not remove ${rel}: ${(e as Error)?.message ?? String(e)}`); failed.push(`(new)${rel}`); }
    }
  }
  // 2) restore cleared entries from backup (through the guarded delete; lexists so symlink-bearing backups verify correctly)
  for (const rel of clear) {
    const bak = join(backupDir, rel), live = join(configRoot, rel);
    if (!lexists(bak)) { failed.push(rel); continue; }
    try {
      if (lexists(live)) safeRemove(configRoot, rel);      // remove partial deploy remnants (guarded)
      ensureParentDir(live);
      cpSync(bak, live, { recursive: true, errorOnExist: false });
      if (!lexists(live)) failed.push(rel);
    } catch (e) { console.error(`  rollback: could not restore ${rel}: ${(e as Error)?.message ?? String(e)}`); failed.push(rel); }
  }
  return failed;
}

// ── CLAUDE.md customization split (Approach A) ────────────────────────────────
// Diffs the user's CLAUDE.md against the upstream base to auto-extract additive
// customizations into an imported GLOBAL.md, so the base can be pulled fresh on
// upgrade. SAFE: pure + deterministic (no LLM). Additions are auto-extracted;
// MODIFICATIONS (same block key, different body) are only FLAGGED, never guessed;
// the version header + @-import comment-state are excluded as noise. The full
// original CLAUDE.md is always in the scoped backup, so a mis-classification is
// cosmetic (surfaced in dry-run for review), never data loss.

export interface ExtractReport {
  additions: string[];      // present in user, absent upstream → extracted to GLOBAL.md
  modifications: string[];  // same key as an upstream block, different body → FLAGGED for manual placement
  noise: string[];          // version header + @-import lines → excluded (base wins; imports re-activated separately)
  matched: number;          // identical to an upstream block → dropped (the base ships it)
}
export interface ExtractResult { global: string; report: ExtractReport; }

interface MdBlock { key: string; text: string; }

// In a LifeOS CLAUDE.md a single-`#` line is the title or an explanatory comment — never a
// content section (real sections are `##`+). So H1 lines + @-import lines (any comment-state) are noise.
const H1_LINE = /^#\s+\S/;                                              // "# LifeOS 6.0.5 …" | "# Identity @-imports …"
const IMPORT_LINE = /^\s*(?:#\s*|<!--\s*)?@[\w./-]+\s*(?:-->)?\s*$/;     // @X | # @X | <!-- @X -->
const isNoiseLine = (l: string) => H1_LINE.test(l) || IMPORT_LINE.test(l);
const mdNorm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Stable identity of a block: heading text, a bullet's bold label / pre-dash lead, else normalized head. */
function blockKey(firstLine: string): string {
  if (/^#{1,6}\s/.test(firstLine)) return "h:" + mdNorm(firstLine.replace(/^#+\s*/, ""));
  const body = firstLine.replace(/^\s*[-*]\s+/, "");
  const bold = body.match(/^\*\*(.+?)\*\*/);
  if (bold) return "b:" + mdNorm(bold[1]);
  return "b:" + mdNorm(body.split(/\s[—-]\s/)[0]).slice(0, 48);
}

/** Split markdown into blocks: heading | top-level bullet (+ indented continuations) | paragraph. Noise lines dropped. */
function segmentMd(md: string): MdBlock[] {
  const lines = md.split("\n");
  const blocks: MdBlock[] = [];
  const isHeading = (l: string) => /^#{1,6}\s/.test(l);
  const isBullet = (l: string) => /^\s*[-*]\s/.test(l);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || isNoiseLine(line)) { i++; continue; }
    if (isHeading(line)) { blocks.push({ key: blockKey(line), text: line.trimEnd() }); i++; continue; }
    const buf = [line]; i++;
    if (isBullet(line)) {
      while (i < lines.length && /^\s+\S/.test(lines[i])) { buf.push(lines[i]); i++; }   // absorb indented continuations
    } else {
      while (i < lines.length && lines[i].trim() !== "" && !isHeading(lines[i]) && !isBullet(lines[i]) && !isNoiseLine(lines[i])) { buf.push(lines[i]); i++; }
    }
    blocks.push({ key: blockKey(buf[0]), text: buf.join("\n").trimEnd() });
  }
  return blocks;
}

export function extractCustomizations(userClaudeMd: string, upstreamBase: string): ExtractResult {
  const baseBlocks = segmentMd(upstreamBase);
  const baseByContent = new Set(baseBlocks.map((b) => mdNorm(b.text)));
  const baseKeys = new Set(baseBlocks.map((b) => b.key));
  const report: ExtractReport = { additions: [], modifications: [], noise: [], matched: 0 };
  const globalBlocks: string[] = [];
  for (const b of segmentMd(userClaudeMd)) {
    if (baseByContent.has(mdNorm(b.text))) { report.matched++; continue; }        // identical to upstream → drop
    if (baseKeys.has(b.key)) { report.modifications.push(b.text); continue; }      // same key, diff body → FLAG (no extract)
    report.additions.push(b.text); globalBlocks.push(b.text);                      // pure addition → extract
  }
  report.noise = userClaudeMd.split("\n").filter((l) => l.trim() !== "" && isNoiseLine(l)).map((l) => l.trim());
  return { global: assembleGlobalMd(globalBlocks), report };
}

function assembleGlobalMd(blocks: string[]): string {
  if (!blocks.length) return "";
  return [
    "# CLAUDE.md Customizations",
    "",
    "> Auto-extracted by CoreUpgrade from your previous CLAUDE.md during upgrade.",
    "> Your additions to the LifeOS routing table — edit freely. Imported by CLAUDE.md.",
    "",
    ...blocks.flatMap((b) => [b, ""]),
  ].join("\n").replace(/\n+$/, "\n");
}

// ── CLAUDE.md split integration (opt-in --split-claude-md) ────────────────────
// SENSITIVE: the ONLY path that replaces CLAUDE.md (the #1 preserved file). Guards:
// opt-in flag; the old CLAUDE.md is backed up and verified before overwrite; an
// existing GLOBAL.md is NEVER overwritten; identity + GLOBAL imports are written
// COMMENTED for the post-step ActivateImports to activate; undo restores CLAUDE.md
// and removes only a GLOBAL.md this run created. Rollback-path change → re-review.

const GLOBAL_REL = "LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md";
const GLOBAL_IMPORT = "@LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md";
const claudeTemplatePath = (payloadRoot: string) => join(payloadRoot, "CLAUDE.template.md");

export interface SplitPlan {
  willSplit: boolean;
  reason: string;
  report: ExtractReport;
  global: string;
  globalExists: boolean;   // GLOBAL.md already present → we will NOT overwrite; additions reported for manual merge
  injectImport: boolean;   // base template lacks the GLOBAL import line → we add it (commented)
}
export interface SplitUndo { claudeBackup: string; globalCreated?: string; }

export function planClaudeSplit(configRoot: string, payloadRoot: string): SplitPlan {
  const empty: ExtractReport = { additions: [], modifications: [], noise: [], matched: 0 };
  const userPath = join(configRoot, "CLAUDE.md");
  const basePath = claudeTemplatePath(payloadRoot);
  if (!existsSync(userPath)) return { willSplit: false, reason: "no CLAUDE.md in config-root", report: empty, global: "", globalExists: false, injectImport: false };
  if (!existsSync(basePath)) return { willSplit: false, reason: "payload ships no CLAUDE.template.md", report: empty, global: "", globalExists: false, injectImport: false };
  const baseMd = readFileSync(basePath, "utf8");
  const { global, report } = extractCustomizations(readFileSync(userPath, "utf8"), baseMd);
  return {
    willSplit: true, reason: "", report, global,
    globalExists: existsSync(join(configRoot, GLOBAL_REL)),
    injectImport: !baseMd.includes(GLOBAL_IMPORT),
  };
}

/** Insert a commented GLOBAL import after the last existing @-import line (or after line 1). */
function injectGlobalImport(baseMd: string): string {
  const lines = baseMd.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) if (IMPORT_LINE.test(lines[i])) lastImport = i;
  lines.splice(lastImport >= 0 ? lastImport + 1 : 1, 0, `# ${GLOBAL_IMPORT}`);
  return lines.join("\n");
}

/** Mutating step: back up CLAUDE.md, write GLOBAL.md (only if absent), replace CLAUDE.md with the base. Atomic — cleans its own partial state on throw. */
export function applyClaudeSplit(configRoot: string, payloadRoot: string, backupDir: string, plan: SplitPlan): SplitUndo {
  const userPath = join(configRoot, "CLAUDE.md");
  const claudeBackup = join(backupDir, "CLAUDE.md.pre-split");
  ensureParentDir(claudeBackup);
  copyFileSync(userPath, claudeBackup);
  if (!existsSync(claudeBackup)) throw new Error("CLAUDE.md backup verification failed — aborting split before any write");
  const undo: SplitUndo = { claudeBackup };
  try {
    const gp = join(configRoot, GLOBAL_REL);
    if (plan.global && !existsSync(gp)) {          // re-check at WRITE time (not stale plan.globalExists) — never clobber a GLOBAL.md
      ensureParentDir(gp);
      undo.globalCreated = gp;                     // record intent BEFORE the write so the catch can clean a partial write
      writeFileSync(gp, plan.global);
    }
    let baseMd = readFileSync(claudeTemplatePath(payloadRoot), "utf8");
    if (plan.injectImport) baseMd = injectGlobalImport(baseMd);
    writeFileSync(userPath, baseMd);              // the one destructive op; backup precedes it
  } catch (e) {
    if (undo.globalCreated) { try { rmSync(undo.globalCreated, { force: true }); } catch { /* best-effort */ } }
    try { copyFileSync(claudeBackup, userPath); }                                // restore CLAUDE.md from the verified backup
    catch { throw new Error(`CLAUDE.md split failed AND auto-restore also failed — your intact original is at ${claudeBackup}; copy it back to ${userPath}. Cause: ${(e as Error).message}`); }
    throw e;
  }
  return undo;
}

/** Undo a split: restore CLAUDE.md from backup, remove only a GLOBAL.md this run created. Returns entries it could NOT restore. */
export function undoClaudeSplit(configRoot: string, undo: SplitUndo): string[] {
  const failed: string[] = [];
  try { copyFileSync(undo.claudeBackup, join(configRoot, "CLAUDE.md")); }
  catch (e) { console.error(`  split-undo: could not restore CLAUDE.md: ${(e as Error)?.message ?? String(e)}`); failed.push("CLAUDE.md"); }
  if (undo.globalCreated) {
    try { rmSync(undo.globalCreated, { force: true }); }
    catch (e) { console.error(`  split-undo: could not remove ${GLOBAL_REL}: ${(e as Error)?.message ?? String(e)}`); failed.push(GLOBAL_REL); }
  }
  return failed;
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function needVal(argv: string[], i: number, flag: string): string {
  const v = argv[i];
  if (!v || v.startsWith("--")) throw new Error(`flag ${flag} requires a non-empty value`);
  return v;
}
export const USAGE = `LifeosUpgrade — scoped major-version upgrade for a LifeOS install.

Usage:
  bun LifeosUpgrade.ts --payload <install-payload-dir>          dry-run (default): print the exact plan, change nothing
  bun LifeosUpgrade.ts --payload <dir> --apply                  execute (scoped backup first, rollback on error)

Flags:
  --payload <dir>       REQUIRED. The target version's install/ payload tree.
  --apply               Execute. Without it, dry-run only.
  --config-root <dir>   LifeOS install to upgrade (default: $CLAUDE_CONFIG_DIR, else ~/.claude).
  --backup-dir <dir>    Backup location (default: <config-root>-backup-<ts>; must be outside config-root).
  --split-claude-md     Extract CLAUDE.md customizations → LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md,
                        then replace CLAUDE.md with the payload base (imports ship commented;
                        run ActivateImports.ts after). Additions auto-extracted; modified base
                        lines are FLAGGED for manual placement, never guessed.
  --help                Show this help.

Preserved (never touched): LIFEOS/USER, LIFEOS/MEMORY, .env*, settings*.json, skills/_*,
custom commands/agents/skills the payload does not ship, harness state — and CLAUDE.md
unless --split-claude-md is passed (then it is backed up first).`;

export function parseArgs(argv: string[]) {
  const a: Record<string, string | boolean> = { apply: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--help" || t === "-h") a.help = true;
    else if (t === "--apply") a.apply = true;
    else if (t === "--payload") a.payload = needVal(argv, ++i, "--payload");
    else if (t === "--config-root") a.configRoot = needVal(argv, ++i, "--config-root");
    else if (t === "--backup-dir") a.backupDir = needVal(argv, ++i, "--backup-dir");
    else if (t === "--split-claude-md") a.splitClaudeMd = true;
    else throw new Error(`unknown argument: ${t}`);
  }
  return a;
}

/** Provably-`never` exit (trailing throw is unreachable; narrows types past process.exit). */
function die(msg: string): never { console.error(msg); process.exit(1); throw new Error(msg); }

function main() {
  let a;
  try { a = parseArgs(process.argv.slice(2)); }
  catch (e) { die(`ARG ERROR: ${(e as Error).message}\n\n${USAGE}`); }
  if (a.help || process.argv.length <= 2) { console.log(USAGE); return; }

  // Default resolution honors CLAUDE_CONFIG_DIR (upstream PR #696 convention; matches ActivateImports.ts).
  const configRoot = resolve((a.configRoot as string) || process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"));
  const payloadRoot = a.payload ? resolve(a.payload as string) : "";
  const apply = a.apply === true;
  const splitClaudeMd = a.splitClaudeMd === true;
  const backupDir = (a.backupDir as string) || `${configRoot}-backup-${Date.now()}`;

  const errs = preflight(configRoot, payloadRoot, backupDir);
  if (errs.length) die("PREFLIGHT FAILED:\n" + errs.map((e) => "  ✗ " + e).join("\n"));

  const plan = planUpgrade(configRoot, payloadRoot);
  if (!plan.deployRoots.length)
    die(`PREFLIGHT FAILED:\n  ✗ payload has no deployable roots (LIFEOS/skills/commands/agents) at ${payloadRoot}\n    → point --payload at the version's install/ tree.`);

  console.log(`\n=== LifeosUpgrade ${apply ? "APPLY" : "DRY-RUN"} ===`);
  console.log(`config-root: ${configRoot}\npayload:     ${payloadRoot}\n`);
  console.log(`CLEAR (${plan.clear.length} payload-backed SYSTEM entries → removed, then re-filled):`);
  plan.clear.forEach((r) => console.log("  − " + r));
  console.log(`\nDEPLOY payload roots → dest: ${plan.deployRoots.map((d) => `${d.src}→${d.dest}`).join(", ")}`);
  console.log(`\nPRESERVED (never touched): USER, MEMORY, ARBOL, .env*, CLAUDE.md, settings*.json, private skills/_*, harness dirs, and any entry the payload does NOT ship.`);
  console.log(`\nWARNINGS:`); plan.warnings.forEach((w) => console.log("  ⚠ " + w));

  let splitPlan: SplitPlan | undefined;
  if (splitClaudeMd) {
    splitPlan = planClaudeSplit(configRoot, payloadRoot);
    console.log(`\n── CLAUDE.md SPLIT (--split-claude-md) ──`);
    if (!splitPlan.willSplit) console.log(`  ⚠ split skipped: ${splitPlan.reason}`);
    else {
      const r = splitPlan.report;
      console.log(`  additions → GLOBAL.md: ${r.additions.length} | modifications FLAGGED for manual placement: ${r.modifications.length} | matched-dropped: ${r.matched} | noise: ${r.noise.length}`);
      if (splitPlan.globalExists) console.log(`  ⚠ USER/CUSTOMIZATIONS/GLOBAL.md exists — will NOT overwrite; new additions are for manual merge.`);
      r.modifications.forEach((m) => console.log(`    ~ place by hand: ${m.split("\n")[0].slice(0, 100)}`));
      console.log(`  → after apply, run the payload's ActivateImports.ts to activate identity + GLOBAL imports.`);
    }
  }

  if (!apply) { console.log(`\nDRY-RUN — nothing changed. Re-run with --apply to execute.`); return; }

  console.log(`\n[1/3] Scoped backup of ${plan.clear.length} entries → ${backupDir}`);
  try { scopedBackup(configRoot, backupDir, plan.clear); }
  catch (e) { die(`✗ BACKUP FAILED (no deletes performed): ${(e as Error).message}`); }
  console.log(`      backup verified (per-entry).`);

  let splitUndo: SplitUndo | undefined;
  if (splitClaudeMd && splitPlan?.willSplit) {
    console.log(`[split] extracting CLAUDE.md customizations → GLOBAL.md; replacing CLAUDE.md with the base…`);
    try { splitUndo = applyClaudeSplit(configRoot, payloadRoot, backupDir, splitPlan); }
    catch (e) { die(`✗ CLAUDE.md SPLIT FAILED — SYSTEM zones untouched. ${(e as Error).message}\n    If it was not auto-restored, your original is at ${backupDir}/CLAUDE.md.pre-split.`); }
    console.log(`      CLAUDE.md backed up + replaced${splitUndo?.globalCreated ? "; GLOBAL.md written" : " (GLOBAL.md left as-is)"}.`);
  }

  let snapshot: Record<string, string[]> = {};
  try {
    snapshot = snapshotDeployTargets(configRoot, plan.deployRoots);   // inside try so a post-split failure here still triggers undoClaudeSplit
    console.log(`[2/3] Clearing ${plan.clear.length} SYSTEM entries…`);
    for (const rel of plan.clear) { safeRemove(configRoot, rel); console.log("      − " + rel); }
    console.log(`[3/3] Deploying payload…`);
    let copied = 0;
    for (const { src, dest } of plan.deployRoots) copied += copyMissing(join(payloadRoot, src), join(configRoot, dest)).copied;
    console.log(`      copied ${copied} files.`);
  } catch (e) {
    console.error(`\n✗ ERROR during clear/deploy: ${(e as Error).message}\n  → ROLLING BACK from ${backupDir}…`);
    if (splitUndo) { const sf = undoClaudeSplit(configRoot, splitUndo); console.error(sf.length ? `  ⚠ split-undo could NOT restore: ${sf.join(", ")} (restore from ${backupDir})` : `  split undone — CLAUDE.md restored.`); }
    const failed = rollback(configRoot, backupDir, plan.clear, snapshot);
    if (failed.length) die(`  ⚠ PARTIAL ROLLBACK — these entries could NOT be auto-restored; restore MANUALLY from the backup:\n` +
      failed.map((f) => `      • ${f}`).join("\n") + `\n    Backup: ${backupDir}`);
    console.error(`  rollback complete — SYSTEM zones restored to pre-run state. Backup kept at ${backupDir}.`);
    process.exit(1);
  }

  console.log(`\nDONE. Backup: ${backupDir}`);
  if (splitClaudeMd && splitPlan?.willSplit)
    console.log(`⚠ NEXT (REQUIRED): the new CLAUDE.md ships with ALL @-imports COMMENTED — your identity/TELOS/GLOBAL context is DORMANT until you run the payload's ActivateImports.ts. Run it FIRST, then reconcile settings + run InstallHooks.ts.`);
  else
    console.log(`NEXT (manual, per warnings): run payload InstallHooks.ts; reconcile CLAUDE.md + settings from payload templates; re-apply any custom SYSTEM-file edits from the backup.`);
}

if (import.meta.main) main();
