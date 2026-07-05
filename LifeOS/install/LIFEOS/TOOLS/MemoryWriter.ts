#!/usr/bin/env bun
/**
 * MemoryWriter — set-overwrite writer for PRINCIPAL_MEMORY.md / DA_MEMORY.md.
 *
 * LifeOS autonomic memory subsystem, F2.
 *
 * Set-overwrite design: the reviewer
 * submits the canonical full list it wants for a memory file. The writer:
 *   1. Validates each entry against the 5-prefix schema (silent-drop malformed)
 *   2. Validates each entry's length ≤ 256 chars (silent-drop over-length)
 *   3. Deduplicates (case-sensitive string match)
 *   4. Checks the accepted+deduped count against the 48-entry cap; if over,
 *      returns a structured at-cap error so the model can re-submit trimmed
 *   5. Writes atomically: acquire <file>.lock → write <file>.tmp → atomic rename
 *
 * Why set-overwrite beats incremental add/replace/remove:
 *   - No race surface (single atomic write per review)
 *   - Idempotent (same input produces same file)
 *   - Eviction is structural (model omits entries it wants gone)
 *   - Simpler mental model: "here is the state I want"
 *
 * Five prefixes only (case-sensitive, exact match, followed by ": "):
 *   NAME | ROLE | RELATION | PREFERENCE | RULE
 *
 * Allowed paths only (resolved + suffix-matched, no symlink escape):
 *   LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md
 *   LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md
 *
 * Observability: every successful setEntries appends a JSONL row to
 * MEMORY/OBSERVABILITY/memory-writes.jsonl per ISC-107.
 *
 * CLI:
 *   bun MemoryWriter.ts read <path>
 *   bun MemoryWriter.ts set <path> <entries-as-newline-delimited-stdin>
 *   bun MemoryWriter.ts test    (runs built-in smoke test)
 */

import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { homedir } from "node:os";

// ── Constants ──

const CLAUDE_ROOT = pathResolve(homedir(), ".claude");

const ALLOWED_FILES = new Set<string>([
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md"),
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md"),
]);

const PREFIX_PATTERN = /^(NAME|ROLE|RELATION|PREFERENCE|RULE): /;
const MAX_CHARS_PER_ENTRY = 256;
const MAX_ENTRIES = 48;

const BEGIN_MARKER = "<!-- BEGIN ENTRIES -->";
const END_MARKER = "<!-- END ENTRIES -->";

const OBSERVABILITY_PATH = pathResolve(
  CLAUDE_ROOT,
  "LIFEOS/MEMORY/OBSERVABILITY/memory-writes.jsonl",
);

// ── Types ──

export interface SetEntriesOk {
  ok: true;
  accepted: number;
  dropped_malformed: number;
  dropped_overlength: number;
  dropped_duplicates: number;
  prior_count: number;
  new_count: number;
  evictions: string[];
  additions: string[];
}

export interface SetEntriesErrAtCap {
  ok: false;
  code: "EAT_CAP";
  message: string;
  over_count: number;
  cap: number;
  indexed_submission: string[];
}

export interface SetEntriesErrPath {
  ok: false;
  code: "EINVAL_PATH";
  message: string;
}

export interface SetEntriesErrLock {
  ok: false;
  code: "ELOCK_HELD";
  message: string;
}

export interface SetEntriesErrIO {
  ok: false;
  code: "EWRITE_FAILED";
  message: string;
}

export interface SetEntriesErrShrink {
  ok: false;
  code: "ESUSPECT_SHRINK";
  message: string;
  prior_count: number;
  new_count: number;
}

export type SetEntriesResult =
  | SetEntriesOk
  | SetEntriesErrAtCap
  | SetEntriesErrPath
  | SetEntriesErrLock
  | SetEntriesErrIO
  | SetEntriesErrShrink;

export interface ReadResult {
  entries: string[];
  count: number;
  chars_used: number;
  cap_entries: number;
  cap_chars: number;
}

// ── Path validation ──

