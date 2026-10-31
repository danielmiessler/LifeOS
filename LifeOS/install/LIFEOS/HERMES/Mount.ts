#!/usr/bin/env bun
/**
 * Mount — install (or re-sync) the LifeOS sidecar into a Hermes install.
 *
 * Turns a stock Hermes into a second front door onto THIS LifeOS instance:
 * same constitution, same identity, same skills, same understanding of what is
 * sensitive — with credential material blocked in code rather than by prompt.
 *
 * What it does, all idempotent:
 *   1. Renders the constitution + identity into `$HERMES_HOME/SOUL.md`.
 *   2. Installs the guard plugin and its generated policy into
 *      `$HERMES_HOME/plugins/lifeos/`.
 *   3. Patches `config.yaml`: soul cap, skills mount, approval policy.
 *   4. Writes the write-sandbox root so the LifeOS tree stays read-only.
 *
 * Code/content separation: this file and everything beside it are install-
 * generic — no identity, no home paths, no instance literals. Everything
 * personal is READ from `LIFEOS/USER/` at render time and WRITTEN into
 * `$HERMES_HOME`, which is outside the LifeOS repo entirely.
 *
 * Usage:
 *   bun LIFEOS/HERMES/Mount.ts              # install / re-sync
 *   bun LIFEOS/HERMES/Mount.ts --check      # report drift, change nothing
 *   bun LIFEOS/HERMES/Mount.ts --keep-output-format
 */

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { emitPolicy, SHELL_DENY_GLOBS } from "./Policy.ts";
import { daName, skillIndex } from "./RenderSoul.ts";
import { INSTALL_ROOT, renderSoul, scrubPaths } from "./RenderSoul.ts";

const HOME = homedir();
const HERMES_HOME = process.env.HERMES_HOME || join(HOME, ".hermes");
const WORKSPACE = process.env.HERMES_WORKSPACE || join(HOME, "HermesWorkspace");
const PLUGIN_SRC = join(import.meta.dir, "plugin");
const PLUGIN_DEST = join(HERMES_HOME, "plugins", "lifeos");

/**
 * Soul cap. The stock default (20,000) truncates silently, and the constitution
 * alone is close to that — so an explicit, generous cap is required, not a
 * nicety. Sized to hold constitution + identity + the skills capability index
 * (~70k as of 2026-08-01) with room to grow.
 */
const CONTEXT_FILE_MAX_CHARS = 100_000;

const MANAGED_BEGIN = "# ── LIFEOS-MANAGED (Mount.ts) — do not hand-edit ─────────────────────────";
const MANAGED_END = "# ── end LIFEOS-MANAGED ───────────────────────────────────────────────────";

interface Change {
  what: string;
  detail: string;
}

/** Decode one YAML flow scalar the way hermes writes them: bare, 'single' ('' escapes), or "double" (JSON escapes). */
function yamlScalar(raw: string): string {
  const s = raw.trim();
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    try { return JSON.parse(s) as string; } catch { return s.slice(1, -1); }
  }
  return s;
}

/** Set or replace a top-level scalar key without creating a duplicate. */
function setTopLevelKey(yaml: string, key: string, value: string): { yaml: string; changed: boolean } {
  const re = new RegExp(`^${key}\\s*:.*$`, "m");
  if (re.test(yaml)) {
    const next = yaml.replace(re, `${key}: ${value}`);
    return { yaml: next, changed: next !== yaml };
  }
  return { yaml: `${yaml.replace(/\n*$/, "")}\n${key}: ${value}\n`, changed: true };
}

/**
 * Add `external_dirs` under an existing `skills:` block, or create the block.
 * Duplicate top-level keys are a YAML hazard, so never blindly append.
 */
function setSkillsExternalDirs(yaml: string, dirs: string[]): { yaml: string; changed: boolean } {
  const list = dirs.map((d) => `    - ${d}`).join("\n");
  if (/^skills:\s*$/m.test(yaml) || /^skills:\s*\n/m.test(yaml)) {
    if (/^\s+external_dirs\s*:/m.test(yaml)) {
      // Replace the existing list wholesale. The key may carry an inline value — hermes' own
      // wizard writes `external_dirs: []` — so match the rest of that line, not only a bare
      // `external_dirs:` followed by `- item` lines; the inline form used to slip through
      // untouched while the console still reported the skills as mounted.
      const next = yaml.replace(
        /^(\s+)external_dirs\s*:.*\n(?:\s+-\s+.*\n)*/m,
        `  external_dirs:\n${list}\n`,
      );
      return { yaml: next, changed: next !== yaml };
    }
    const next = yaml.replace(/^skills:\s*$/m, `skills:\n  external_dirs:\n${list}`);
    return { yaml: next, changed: next !== yaml };
  }
  return { yaml: `${yaml.replace(/\n*$/, "")}\nskills:\n  external_dirs:\n${list}\n`, changed: true };
}

