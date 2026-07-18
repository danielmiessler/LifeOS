#!/usr/bin/env bun
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { homedir } from "node:os";
import { parseFrontmatter } from "../lib/frontmatter";
import { claudeDir } from "../../TOOLS/lifeos-root";

const args = process.argv.slice(2);
const stagingArg = args.find((a) => !a.startsWith("--"));
if (!stagingArg || args.includes("--help")) {
  console.log(`Usage: bun ReleaseAudit.ts <path-to-staged-release> [--strict]

Audits a staged LifeOS release for:
  1. USER/ files with provenance != template (or missing provenance) — must be excluded
  2. PULSE_DATA/ contents (must be absent entirely)
  3. Prohibited identity strings loaded from a USER-zone config file
     (the audit tool ships generic; the strings are user-specific and never ship)

Exit 0 if clean. Exit 1 if any violations.`);
  process.exit(stagingArg ? 0 : 1);
}

const STAGING = resolve(stagingArg);
if (!existsSync(STAGING)) {
  console.error(`error: staging dir does not exist: ${STAGING}`);
  process.exit(1);
}

// Load PROHIBITED_STRINGS from USER-zone config (never ships publicly).
// File format: JSON array of strings. If missing or invalid, default to empty —
// audit then only enforces the provenance + PULSE_DATA checks (still useful).
// Public LifeOS users populate their own list; the principal populates with
// principal-bound names (surname, partner names, phonetics, etc.).
function loadProhibitedStrings(): string[] {
  const candidates = [
    process.env.LIFEOS_RELEASE_AUDIT_STRINGS,
    join(homedir(), ".config/LIFEOS/USER/CONFIG/release-audit-strings.json"),
    join(claudeDir(), "LIFEOS/USER/CONFIG/release-audit-strings.json"),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      if (!existsSync(p)) continue;
      const raw = readFileSync(p, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }
  return [];
}

const PROHIBITED_STRINGS = loadProhibitedStrings();

interface Issue {
  path: string;
  rule: string;
  detail: string;
}

const issues: Issue[] = [];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry.startsWith(".git")) continue;
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(STAGING);
console.log(`Auditing ${files.length} file(s) in ${STAGING}…\n`);

for (const file of files) {
  const rel = relative(STAGING, file);

  if (rel.startsWith("LIFEOS/MEMORY/PULSE_DATA/") || rel.includes("/MEMORY/PULSE_DATA/")) {
    issues.push({ path: rel, rule: "containment", detail: "PULSE_DATA/ contents must not ship" });
    continue;
  }

  if (rel.startsWith("LIFEOS/USER/") && (rel.endsWith(".md") || rel.endsWith(".markdown"))) {
    if (rel.startsWith("LIFEOS/USER/_TEMPLATES/")) continue;
    try {
      const fm = parseFrontmatter(readFileSync(file, "utf8"));
      const prov = fm.data.provenance;
      if (prov !== "template") {
        issues.push({ path: rel, rule: "provenance", detail: `frontmatter provenance is "${prov ?? "(missing)"}" — only "template" may ship` });
      }
    } catch (e) {
      issues.push({ path: rel, rule: "parse", detail: `frontmatter parse failed: ${(e as Error).message}` });
    }
  }

  if (rel.endsWith(".md") || rel.endsWith(".markdown") || rel.endsWith(".ts") || rel.endsWith(".js") || rel.endsWith(".json") || rel.endsWith(".toml")) {
    if (rel.startsWith("LIFEOS/USER/_TEMPLATES/")) continue;
    const content = readFileSync(file, "utf8");
    for (const s of PROHIBITED_STRINGS) {
      if (content.includes(s)) {
        issues.push({ path: rel, rule: "prohibited-string", detail: `contains "${s}"` });
        break;
      }
    }
  }
}

if (issues.length === 0) {
  console.log("✓ release clean");
  process.exit(0);
}

console.error(`✗ ${issues.length} violation(s):\n`);
for (const i of issues) console.error(`  [${i.rule}] ${i.path} → ${i.detail}`);
process.exit(1);