function validatePath(filePath: string): { ok: true; abs: string } | SetEntriesErrPath {
  let abs: string;
  try {
    abs = pathResolve(filePath);
  } catch (e) {
    return { ok: false, code: "EINVAL_PATH", message: `Cannot resolve path: ${filePath}` };
  }
  if (!ALLOWED_FILES.has(abs)) {
    return {
      ok: false,
      code: "EINVAL_PATH",
      message: `Path not in allowlist. MemoryWriter only operates on PRINCIPAL_MEMORY.md / DA_MEMORY.md. Got: ${abs}`,
    };
  }
  return { ok: true, abs };
}

// ── Entry validation ──

interface ValidationOutcome {
  accepted: string[];
  malformed: number;
  overlength: number;
  duplicates: number;
}

function validateAndDedup(entries: string[]): ValidationOutcome {
  const seen = new Set<string>();
  const accepted: string[] = [];
  let malformed = 0;
  let overlength = 0;
  let duplicates = 0;

  for (const raw of entries) {
    const entry = raw.trim();
    if (entry.length === 0) continue;

    const m = entry.match(PREFIX_PATTERN);
    if (!m) {
      malformed++;
      continue;
    }

    // Length check: total entry length must be ≤ prefix.length + MAX_CHARS_PER_ENTRY
    // Equivalently: the content AFTER the prefix must be ≤ MAX_CHARS_PER_ENTRY.
    const prefixWithColonSpace = m[0]; // e.g. "PREFERENCE: "
    const content = entry.slice(prefixWithColonSpace.length);
    if (content.length > MAX_CHARS_PER_ENTRY) {
      overlength++;
      continue;
    }

    if (seen.has(entry)) {
      duplicates++;
      continue;
    }
    seen.add(entry);
    accepted.push(entry);
  }

  return { accepted, malformed, overlength, duplicates };
}

// ── File parse / serialize ──

interface ParsedFile {
  frontmatter: string;
  preEntriesBody: string;
  entries: string[];
  postEntriesBody: string;
}

function parseFile(content: string): ParsedFile {
  // Frontmatter is between two --- lines at the top.
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  const frontmatter = fmMatch ? fmMatch[0] : "";
  const afterFm = content.slice(frontmatter.length);

  const beginIdx = afterFm.indexOf(BEGIN_MARKER);
  const endIdx = afterFm.indexOf(END_MARKER);

  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    // Markers missing or malformed. Happens on files scaffolded before the
    // entry markers existed, and on files a prior write corrupted by appending
    // after the body (leaving stray END markers and no BEGIN). Recover any
    // existing entries from the body and drop stray markers, so serializeFile
    // can re-emit a canonical BEGIN…END block. Without this, the whole body
    // (including real entries) becomes preEntriesBody, the entries block stays
    // empty, and readers that slice between the markers silently see nothing.
    const recoveredEntries: string[] = [];
    const preambleLines: string[] = [];
    let sawEntry = false;
    let inFence = false;
    for (const line of afterFm.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
        inFence = !inFence;
        if (!sawEntry) preambleLines.push(line);
        continue;
      }
      if (trimmed === BEGIN_MARKER || trimmed === END_MARKER) continue;
      // Only treat a line as an entry when it is not inside a fenced code block
      // or a blockquote — prose/examples there can legitimately look like an
      // entry (e.g. a documented `PREFERENCE: …` sample) and must not be adopted.
      if (!inFence && !trimmed.startsWith(">") && PREFIX_PATTERN.test(trimmed)) {
        recoveredEntries.push(trimmed);
        sawEntry = true;
        continue;
      }
      if (!sawEntry) preambleLines.push(line);
    }
    return {
      frontmatter,
      preEntriesBody: preambleLines.join("\n").replace(/\s+$/, "") + "\n",
      entries: recoveredEntries,
      postEntriesBody: "",
    };
  }

  const preEntriesBody = afterFm.slice(0, beginIdx + BEGIN_MARKER.length);
  const entriesBlock = afterFm.slice(beginIdx + BEGIN_MARKER.length, endIdx);
  const postEntriesBody = afterFm.slice(endIdx);

  const entries = entriesBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && PREFIX_PATTERN.test(line));

  return { frontmatter, preEntriesBody, entries, postEntriesBody };
}

