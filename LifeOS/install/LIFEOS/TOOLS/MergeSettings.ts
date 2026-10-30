#!/usr/bin/env bun

/**
 * @version 1.3.16
 * Deep-merges a system settings JSON value with a user overlay.
 * Objects merge recursively while preserving system key order.
 * New user-only object keys are appended after system keys at each level.
 * Scalars and arrays replace by default, with user values winning conflicts.
 * Arrays can opt into append via { "__merge": "append", "values": [...] }.
 * Any key can be dropped from the output via { "__merge": "remove" } in the overlay.
 * Merge annotations are consumed and never emitted in the output.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { atomicWriteText } from "../PULSE/lib/atomic-write";
import { homedir } from "node:os";
import { getClaudeDir, lifeosPath } from "./Paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord

/**
 * Snapshot of the last merge output, written alongside every successful
 * --output run. SettingsBackport diffs the live settings.json against THIS
 * (three-way base), not against a freshly computed merge — so source-file
 * edits that haven't been merged yet never read as "drift" and never get
 * clobbered back into the overlay (the 2026-07-11 hooks-BLE incident).
 */
export const MERGE_SNAPSHOT_PATH = lifeosPath("MEMORY", "STATE", "settings-merge-snapshot.json");

type CliMode =
  | { kind: "output"; path: string }
  | { kind: "check"; path: string };

export type CliOptions = {
  systemPath: string;
  userPath: string;
  mode: CliMode;
};

type Difference = {
  path: string;
  expected: any;
  actual: any;
};

type AppendAnnotation = {
  __merge: "append";
  values: any[];
};

function isObjectRecord(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwnKey(value: Record<string, any>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function isAppendAnnotation(value: any): value is AppendAnnotation {
  return (
    isObjectRecord(value) &&
    value.__merge === "append" &&
    Array.isArray(value.values)
  );
}

/** `{ "__merge": "remove" }` in the overlay drops the key from the output, the system layer's value included. */
export function isRemoveAnnotation(value: any): boolean {
  return isObjectRecord(value) && value.__merge === "remove" && Object.keys(value).length === 1;
}

function hasInvalidMergeAnnotation(value: any): boolean {
  return isObjectRecord(value) && hasOwnKey(value, "__merge") && !isAppendAnnotation(value) && !isRemoveAnnotation(value);
}

function cloneJsonValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  if (isObjectRecord(value)) {
    const clone: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      clone[key] = cloneJsonValue(value[key]);
    }
    return clone;
  }

  return value;
}