/**
 * The deny list is RECONCILED, not merely seeded. Skipping whenever an `approvals:` block
 * already existed meant an installed sidecar could never be corrected: the first mount wrote
 * the list, anything later edited it, and every re-run — including `--check` — reported the
 * install clean. That is how `*.claude*` survived in a live config while this file was the
 * stated source of truth. Only the deny list is claimed; mode, timeout, and cron_mode stay
 * whatever the operator set.
 */
function ensureApprovals(yaml: string): { yaml: string; changed: boolean } {
  if (/^approvals:/m.test(yaml)) {
    // Line-based, not a regex. A multiline regex spanning a YAML block is one greedy quantifier
    // away from eating the rest of the document, and it did: the first attempt at this deleted
    // 190 lines of a live config. Walk the block instead — it is the same amount of code and it
    // cannot match past the section it is editing.
    const lines = yaml.split("\n");
    const start = lines.findIndex((l) => /^approvals:\s*$/.test(l));
    if (start === -1) return { yaml, changed: false };

    let end = start + 1;
    while (end < lines.length && (lines[end]!.trim() === "" || /^\s/.test(lines[end]!))) end++;

    const denyAt = lines.slice(start + 1, end).findIndex((l) => /^\s{2}deny:\s*$/.test(l));
    if (denyAt === -1) {
      // An `approvals:` block with no `deny:` list at all — the shape a stock or wizard-written
      // config has (`mode`/`timeout` only). Returning "nothing to own" here meant such an install
      // never received the shell deny globs while `--check` reported it current. Add the list at
      // the end of the block; mode/timeout/cron_mode stay the operator's.
      const next = [
        ...lines.slice(0, end),
        "  deny:",
        ...SHELL_DENY_GLOBS.map((g) => `    - ${JSON.stringify(g)}`),
        ...lines.slice(end),
      ].join("\n");
      return { yaml: next, changed: next !== yaml };
    }
    const denyLine = start + 1 + denyAt;

    let after = denyLine + 1;
    while (after < end && /^\s+-\s/.test(lines[after]!)) after++;

    // Compare VALUES, not lines. Hermes round-trips config.yaml through its own YAML
    // dumper on every start and re-quotes these entries ('…' for "…"), which is not
    // drift — comparing the literal lines made every gateway restart read as STALE
    // and every mount flip the quotes back, a loop with no semantic change.
    const existing = lines.slice(denyLine + 1, after).map((l) => yamlScalar(l.replace(/^\s+-\s+/, "")));
    const same = existing.length === SHELL_DENY_GLOBS.length && existing.every((v, i) => v === SHELL_DENY_GLOBS[i]);
    if (same) return { yaml, changed: false };

    const next = [
      ...lines.slice(0, denyLine + 1),
      ...SHELL_DENY_GLOBS.map((g) => `    - ${JSON.stringify(g)}`),
      ...lines.slice(after),
    ].join("\n");
    return { yaml: next, changed: next !== yaml };
  }
  const block = [
    "approvals:",
    "  mode: manual",
    "  timeout: 300",
    "  cron_mode: deny",
    "  deny:",
    ...SHELL_DENY_GLOBS.map((g) => `    - ${JSON.stringify(g)}`),
  ].join("\n");
  return { yaml: `${yaml.replace(/\n*$/, "")}\n\n${MANAGED_BEGIN}\n${block}\n${MANAGED_END}\n`, changed: true };
}

/**
 * Hermes scans every context file with `scan_for_threats(scope="context")` and,
 * on ANY match, silently replaces the whole soul with a [BLOCKED: …]
 * placeholder — per session, with nothing visibly wrong. Doctrine that QUOTES
 * an attack shape ("…ignore previous instructions…") is enough: that exact
 * sentence once cost an install its constitution in most sessions for weeks. So the mount refuses to write a soul the engine
 * would reject, running Hermes' OWN scanner (never a lookalike regex). When the
 * engine tree or python3 is absent the gate skips — there is no scanner to
 * satisfy, and a mount on such an install has nothing to gate.
 */