function updateFrontmatterTimestamp(frontmatter: string): string {
  if (!frontmatter) return frontmatter;
  const now = new Date().toISOString();
  // Replace last_updated value
  if (/^last_updated:.*$/m.test(frontmatter)) {
    return frontmatter.replace(/^last_updated:.*$/m, `last_updated: ${now}`);
  }
  // Add it before the closing ---
  return frontmatter.replace(/\n---\n$/, `\nlast_updated: ${now}\n---\n`);
}

function updateFrontmatterUpdatedBy(frontmatter: string, by: string): string {
  if (!frontmatter) return frontmatter;
  if (/^last_updated_by:.*$/m.test(frontmatter)) {
    return frontmatter.replace(/^last_updated_by:.*$/m, `last_updated_by: ${by}`);
  }
  return frontmatter.replace(/\n---\n$/, `\nlast_updated_by: ${by}\n---\n`);
}

function serializeFile(parsed: ParsedFile, newEntries: string[], updatedBy: string): string {
  let fm = updateFrontmatterTimestamp(parsed.frontmatter);
  fm = updateFrontmatterUpdatedBy(fm, updatedBy);

  // Ensure the entries block is opened by exactly one BEGIN_MARKER. Healthy
  // files already carry it in preEntriesBody; a recovered/marker-less file does
  // not, so add it here — the symmetric partner to the END_MARKER guard below.
  // Without both guards a missing BEGIN silently swallows every entry.
  let pre = parsed.preEntriesBody;
  if (!pre.includes(BEGIN_MARKER)) {
    pre = pre.replace(/\s+$/, "") + "\n" + BEGIN_MARKER;
  }
  if (!pre.endsWith("\n")) pre += "\n";

  const entriesBlock = newEntries.length === 0 ? "" : newEntries.join("\n") + "\n";

  let post = parsed.postEntriesBody;
  // Ensure post starts cleanly with the END_MARKER
  if (!post.startsWith(END_MARKER)) {
    // Should not happen given parseFile guarantees, but defensive
    post = END_MARKER + post;
  }

  return fm + pre + entriesBlock + post;
}

// ── Atomic write with lock ──

function withLock<T>(filePath: string, action: () => T): T | SetEntriesErrLock | SetEntriesErrIO {
  const lockPath = `${filePath}.lock`;
  let fd: number | null = null;
  try {
    fd = openSync(lockPath, "wx"); // O_CREAT | O_EXCL
  } catch (e: any) {
    if (e?.code === "EEXIST") {
      return {
        ok: false,
        code: "ELOCK_HELD",
        message: `Lock held by another writer: ${lockPath}. Investigate stale lock if persistent.`,
      };
    }
    return {
      ok: false,
      code: "EWRITE_FAILED",
      message: `Failed to acquire lock: ${e?.message || String(e)}`,
    };
  }

  try {
    const result = action();
    return result;
  } catch (e: any) {
    return {
      ok: false,
      code: "EWRITE_FAILED",
      message: `Write action threw: ${e?.message || String(e)}`,
    };
  } finally {
    try {
      if (fd !== null) closeSync(fd);
    } catch { /* ignore */ }
    try {
      unlinkSync(lockPath);
    } catch { /* lockfile cleanup best-effort */ }
  }
}

// ── Per-write snapshots (recoverability) ──
// Every Tier-A write snapshots the PRIOR file content to a ring buffer before
// overwriting. set-overwrite has a "wipe the whole file" blast radius; git only
// covers between commits. This makes every individual autonomic write reversible
// via `MemoryRestore.ts`. Cheap: one file copy of <13KB, capped at 30 per file.
const SNAPSHOT_DIR = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/memory-snapshots");
const SNAPSHOT_RING = 30;

function snapshotBeforeWrite(absPath: string, priorContent: string): void {
  try {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const base = absPath.split("/").pop()!.replace(/\.md$/, "");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(pathResolve(SNAPSHOT_DIR, `${base}__${stamp}.md`), priorContent, "utf8");
    // Trim the ring: keep the newest SNAPSHOT_RING per base file.
    const mine = readdirSync(SNAPSHOT_DIR)
      .filter((f: string) => f.startsWith(`${base}__`))
      .sort(); // ISO stamp sorts chronologically
    for (const stale of mine.slice(0, Math.max(0, mine.length - SNAPSHOT_RING))) {
      try { rmSync(pathResolve(SNAPSHOT_DIR, stale)); } catch { /* best-effort */ }
    }
  } catch {
    // Snapshotting is best-effort; never fail a write because the backup failed.
  }
}