export function applyArrayMerge(systemValue: any, userValue: AppendAnnotation): any[] {
  if (systemValue === undefined) {
    return cloneJsonValue(userValue.values);
  }

  if (Array.isArray(systemValue)) {
    // An appended value the system layer already carries adds nothing; keep only the first copy.
    const seen = new Set(systemValue.map((item) => JSON.stringify(item)));
    const added = userValue.values.filter((item) => {
      const key = JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [...cloneJsonValue(systemValue), ...cloneJsonValue(added)];
  }

  throw new Error(
    '__merge: "append" requires the system value to be an array or absent',
  );
}

/**
 * Permission-array overlay guard (public issue #1527, @vichong).
 *
 * Arrays replace wholesale by design, but a scaffolded overlay carrying a literal
 * empty array — `"deny": []` — silently erased the entire system denylist, turning
 * the security layer off from install day with no signal. For the three permission
 * arrays only: an EMPTY user array is treated as "no opinion" (system list kept),
 * and a merge that nets fewer deny rules than the system half ships warns loudly.
 * Non-empty user arrays keep the documented replace semantics untouched.
 */
export function guardPermissionOverlays(system: any, user: any, merged: any): string[] {
  const warnings: string[] = [];
  const systemPerms = system?.permissions;
  const userPerms = user?.permissions;
  const mergedPerms = merged?.permissions;
  if (!isObjectRecord(systemPerms) || !isObjectRecord(mergedPerms)) return warnings;

  for (const arrayName of PERMISSION_ARRAYS) {
    const systemArr = systemPerms[arrayName];
    if (!Array.isArray(systemArr) || systemArr.length === 0) continue;
    const userArr = isObjectRecord(userPerms) ? userPerms[arrayName] : undefined;
    if (Array.isArray(userArr) && userArr.length === 0) {
      mergedPerms[arrayName] = cloneJsonValue(systemArr);
      warnings.push(
        `permissions.${arrayName}: user overlay is an empty array — treated as no-opinion, kept the ${systemArr.length} system rule(s). To append instead, use { "__merge": "append", "values": [...] }.`,
      );
    }
  }

  const mergedDeny = mergedPerms.deny;
  const systemDeny = systemPerms.deny;
  if (Array.isArray(systemDeny) && Array.isArray(mergedDeny) && mergedDeny.length < systemDeny.length) {
    warnings.push(
      `permissions.deny: merged output has ${mergedDeny.length} rule(s), fewer than the ${systemDeny.length} the system layer ships — the user overlay is removing deny rules. Verify this is intentional.`,
    );
  }

  return warnings;
}

/**
 * Keys the INSTALLER writes straight into the merged settings.json (InstallHooks, the statusline
 * and spinner deployers) rather than into either source layer. The shipped settings.system.json
 * omits them on purpose, so a regeneration from system ⊕ user must carry them forward from the
 * existing output or the first SessionStart after the user creates an overlay silently removes
 * every hook (in-family audit, round 15, 7.52.0 cut). A layer that DOES define the key wins.
 */
export const INSTALLER_OWNED_KEYS = ["hooks", "statusLine", "spinnerVerbs", "spinnerTipsOverride"] as const;

/** system ⊕ user, plus the installer-owned keys of `existing` that neither layer defines. */
export function mergeSettingsPreserving(system: any, user: any, existing: any): any {
  const merged = mergeSettings(system, user);
  if (existing && typeof existing === "object") {
    for (const k of INSTALLER_OWNED_KEYS) {
      const inLayer = (system && typeof system === "object" && k in system) || (user && typeof user === "object" && k in user);
      if (!inLayer && k in existing) merged[k] = existing[k];
    }
  }
  return merged;
}

export function mergeSettings(system: any, user: any): any {
  if (isAppendAnnotation(user)) {
    return applyArrayMerge(system, user);
  }

  if (hasInvalidMergeAnnotation(user)) {
    throw new Error(
      '__merge annotations must use { "__merge": "append", "values": [...] }',
    );
  }

  if (isObjectRecord(system) && isObjectRecord(user)) {
    const merged: Record<string, any> = {};

    for (const key of Object.keys(system)) {
      if (hasOwnKey(user, key)) {
        if (isRemoveAnnotation(user[key])) continue;
        merged[key] = mergeSettings(system[key], user[key]);
      } else {
        merged[key] = cloneJsonValue(system[key]);
      }
    }

    for (const key of Object.keys(user)) {
      if (isRemoveAnnotation(user[key])) continue;
      if (!hasOwnKey(system, key)) {
        merged[key] = mergeSettings(undefined, user[key]);
      }
    }

    return merged;
  }

  return cloneJsonValue(user);
}

/**
 * Expand a LEADING $HOME / ${HOME} / ~ token in a string to the real home dir.
 * Only the prefix is expanded, and only when the token is a whole path segment
 * ($HOMEFOO is left untouched). Returns the string unchanged if no match.
 */
function expandLeadingHome(value: string, home: string): string {
  if (value === "${HOME}") return home;
  if (value.startsWith("${HOME}/")) return home + value.slice("${HOME}".length);
  if (value === "$HOME") return home;
  if (value.startsWith("$HOME/")) return home + value.slice("$HOME".length);
  if (value === "~") return home;
  if (value.startsWith("~/")) return home + value.slice(1);
  return value;
}

/**
 * Expand leading $HOME/${HOME}/~ references in settings `env` values to the real
 * home directory, in place. The Claude Code harness sets `env` values verbatim —
 * it does NOT expand shell variables — so a shipped value like
 * "$HOME/.claude/LIFEOS" would be exported literally, making LIFEOS_DIR resolve
 * to the string "$HOME/…" and breaking every downstream path (worst on fresh
 * installs and Linux). Issues #1404 / #1422.
 */
export function expandEnvHomeReferences(settings: any, home: string): void {
  const env = settings?.env;
  if (!isObjectRecord(env) || !home) return;
  for (const key of Object.keys(env)) {
    const value = env[key];
    if (typeof value === "string") {
      env[key] = expandLeadingHome(value, home);
    }
  }
}

/**
 * Tool names the Claude Code harness accepts in permission rules.
 * Source: core tools always present + the deferred-tool registry surfaced via
 * ToolSearch. When the harness adds or removes a tool, update this set — a rule
 * naming a tool not in here is pruned at merge time (the harness rejects it
 * anyway with "matches no known tool"). MultiEdit was removed from the harness;
 * its absence here is deliberate and is what prunes the dead MultiEdit(...) rules.
 */
export const KNOWN_TOOL_NAMES: ReadonlySet<string> = new Set([
  "Read", "Glob", "Grep", "LS", "WebFetch", "WebSearch", "NotebookRead",
  "NotebookEdit", "TodoWrite", "Edit", "Write", "Bash", "BashOutput", "KillShell",
  "Task", "Skill", "SlashCommand", "AskUserQuestion", "Agent", "ToolSearch",
  "EnterPlanMode", "ExitPlanMode", "EnterWorktree", "ExitWorktree", "LSP",
  "Monitor", "RemoteTrigger", "PushNotification", "SendMessage",
  "ListMcpResourcesTool", "ReadMcpResourceTool",
  "TaskCreate", "TaskGet", "TaskList", "TaskStop", "TaskUpdate",
  "CronCreate", "CronDelete", "CronList", "TeamCreate", "TeamDelete",
]);

const PERMISSION_ARRAYS = ["allow", "ask", "deny"] as const;

export type DroppedRule = { array: string; rule: string; reason: string };

/**
 * File-editing tools whose PATH rules the harness never matches. File permission
 * checks resolve against `Edit(path)` ONLY, and Edit covers every file-editing
 * tool — so `Write(/etc/**)` is dead weight next to `Edit(/etc/**)`, and dead
 * weight the CLI complains about at startup.
 *
 * Verified live, not counted: with only `Edit(~/.claude/projects/**\/memory/**)`
 * present and no Write twin, the Write tool was DENIED there; with no Write allow
 * rule present, Write to `~/.claude/` was ALLOWED (commit b68b1a5c4, 2026-07-26).
 *
 * This has been "fixed" the wrong way three times — 2026-07-16 (dropped), 07-25
 * (restored on a config-shape count), 07-27 (restored again) — each time from an
 * audit that read the settings file and saw an Edit rule without a Write twin.
 * The count is not evidence; the probe is. Pruning here is what makes the wrong
 * fix harmless no matter which source layer it lands in.
 */
const INERT_FILE_RULE_TOOLS = new Set(["Write", "MultiEdit"]);

/**
 * Returns null when the rule is valid, or a human reason when the harness would
 * reject or silently ignore it. Three rejection classes:
 *   1. mcp wildcard not in tool position — `mcp__*` is illegal; a glob is only
 *      allowed AFTER a literal `mcp__<server>__` prefix.
 *   2. Non-mcp rule naming a tool not in KNOWN_TOOL_NAMES (e.g. MultiEdit).
 *   3. `Write(path)` / `MultiEdit(path)` — a real tool, but file permissions
 *      match Edit(path) only, so the rule is inert (see INERT_FILE_RULE_TOOLS).
 *      Bare `Write` with no specifier is untouched: that is a tool-level rule
 *      and the harness does honor it.
 */
export function permissionRuleRejectionReason(rule: string): string | null {
  if (typeof rule !== "string" || rule.length === 0) {
    return "rule is not a non-empty string";
  }

  if (rule.startsWith("mcp__")) {
    const parts = rule.split("__");
    // Valid shapes: mcp__<server> (every tool from that server, per the Claude
    // Code permissions docs) or mcp__<server>__<tool-or-glob>. Either way the
    // server segment must be non-empty and not itself a wildcard.
    if (parts[1].length === 0 || parts[1].includes("*")) {
      return `mcp wildcard "${rule}" is not in tool position — globs are only allowed after a literal mcp__<server>__ prefix`;
    }
    return null;
  }

  const hasSpecifier = rule.includes("(");
  const toolName = hasSpecifier ? rule.slice(0, rule.indexOf("(")) : rule;
  if (!KNOWN_TOOL_NAMES.has(toolName)) {
    return `tool "${toolName}" matches no known tool`;
  }
  if (hasSpecifier && INERT_FILE_RULE_TOOLS.has(toolName)) {
    const path = rule.slice(rule.indexOf("(") + 1, rule.lastIndexOf(")"));
    return `${toolName}(...) path rules are inert — file permissions match Edit(...) only, and Edit covers every file-editing tool (live probe, commit b68b1a5c4). Use Edit(${path}); do not "restore" a Write twin.`;
  }
  return null;
}

/**
 * Removes permission rules the harness would reject from a merged settings
 * object (mutating a clone is the caller's job — this mutates in place on the
 * passed object's permission arrays). Returns the list of dropped rules so the
 * caller can warn loudly. The merged file the harness reads is thereby always
 * free of invalid permission rules, making the "Invalid settings" startup error
 * structurally impossible regardless of what the source files contain.
 */
export function prunePermissionRules(settings: any): DroppedRule[] {
  const dropped: DroppedRule[] = [];
  const permissions = settings?.permissions;
  if (!isObjectRecord(permissions)) {
    return dropped;
  }

  for (const arrayName of PERMISSION_ARRAYS) {
    const rules = permissions[arrayName];
    if (!Array.isArray(rules)) {
      continue;
    }
    permissions[arrayName] = rules.filter((rule: any) => {
      const reason = permissionRuleRejectionReason(rule);
      if (reason !== null) {
        dropped.push({ array: arrayName, rule: String(rule), reason });
        return false;
      }
      return true;
    });
  }

  return dropped;
}

export async function parseJsonFileOrThrow(filePath: string): Promise<any> {
  let contents: string;

  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to read JSON file ${filePath}: ${formatErrorMessage(error)}`,
    );
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON file ${filePath}: ${formatErrorMessage(error)}`,
    );
  }
}