function assertSoulPassesHermesScanner(soul: string): void {
  const engine = join(HERMES_HOME, "hermes-agent");
  if (!existsSync(join(engine, "tools", "threat_patterns.py"))) return;
  let out: ReturnType<typeof Bun.spawnSync>;
  try {
    out = Bun.spawnSync(
      [
        "python3",
        "-c",
        'import sys\nsys.path.insert(0, sys.argv[1])\nfrom tools.threat_patterns import scan_for_threats\nf = scan_for_threats(sys.stdin.read(), scope="context")\nprint(",".join(f))\nsys.exit(1 if f else 0)',
        engine,
      ],
      { stdin: Buffer.from(soul, "utf8") },
    );
  } catch {
    return; // python3 unavailable — nothing to gate against
  }
  if (out.exitCode === 1) {
    const findings = out.stdout?.toString().trim() ?? "unknown";
    throw new Error(
      `rendered soul matches Hermes' threat scanner (${findings}) — Hermes would BLOCK the entire ` +
        `constitution at every session start. Fix the matching sentence in the soul SOURCE ` +
        `(see HermesSidecar.md § Known behaviour), never by weakening the scanner.`,
    );
  }
}

/**
 * Approval-allowlist keys this install runs unattended work on — ENSURE-PRESENT
 * only: Hermes appends its own entries when the operator answers "always", so
 * the list is merged, never replaced, and operator entries are never removed.
 * "script execution via heredoc" is the capability twin of the already-approved
 * "-e/-c flag" key: cron jobs write their state files via `python3 - <<'PY'`
 * heredocs, and under `cron_mode: deny` every one died unattended. The
 * guard's deny globs and the write sandbox still bound what a script touches.
 */
const COMMAND_ALLOWLIST_ENSURE: readonly string[] = ["script execution via heredoc"];

const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, "").trim();

function ensureCommandAllowlist(yaml: string): { yaml: string; changed: boolean } {
  const lines = yaml.split("\n");
  // Every top-level occurrence, block (`command_allowlist:`) or inline (`command_allowlist: []`, the
  // form a wizard-written or migrated config carries). A config an earlier mount already broke has both.
  const keyAt = lines.flatMap((l, i) => (/^command_allowlist\s*:/.test(l) ? [i] : []));
  if (keyAt.length === 0) {
    const block = ["command_allowlist:", ...COMMAND_ALLOWLIST_ENSURE.map((k) => `  - ${k}`)].join("\n");
    return { yaml: `${yaml.replace(/\n*$/, "")}\n${block}\n`, changed: true };
  }
  const items: string[] = [];
  const spans: Array<[number, number]> = [];
  for (const start of keyAt) {
    const inline = lines[start]!.replace(/^command_allowlist\s*:/, "").trim();
    if (inline) items.push(...inline.replace(/^\[|\]$/g, "").split(",").map(unquote).filter(Boolean));
    let end = start + 1;
    while (end < lines.length && (lines[end]!.trim() === "" || /^\s/.test(lines[end]!))) {
      const v = unquote(lines[end]!.replace(/^\s*-\s*/, ""));
      if (v) items.push(v);
      end++;
    }
    while (end > start + 1 && lines[end - 1]!.trim() === "") end--; // trailing blank lines belong to what follows
    spans.push([start, end]);
  }
  const missing = COMMAND_ALLOWLIST_ENSURE.filter((k) => !items.includes(k));
  const single = keyAt.length === 1 && lines[keyAt[0]!]!.replace(/^command_allowlist\s*:/, "").trim() === "";
  if (single && missing.length === 0) return { yaml, changed: false };
  if (single) {
    const [, end] = spans[0]!;
    return { yaml: [...lines.slice(0, end), ...missing.map((k) => `  - ${k}`), ...lines.slice(end)].join("\n"), changed: true };
  }
  // Inline or duplicated: fold every occurrence into one block at the first key's position.
  const merged = [...new Set([...items, ...missing])];
  const block = ["command_allowlist:", ...merged.map((k) => `  - ${k}`)];
  const out: string[] = [];
  let i = 0;
  for (const [start, end] of spans) {
    out.push(...lines.slice(i, start));
    if (start === spans[0]![0]) out.push(...block);
    i = end;
  }
  out.push(...lines.slice(i));
  return { yaml: out.join("\n"), changed: true };
}

