#!/usr/bin/env bun
/**
 * InstallIntegrationTest — end-to-end proof of the custom-LifeOS-home install
 * (LIFEOS_HOME), plus a default-install regression check. Everything runs
 * against a THROWAWAY fake $HOME under mktemp — the real home is never touched,
 * which doubles as the isolation proof.
 *
 * Scenarios:
 *   A. Custom home: full tool chain (DetectEnv → InstallSettings → DeployCore →
 *      InstallHooks → CLAUDE.md overlay → ScaffoldUser → LinkUser →
 *      ActivateImports → DeployComponents statusline) into
 *      `<fakeHome>/lifeos-home`, then asserts: everything landed under the
 *      custom root, the written settings.json (env values, permission globs,
 *      hook commands) contains ZERO `.claude` references, the symlink contract
 *      holds against `<configRoot>/USER-data`, identity imports activated, and
 *      nothing was written to `<fakeHome>/.claude` or `<fakeHome>/.config/LIFEOS`.
 *   B. Legacy recovery + explicit self-symlink guard: an ambient legacy
 *      LIFEOS_CONFIG_DIR value is repaired, while an explicitly requested
 *      unsafe data home is still refused before any filesystem mutation.
 *   C. Default regression: with NO LIFEOS_HOME the install lands in
 *      `<fakeHome>/.claude` and the settings template ships byte-identical
 *      (`~/.claude` permission globs untouched, `$HOME`-expanded env values).
 *
 * Requires network once for `bun install` (DeployCore's dependency step) unless
 * bun's cache already holds the runtime deps.
 *
 * Usage:
 *   bun InstallIntegrationTest.ts [--keep]
 *   (--keep retains the temp workspace; it is always retained on failure)
 */

import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const toolsDir = import.meta.dir;
const skillRoot = join(toolsDir, "..");

interface Check { scenario: string; name: string; passed: boolean; detail?: string }
const checks: Check[] = [];
function check(scenario: string, name: string, passed: boolean, detail?: string): void {
  checks.push({ scenario, name, passed, detail: passed ? undefined : detail });
}

/** Env for a spawned tool: real PATH etc., fake HOME, LifeOS path vars scrubbed. */
function toolEnv(fakeHome: string, extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  const scrub = new Set(["LIFEOS_HOME", "CLAUDE_CONFIG_DIR", "LIFEOS_CONFIG_DIR", "LIFEOS_DIR", "LIFEOS_ROOT", "CLAUDE_PLUGIN_ROOT"]);
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || scrub.has(k)) continue;
    env[k] = v;
  }
  env.HOME = fakeHome;
  Object.assign(env, extra);
  return env;
}

function runTool(tool: string, args: string[], env: Record<string, string>): { code: number; json: Record<string, unknown> | null; raw: string } {
  const proc = Bun.spawnSync(["bun", join(toolsDir, tool), ...args], { env, stdout: "pipe", stderr: "pipe" });
  const out = proc.stdout.toString();
  let json: Record<string, unknown> | null = null;
  try { json = JSON.parse(out); } catch { /* non-JSON output stays raw */ }
  return { code: proc.exitCode ?? -1, json, raw: out + proc.stderr.toString() };
}