export function deepEqual(left: any, right: any): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }

    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!deepEqual(left[index], right[index])) {
        return false;
      }
    }

    return true;
  }

  if (isObjectRecord(left) || isObjectRecord(right)) {
    if (!isObjectRecord(left) || !isObjectRecord(right)) {
      return false;
    }

    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    for (const key of leftKeys) {
      if (!hasOwnKey(right, key) || !deepEqual(left[key], right[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function collectDifferences(expected: any, actual: any, currentPath = "$"): Difference[] {
  if (deepEqual(expected, actual)) {
    return [];
  }

  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      return [{ path: currentPath, expected, actual }];
    }

    const differences: Difference[] = [];
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      const itemPath = `${currentPath}[${index}]`;
      if (index >= expected.length) {
        differences.push({ path: itemPath, expected: undefined, actual: actual[index] });
      } else if (index >= actual.length) {
        differences.push({ path: itemPath, expected: expected[index], actual: undefined });
      } else {
        differences.push(...collectDifferences(expected[index], actual[index], itemPath));
      }
    }
    return differences;
  }

  if (isObjectRecord(expected) || isObjectRecord(actual)) {
    if (!isObjectRecord(expected) || !isObjectRecord(actual)) {
      return [{ path: currentPath, expected, actual }];
    }

    const differences: Difference[] = [];
    for (const key of Object.keys(expected)) {
      const keyPath = `${currentPath}.${key}`;
      if (!hasOwnKey(actual, key)) {
        differences.push({ path: keyPath, expected: expected[key], actual: undefined });
      } else {
        differences.push(...collectDifferences(expected[key], actual[key], keyPath));
      }
    }

    for (const key of Object.keys(actual)) {
      if (!hasOwnKey(expected, key)) {
        differences.push({ path: `${currentPath}.${key}`, expected: undefined, actual: actual[key] });
      }
    }

    return differences;
  }

  return [{ path: currentPath, expected, actual }];
}

function validateRoundTripOrThrow(value: any): string {
  let serialized: string;

  try {
    serialized = JSON.stringify(value, null, 2);
  } catch (error) {
    throw new Error(`Failed to stringify merged output: ${formatErrorMessage(error)}`);
  }

  try {
    JSON.parse(JSON.stringify(value));
  } catch (error) {
    throw new Error(`Merged output failed JSON round-trip validation: ${formatErrorMessage(error)}`);
  }

  return `${serialized}\n`;
}

function formatDifferenceValue(value: any): string {
  if (value === undefined) {
    return "<missing>";
  }

  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    return String(value);
  }

  return serialized;
}

function formatDifferences(differences: Difference[]): string {
  return differences
    .map(
      (difference) =>
        `${difference.path}: expected ${formatDifferenceValue(difference.expected)}, actual ${formatDifferenceValue(difference.actual)}`,
    )
    .join("\n");
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function usage(): string {
  return [
    "Usage:",
    "  bun MergeSettings.ts --system SYSTEM --user USER --output OUTPUT",
    "  bun MergeSettings.ts --system SYSTEM --user USER --check EXISTING",
  ].join("\n");
}

function parseArgs(argv: string[]): CliOptions {
  let systemPath: string | undefined;
  let userPath: string | undefined;
  let outputPath: string | undefined;
  let checkPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === "--system") {
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for --system\n${usage()}`);
      }
      systemPath = value;
      index += 1;
    } else if (flag === "--user") {
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for --user\n${usage()}`);
      }
      userPath = value;
      index += 1;
    } else if (flag === "--output") {
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for --output\n${usage()}`);
      }
      outputPath = value;
      index += 1;
    } else if (flag === "--check") {
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for --check\n${usage()}`);
      }
      checkPath = value;
      index += 1;
    } else {
      throw new Error(`Unknown flag: ${flag}\n${usage()}`);
    }
  }

  if (systemPath === undefined) {
    throw new Error(`Missing required --system flag\n${usage()}`);
  }

  if (userPath === undefined) {
    throw new Error(`Missing required --user flag\n${usage()}`);
  }

  if (outputPath !== undefined && checkPath !== undefined) {
    throw new Error(`Use exactly one of --output or --check\n${usage()}`);
  }

  if (outputPath === undefined && checkPath === undefined) {
    throw new Error(`Missing required --output or --check flag\n${usage()}`);
  }

  return {
    systemPath,
    userPath,
    mode:
      outputPath !== undefined
        ? { kind: "output", path: outputPath }
        : { kind: "check", path: checkPath! }, // checkPath is defined here: lines above throw if both output+check are undefined
  };
}