function installPlugin(): Change[] {
  const changes: Change[] = [];
  mkdirSync(PLUGIN_DEST, { recursive: true });

  for (const file of ["__init__.py", "guard.py", "plugin.yaml"]) {
    const src = join(PLUGIN_SRC, file);
    const dest = join(PLUGIN_DEST, file);
    const before = existsSync(dest) ? readFileSync(dest, "utf8") : null;
    copyFileSync(src, dest);
    if (before !== readFileSync(dest, "utf8")) {
      changes.push({ what: `plugins/lifeos/${file}`, detail: before === null ? "installed" : "updated" });
    }
  }

  const policyPath = join(PLUGIN_DEST, "policy.json");
  const beforePolicy = existsSync(policyPath) ? readFileSync(policyPath, "utf8") : null;
  const policy = emitPolicy(policyPath, { launcherName: daName(), trustedEgressDomains: trustedEgressDomains() });
  if (beforePolicy !== readFileSync(policyPath, "utf8")) {
    changes.push({
      what: "plugins/lifeos/policy.json",
      detail: `${policy.denyRules.length} read rules, ${policy.shellDenyGlobs.length} shell globs, ${policy.trustedEgressDomains.length} trusted egress hosts`,
    });
  }
  return changes;
}

/**
 * Operator-trusted egress hosts, read from the USER tree at mount time so the
 * shipped code stays install-generic. Shape: `{"domains": ["example.dev"]}`.
 * Missing or malformed config degrades to the loopback-only defaults.
 */
function trustedEgressDomains(): string[] {
  const path = join(INSTALL_ROOT, "LIFEOS", "USER", "CONFIG", "hermes-trusted-domains.json");
  try {
    if (!existsSync(path)) return [];
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { domains?: unknown };
    if (!Array.isArray(parsed.domains)) return [];
    return parsed.domains.filter((d): d is string => typeof d === "string");
  } catch {
    return [];
  }
}

/**
 * Hermes plugins are opt-in — an installed-but-disabled guard looks present in
 * every listing while enforcing nothing. Enabling is part of installing, never
 * a step left to the operator.
 *
 * Enabling is done HERE, in the config we already own, rather than by shelling out to
 * `hermes plugins enable lifeos`. That command rewrote config.yaml from a stock template:
 * a 236-line install came back as 46 lines of defaults and comments, losing the model and
 * agent blocks, the skills mount, the approvals deny list, and the enabled telegram and
 * photon platforms. Mount ran it AFTER writing its own patched config, so every mount
 * silently discarded everything it had just done and took the chat channels down with it.
 * One writer for this file, and it is this script.
 */
function ensurePluginEnabled(yaml: string): { yaml: string; changed: boolean } {
  const lines = yaml.split("\n");
  const start = lines.findIndex((l) => /^plugins:\s*$/.test(l));
  if (start === -1) {
    return { yaml: `${yaml.replace(/\n*$/, "")}\nplugins:\n  enabled:\n    - lifeos\n`, changed: true };
  }

  let end = start + 1;
  while (end < lines.length && (lines[end]!.trim() === "" || /^\s/.test(lines[end]!))) end++;

  const enabledAt = lines.slice(start + 1, end).findIndex((l) => /^\s{2}enabled:\s*$/.test(l));
  if (enabledAt === -1) {
    return { yaml: [...lines.slice(0, start + 1), "  enabled:", "    - lifeos", ...lines.slice(start + 1)].join("\n"), changed: true };
  }
  const enabledLine = start + 1 + enabledAt;

  let after = enabledLine + 1;
  const entries: string[] = [];
  while (after < end && /^\s+-\s/.test(lines[after]!)) entries.push(lines[after++]!);
  if (entries.some((e) => /^\s+-\s+lifeos\s*$/.test(e))) return { yaml, changed: false };

  const next = [...lines.slice(0, enabledLine + 1), "    - lifeos", ...lines.slice(enabledLine + 1)].join("\n");
  return { yaml: next, changed: true };
}

