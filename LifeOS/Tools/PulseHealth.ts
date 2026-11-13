#!/usr/bin/env bun
/**
 * PulseHealth — Pulse's health, for the LifeOS installer and doctor.
 *
 * Absorbed from the retired standalone Pulse-setup skill (2026-10-13). One subcommand:
 *
 *   audit   (read-only, the default) — runs every Pulse check against the live install and prints
 *           one status block: schema tool reachable, provenance of the USER copies of the release
 *           templates (template / customized / unstamped counts), templates whose USER destination is
 *           missing, USER files missing an H2 section their shipped template now has (by file and section, advisory),
 *           and the Pulse service at 127.0.0.1:<PULSE_PORT|31337>/healthz. A check that could
 *           not run is reported as NOT RUN, never as passing. Exit 0 only when every check that ran passed.
 *
 * Install-specific values come from `<configRoot>/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/LifeOS/Config.md`:
 *   pulse_templates_dir — the USER template tree to compare against (default
 *   `<configRoot>/skills/LifeOS/install/USER`, where the bootstrap installer leaves the release);
 *   ScaffoldUser copies from the same tree. Read through `lib/skill-config.ts`.
 *
 * Usage:
 *   bun PulseHealth.ts [audit] [--json] [--config-root <dir>]
 */

import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { claudeDirFor } from "./lib/claude-dir";
import { configPath, configuredTemplatesDir, readConfigKey } from "./lib/skill-config";

export { configPath, readConfigKey };

/** `warn` is a finding that does not break Pulse (a template with no USER copy); it never fails the exit code. */
export type CheckState = "pass" | "warn" | "fail" | "not-run";
export interface Check { name: string; state: CheckState; detail: string }

export function resolveConfigRoot(argv: string[], env: Record<string, string | undefined> = process.env): string {
  const i = argv.indexOf("--config-root");
  if (i >= 0 && argv[i + 1]) return resolve(argv[i + 1]!);
  const home = env.HOME || homedir();
  return claudeDirFor(env, home);
}

/** The USER template tree: `pulse_templates_dir` when set, else the installer's shipped copy. */
export function templatesDir(configRoot: string, home = process.env.HOME || homedir()): { dir: string; from: string } {
  return configuredTemplatesDir(configRoot, home) ?? { dir: join(configRoot, "skills", "LifeOS", "install", "USER"), from: "default" };
}

/** Top-level template `*.md` files whose USER destination is missing. */
export function missingFromUser(tplDir: string, userDir: string): string[] {
  if (!existsSync(tplDir)) return [];
  return readdirSync(tplDir)
    .filter((f) => f.endsWith(".md") && statSync(join(tplDir, f)).isFile())
    .filter((f) => !existsSync(join(userDir, f)))
    .sort();
}

export interface SectionDrift { file: string; missing: string[] }

/** The H2 headings of a markdown text, outside code fences, with frontmatter skipped. */
export function h2Headings(text: string): string[] {
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const out: string[] = [];
  let fence = false;
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = fence ? null : line.match(/^##\s+(.+?)\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

/** GenerateTelosSummary's section key: dash suffix and trailing parentheticals dropped, lowercased, plural-tolerant. */
const headingKey = (h: string): string =>
  h.replace(/\s*\(.*\)\s*$/, "").replace(/\s*[—–-].*$/, "").replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase().replace(/s$/, "");

/**
 * Template sections a USER file lacks: for every `*.md` in the template tree (recursively, symlinks skipped) whose USER
 * copy exists, each template H2 heading with no matching USER heading, by file and the template's heading text.
 * Read-only and advisory: the fix is the user's to make, since the USER file is theirs (installer ISA ISC-33).
 */
export function sectionDrift(tplDir: string, userDir: string): SectionDrift[] {
  if (!existsSync(tplDir) || !existsSync(userDir)) return [];
  const drift: SectionDrift[] = [];
  const walk = (rel: string, depth: number): void => {
    if (depth > 8) return;
    for (const name of readdirSync(join(tplDir, rel)).sort()) {
      const r = rel ? `${rel}/${name}` : name;
      const st = lstatSync(join(tplDir, r));
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { walk(r, depth + 1); continue; }
      if (!name.endsWith(".md")) continue;
      const userFile = join(userDir, r);
      if (!existsSync(userFile) || !statSync(userFile).isFile()) continue;
      const have = new Set(h2Headings(readFileSync(userFile, "utf8")).map(headingKey));
      const missing = h2Headings(readFileSync(join(tplDir, r), "utf8")).filter((h) => !have.has(headingKey(h)));
      if (missing.length) drift.push({ file: r, missing });
    }
  };
  walk("", 0);
  return drift;
}

/** Parses `AuditProvenance.ts -v` output into counts. */
export function parseProvenance(out: string): { template: number; customized: number; unknown: number; issues: number; scanned: number } {
  const count = (re: RegExp) => (out.match(re) ?? []).length;
  const scanned = Number(out.match(/Scanned (\d+) unique source file/)?.[1] ?? 0);
  const issues = Number(out.match(/✗ (\d+) issue/)?.[1] ?? 0);
  return {
    template: count(/^\s+template\s+\S/gm),
    customized: count(/^\s+customized\s+\S/gm),
    unknown: count(/^\s+unknown\s+\S/gm),
    issues,
    scanned,
  };
}

/** Probes the Pulse service's /healthz. `port` comes from PULSE_PORT, else 31337. */
export async function serviceHealth(port = Number(process.env.PULSE_PORT || 31337)): Promise<Check> {
  const url = `http://127.0.0.1:${port}/healthz`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return { name: "service", state: r.ok ? "pass" : "fail", detail: `${url} → ${r.status}` };
  } catch (e) {
    return { name: "service", state: "fail", detail: `${url} unreachable (${(e as Error).name}); start it with LIFEOS/PULSE/manage.sh start` };
  }
}

function run(cmd: string[], cwd: string): { code: number; out: string } {
  const p = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode ?? 1, out: `${p.stdout.toString()}${p.stderr.toString()}` };
}