function countObjectKeys(value: any): number {
  if (isObjectRecord(value)) {
    return Object.keys(value).length;
  }

  return 0;
}

/**
 * Before an --output run overwrites the live settings.json, run SettingsBackport so any edit made
 * to the generated file since the last merge lands in the user overlay first. Applies only when
 * the run targets the config root's own three files (the ones SettingsBackport reads); a merge
 * aimed at a scratch path or test layers is left alone. Returns a refusal message when the
 * backport fails, so the write never happens with an edit still unrecorded.
 */
export function backportBeforeOverwrite(options: CliOptions): string | null {
  if (options.mode.kind !== "output") return null;
  const root = getClaudeDir();
  const own =
    path.resolve(options.mode.path) === path.resolve(root, "settings.json") &&
    path.resolve(options.systemPath) === path.resolve(root, "settings.system.json") &&
    path.resolve(options.userPath) === path.resolve(root, "LIFEOS", "USER", "CONFIG", "settings.user.json");
  if (!own || !existsSync(options.mode.path) || !existsSync(MERGE_SNAPSHOT_PATH)) return null;
  const res = Bun.spawnSync(["bun", path.join(import.meta.dir, "SettingsBackport.ts")], { stdout: "pipe", stderr: "pipe" });
  if (res.exitCode === 0) return null;
  const why = `${res.stderr.toString()}${res.stdout.toString()}`.trim().split("\n").slice(-3).join(" | ");
  return `refusing to overwrite ${options.mode.path}: backporting its hand edits failed (exit ${res.exitCode}${why ? `: ${why}` : ""}). Run bun LIFEOS/TOOLS/SettingsBackport.ts --dry-run to see the drift.`;
}