function isQuotedAt(line: string, position: number): boolean {
  let single = false;
  let double = false;
  let escaped = false;
  for (let i = 0; i < position; i++) {
    const char = line[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\" && !single) { escaped = true; continue; }
    if (char === "'" && !double) single = !single;
    if (char === '"' && !single) double = !double;
  }
  return single || double;
}

/** Enforce the boundary between model placeholders and executable shell vars. */
function markdownPathConventionViolations(root: string): string[] {
  const violations: string[] = [];
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
    }
  };
  walk(root);

  for (const file of files) {
    let fence: string | null = null;
    const inlineShellCommand = /^\s*(?:bun(?:\s+run)?|bash|sh|zsh|cd|ls|rg|grep|cat|tail|head|find|cp|mv|mkdir|touch|chmod|source|echo|jq|rsync|fabric|git)\b/;
    const lines = readFileSync(file, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const marker = line.match(/^\s*```([^`]*)/);
      if (marker) {
        fence = fence === null ? marker[1].trim().toLowerCase() : null;
        continue;
      }
      const shell = ["bash", "sh", "shell", "zsh"].includes(fence ?? "") || line.trimStart().startsWith("!`");
      const label = `${file}:${i + 1}`;
      const modelFacingLine = shell ? line : line.replace(/`([^`\n]+)`/g, (span, code: string) => {
        if (!inlineShellCommand.test(code)) return span;
        if (/\{\{LIFEOS_(?:ROOT|DIR|CONFIG_DIR)\}\}/.test(code)) {
          violations.push(`${label}: model placeholder in inline shell command`);
        }
        if (/\$LIFEOS_(?:ROOT|DIR|CONFIG_DIR)\b/.test(code)) {
          violations.push(`${label}: unbraced variable in inline shell command`);
        }
        for (const match of code.matchAll(/\$\{(?:LIFEOS_(?:ROOT|DIR|CONFIG_DIR)|CLAUDE_SKILL_DIR)\}/g)) {
          if (!isQuotedAt(code, match.index ?? 0)) violations.push(`${label}: unquoted inline shell path`);
        }
        return "";
      });
      if (shell) {
        if (!line.trimStart().startsWith("#") && /\{\{LIFEOS_(?:ROOT|DIR|CONFIG_DIR)\}\}/.test(line)) {
          violations.push(`${label}: model placeholder in executable shell`);
        }
        if (/\$LIFEOS_(?:ROOT|DIR|CONFIG_DIR)\b/.test(line)) {
          violations.push(`${label}: unbraced LifeOS shell variable`);
        }
        for (const match of line.matchAll(/\$\{(?:LIFEOS_(?:ROOT|DIR|CONFIG_DIR)|CLAUDE_SKILL_DIR)\}/g)) {
          if (!isQuotedAt(line, match.index ?? 0)) violations.push(`${label}: unquoted shell path variable`);
        }
      } else if (/\$\{?LIFEOS_(?:ROOT|DIR|CONFIG_DIR)\}?/.test(modelFacingLine)) {
        violations.push(`${label}: shell variable in model-facing content`);
      }
      if (basename(file) !== "SKILL.md" && /\$\{CLAUDE_SKILL_DIR\}/.test(line)) {
        violations.push(`${label}: CLAUDE_SKILL_DIR outside rendered SKILL.md`);
      }
      if (/(?:bun|bash|sh|rg|grep|ls|cd)\s+\$\{CLAUDE_SKILL_DIR\}/.test(line)) {
        violations.push(`${label}: unquoted CLAUDE_SKILL_DIR command path`);
      }
    }
  }
  return violations;
}

const keep = process.argv.includes("--keep");
const workRoot = mkdtempSync(join(tmpdir(), "lifeos-install-test-"));

// ─── Scenario A: custom home ─────────────────────────────────────────
{
  const S = "A:custom-home";
  const fakeHome = join(workRoot, "home-custom");
  const configRoot = join(fakeHome, "lifeos home"); // spaces exercise shell-safe command generation; deliberately NO ".claude"
  const configDir = join(configRoot, "USER-data");
  const env = toolEnv(fakeHome, { LIFEOS_HOME: configRoot });
  const flags = ["--config-root", configRoot]; // belt-and-suspenders on top of LIFEOS_HOME, like the Setup workflow passes

  // DetectEnv resolves the override
  const detect = runTool("DetectEnv.ts", [], env);
  check(S, "DetectEnv reports the custom configRoot", detect.json?.configRoot === configRoot, detect.raw);
  check(S, "DetectEnv reports configDir = <configRoot>/USER-data", detect.json?.configDir === configDir, detect.raw);

  // InstallSettings
  const settingsRun = runTool("InstallSettings.ts", [...flags, "--skill-root", skillRoot, "--apply"], env);
  const settingsPath = join(configRoot, "settings.json");
  check(S, "InstallSettings ok", settingsRun.code === 0 && settingsRun.json?.ok === true, settingsRun.raw);
  check(S, "settings.json written under the custom root", existsSync(settingsPath));

  // Managed root variables must be repaired, not preserved as arbitrary user
  // overrides: otherwise the next model/session context points at two trees.
  if (existsSync(settingsPath)) {
    const stale = JSON.parse(readFileSync(settingsPath, "utf-8")) as Record<string, any>;
    stale.env.LIFEOS_ROOT = join(fakeHome, ".claude");
    stale.env.LIFEOS_DIR = join(fakeHome, ".claude", "LIFEOS");
    stale.env.LIFEOS_HOME = join(fakeHome, ".claude");
    writeFileSync(settingsPath, JSON.stringify(stale, null, 2) + "\n");
    const repairedRun = runTool("InstallSettings.ts", [...flags, "--skill-root", skillRoot, "--apply"], env);
    const repaired = JSON.parse(readFileSync(settingsPath, "utf-8")) as Record<string, any>;
    check(S, "InstallSettings repairs stale managed root variables", repairedRun.code === 0 &&
      repaired.env?.LIFEOS_ROOT === configRoot &&
      repaired.env?.LIFEOS_DIR === join(configRoot, "LIFEOS") &&
      repaired.env?.LIFEOS_HOME === configRoot, repairedRun.raw + JSON.stringify(repaired.env));
  }

  // DeployCore (skills + runtime + MEMORY scaffold + deps)
  const core = runTool("DeployCore.ts", [...flags, "--skill-root", skillRoot, "--apply"], env);
  check(S, "DeployCore ok", core.code === 0 && core.json?.ok === true, core.raw.slice(0, 2000));
  check(S, "LIFEOS runtime under the custom root", existsSync(join(configRoot, "LIFEOS", "VERSION")) || existsSync(join(configRoot, "LIFEOS")));
  check(S, "skills library under the custom root", existsSync(join(configRoot, "skills")));

  // InstallHooks (merge + script deploy)
  const hooks = runTool("InstallHooks.ts", [...flags, "--skill-root", skillRoot, "--apply"], env);
  check(S, "InstallHooks ok", hooks.code === 0 && hooks.json?.ok === true, hooks.raw);
  check(S, "hook commands retargeted (>0)", typeof hooks.json?.commandsRetargeted === "number" && (hooks.json.commandsRetargeted as number) > 0, hooks.raw);
  check(S, "hook scripts deployed under the custom root", existsSync(join(configRoot, "hooks", "lib", "paths.ts")));

  // The whole settings.json — env values, permission globs, guidance prose, merged
  // hook commands — must now reference ONLY the custom root.
  if (existsSync(settingsPath)) {
    const settingsRaw = readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(settingsRaw) as Record<string, any>;
    check(S, "settings.json has ZERO .claude references", !settingsRaw.includes(".claude"),
      `found: ${(settingsRaw.match(/[^"\s]*\.claude[^"\s]*/g) || []).slice(0, 5).join(", ")}`);
    check(S, "env.LIFEOS_DIR points at the custom root", settings.env?.LIFEOS_DIR === join(configRoot, "LIFEOS"), String(settings.env?.LIFEOS_DIR));
    check(S, "env.LIFEOS_CONFIG_DIR points at the user-data home", settings.env?.LIFEOS_CONFIG_DIR === configDir, String(settings.env?.LIFEOS_CONFIG_DIR));
    check(S, "env.LIFEOS_ROOT points at the custom root", settings.env?.LIFEOS_ROOT === configRoot, String(settings.env?.LIFEOS_ROOT));
    check(S, "env.LIFEOS_HOME persists the custom root", settings.env?.LIFEOS_HOME === configRoot, String(settings.env?.LIFEOS_HOME));
    check(S, "permission globs carry the custom root", JSON.stringify(settings.permissions?.allow ?? []).includes(`Write(${configRoot}/**)`), "no retargeted Write glob found");
    const hookCmds = JSON.stringify(settings.hooks ?? {});
    check(S, "merged hook commands carry the custom root", hookCmds.includes(join(configRoot, "hooks")), hookCmds.slice(0, 500));
    check(S, "hook paths with spaces are shell-quoted", hookCmds.includes(`'${join(configRoot, "hooks")}`), hookCmds.slice(0, 500));
    check(S, "unresolved-path guard covers model path tools", hookCmds.includes("Read|Glob|Grep"), hookCmds.slice(0, 1000));
  }

  // Instruction layer: deployed model-read markdown must not carry executable
  // default-root paths — the `~/.claude/LIFEOS` form is what the payload codemod
  // rewrote to `$LIFEOS_DIR`/`$LIFEOS_ROOT` (changelogs are historical records).
  {
    const mdRoots = [join(configRoot, "skills"), join(configRoot, "LIFEOS", "DOCUMENTATION")].filter((d) => existsSync(d));
    const g = Bun.spawnSync(["grep", "-rlE", "(~|\\$HOME|\\$\\{HOME\\})/\\.claude/LIFEOS", "--include=*.md", ...mdRoots]);
    const hits = g.stdout.toString().trim().split("\n").filter(Boolean).filter((f) => !/changelog/i.test(f));
    check(S, "deployed markdown has no hardcoded ~/.claude/LIFEOS paths", mdRoots.length > 0 && hits.length === 0, hits.slice(0, 5).join(", ") || `scanned: ${mdRoots.join(", ")}`);
  }

  const conventionViolations = markdownPathConventionViolations(join(skillRoot, "install"));
  check(S, "markdown separates model placeholders from quoted shell variables",
    conventionViolations.length === 0, conventionViolations.slice(0, 20).join("\n"));

  // CLAUDE.md overlay (Setup step 4 does this by hand) + ScaffoldUser + LinkUser + ActivateImports
  cpSync(join(skillRoot, "install", "CLAUDE.template.md"), join(configRoot, "CLAUDE.md"));
  const scaffold = runTool("ScaffoldUser.ts", [...flags, "--config-dir", configDir, "--skill-root", skillRoot, "--apply"], env);
  check(S, "ScaffoldUser ok", scaffold.code === 0 && scaffold.json?.ok === true, scaffold.raw);
  check(S, "USER tree scaffolded into <configRoot>/USER-data", existsSync(join(configDir, "USER", "PROJECTS.md")));

  const link = runTool("LinkUser.ts", [...flags, "--config-dir", configDir, "--apply"], env);
  check(S, "LinkUser ok + contract passed", link.code === 0 && (link.json?.contract as any)?.passed === true, link.raw);
  const liveUser = join(configRoot, "LIFEOS", "USER");
  check(S, "LIFEOS/USER symlink → <configRoot>/USER-data/USER",
    existsSync(liveUser) && lstatSync(liveUser).isSymbolicLink() && readlinkSync(liveUser) === join(configDir, "USER"),
    existsSync(liveUser) ? String(lstatSync(liveUser).isSymbolicLink() && readlinkSync(liveUser)) : "missing");

  const imports = runTool("ActivateImports.ts", [...flags, "--apply"], env);
  const activated = (imports.json?.activated as string[]) ?? [];
  check(S, "ActivateImports activated identity imports (>0)", imports.code === 0 && activated.length > 0, imports.raw);
  check(S, "every activated import resolves under the custom root",
    activated.every((imp) => existsSync(join(configRoot, imp.replace(/^@/, "")))), activated.join(", "));

  // Statusline enhancement wires against the custom root
  const status = runTool("DeployComponents.ts", [...flags, "--skill-root", skillRoot, "--apply", "--components", "statusline"], env);
  check(S, "DeployComponents statusline ok", status.code === 0 && status.json?.ok === true, status.raw.slice(0, 1500));
  if (existsSync(settingsPath)) {
    const cmd = (JSON.parse(readFileSync(settingsPath, "utf-8")) as any).statusLine?.command ?? "";
    check(S, "statusLine command targets the custom root", cmd.includes("lifeos home/LIFEOS/LIFEOS_StatusLine.sh"), cmd);
    check(S, "statusLine path with spaces is shell-quoted", cmd === `'${join(configRoot, "LIFEOS", "LIFEOS_StatusLine.sh")}'`, cmd);
  }

  // Isolation: nothing leaked into the default locations of the (fake) home.
  check(S, "no writes to <home>/.claude", !existsSync(join(fakeHome, ".claude")));
  check(S, "no writes to <home>/.config/LIFEOS", !existsSync(join(fakeHome, ".config", "LIFEOS")));

  // ─── Scenario D: Pulse runtime + launchd wiring is custom-home-aware ──
  // DeployCore (above) shipped LIFEOS/PULSE + LIFEOS/TOOLS/lifeos-root.ts into the
  // custom root. The whole runtime layer must resolve the custom root — not ~/.claude.
  // configRoot here is `<fakeHome>/lifeos-home` (NO ".claude" in the name), so a clean
  // "zero .claude" assertion catches any surviving hardcode, exactly like settings.json.
  const SP = "D:pulse-custom-home";
  const lifeosDir = join(configRoot, "LIFEOS");
  const pulseDir = join(lifeosDir, "PULSE");
  const statuslinePath = join(lifeosDir, "LIFEOS_StatusLine.sh");

  check(SP, "canonical resolver lifeos-root.ts deployed under custom root", existsSync(join(lifeosDir, "TOOLS", "lifeos-root.ts")));
  check(SP, "a PULSE module routes through the resolver (codemod shipped)",
    existsSync(join(pulseDir, "modules", "memory.ts")) && readFileSync(join(pulseDir, "modules", "memory.ts"), "utf-8").includes("lifeos-root"),
    "memory.ts does not import lifeos-root");
  if (existsSync(statuslinePath)) {
    const statusline = readFileSync(statuslinePath, "utf-8");
    const statuslineLeaks = [
      'CLAUDE_HOME="$HOME/.claude"',
      'source "$HOME/.claude/.env"',
      'bun "$HOME/.claude/LIFEOS/TOOLS/GetCounts.ts"',
      '"$HOME"/.claude/projects/',
    ].filter((needle) => statusline.includes(needle));
    check(SP, "statusline internals use the resolved custom root", statuslineLeaks.length === 0, statuslineLeaks.join(", "));
  }

  const pulsePlistTpl = join(pulseDir, "com.lifeos.pulse.plist");
  if (existsSync(pulsePlistTpl)) {
    const tpl = readFileSync(pulsePlistTpl, "utf-8");
    check(SP, "pulse plist template is __LIFEOS_DIR__-based (no __HOME__/.claude)",
      tpl.includes("__LIFEOS_DIR__") && !tpl.includes("__HOME__/.claude"), tpl.match(/__HOME__\/\.claude\S*/)?.[0] ?? "");
  }

  // `manage.sh render` performs the real substitution (self-locating its own dir) —
  // no launchctl load, so it is safe in CI.
  const manage = join(pulseDir, "manage.sh");
  check(SP, "manage.sh deployed under custom root", existsSync(manage));
  if (existsSync(manage)) {
    const render = Bun.spawnSync(["bash", manage, "render"], { env, stdout: "pipe", stderr: "pipe" });
    const plist = render.stdout.toString();
    check(SP, "rendered pulse plist has ZERO .claude references", plist.length > 0 && !plist.includes(".claude"),
      (plist.match(/\S*\.claude\S*/g) || []).slice(0, 3).join(", ") || render.stderr.toString().slice(0, 300));
    check(SP, "no unresolved __LIFEOS_DIR__ placeholder", plist.length > 0 && !plist.includes("__LIFEOS_DIR__"), plist.slice(0, 200));
    // Format differs per OS: macOS renders a launchd plist (<string>PATH</string>);
    // Linux renders a systemd unit (WorkingDirectory=PATH / Environment=LIFEOS_DIR=PATH).
    const isLinux = process.platform === "linux";
    check(SP, "WorkingDirectory targets <configRoot>/LIFEOS/PULSE",
      isLinux ? plist.includes(`WorkingDirectory=${pulseDir}`) : plist.includes(`<string>${pulseDir}</string>`),
      plist.slice(0, 500));
    check(SP, "LIFEOS_DIR env set to <configRoot>/LIFEOS",
      isLinux ? plist.includes(`LIFEOS_DIR=${lifeosDir}`) : plist.includes(`<string>${lifeosDir}</string>`),
      plist.slice(0, 500));
  }

  // Execute both deployed resolvers with every root env scrubbed. This verifies
  // self-location behavior instead of only checking that imports exist in text.
  const resolverEnv = toolEnv(fakeHome);
  const runtimeResolver = join(lifeosDir, "TOOLS", "lifeos-root.ts");
  const runtimeProbe = Bun.spawnSync(["bun", "-e", `const m = await import(${JSON.stringify(runtimeResolver)}); console.log(m.claudeDir())`], { env: resolverEnv, stdout: "pipe", stderr: "pipe" });
  check(SP, "deployed runtime resolver self-locates the custom root", runtimeProbe.exitCode === 0 && runtimeProbe.stdout.toString().trim() === realpathSync(configRoot), runtimeProbe.stdout.toString() + runtimeProbe.stderr.toString());
  const hookResolver = join(configRoot, "hooks", "lib", "paths.ts");
  const hookProbe = Bun.spawnSync(["bun", "-e", `const m = await import(${JSON.stringify(hookResolver)}); console.log(m.getClaudeDir())`], { env: resolverEnv, stdout: "pipe", stderr: "pipe" });
  check(SP, "deployed hook resolver self-locates the custom root", hookProbe.exitCode === 0 && hookProbe.stdout.toString().trim() === realpathSync(configRoot), hookProbe.stdout.toString() + hookProbe.stderr.toString());

  // SessionStart must ground semantic placeholders even for subagents, which
  // intentionally skip the personal relationship/learning context.
  const loadContext = join(configRoot, "hooks", "LoadContext.hook.ts");
  const contextEnv = toolEnv(fakeHome, {
    // Deliberately stale/legacy values: LIFEOS_DIR and hook self-location win.
    LIFEOS_ROOT: join(fakeHome, ".claude"),
    LIFEOS_DIR: lifeosDir,
    LIFEOS_CONFIG_DIR: lifeosDir,
    CLAUDE_AGENT_TYPE: "integration-test",
  });
  const contextProbe = Bun.spawnSync(["bun", loadContext], { env: contextEnv, stdout: "pipe", stderr: "pipe" });
  const contextOut = contextProbe.stdout.toString();
  check(SP, "SessionStart grounds all LifeOS model path placeholders",
    contextProbe.exitCode === 0 &&
    contextOut.includes(`{{LIFEOS_ROOT}} = ${JSON.stringify(configRoot)}`) &&
    contextOut.includes(`{{LIFEOS_DIR}} = ${JSON.stringify(lifeosDir)}`) &&
    contextOut.includes(`{{LIFEOS_CONFIG_DIR}} = ${JSON.stringify(configDir)}`),
    contextOut + contextProbe.stderr.toString());
  check(SP, "SessionStart forbids unresolved placeholders in tool calls",
    contextOut.includes("Never pass an unresolved LifeOS placeholder to a tool"), contextOut);

  const preToolGuard = join(configRoot, "hooks", "PreToolGuard.hook.ts");
  const unresolvedProbe = Bun.spawnSync(["bun", preToolGuard], {
    env: contextEnv,
    stdin: new Blob([JSON.stringify({
      tool_name: "Read",
      tool_input: { file_path: "{{LIFEOS_ROOT}}/settings.json" },
    })]),
    stdout: "pipe",
    stderr: "pipe",
  });
  check(SP, "PreToolUse blocks unresolved LifeOS paths",
    unresolvedProbe.exitCode === 2 && unresolvedProbe.stderr.toString().includes("Unresolved {{LIFEOS_ROOT}}"),
    unresolvedProbe.stdout.toString() + unresolvedProbe.stderr.toString());

  const documentedPlaceholderProbe = Bun.spawnSync(["bun", preToolGuard], {
    env: contextEnv,
    stdin: new Blob([JSON.stringify({
      tool_name: "Write",
      tool_input: {
        file_path: join(configRoot, "example.md"),
        content: "Model paths use {{LIFEOS_ROOT}}/skills in documentation.",
      },
    })]),
    stdout: "pipe",
    stderr: "pipe",
  });
  check(SP, "PreToolUse allows placeholders as documentation content",
    documentedPlaceholderProbe.exitCode === 0,
    documentedPlaceholderProbe.stdout.toString() + documentedPlaceholderProbe.stderr.toString());

  // The installed launcher must make an arbitrary custom root visible to a
  // fresh Claude process. A fake binary captures cwd/env without contacting
  // Claude or touching any real user configuration.
  const fakeBin = join(workRoot, "fake-bin");
  const launchCapture = join(workRoot, "launcher-capture.json");
  mkdirSync(fakeBin, { recursive: true });
  const fakeClaude = join(fakeBin, "claude");
  writeFileSync(fakeClaude, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "2.0.0"; exit 0; fi\nprintf '{"cwd":"%s","lifeosHome":"%s","claudeConfigDir":"%s"}\\n' "$PWD" "$LIFEOS_HOME" "$CLAUDE_CONFIG_DIR" > "$LIFEOS_LAUNCH_CAPTURE"\n`);
  chmodSync(fakeClaude, 0o755);
  const launcherEnv = toolEnv(fakeHome, {
    PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
    LIFEOS_LAUNCH_CAPTURE: launchCapture,
  });
  const launcher = Bun.spawnSync(["bun", join(lifeosDir, "TOOLS", "lifeos.ts")], { env: launcherEnv, stdout: "pipe", stderr: "pipe" });
  const captured = existsSync(launchCapture) ? JSON.parse(readFileSync(launchCapture, "utf-8")) as Record<string, string> : {};
  check(SP, "launcher exports and enters the arbitrary custom root", launcher.exitCode === 0 && captured.cwd === realpathSync(configRoot) && captured.lifeosHome === realpathSync(configRoot) && captured.claudeConfigDir === realpathSync(configRoot), launcher.stdout.toString() + launcher.stderr.toString() + JSON.stringify(captured));

  // A later session no longer has the installer's transient LIFEOS_HOME. It
  // does retain LIFEOS_DIR/LIFEOS_CONFIG_DIR from settings and must recover one
  // coherent pair rather than mixing ~/.claude with the custom data home.
  const resumedEnv = toolEnv(fakeHome, { LIFEOS_DIR: lifeosDir, LIFEOS_CONFIG_DIR: configDir });
  const resumedDetect = runTool("DetectEnv.ts", [], resumedEnv);
  check(SP, "later session recovers configRoot from LIFEOS_DIR", resumedDetect.json?.configRoot === configRoot, resumedDetect.raw);
  check(SP, "later session keeps the matching configDir", resumedDetect.json?.configDir === configDir, resumedDetect.raw);
  const resumedScaffold = runTool("ScaffoldUser.ts", ["--skill-root", skillRoot], resumedEnv);
  check(SP, "later ScaffoldUser defaults stay inside the custom root", resumedScaffold.code === 0 && resumedScaffold.json?.to === join(configDir, "USER"), resumedScaffold.raw);

  const actionableFiles = [
    join(pulseDir, "modules", "hooks.ts"),
    join(pulseDir, "modules", "work.ts"),
    join(configRoot, "hooks", "MemoryHealthGate.hook.ts"),
    join(configRoot, "hooks", "MemoryDeltaSurface.hook.ts"),
    join(configRoot, "hooks", "WritingGate.hook.ts"),
  ];
  const actionableLeaks = actionableFiles.filter((p) => existsSync(p) && /bun (?:\$HOME\/\.claude|~\/\.claude)/.test(readFileSync(p, "utf-8")));
  check(SP, "agent-actionable runtime commands have no default-root hardcode", actionableLeaks.length === 0, actionableLeaks.join(", "));

  // ─── Scenario B: legacy recovery + explicit self-symlink guard ─────
  const SG = "B:legacy-and-guard";
  // A legacy ambient value is ignored and automatically recovers to the
  // isolated custom data home.
  const poisoned = toolEnv(fakeHome, { LIFEOS_CONFIG_DIR: join(configRoot, "LIFEOS") });
  const guardLink = runTool("LinkUser.ts", ["--config-root", configRoot, "--apply"], poisoned);
  check(SG, "LinkUser recovers from an ambient legacy configDir", guardLink.code === 0 && (guardLink.json?.contract as any)?.passed === true, guardLink.raw);
  const guardScaffold = runTool("ScaffoldUser.ts", ["--config-root", configRoot, "--skill-root", skillRoot, "--apply"], poisoned);
  check(SG, "ScaffoldUser recovers from an ambient legacy configDir", guardScaffold.code === 0 && guardScaffold.json?.to === join(configDir, "USER"), guardScaffold.raw);

  // An explicit unsafe request remains an error: explicit flags outrank the
  // recovery heuristic, and the separation guard prevents self-linking.
  const unsafeDir = join(configRoot, "LIFEOS");
  const explicitGuardLink = runTool("LinkUser.ts", ["--config-root", configRoot, "--config-dir", unsafeDir, "--apply"], env);
  check(SG, "LinkUser refuses an explicitly unsafe configDir", explicitGuardLink.code !== 0 && explicitGuardLink.json?.refused === "user-data-separation", explicitGuardLink.raw);
  const explicitGuardScaffold = runTool("ScaffoldUser.ts", ["--config-root", configRoot, "--config-dir", unsafeDir, "--skill-root", skillRoot, "--apply"], env);
  check(SG, "ScaffoldUser refuses an explicitly unsafe configDir", explicitGuardScaffold.code !== 0 && explicitGuardScaffold.json?.refused === "user-data-separation", explicitGuardScaffold.raw);
  check(SG, "live USER symlink survived the explicit refused runs",
    lstatSync(liveUser).isSymbolicLink() && readlinkSync(liveUser) === join(configDir, "USER"));
}

// ─── Scenario C: default-install regression (no LIFEOS_HOME) ─────────
{
  const S = "C:default-regression";
  const fakeHome = join(workRoot, "home-default");
  const env = toolEnv(fakeHome);
  const defaultRoot = join(fakeHome, ".claude");

  const detect = runTool("DetectEnv.ts", [], env);
  check(S, "DetectEnv falls back to ~/.claude", detect.json?.configRoot === defaultRoot, detect.raw);
  check(S, "DetectEnv configDir falls back to ~/.config/LIFEOS", detect.json?.configDir === join(fakeHome, ".config", "LIFEOS"), detect.raw);

  const settingsRun = runTool("InstallSettings.ts", ["--skill-root", skillRoot, "--apply"], env);
  const settingsPath = join(defaultRoot, "settings.json");
  check(S, "InstallSettings ok into ~/.claude", settingsRun.code === 0 && existsSync(settingsPath), settingsRun.raw);
  if (existsSync(settingsPath)) {
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as Record<string, any>;
    check(S, "env.LIFEOS_DIR is the expanded default", settings.env?.LIFEOS_DIR === join(defaultRoot, "LIFEOS"), String(settings.env?.LIFEOS_DIR));
    check(S, "env.LIFEOS_ROOT is the expanded default", settings.env?.LIFEOS_ROOT === defaultRoot, String(settings.env?.LIFEOS_ROOT));
    check(S, "env.LIFEOS_CONFIG_DIR points at the private default data home", settings.env?.LIFEOS_CONFIG_DIR === join(fakeHome, ".config", "LIFEOS"), String(settings.env?.LIFEOS_CONFIG_DIR));
    check(S, "template ~/.claude permission globs untouched", JSON.stringify(settings.permissions?.allow ?? []).includes("Write(~/.claude/**)"), "default globs were rewritten — regression!");
    check(S, "no retarget was reported", settingsRun.json?.retargetedStrings === undefined, JSON.stringify(settingsRun.json));
  }

  const hooks = runTool("InstallHooks.ts", ["--skill-root", skillRoot, "--apply"], env);
  check(S, "InstallHooks ok into ~/.claude", hooks.code === 0 && hooks.json?.ok === true, hooks.raw);
  if (existsSync(settingsPath)) {
    const hookCmds = JSON.stringify((JSON.parse(readFileSync(settingsPath, "utf-8")) as any).hooks ?? {});
    check(S, "default hook commands still use $HOME/.claude", hookCmds.includes("$HOME/.claude/hooks/"), hookCmds.slice(0, 300));
  }

  // Legacy settings poisoned LIFEOS_CONFIG_DIR with <configRoot>/LIFEOS. The
  // resolver must ignore it immediately and InstallSettings must repair it.
  const legacyEnv = toolEnv(fakeHome, { LIFEOS_DIR: join(defaultRoot, "LIFEOS"), LIFEOS_CONFIG_DIR: join(defaultRoot, "LIFEOS") });
  const legacyScaffold = runTool("ScaffoldUser.ts", ["--skill-root", skillRoot], legacyEnv);
  check(S, "legacy poisoned configDir no longer blocks a default rerun", legacyScaffold.code === 0 && legacyScaffold.json?.to === join(fakeHome, ".config", "LIFEOS", "USER"), legacyScaffold.raw);
  if (existsSync(settingsPath)) {
    const legacySettings = JSON.parse(readFileSync(settingsPath, "utf-8")) as Record<string, any>;
    legacySettings.env.LIFEOS_CONFIG_DIR = join(defaultRoot, "LIFEOS");
    writeFileSync(settingsPath, JSON.stringify(legacySettings, null, 2) + "\n");
    const repair = runTool("InstallSettings.ts", ["--skill-root", skillRoot, "--apply"], legacyEnv);
    const repaired = JSON.parse(readFileSync(settingsPath, "utf-8")) as Record<string, any>;
    check(S, "InstallSettings repairs the legacy LIFEOS_CONFIG_DIR value", repair.code === 0 && repaired.env?.LIFEOS_CONFIG_DIR === join(fakeHome, ".config", "LIFEOS"), repair.raw);
  }
}

// ─── Scenario E: direct explicit root is isolated without LIFEOS_HOME ──
{
  const S = "E:explicit-root";
  const fakeHome = join(workRoot, "home-explicit");
  const explicitRoot = join(fakeHome, "explicit root");
  const env = toolEnv(fakeHome);
  const scaffold = runTool("ScaffoldUser.ts", ["--config-root", explicitRoot, "--skill-root", skillRoot], env);
  check(S, "--config-root defaults USER data under that root", scaffold.code === 0 && scaffold.json?.to === join(explicitRoot, "USER-data", "USER"), scaffold.raw);
  const harnessEnv = toolEnv(fakeHome, { CLAUDE_CONFIG_DIR: explicitRoot });
  const harnessDetect = runTool("DetectEnv.ts", [], harnessEnv);
  check(S, "CLAUDE_CONFIG_DIR override gets an isolated USER data home", harnessDetect.json?.configRoot === explicitRoot && harnessDetect.json?.configDir === join(explicitRoot, "USER-data"), harnessDetect.raw);
}

// ─── Scenario G: bootstrap makes the staged custom skill discoverable ──
{
  const S = "G:bootstrap-handoff";
  const fakeHome = join(workRoot, "home-bootstrap");
  const configRoot = join(fakeHome, "bootstrap root");
  const fakeBin = join(workRoot, "bootstrap-bin");
  const capturePath = join(workRoot, "bootstrap-capture.json");
  mkdirSync(fakeBin, { recursive: true });
  const fakeClaude = join(fakeBin, "claude");
  writeFileSync(fakeClaude, `#!/bin/sh\nprintf '{"arg":"%s","lifeosHome":"%s","claudeConfigDir":"%s"}\\n' "$1" "$LIFEOS_HOME" "$CLAUDE_CONFIG_DIR" > "$LIFEOS_BOOTSTRAP_CAPTURE"\n`);
  chmodSync(fakeClaude, 0o755);
  const env = toolEnv(fakeHome, {
    PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
    LIFEOS_SRC: dirname(skillRoot),
    LIFEOS_TAG: "v-test",
    LIFEOS_BOOTSTRAP_CAPTURE: capturePath,
  });
  const bootstrap = Bun.spawnSync(["bash", join(skillRoot, "install", "install.sh"), "--home", configRoot], { env, stdout: "pipe", stderr: "pipe" });
  const captured = existsSync(capturePath) ? JSON.parse(readFileSync(capturePath, "utf-8")) as Record<string, string> : {};
  check(S, "bootstrap stages LifeOS under the custom root", existsSync(join(configRoot, "skills", "LifeOS", "SKILL.md")), bootstrap.stdout.toString() + bootstrap.stderr.toString());
  check(S, "bootstrap launches the staged skill through CLAUDE_CONFIG_DIR", bootstrap.exitCode === 0 && captured.arg === "/lifeos-setup" && captured.lifeosHome === configRoot && captured.claudeConfigDir === configRoot, bootstrap.stdout.toString() + bootstrap.stderr.toString() + JSON.stringify(captured));
}