/** The `sections` check: template sections missing from USER files. Advisory (`warn`), never auto-written. */
export function sectionsCheck(tplDir: string, userDir: string, noTemplates = `no template tree at ${tplDir}`): Check {
  if (!existsSync(tplDir)) return { name: "sections", state: "not-run", detail: noTemplates };
  if (!existsSync(userDir)) return { name: "sections", state: "not-run", detail: `no USER tree at ${userDir}` };
  const drift = sectionDrift(tplDir, userDir);
  return drift.length === 0
    ? { name: "sections", state: "pass", detail: "every USER copy of a template has the template's sections" }
    : {
        name: "sections",
        state: "warn",
        detail: `${drift.length} USER file(s) missing a section their template now has: ${drift.map((d) => `${d.file} [${d.missing.join("; ")}]`).join(", ")} (add the heading by hand; nothing rewrites a USER file)`,
      };
}

export async function audit(configRoot: string): Promise<Check[]> {
  const tools = join(configRoot, "LIFEOS", "PULSE", "Tools");
  const checks: Check[] = [];
  const tool = (f: string) => join(tools, f);
  const has = (f: string) => existsSync(tool(f));
  const userDir = join(configRoot, "LIFEOS", "USER");
  const tpl = templatesDir(configRoot);
  const noTemplates = `no template tree at ${tpl.dir} (${tpl.from}); set pulse_templates_dir in ${configPath(configRoot)}`;

  if (has("ValidateSchema.ts")) {
    const r = run(["bun", tool("ValidateSchema.ts"), "--help"], configRoot);
    checks.push({ name: "schema", state: /Usage:/.test(r.out) ? "pass" : "fail", detail: r.out.trim().split("\n")[0] ?? "" });
  } else checks.push({ name: "schema", state: "not-run", detail: `${tool("ValidateSchema.ts")} not found` });

  if (!existsSync(tpl.dir)) checks.push({ name: "provenance", state: "not-run", detail: noTemplates });
  else if (!existsSync(userDir)) checks.push({ name: "provenance", state: "not-run", detail: `no USER tree at ${userDir}` });
  else if (has("AuditProvenance.ts")) {
    const r = run(["bun", tool("AuditProvenance.ts"), "-v", "--templates", tpl.dir, "--user", userDir], configRoot);
    const p = parseProvenance(r.out);
    checks.push({
      name: "provenance",
      state: r.code === 0 ? "pass" : "fail",
      detail: r.code === 2
        ? r.out.trim().split("\n")[0] ?? "AuditProvenance.ts refused its arguments"
        : `${p.scanned} USER copies of release templates · ${p.template} template · ${p.customized} customized · ${p.unknown} unstamped (read as customized) · ${p.issues} issue(s)`,
    });
  } else checks.push({ name: "provenance", state: "not-run", detail: `${tool("AuditProvenance.ts")} not found` });

  if (existsSync(tpl.dir)) {
    const missing = missingFromUser(tpl.dir, userDir);
    checks.push({
      name: "templates",
      state: missing.length === 0 ? "pass" : "warn",
      detail: missing.length === 0
        ? `every top-level template in ${tpl.dir} has a USER copy`
        : `${missing.length} template(s) with no USER copy: ${missing.join(", ")} (Tools/ScaffoldUser.ts --apply copies any missing template from the installed release; a customized file is never overwritten)`,
    });
  } else {
    checks.push({ name: "templates", state: "not-run", detail: noTemplates });
  }

  checks.push(sectionsCheck(tpl.dir, userDir, noTemplates));

  checks.push(await serviceHealth());
  return checks;
}

const MARK: Record<CheckState, string> = { pass: "✓", warn: "!", fail: "✗", "not-run": "–" };

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const sub = argv[0] && !argv[0].startsWith("--") ? argv[0] : "audit";
  const configRoot = resolveConfigRoot(argv);

  if (sub !== "audit") {
    console.error(`unknown subcommand ${sub}; use audit (the Data Plane \`rebuild\` was retired on 2026-10-14)`);
    process.exit(2);
  }

  const checks = await audit(configRoot);
  if (argv.includes("--json")) console.log(JSON.stringify({ configRoot, checks }, null, 2));
  else {
    console.log(`Pulse health · ${configRoot}`);
    for (const c of checks) console.log(`  ${MARK[c.state]} ${c.name.padEnd(11)} ${c.detail}`);
  }
  process.exit(checks.some((c) => c.state === "fail") ? 1 : 0);
}

if (import.meta.main) await main();
