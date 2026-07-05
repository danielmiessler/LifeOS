#!/usr/bin/env bun
// Run with an isolated HOME: HOME=<tmp> bun test-migration.ts
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const MIG = new URL("./MigrateMemoryMarkers.ts", import.meta.url).pathname;
const H = homedir();
const P = join(H, ".claude/LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md");
const D = join(H, ".claude/LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md");
mkdirSync(join(H, ".claude/LIFEOS/USER/PRINCIPAL"), { recursive: true });
mkdirSync(join(H, ".claude/LIFEOS/USER/DIGITAL_ASSISTANT"), { recursive: true });
mkdirSync(join(H, ".claude/LIFEOS/MEMORY/OBSERVABILITY"), { recursive: true });

const FM = `---\nschema_version: 1\ncap_entries: 48\ncap_chars_per_entry: 256\nlast_updated: 2026-01-01\nlast_updated_by: bootstrap-template\nconvention: pai-freshness-v1\n---\n\n# Hot-Layer Memory\n\n`;
// Corrupted principal: no BEGIN, two stray ENDs, two orphaned entries.
writeFileSync(P, FM + `PREFERENCE: orphaned alpha ~explicit\n<!-- END ENTRIES -->\nPREFERENCE: orphaned beta ~inferred\n<!-- END ENTRIES -->\n`);
// Canonical DA: must be left untouched.
const CANON = FM + `<!-- BEGIN ENTRIES -->\nRULE: healthy entry ~explicit\n<!-- END ENTRIES -->\n`;
writeFileSync(D, CANON);

const BEGIN = "<!-- BEGIN ENTRIES -->", END = "<!-- END ENTRIES -->";
const readerSees = (raw: string): string[] => {
  const s = raw.indexOf(BEGIN), e = raw.indexOf(END);
  if (s === -1 || e === -1 || e < s) return [];
  return raw.slice(s + BEGIN.length, e).trim().split("\n").map(l => l.trim()).filter(Boolean);
};
const run = (dry: boolean) => Bun.spawnSync(["bun", MIG, ...(dry ? ["--dry-run"] : [])], { env: { ...process.env, HOME: H } });

let fails = 0;
const check = (n: string, c: boolean, d = "") => { console.log(`${c ? "✅" : "❌"} ${n}${c ? "" : "  — " + d}`); if (!c) fails++; };

// 1) dry-run: reports but writes nothing
const dry = run(true); const dryOut = dry.stdout.toString();
check("dry-run flags principal as would-repair", /would-repair.*PRINCIPAL_MEMORY/s.test(dryOut) || /would-repair/.test(dryOut), dryOut);
check("dry-run leaves canonical DA as skip-ok", /skip-ok.*DA_MEMORY|DA_MEMORY.*already/s.test(dryOut), dryOut);
check("dry-run did NOT modify the corrupted file", readerSees(readFileSync(P, "utf8")).length === 0);

// 2) real run: heals principal, leaves DA
const real = run(false); const realOut = real.stdout.toString();
check("real run reports principal repaired", /repaired.*PRINCIPAL_MEMORY|PRINCIPAL_MEMORY.*recovered/s.test(realOut), realOut);
const healed = readFileSync(P, "utf8");
const seen = readerSees(healed);
check("healed principal: reader sees orphaned alpha", seen.includes("PREFERENCE: orphaned alpha ~explicit"), seen.join(" | "));
check("healed principal: reader sees orphaned beta", seen.includes("PREFERENCE: orphaned beta ~inferred"), seen.join(" | "));
check("healed principal: exactly one BEGIN + one END", (healed.match(/BEGIN ENTRIES/g)||[]).length === 1 && (healed.match(/END ENTRIES/g)||[]).length === 1);
check("canonical DA left byte-identical", readFileSync(D, "utf8") === CANON);

// 3) idempotent: second run repairs nothing
const again = run(false).stdout.toString();
check("second run is idempotent (0 repaired)", /^0 repaired|\n0 repaired/m.test(again) || again.includes("0 repaired"), again);

console.log(fails === 0 ? "\n🎉 MIGRATION ALL PASS" : `\n💥 ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