function main(): void {
  const args = new Set(process.argv.slice(2));
  const check = args.has("--check");
  const keepOutputFormat = args.has("--keep-output-format");

  if (!existsSync(HERMES_HOME)) {
    throw new Error(`no Hermes install at ${scrubPaths(HERMES_HOME)} — install Hermes first`);
  }

  const soul = renderSoul({ keepOutputFormat });
  const soulPath = join(HERMES_HOME, "SOUL.md");
  const soulCurrent = existsSync(soulPath) ? readFileSync(soulPath, "utf8") : "";
  const soulDrifted = soulCurrent !== soul;
  const digest = createHash("sha256").update(soul).digest("hex").slice(0, 12);
  // A SOUL.md this mount did not render (no LifeOS header line) belongs to a
  // Hermes agent that already lives in this HERMES_HOME. Never overwrite it
  // silently: point at a standalone home, or --force to take the profile
  // over. (public issue #1962, @theNetworkChuck)
  const soulMarker = soul.split("\n", 1)[0];
  const soulForeign = soulCurrent.length > 0 && !soulCurrent.startsWith(soulMarker);
  if (soulForeign && !check && !args.has("--force")) {
    throw new Error(
      `${scrubPaths(soulPath)} exists and was not written by LifeOS — another Hermes agent owns this profile. ` +
        `Run with HERMES_HOME=<standalone dir> to mount beside it, or --force to overwrite its SOUL.md.`,
    );
  }

  assertSoulPassesHermesScanner(soul);

  if (soul.length > CONTEXT_FILE_MAX_CHARS) {
    throw new Error(
      `soul is ${soul.length} chars, over the configured cap of ${CONTEXT_FILE_MAX_CHARS} — ` +
        `raise CONTEXT_FILE_MAX_CHARS or tighten a section budget. Hermes truncates silently.`,
    );
  }

  const configPath = join(HERMES_HOME, "config.yaml");
  let yaml = readFileSync(configPath, "utf8");
  const yamlBefore = yaml;

  ({ yaml } = setTopLevelKey(yaml, "context_file_max_chars", String(CONTEXT_FILE_MAX_CHARS)));
  ({ yaml } = setSkillsExternalDirs(yaml, [join(INSTALL_ROOT, "skills")]));
  ({ yaml } = ensureApprovals(yaml));
  ({ yaml } = ensureCommandAllowlist(yaml));
  ({ yaml } = ensurePluginEnabled(yaml));
  const configDrifted = yaml !== yamlBefore;

  if (check) {
    console.log(`soul       ${soul.length} chars, digest ${digest}`);
    console.log(`           ${soulForeign ? "FOREIGN — another agent's SOUL.md; set HERMES_HOME or use --force" : soulDrifted ? "STALE — re-run Mount.ts" : "current"}`);
    console.log(`config     ${configDrifted ? "STALE — re-run Mount.ts" : "current"}`);
    process.exit(soulDrifted || configDrifted ? 1 : 0);
  }

  writeFileSync(soulPath, soul, "utf8");
  if (configDrifted) writeFileSync(configPath, yaml, "utf8");
  const pluginChanges = [...installPlugin()];

  mkdirSync(WORKSPACE, { recursive: true });
  const envPath = join(HERMES_HOME, ".env");
  const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  if (!/^HERMES_WRITE_SAFE_ROOT=/m.test(env)) {
    writeFileSync(
      envPath,
      `${env.replace(/\n*$/, "")}\n\n# Writes are hard-blocked outside these roots. The LifeOS tree is\n` +
        `# READ-only to the sidecar; persistence goes through the memory API.\n` +
        `HERMES_WRITE_SAFE_ROOT=${WORKSPACE}:${HERMES_HOME}\n`,
      "utf8",
    );
    pluginChanges.push({ what: ".env", detail: "write-sandbox root set" });
  }

  console.log(`✓ SOUL.md            ${soul.length} chars (cap ${CONTEXT_FILE_MAX_CHARS}), digest ${digest}`);
  console.log(`✓ skills mounted     ${scrubPaths(join(INSTALL_ROOT, "skills"))} (${skillIndex().length} indexed in soul — the default routing path)`);
  console.log(`✓ config.yaml        ${configDrifted ? "patched" : "already current"}`);
  for (const c of pluginChanges) console.log(`✓ ${c.what.padEnd(18)} ${c.detail}`);
  if (!pluginChanges.length) console.log("✓ plugin             already current");
}

main();
