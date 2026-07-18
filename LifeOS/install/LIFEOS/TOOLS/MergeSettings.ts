#!/usr/bin/env bun

/**
 * Deep-merges a system settings JSON value with a user overlay.
 * Objects merge recursively while preserving system key order.
 * New user-only object keys are appended after system keys at each level.
 * Scalars and arrays replace by default, with user values winning conflicts.
 * Arrays can opt into append via { "__merge": "append", "values": [...] }.
 * Merge annotations are consumed and never emitted in the output.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { claudeDir } from "./lifeos-root";

/**
 * Snapshot of the last merge output, written alongside every successful
 * --output run. SettingsBackport diffs the live settings.json against THIS
 * (three-way base), not against a freshly computed merge — so source-file
 * edits that haven't been merged yet never read as "drift" and never get
 * clobbered back into the overlay (the 2026-07-11 hooks-BPE incident).
 */
export const MERGE_SNAPSHOT_PATH = path.join(claudeDir(),
  "LIFEOS",
  "MEMORY",
  "STATE",
  "settings-merge-snapshot.json",
);

type CliMode =
  | { kind: "output"; path: string }
  | { kind: "check"; path: string };

type CliOptions = {
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

function hasInvalidMergeAnnotation(value: any): boolean {
  return isObjectRecord(value) && hasOwnKey(value, "__merge") && !isAppendAnnotation(value);
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
    return [...cloneJsonValue(systemValue), ...cloneJsonValue(userValue.values)];
  }

  throw new Error(
    '__merge: "append" requires the system value to be an array or absent',
  );
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
        merged[key] = mergeSettings(system[key], user[key]);
      } else {
        merged[key] = cloneJsonValue(system[key]);
      }
    }

    for (const key of Object.keys(user)) {
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
  "TaskCreate", "TaskGet", "TaskList", "TaskOutput", "TaskStop", "TaskUpdate",
  "CronCreate", "CronDelete", "CronList", "TeamCreate", "TeamDelete",
]);

const PERMISSION_ARRAYS = ["allow", "ask", "deny"] as const;

export type DroppedRule = { array: string; rule: string; reason: string };

/**
 * Returns null when the rule is valid, or a human reason when the harness would
 * reject it. Two rejection classes, matching the harness validator:
 *   1. mcp wildcard not in tool position — `mcp__*` is illegal; a glob is only
 *      allowed AFTER a literal `mcp__<server>__` prefix.
 *   2. Non-mcp rule naming a tool not in KNOWN_TOOL_NAMES (e.g. MultiEdit).
 */
export function permissionRuleRejectionReason(rule: string): string | null {
  if (typeof rule !== "string" || rule.length === 0) {
    return "rule is not a non-empty string";
  }

  if (rule.startsWith("mcp__")) {
    const parts = rule.split("__");
    // Valid shape: mcp__<server>__<tool-or-glob> => at least 3 parts, server
    // segment non-empty and not itself a wildcard.
    if (parts.length < 3 || parts[1].length === 0 || parts[1].includes("*")) {
      return `mcp wildcard "${rule}" is not in tool position — globs are only allowed after a literal mcp__<server>__ prefix`;
    }
    return null;
  }

  const toolName = rule.includes("(") ? rule.slice(0, rule.indexOf("(")) : rule;
  if (!KNOWN_TOOL_NAMES.has(toolName)) {
    return `tool "${toolName}" matches no known tool`;
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

async function runCli(argv: string[]): Promise<number> {
  let options: CliOptions;

  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${formatErrorMessage(error)}\n`);
    return 2;
  }

  // Fresh-install guard (audit 20260702 F-001): the SessionStart maintenance hook
  // invokes this with a system+user settings layer a fresh skill-only install has not
  // established yet. If either input is absent there is nothing to merge — no-op
  // cleanly (exit 0) instead of throwing on the missing input file.
  if (!existsSync(options.systemPath) || !existsSync(options.userPath)) {
    process.stdout.write("MergeSettings: input(s) absent (system/user settings layer not established) — nothing to merge\n");
    return 0;
  }

  try {
    const system = await parseJsonFileOrThrow(options.systemPath);
    const user = await parseJsonFileOrThrow(options.userPath);
    const merged = mergeSettings(system, user);

    // The harness exports env values verbatim — expand leading $HOME/${HOME}/~ so
    // LIFEOS_DIR et al. resolve to real paths on a fresh install (#1404 / #1422).
    expandEnvHomeReferences(merged, process.env.HOME || "");

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
      try {
        await writeFile(options.mode.path, outputJson, "utf8");
      } catch (error) {
        throw new Error(
          `Failed to write merged settings to ${options.mode.path}: ${formatErrorMessage(error)}`,
        );
      }

      // Record the merge base for SettingsBackport's three-way diff.
      // Best-effort: a failed snapshot write must never fail the merge itself
      // (backport skips safely when the snapshot is missing/stale).
      try {
        await writeFile(MERGE_SNAPSHOT_PATH, outputJson, "utf8");
      } catch {
        process.stderr.write(`⚠️  could not write merge snapshot to ${MERGE_SNAPSHOT_PATH}\n`);
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
