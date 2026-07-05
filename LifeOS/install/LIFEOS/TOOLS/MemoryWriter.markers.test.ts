#!/usr/bin/env bun
/**
 * Regression test for the hot-layer memory marker bug.
 * Exercises the never-tested path: a fact written in one "session" must be
 * readable in the next. Run with an isolated HOME so it hits the real public
 * API (setEntries/read) without touching the live tree:
 *   HOME=/tmp/mem-test bun test-memory-markers.ts
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const WT = new URL(".", import.meta.url).pathname;
const HOME = homedir();
const USER = join(HOME, ".claude/LIFEOS/USER/PRINCIPAL");
const OBS = join(HOME, ".claude/LIFEOS/MEMORY/OBSERVABILITY");
const FILE = join(USER, "PRINCIPAL_MEMORY.md");

const FIXED_TEMPLATE = `---
schema_version: 1
cap_entries: 48
cap_chars_per_entry: 256
last_updated: 2026-01-01
last_updated_by: bootstrap-template
convention: pai-freshness-v1
---

# Principal Hot-Layer Memory

> Auto-curated hot-layer memory about you.

<!-- Entries are appended automatically by the memory curation loop. Empty on a fresh install — this is expected. -->
<!-- BEGIN ENTRIES -->
<!-- END ENTRIES -->
`;

// A file corrupted by the OLD bug: no BEGIN, stray ENDs, orphaned entries.
const CORRUPTED = `---
schema_version: 1
cap_entries: 48
cap_chars_per_entry: 256
last_updated: 2026-01-01
last_updated_by: bootstrap-template
convention: pai-freshness-v1
---

# Principal Hot-Layer Memory

<!-- Entries are appended automatically by the memory curation loop. Empty on a fresh install — this is expected. -->
PREFERENCE: existing fact one ~explicit
<!-- END ENTRIES -->
PREFERENCE: existing fact two ~inferred
<!-- END ENTRIES -->
`;

const BEGIN = "<!-- BEGIN ENTRIES -->";
const END = "<!-- END ENTRIES -->";

// Mirror of LoadMemory.hook.ts readMemory(): the consumer contract.
function readerSees(raw: string): string[] {
  const s = raw.indexOf(BEGIN), e = raw.indexOf(END);
  if (s === -1 || e === -1 || e < s) return [];
  return raw.slice(s + BEGIN.length, e).trim().split("\n").map(l => l.trim()).filter(Boolean);
}

let failures = 0;
const check = (name: string, cond: boolean, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${cond ? "" : "  — " + detail}`);
  if (!cond) failures++;
};

mkdirSync(USER, { recursive: true });
mkdirSync(OBS, { recursive: true });
mkdirSync(join(HOME, ".claude/LIFEOS/USER/DIGITAL_ASSISTANT"), { recursive: true });

const { setEntries, read } = await import(join(WT, "MemoryWriter.ts"));

// ── Scenario A: fresh (fixed) template — write in session 1, read in session 2 ──
writeFileSync(FILE, FIXED_TEMPLATE);
check("A0: fresh template starts empty to the reader", readerSees(readFileSync(FILE, "utf8")).length === 0);
setEntries(FILE, ["PREFERENCE: session-1 wrote this ~explicit"]);
const afterA = readFileSync(FILE, "utf8");
check("A1: reader (LoadMemory contract) now sees the written fact", readerSees(afterA).includes("PREFERENCE: session-1 wrote this ~explicit"));
check("A2: read() API returns 1 entry", (read(FILE) as any).count === 1);
check("A3: exactly one BEGIN + one END", (afterA.match(/BEGIN ENTRIES/g)||[]).length === 1 && (afterA.match(/END ENTRIES/g)||[]).length === 1);

// ── Scenario B: heal a file the OLD bug already corrupted ──
// The real heal path: read() (parseFile) recovers orphaned entries, then
// MemorySystem.add does read → append → setEntries (MemorySystem.ts:243).
writeFileSync(FILE, CORRUPTED);
check("B0: corrupted file reads as 0 to the consumer (the bug)", readerSees(CORRUPTED).length === 0);
const recovered = (read(FILE) as any).entries as string[];
check("B1: read()/parseFile recovers orphaned fact one", recovered.includes("PREFERENCE: existing fact one ~explicit"), recovered.join(" | "));
check("B2: read()/parseFile recovers orphaned fact two", recovered.includes("PREFERENCE: existing fact two ~inferred"), recovered.join(" | "));
// Simulate MemorySystem.add: merge current + new, then set-overwrite.
setEntries(FILE, [...recovered, "PREFERENCE: session-N new fact ~explicit"]);
const afterB = readFileSync(FILE, "utf8");
const seenB = readerSees(afterB);
check("B3: after add-flow, reader sees both orphaned facts + the new one", seenB.length === 3 && seenB.includes("PREFERENCE: session-N new fact ~explicit"), seenB.join(" | "));
check("B4: self-healed to exactly one BEGIN + one END", (afterB.match(/BEGIN ENTRIES/g)||[]).length === 1 && (afterB.match(/END ENTRIES/g)||[]).length === 1, `B=${(afterB.match(/BEGIN ENTRIES/g)||[]).length} E=${(afterB.match(/END ENTRIES/g)||[]).length}`);

// ── Scenario C: recovery must NOT adopt PREFIX lines inside a code fence / blockquote ──
const FENCED = `---
schema_version: 1
cap_entries: 48
cap_chars_per_entry: 256
last_updated: 2026-01-01
last_updated_by: bootstrap-template
convention: pai-freshness-v1
---

# Principal Hot-Layer Memory

> Auto-curated hot-layer memory about you.

Example of the entry format used below:
\`\`\`
PREFERENCE: this is only a documentation example ~explicit
\`\`\`
> RULE: this blockquoted line is a citation, not a real entry ~explicit
PREFERENCE: this one is a genuine entry ~explicit
`;
writeFileSync(FILE, FENCED);
const recC = (read(FILE) as any).entries as string[];
check("C1: fenced PREFERENCE example NOT adopted as an entry", !recC.some(e => e.includes("documentation example")), recC.join(" | "));
check("C2: blockquoted RULE citation NOT adopted", !recC.some(e => e.includes("citation")), recC.join(" | "));
check("C3: the one genuine entry IS recovered", recC.includes("PREFERENCE: this one is a genuine entry ~explicit"), recC.join(" | "));

rmSync(join(HOME, ".claude"), { recursive: true, force: true });
console.log(failures === 0 ? "\n🎉 ALL PASS" : `\n💥 ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