async function runCli(argv: string[]): Promise<number> {
  let options: CliOptions;

  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${formatErrorMessage(error)}\n`);
    return 2;
  }

  // Root-overlay footgun (public issue #1575, @dactylmedia): a user overlay at
  // <configRoot>/settings.user.json is a natural-but-wrong guess (both
  // settings.system.json and the generated settings.json live at the root),
  // and the merge reads only the canonical --user path — so a root-level copy
  // is silently inert. On one install an entire overlay (deny rules, hooks)
  // sat dead for days. Warn loudly whenever a root-level copy exists that is
  // not the canonical file. This runs BEFORE the fresh-install no-op guard:
  // canonical-absent + root-stray-present is exactly the footgun case.
  const rootStray = path.join(getClaudeDir(), "settings.user.json");
  if (existsSync(rootStray) && path.resolve(rootStray) !== path.resolve(options.userPath)) {
    process.stderr.write(
      `⚠️  MergeSettings: ${rootStray} exists but is NOT read by the merge.\n` +
      `   The user overlay is read ONLY from the canonical path passed via --user\n` +
      `   (${options.userPath}).\n` +
      `   Move your overlay there, or its rules/hooks will never take effect.\n`,
    );
  }

  // Fresh-install guard (audit 20260702 F-001): the SessionStart maintenance hook
  // invokes this with a system+user settings layer a fresh skill-only install has not
  // established yet. If either input is absent there is nothing to merge — no-op
  // cleanly (exit 0) instead of throwing on the missing input file.
  // The no-op is for generation only. --check is a verification: with an input absent
  // nothing was compared, so it exits non-zero and says so (S093: it used to pass).
  if (!existsSync(options.systemPath) || !existsSync(options.userPath)) {
    if (options.mode.kind === "check") {
      const missing = [options.systemPath, options.userPath].filter((p) => !existsSync(p));
      process.stderr.write(`MergeSettings: cannot check ${path.resolve(options.mode.path)}: input layer absent (${missing.join(", ")}) — nothing was compared\n`);
      return 1;
    }
    process.stdout.write("MergeSettings: input(s) absent (system/user settings layer not established) — nothing to merge\n");
    return 0;
  }

  try {
    // Regenerating the live settings.json first folds any hand edit made since the last merge
    // into the user overlay, whoever triggers the run, so the overwrite can never lose it.
    // Before this only SessionStart ran the backport, and a mid-session regeneration dropped
    // hooks added to settings.json alone (Moshi's removal on 09-28, a StopFailure hook 10-15).
    const backportRefusal = backportBeforeOverwrite(options);
    if (backportRefusal) {
      process.stderr.write(`MergeSettings: ${backportRefusal}\n`);
      return 1;
    }
    const system = await parseJsonFileOrThrow(options.systemPath);
    const user = await parseJsonFileOrThrow(options.userPath);
    // Both modes carry the installer-owned keys forward from the file at mode.path: --check
    // verifies what --output would write to that same file, so it must preserve them too.
    let existingOutput: unknown = null;
    if (existsSync(options.mode.path)) {
      try { existingOutput = await parseJsonFileOrThrow(options.mode.path); } catch { existingOutput = null; }
    }
    const merged = mergeSettingsPreserving(system, user, existingOutput);

    const permWarnings = guardPermissionOverlays(system, user, merged);
    for (const warning of permWarnings) {
      process.stderr.write(`⚠️  MergeSettings: ${warning}\n`);
    }

    // The harness exports env values verbatim — expand leading $HOME/${HOME}/~ so
    // LIFEOS_DIR et al. resolve to real paths on a fresh install (#1404 / #1422).
    expandEnvHomeReferences(merged, homedir());

    const dropped = prunePermissionRules(merged);
    if (dropped.length > 0) {
      process.stderr.write(
        `⚠️  MergeSettings pruned ${dropped.length} invalid permission rule(s) the harness would reject:\n`,
      );
      for (const item of dropped) {
        process.stderr.write(`   - permissions.${item.array}: ${item.rule}  (${item.reason})\n`);
      }
      process.stderr.write(
        `   Fix these at the SOURCE (settings.system.json / settings.user.json) so the warning clears.\n`,
      );
    }

    const outputJson = validateRoundTripOrThrow(merged);

    if (options.mode.kind === "output") {
      // Atomic: this runs at SessionStart under a 15s hook timeout, so a kill
      // mid-write must not leave settings.json truncated — that drops every
      // hook, permission rule and env var on the next launch.
      // public PR #1643, @elhoim
      try {
        atomicWriteText(options.mode.path, outputJson);
      } catch (error) {
        throw new Error(
          `Failed to write merged settings to ${options.mode.path}: ${formatErrorMessage(error)}`,
        );
      }

      // Record the merge base for SettingsBackport's three-way diff.
      // Best-effort: a failed snapshot write must never fail the merge itself
      // (backport skips safely when the snapshot is missing/stale).
      // Only when the output IS the config root's settings.json: a merge aimed at a scratch path
      // (a release-gate probe, a dry run) must not plant a snapshot anywhere, least of all inside
      // a payload under test (in-family audit, round 16, 7.52.0 cut).
      if (path.resolve(options.mode.path) === path.resolve(getClaudeDir(), "settings.json")) {
        try {
          atomicWriteText(MERGE_SNAPSHOT_PATH, outputJson);
        } catch {
          process.stderr.write(`⚠️  could not write merge snapshot to ${MERGE_SNAPSHOT_PATH}\n`);
        }
      }

      process.stdout.write(
        `Merged ${countObjectKeys(system)} system keys + ${countObjectKeys(user)} user overlays into ${path.resolve(options.mode.path)}\n`,
      );
      return 0;
    }

    const existing = await parseJsonFileOrThrow(options.mode.path);
    if (deepEqual(merged, existing)) {
      process.stdout.write(`no differences: ${path.resolve(options.mode.path)}\n`);
      return 0;
    }

    const differences = collectDifferences(merged, existing);
    process.stdout.write(`${formatDifferences(differences)}\n`);
    return 1;
  } catch (error) {
    process.stderr.write(`${formatErrorMessage(error)}\n`);
    return 1;
  }
}

if (import.meta.main) {
  const exitCode = await runCli(Bun.argv.slice(2));
  process.exit(exitCode);
}