function atomicWrite(filePath: string, content: string): true | SetEntriesErrIO {
  const tmpPath = `${filePath}.tmp`;
  try {
    writeFileSync(tmpPath, content, "utf8");
    // fsync the tmp file for durability before rename
    const fd = openSync(tmpPath, "r+");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmpPath, filePath);
    return true;
  } catch (e: any) {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    return {
      ok: false,
      code: "EWRITE_FAILED",
      message: `Atomic write failed: ${e?.message || String(e)}`,
    };
  }
}

// ── Observability ──

function logWriteEvent(
  filePath: string,
  result: SetEntriesOk,
  updatedBy?: string,
): void {
  try {
    mkdirSync(dirname(OBSERVABILITY_PATH), { recursive: true });
    const row = JSON.stringify({
      ts: new Date().toISOString(),
      file: filePath.replace(CLAUDE_ROOT + "/", ""),
      updated_by: updatedBy ?? "unknown",
      prior_count: result.prior_count,
      new_count: result.new_count,
      accepted: result.accepted,
      dropped_malformed: result.dropped_malformed,
      dropped_overlength: result.dropped_overlength,
      dropped_duplicates: result.dropped_duplicates,
      evictions: result.evictions,
      additions: result.additions,
    });
    appendFileSync(OBSERVABILITY_PATH, row + "\n", "utf8");
  } catch {
    // Observability is best-effort; never fail a write because logging failed.
  }
}

// ── Public API ──

export interface SetEntriesOptions {
  /** Who is writing — appears in the file's frontmatter last_updated_by. */
  updatedBy?: string;
  /** Bypass the catastrophic-shrink guard (legitimate full-clear / restore). */
  allowDrastic?: boolean;
}

export function setEntries(
  filePath: string,
  entries: string[],
  options: SetEntriesOptions = {},
): SetEntriesResult {
  const pathCheck = validatePath(filePath);
  if (!("abs" in pathCheck)) return pathCheck;
  const abs = pathCheck.abs;

  if (!existsSync(abs)) {
    return {
      ok: false,
      code: "EINVAL_PATH",
      message: `Memory file does not exist (scaffold it first): ${abs}`,
    };
  }

  const validated = validateAndDedup(entries);
  const submitted = validated.accepted.length;
  const indexedSubmission = validated.accepted.map((e, i) => `[${i}] ${e}`);

  if (submitted > MAX_ENTRIES) {
    return {
      ok: false,
      code: "EAT_CAP",
      message: `Memory file cap is ${MAX_ENTRIES} entries — your submission has ${submitted} accepted+deduped entries. Trim ${submitted - MAX_ENTRIES} before re-submitting.`,
      over_count: submitted - MAX_ENTRIES,
      cap: MAX_ENTRIES,
      indexed_submission: indexedSubmission,
    };
  }

  const result = withLock(abs, () => {
    const content = readFileSync(abs, "utf8");
    const parsed = parseFile(content);
    const priorEntries = parsed.entries;
    const newEntries = validated.accepted;

    // Compute the symmetric delta: evictions (present before, absent now) and
    // additions (absent before, present now). Both feed the visibility surface.
    const newSet = new Set(newEntries);
    const priorSet = new Set(priorEntries);
    const evictions = priorEntries.filter((e) => !newSet.has(e));
    const additions = newEntries.filter((e) => !priorSet.has(e));

    // Catastrophic-shrink guard (computed IN-LOCK against the just-read prior
    // state, so it can't race a concurrent write). set-overwrite REPLACES the
    // file, so a hallucinated empty/tiny reviewer list would wipe real memory
    // (this exact wipe happened once during a cross-vendor audit). We block two
    // shapes only — and deliberately ALLOW large honest consolidation (many
    // drops accompanied by additions), so the reviewer can still shrink hard
    // when it's genuinely merging. Bypass for legitimate full-clears via opts.
    if (!options.allowDrastic && priorEntries.length >= 10) {
      const FLOOR = 3;
      const massDeleteNoAdd = evictions.length > priorEntries.length * 0.5 && additions.length === 0;
      if (newEntries.length < FLOOR || massDeleteNoAdd) {
        const shrinkErr: SetEntriesErrShrink = {
          ok: false,
          code: "ESUSPECT_SHRINK",
          message: `Refused: op would shrink ${priorEntries.length} → ${newEntries.length} entries (${evictions.length} dropped, ${additions.length} added). Near-empty results and mass-deletion-without-curation are blocked as likely-bad output. A real consolidation that drops many should also ADD merged entries.`,
          prior_count: priorEntries.length,
          new_count: newEntries.length,
        };
        return shrinkErr;
      }
    }

    // Snapshot the prior content before we overwrite — individual-write recovery.
    snapshotBeforeWrite(abs, content);

    const newContent = serializeFile(parsed, newEntries, options.updatedBy || "MemoryWriter");
    const writeRes = atomicWrite(abs, newContent);
    if (writeRes !== true) return writeRes;

    const ok: SetEntriesOk = {
      ok: true,
      accepted: newEntries.length,
      dropped_malformed: validated.malformed,
      dropped_overlength: validated.overlength,
      dropped_duplicates: validated.duplicates,
      prior_count: priorEntries.length,
      new_count: newEntries.length,
      evictions,
      additions,
    };
    logWriteEvent(abs, ok, options.updatedBy);
    return ok;
  });

  return result;
}