// The nested LifeOS payload is a supported direct-deploy path; keep its
// installer implementation synchronized with the authoritative outer skill.
{
  const S = "F:packaged-copy";
  const nested = join(skillRoot, "install", "skills", "LifeOS");
  for (const rel of [
    "Tools/ActivateImports.ts",
    "Tools/DetectEnv.ts",
    "Tools/DeployComponents.ts",
    "Tools/DeployCore.ts",
    "Tools/InstallEngine.ts",
    "Tools/InstallHooks.ts",
    "Tools/InstallSettings.ts",
    "Tools/LinkUser.ts",
    "Tools/ScaffoldUser.ts",
    "Tools/ScanConflicts.ts",
    "Tools/SeedPulse.ts",
    "Workflows/Interview.md",
    "Workflows/Setup.md",
    "Workflows/Uninstall.md",
    "Workflows/Update.md",
    "INSTALL.md",
    "install/CLAUDE.template.md",
    "install/install.sh",
    "install/settings.system.json",
  ]) {
    check(S, `packaged ${rel} matches the authoritative skill`, readFileSync(join(skillRoot, rel), "utf-8") === readFileSync(join(nested, rel), "utf-8"), rel);
  }
}

// ─── Report ──────────────────────────────────────────────────────────
const failed = checks.filter((c) => !c.passed);
const ok = failed.length === 0;
const retain = keep || !ok;
if (!retain) rmSync(workRoot, { recursive: true, force: true });

console.log(JSON.stringify({
  ok,
  passed: checks.length - failed.length,
  failed: failed.length,
  checks: ok ? checks.map(({ scenario, name }) => `${scenario} ✓ ${name}`) : checks,
  workRoot: retain ? workRoot : undefined,
  note: retain && !ok ? "temp workspace retained for inspection" : undefined,
}, null, 2));
process.exit(ok ? 0 : 1);
