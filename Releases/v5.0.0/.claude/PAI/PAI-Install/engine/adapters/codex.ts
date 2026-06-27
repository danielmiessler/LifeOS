import { copyFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type {
  AdapterInstallInput,
  AdapterInstallResult,
  AdapterValidateInput,
  AdapterValidationResult,
  HarnessAdapter,
} from "./contract";
import { rewriteCodexPaths } from "./codex-rewrite";
import { writeAdapterManifest, type InstalledAdapterManifest } from "./manifest";
import { resolveHarnessPaths, type ResolvedHarnessPaths } from "./paths";
import { prepareAdapterInstall, validateAdapterState } from "./state";

const PAI_AGENTS_START = "<!-- PAI managed instructions: start -->";
const PAI_AGENTS_END = "<!-- PAI managed instructions: end -->";
const PAI_STARTUP_SENTINEL = "ALGORITHM/LATEST";

function hasPaiStartupInstructions(content: string): boolean {
  return /Personal AI Infrastructure|#\s*PAI\b/i.test(content) &&
    content.includes(PAI_STARTUP_SENTINEL);
}

function hasClaudePaiPaths(content: string): boolean {
  return /(?:~|\$HOME|\$\{HOME\})\/\.claude\/PAI/.test(content);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeTopLevelTomlKey(content: string, key: string): string {
  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
  let insideTable = false;
  return content
    .split(/\r?\n/)
    .filter((line) => {
      if (/^\s*\[/.test(line)) insideTable = true;
      return insideTable || !keyPattern.test(line);
    })
    .join("\n");
}

function upsertTomlTableBoolean(content: string, table: string, key: string, value: boolean): string {
  const line = `${key} = ${value ? "true" : "false"}`;
  const tablePattern = new RegExp(`^\\s*\\[${escapeRegExp(table)}\\]\\s*$`);
  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
  const lines = content.split(/\r?\n/);
  const tableIndex = lines.findIndex((current) => tablePattern.test(current));

  if (tableIndex === -1) {
    const trimmed = content.trimEnd();
    return trimmed ? `${trimmed}\n\n[${table}]\n${line}\n` : `[${table}]\n${line}\n`;
  }

  let endIndex = lines.length;
  for (let i = tableIndex + 1; i < lines.length; i++) {
    if (/^\s*\[/.test(lines[i])) {
      endIndex = i;
      break;
    }
    if (keyPattern.test(lines[i])) {
      lines[i] = line;
      return `${lines.join("\n").trimEnd()}\n`;
    }
  }

  lines.splice(endIndex, 0, line);
  return `${lines.join("\n").trimEnd()}\n`;
}

function ensureCodexConfig(paths: ResolvedHarnessPaths): void {
  const configPath = join(paths.harnessHome, "config.toml");
  const existing = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "";
  let next = removeTopLevelTomlKey(existing, "PAI_DIR");
  next = upsertTomlTableBoolean(next, "features", "hooks", true);
  writeFileSync(configPath, next, "utf-8");
}

function homeRelativePath(paths: ResolvedHarnessPaths, absolutePath: string): string {
  return absolutePath.startsWith(`${paths.homeDir}/`)
    ? absolutePath.replace(paths.homeDir, "${HOME}")
    : absolutePath;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function replaceListItems(value: unknown, replacements: Array<[RegExp, string]>): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (typeof item !== "string") return item;
    return replacements.reduce((next, [pattern, replacement]) => next.replace(pattern, replacement), item);
  });
}

function normalizeCodexPaiSettings(settings: Record<string, unknown>, paths: ResolvedHarnessPaths): Record<string, unknown> {
  // Codex does not read Claude's settings schema. In Codex installs this file is
  // PAI-owned runtime configuration under PAI_DIR, while Codex-native config
  // lives in config.toml, hooks.json, and AGENTS.md.
  delete settings.$schema;

  const env = asRecord(settings.env);
  settings.env = {
    ...env,
    PAI_DIR: homeRelativePath(paths, paths.paiDir),
  };

  if ("_docs" in settings) {
    const docs = asRecord(settings._docs);
    const docEnv = asRecord(docs._env);
    settings._docs = {
      ...docs,
      _env: {
        ...docEnv,
        PAI_DIR: "Root directory for PAI data (~/.pai by default). Memory, Algorithm, Tools, USER config, and Pulse live here. Hooks and skills stay in the selected harness home.",
      },
    };
  }

  if ("spinnerTipsOverride" in settings) {
    const spinnerTips = asRecord(settings.spinnerTipsOverride);
    settings.spinnerTipsOverride = {
      ...spinnerTips,
      tips: replaceListItems(spinnerTips.tips, [
        [/settings\.json is the single source of truth for all PAI configuration\./g, "PAI_DIR/settings.json is the single source of truth for PAI runtime configuration."],
        [/\/update-config configures the Claude Code harness via settings\.json\./g, "/update-config configures the selected harness and PAI_DIR/settings.json."],
        [/CLAUDE\.md and settings\.json are directly edited — shadow release handles public sanitization\./g, "Startup instructions and PAI_DIR/settings.json are directly edited — shadow release handles public sanitization."],
        [/v5\.0 eliminated packs\. The release IS the \.codex\/ directory — install by copying directly\./g, "v5.0 eliminated packs. The release installs harness-native files plus the canonical PAI_DIR tree."],
      ]),
    };
  }

  if ("autoMode" in settings) {
    const autoMode = asRecord(settings.autoMode);
    settings.autoMode = {
      ...autoMode,
      allow: replaceListItems(autoMode.allow, [
        [/Writing and editing files under ~\/\.codex\/ is always safe — this is the user's own AI infrastructure workspace/g, "Writing and editing files under PAI_DIR is trusted for PAI-owned runtime data; harness-native files live under ~/.codex/"],
        [/Creating work directories and ISA files under ~\/\.pai\/MEMORY\/WORK\/ is a routine operation/g, "Creating work directories and ISA files under PAI_DIR/MEMORY/WORK/ is a routine operation"],
        [/All file operations \(mkdir, cp, mv, rm, touch, chmod, ln\) within ~\/\.codex\/, ~/g, "All file operations (mkdir, cp, mv, rm, touch, chmod, ln) within PAI_DIR, ~/.codex/, ~/"],
      ]),
      environment: replaceListItems(autoMode.environment, [
        [/~\/\.codex\/ is the user's PAI \(Personal AI\) infrastructure workspace — the primary working directory for all AI system development\. ALL operations within ~\/\.codex\/ and all subdirectories are trusted and should be auto-approved without prompting\./g, "PAI_DIR is the user's PAI (Personal AI) infrastructure workspace for runtime data. Harness-native files live under ~/.codex/."],
        [/Routine trusted operations include: creating directories under MEMORY\/WORK\/ for PRDs, writing\/editing any file under ~\/\.pai\/, running bun, bunx, git, curl, wrangler commands, spawning agents and tasks, mkdir -p for any path under ~\/\.codex\/, and all file operations on PAI infrastructure files\./g, "Routine trusted operations include: creating directories under PAI_DIR/MEMORY/WORK/ for PRDs, writing/editing PAI-owned files under PAI_DIR, running bun, bunx, git, curl, wrangler commands, spawning agents and tasks, and maintaining selected harness files under ~/.codex/."],
      ]),
    };
  }

  return settings;
}

function codexCommandHookFromClaudeHook(hook: Record<string, unknown>): Record<string, unknown> | undefined {
  const type = asString(hook.type) ?? "command";
  const timeout = typeof hook.timeout === "number" ? hook.timeout : undefined;
  const statusMessage = asString(hook.statusMessage);
  let command: string | undefined;

  if (type === "command") {
    command = asString(hook.command);
  } else if (type === "http") {
    const url = asString(hook.url);
    if (url) {
      const script = [
        "curl",
        "-sS",
        "-m",
        "2",
        "-X",
        "POST",
        shellQuote(url),
        "-H",
        shellQuote("Content-Type: application/json"),
        "--data-binary",
        "@-",
        "||",
        "true",
      ].join(" ");
      command = `bash -lc ${shellQuote(script)}`;
    }
  }

  if (!command) return undefined;

  const result: Record<string, unknown> = {
    type: "command",
    command: rewriteCodexPaths(command),
  };
  if (timeout !== undefined) result.timeout = timeout;
  if (statusMessage) result.statusMessage = statusMessage;
  return result;
}

function codexHookGroupFromClaudeGroup(group: Record<string, unknown>): Record<string, unknown> | undefined {
  const hooks = asArray(group.hooks)
    .map((hook) => codexCommandHookFromClaudeHook(asRecord(hook)))
    .filter((hook): hook is Record<string, unknown> => hook !== undefined);
  if (hooks.length === 0) return undefined;

  const result: Record<string, unknown> = { hooks };
  const matcher = asString(group.matcher);
  if (matcher) result.matcher = matcher;
  return result;
}

function codexHooksFromClaudeSettingsHooks(hooks: unknown): Record<string, unknown[]> {
  return Object.fromEntries(
    Object.entries(asRecord(hooks))
      .map(([eventName, groups]) => [
        eventName,
        asArray(groups)
          .map((group) => codexHookGroupFromClaudeGroup(asRecord(group)))
          .filter((group): group is Record<string, unknown> => group !== undefined),
      ])
      .filter(([, groups]) => groups.length > 0),
  );
}

function ensureCodexPaiSettings(paths: ResolvedHarnessPaths): void {
  const settingsPath = join(paths.paiDir, "settings.json");
  if (!existsSync(settingsPath)) return;

  try {
    const settings = normalizeCodexPaiSettings(
      rewriteCodexPaths(JSON.parse(readFileSync(settingsPath, "utf-8"))) as Record<string, unknown>,
      paths,
    );
    writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
  } catch {
    const current = readFileSync(settingsPath, "utf-8");
    writeFileSync(settingsPath, rewriteCodexPaths(current) as string, "utf-8");
  }
}

function ensureCodexHooksJson(paths: ResolvedHarnessPaths): void {
  const settingsPath = join(paths.paiDir, "settings.json");
  const hooksPath = join(paths.harnessHome, "hooks.json");
  let hooks: Record<string, unknown[]> = {};

  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as { hooks?: unknown };
      hooks = codexHooksFromClaudeSettingsHooks(settings.hooks);
    } catch {
      hooks = {};
    }
  }

  writeFileSync(hooksPath, `${JSON.stringify({ hooks }, null, 2)}\n`, "utf-8");
}

function codexStartupSource(paths: ResolvedHarnessPaths, startupInstructionsSource?: string): string {
  const claudePath = join(paths.harnessHome, "CLAUDE.md");
  const source = startupInstructionsSource ??
    (existsSync(claudePath)
      ? readFileSync(claudePath, "utf-8")
      : "# PAI - Personal AI Infrastructure\n\nRead ~/.pai/ALGORITHM/LATEST before Algorithm-mode work.\n");
  return rewriteCodexPaths(source) as string;
}

function codexSystemPromptSource(paths: ResolvedHarnessPaths): string {
  const systemPromptPath = join(paths.paiDir, "PAI_SYSTEM_PROMPT.md");
  if (!existsSync(systemPromptPath)) return "";

  const source = readFileSync(systemPromptPath, "utf-8").trim();
  return rewriteCodexPaths(source) as string;
}

function codexPaiBlock(paths: ResolvedHarnessPaths, startupInstructionsSource?: string): string {
  const systemPrompt = codexSystemPromptSource(paths);
  const startup = codexStartupSource(paths, startupInstructionsSource).trimEnd();
  const body = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${startup}`
    : startup;

  return [
    PAI_AGENTS_START,
    body,
    PAI_AGENTS_END,
    "",
  ].join("\n");
}

function replaceManagedPaiBlock(existing: string, block: string): string | undefined {
  const start = existing.indexOf(PAI_AGENTS_START);
  const end = existing.indexOf(PAI_AGENTS_END);
  if (start < 0 || end < start) return undefined;

  const afterEnd = end + PAI_AGENTS_END.length;
  return `${existing.slice(0, start)}${block}${existing.slice(afterEnd).replace(/^\n+/, "")}`;
}

function backupUnmarkedPaiStartup(agentsPath: string): void {
  const backupPath = `${agentsPath}.pre-codex-pai.bak`;
  if (!existsSync(backupPath)) {
    copyFileSync(agentsPath, backupPath);
  }
}

function mergeCodexStartup(existing: string, block: string, agentsPath: string): string {
  const replaced = replaceManagedPaiBlock(existing, block);
  if (replaced !== undefined) return replaced;

  if (hasPaiStartupInstructions(existing)) {
    backupUnmarkedPaiStartup(agentsPath);
    return block;
  }

  return existing.trim()
    ? `${block}\n${existing.trimStart()}`
    : block;
}

function ensureCodexStartup(paths: ResolvedHarnessPaths, startupInstructionsSource?: string): void {
  const agentsPath = join(paths.harnessHome, "AGENTS.md");
  const existing = existsSync(agentsPath) ? readFileSync(agentsPath, "utf-8") : "";
  const next = mergeCodexStartup(existing, codexPaiBlock(paths, startupInstructionsSource), agentsPath);
  if (next !== existing) {
    writeFileSync(agentsPath, next, "utf-8");
  }
}

function ensureCodexNativeFiles(paths: ResolvedHarnessPaths, startupInstructionsSource?: string): void {
  ensureCodexPaiSettings(paths);
  ensureCodexStartup(paths, startupInstructionsSource);
  ensureCodexConfig(paths);
  ensureCodexHooksJson(paths);
}

async function install(input: AdapterInstallInput): Promise<AdapterInstallResult> {
  const { paths, now } = prepareAdapterInstall(input, "codex");
  ensureCodexNativeFiles(paths, input.startupInstructionsSource);

  const manifest: InstalledAdapterManifest = {
    schemaVersion: 1,
    harness: "codex",
    paiVersion: input.paiVersion,
    paiDir: paths.paiDir,
    harnessHome: paths.harnessHome,
    managedFiles: input.managedFiles,
    installedAt: now,
    updatedAt: now,
    validation: {
      status: "unknown",
      checkedAt: now,
      issues: [],
    },
  };

  writeAdapterManifest(paths.manifestPath, manifest);

  return { paths, manifest };
}

async function validate(input: AdapterValidateInput): Promise<AdapterValidationResult> {
  const result = validateAdapterState(input, "codex", "Codex");
  const agentsPath = join(result.paths.harnessHome, "AGENTS.md");

  if (existsSync(agentsPath)) {
    const agents = readFileSync(agentsPath, "utf-8");
    if (!hasPaiStartupInstructions(agents)) {
      result.issues.push({
        check: "startupInstructions",
        message: "AGENTS.md is missing PAI startup instructions",
      });
    }
    if (hasClaudePaiPaths(agents)) {
      result.issues.push({
        check: "startupInstructions",
        message: "AGENTS.md contains legacy Claude PAI paths instead of canonical PAI paths",
      });
    }
  }

  return {
    ...result,
    valid: result.issues.length === 0,
  };
}

export const codexAdapter: HarnessAdapter = {
  harness: "codex",
  resolvePaths: (input) => resolveHarnessPaths({ ...input, harness: "codex" }),
  install,
  validate,
};