export function read(filePath: string): ReadResult | SetEntriesErrPath {
  const pathCheck = validatePath(filePath);
  if (!("abs" in pathCheck)) return pathCheck;
  const abs = pathCheck.abs;

  if (!existsSync(abs)) {
    // Graceful degradation: missing file reads as zero entries
    return {
      entries: [],
      count: 0,
      chars_used: 0,
      cap_entries: MAX_ENTRIES,
      cap_chars: MAX_ENTRIES * MAX_CHARS_PER_ENTRY,
    };
  }

  const content = readFileSync(abs, "utf8");
  const parsed = parseFile(content);
  // Silent-drop malformed entries discovered at read time too.
  const valid = validateAndDedup(parsed.entries);
  const chars_used = valid.accepted.reduce((sum, e) => sum + e.length, 0);

  return {
    entries: valid.accepted,
    count: valid.accepted.length,
    chars_used,
    cap_entries: MAX_ENTRIES,
    cap_chars: MAX_ENTRIES * MAX_CHARS_PER_ENTRY,
  };
}

// ── CLI ──

function smokeTest(): number {
  console.log("MemoryWriter smoke test starting…");
  const testFile = pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md");
  const writer = "smoke-test";

  // 1. Read initial state (should be empty)
  const r0 = read(testFile);
  if ("code" in r0) {
    console.error(`FAIL: read returned error: ${r0.message}`);
    return 1;
  }
  console.log(`  initial: ${r0.count}/${r0.cap_entries} entries, ${r0.chars_used}/${r0.cap_chars} chars`);

  // 2. Write 3 valid entries + 1 malformed + 1 over-length + 1 dup
  const longStr = "X".repeat(300);
  const submission = [
    "NAME: SmokeTest User",
    "PREFERENCE: Smoke-test prefers terse outputs",
    "RULE: Smoke-test always cleans up after itself",
    "INVALID_PREFIX: this should be dropped",
    `PREFERENCE: ${longStr}`,
    "NAME: SmokeTest User", // duplicate
  ];
  const w1 = setEntries(testFile, submission, { updatedBy: writer });
  if (!w1.ok) {
    console.error(`FAIL: setEntries returned error: ${w1.code} — ${w1.message}`);
    return 1;
  }
  console.log(`  write 1: accepted=${w1.accepted}, dropped_malformed=${w1.dropped_malformed}, dropped_overlength=${w1.dropped_overlength}, dropped_duplicates=${w1.dropped_duplicates}, evictions=${w1.evictions.length}`);
  if (w1.accepted !== 3) {
    console.error(`FAIL: expected 3 accepted, got ${w1.accepted}`);
    return 1;
  }
  if (w1.dropped_malformed !== 1) {
    console.error(`FAIL: expected 1 malformed drop, got ${w1.dropped_malformed}`);
    return 1;
  }
  if (w1.dropped_overlength !== 1) {
    console.error(`FAIL: expected 1 overlength drop, got ${w1.dropped_overlength}`);
    return 1;
  }
  if (w1.dropped_duplicates !== 1) {
    console.error(`FAIL: expected 1 dup drop, got ${w1.dropped_duplicates}`);
    return 1;
  }

  // 3. Read back, verify
  const r1 = read(testFile);
  if ("code" in r1) {
    console.error(`FAIL: read after write returned error: ${r1.message}`);
    return 1;
  }
  if (r1.count !== 3) {
    console.error(`FAIL: expected 3 entries on readback, got ${r1.count}`);
    return 1;
  }
  console.log(`  readback: ${r1.count}/${r1.cap_entries} entries, ${r1.chars_used}/${r1.cap_chars} chars`);

  // 4. Set-overwrite with fewer entries (test eviction)
  const w2 = setEntries(testFile, ["NAME: SmokeTest User"], { updatedBy: writer });
  if (!w2.ok) {
    console.error(`FAIL: second write returned error: ${(w2 as any).message}`);
    return 1;
  }
  if (w2.evictions.length !== 2) {
    console.error(`FAIL: expected 2 evictions, got ${w2.evictions.length}`);
    return 1;
  }
  console.log(`  write 2 (set-overwrite with 1 entry): evictions=${w2.evictions.length} ← PREFERENCE + RULE evicted`);

  // 5. Test at-cap error
  const tooMany = Array.from({ length: 49 }, (_, i) => `PREFERENCE: smoke entry ${i}`);
  const w3 = setEntries(testFile, tooMany, { updatedBy: writer });
  if (w3.ok) {
    console.error(`FAIL: expected EAT_CAP error, got success`);
    return 1;
  }
  if (w3.code !== "EAT_CAP") {
    console.error(`FAIL: expected EAT_CAP, got ${w3.code}`);
    return 1;
  }
  console.log(`  write 3 (49 entries): correctly rejected with ${w3.code} — over_count=${w3.over_count}`);

  // 6. Test path rejection
  const w4 = setEntries("/etc/passwd", ["NAME: hacker"], { updatedBy: writer });
  if (w4.ok) {
    console.error(`FAIL: expected EINVAL_PATH for /etc/passwd, got success`);
    return 1;
  }
  if (w4.code !== "EINVAL_PATH") {
    console.error(`FAIL: expected EINVAL_PATH, got ${w4.code}`);
    return 1;
  }
  console.log(`  write 4 (/etc/passwd): correctly rejected with ${w4.code}`);

  // 7. Cleanup — restore to empty
  const w5 = setEntries(testFile, [], { updatedBy: "smoke-test-cleanup" });
  if (!w5.ok) {
    console.error(`FAIL: cleanup write returned error: ${(w5 as any).message}`);
    return 1;
  }
  console.log(`  cleanup: ${w5.new_count} entries remaining (should be 0)`);

  console.log("✓ MemoryWriter smoke test PASSED");
  return 0;
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "test") {
    process.exit(smokeTest());
  }
  if (cmd === "read") {
    const path = process.argv[3];
    if (!path) {
      console.error("Usage: bun MemoryWriter.ts read <path>");
      process.exit(2);
    }
    const r = read(path);
    console.log(JSON.stringify(r, null, 2));
    process.exit("code" in r ? 1 : 0);
  }
  if (cmd === "set") {
    const path = process.argv[3];
    if (!path) {
      console.error("Usage: bun MemoryWriter.ts set <path>  (entries via stdin, one per line)");
      process.exit(2);
    }
    const stdin = await new Promise<string>((resolve) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { data += chunk; });
      process.stdin.on("end", () => resolve(data));
    });
    const entries = stdin.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const r = setEntries(path, entries, { updatedBy: "cli" });
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  }
  console.error("Usage: bun MemoryWriter.ts {test|read <path>|set <path>}");
  process.exit(2);
}

if (import.meta.main) {
  main();
}
