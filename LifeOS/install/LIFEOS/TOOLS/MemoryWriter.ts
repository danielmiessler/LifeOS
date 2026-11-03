#!/usr/bin/env bun
/**
 * @version 1.3.19
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
 * Ledger (curated ⟺ folded, 20260816-cortex-ledger-build): every write —
 * accepted or rejected — is an event in MEMORY/LEDGER/cortex-events.jsonl.
 * Accepted sets are EVENT-FIRST and FAIL-CLOSED: the event carries the full
 * rendered document, the file write is a byte copy of it, and a failed append
 * aborts the write untouched. CortexLedger.ts folds/verifies/heals.
 *
 * CLI:
 *   bun MemoryWriter.ts read <path>
 *   bun MemoryWriter.ts set <path> <entries-as-newline-delimited-stdin>
 *   bun MemoryWriter.ts test    (runs built-in smoke test)
 */

import {
  chmodSync,
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { InvariantViolation, invariant } from "./Invariant";
import { getClaudeDir } from "./Paths"; // public issue #1665 @rogdex24, #1584 @ramazanpolat — aliased resolve sites missed by the 09-03 sweep
import { spawnSync } from "node:child_process";
import { dirname, resolve as pathResolve, type PlatformPath } from "node:path";
import { hasPosixModes, nativePath, rootRelativeKey } from "../../hooks/lib/portable-path";
import { appendEvent, archiveContent, entriesHash, foldState, readRows, sha256, type AppendResult } from "./lib/CortexLedgerCore";
import { isInstructionShaped } from "./InjectionShapes";
import { assertInsideUserData } from "./lib/ForeignDataCheck";
import { ANNOTATION_PATTERN, recordWrite } from "./MemoryEntryMeta";
import { bumpMemoryGeneration } from "./MemoryRetriever";
import { atomicWrite as boundaryAtomicWrite } from "./lib/Boundary";

// ── Constants ──

const CLAUDE_ROOT = getClaudeDir();

const ALLOWED_FILES = new Set<string>([
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md"),
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md"),
]);

const PREFIX_PATTERN = /^(NAME|ROLE|RELATION|PREFERENCE|RULE): /;
const MAX_CHARS_PER_ENTRY = 256;
export const MAX_ENTRIES = 48;
/** Public name for the entry cap, so prompts interpolate it instead of hardcoding 48. */
export const MEMORY_CAP = MAX_ENTRIES;

/**
 * Occupancy at which the reviewer is told to consolidate before adding, and the
 * ONLY point at which a caller's `consolidate` intent may lift the erosion guard
 * below. Derived from the cap so the two can never drift — the reviewer prompt
 * hardcoded 39 in two places while nothing could act on it
 * (public issue #1905, @ksjayeshks).
 */
export const CONSOLIDATE_THRESHOLD = Math.ceil(MAX_ENTRIES * 0.8);

/**
 * Floor a consolidation may never land below. Intent may come from a model;
 * MAGNITUDE stays deterministic — that is the whole lesson of #1761. A genuine
 * merge pass starting at 39–48 has no honest reason to end below half the cap;
 * anything lower is amnesia wearing consolidation's name.
 */
export const CONSOLIDATION_FLOOR = Math.floor(MAX_ENTRIES / 2);

export type GuardVerdict = "ok" | "shrink" | "erosion";

/**
 * The two data-loss guards, as one pure decision so the DANGEROUS directions are
 * testable without widening the path allowlist (which is a security boundary).
 *
 * `allowDrastic` is the human-invoked full-clear/restore bypass and lifts BOTH
 * guards. `consolidation` is the narrow autonomic path: it lifts ONLY the
 * erosion net-loss limit, and only when occupancy is genuinely at the
 * consolidate threshold AND the result stays at/above CONSOLIDATION_FLOOR. The
 * catastrophic-shrink guard stays live under consolidation — reusing
 * allowDrastic for it would have authorized 48 → 1 from a model-set flag
 * (caught by an in-family second look on the #1905 fix before it shipped).
 */
export function evaluateWriteGuards(
  priorEntries: string[],
  newEntries: string[],
  options: { allowDrastic?: boolean; consolidation?: boolean } = {},
): GuardVerdict {
  if (options.allowDrastic || priorEntries.length < 10) return "ok";

  const newSet = new Set(newEntries);
  const priorSet = new Set(priorEntries);
  const evictions = priorEntries.filter((e) => !newSet.has(e));
  const additions = newEntries.filter((e) => !priorSet.has(e));

  const FLOOR = 3;
  const massDeleteNoAdd = evictions.length > priorEntries.length * 0.5 && additions.length === 0;
  if (newEntries.length < FLOOR || massDeleteNoAdd) return "shrink";

  // Decided here, in-lock against the just-read prior state — an occupancy check
  // made by the caller could go stale against a concurrent write.
  const consolidating =
    options.consolidation === true &&
    priorEntries.length >= CONSOLIDATE_THRESHOLD &&
    newEntries.length >= CONSOLIDATION_FLOOR;

  const EROSION_LIMIT = 2;
  if (!consolidating && evictions.length - additions.length >= EROSION_LIMIT) return "erosion";

  return "ok";
}

export const BEGIN_MARKER = "<!-- BEGIN ENTRIES -->";
export const END_MARKER = "<!-- END ENTRIES -->";

// ── Types ──

export interface SetEntriesOk {
  ok: true;
  accepted: number;
  dropped_malformed: number;
  dropped_overlength: number;
  dropped_duplicates: number;
  /** Entries refused as instruction-shaped. Never silent — see `refused_injection`. */
  dropped_injection: number;
  /** The refused text (max 5), so the caller can surface it for human review. */
  refused_injection: string[];
  prior_count: number;
  new_count: number;
  evictions: string[];
  additions: string[];
  /** Optional details: fingerprint of the new entries after write (for ESTALE_BASE chaining, public PR #2097). */
  detail?: { fingerprint?: string };
  /** Set when this write first adopted an out-of-band edit into the ledger (see adoptLive). */
  adopted_drift?: { seq: number; lost: string[]; gained: string[]; committed: boolean };
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

export interface SetEntriesErrErosion {
  ok: false;
  code: "ESUSPECT_EROSION";
  message: string;
  prior_count: number;
  new_count: number;
}

export interface SetEntriesErrStaleBase {
  ok: false;
  code: "ESTALE_BASE";
  message: string;
  /** Fingerprint from the read before inference. */
  expected_fingerprint: string;
  /** Fingerprint of the file as it is now. */
  actual_fingerprint: string;
}

export type SetEntriesResult =
  | SetEntriesOk
  | SetEntriesErrAtCap
  | SetEntriesErrPath
  | SetEntriesErrLock
  | SetEntriesErrIO
  | SetEntriesErrShrink
  | SetEntriesErrErosion
  | SetEntriesErrStaleBase
  | SetEntriesErrDrift
  | SetEntriesErrRedacted;

/**
 * The submission or restored content carries an entry a redact tombstone removed. Refused before any event is
 * appended or byte written, so a redaction cannot be undone by resubmitting the entry. The
 * entry text is never echoed: only how many, and their hashes.
 */
export interface SetEntriesErrRedacted {
  ok: false;
  code: "EREDACTED";
  message: string;
  redacted_hashes: string[];
}

/** Entries whose hash a ledger redact tombstone names. Read fresh from the ledger at every call: tombstones only grow. */
function tombstonedIn(entries: string[]): string[] {
  const redacted = foldState().redacted;
  if (redacted.size === 0) return [];
  return [...new Set(entries.map((e) => sha256(e)).filter((h) => redacted.has(h)))];
}

function redactedRefusal(hashes: string[], what: string): SetEntriesErrRedacted {
  invariant(hashes.length > 0, "a redaction refusal names at least one tombstoned hash");
  return {
    ok: false,
    code: "EREDACTED",
    message: `Refused: the ${what} carries ${hashes.length} entr${hashes.length === 1 ? "y" : "ies"} a redact tombstone removed (${hashes.map((h) => h.slice(0, 12)).join(", ")}). Redacted memory cannot be written back; drop the entr${hashes.length === 1 ? "y" : "ies"} and resubmit.`,
    redacted_hashes: hashes,
  };
}

export interface ReadResult {
  entries: string[];
  count: number;
  chars_used: number;
  cap_entries: number;
  cap_chars: number;
  /**
   * On-disk entries excluded from `entries` as invalid (marker/newline content or
   * over-length). NEVER silently ignorable: the reviewer's set-overwrite submits
   * `entries`, so anything listed here is erased by its next write.
   */
  dropped_invalid: { entry: string; reason: "malformed" | "overlength" }[];
  /** SHA256 of the valid entries list (empty string hash if no valid entries); used by ESTALE_BASE guard (public PR #2097, @hjbrandt). */
  fingerprint?: string;
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
  // Physical boundary: the lexical allowlist
  // alone passes a path whose LIFEOS/USER symlink is broken or replaced by a real
  // directory. Every primitive (read, set, restore, adopt) resolves through here,
  // so the realpath-based user-data check lives here, not only in MemorySystem.add.
  const boundary = assertInsideUserData(abs);
  if (!boundary.ok) {
    return { ok: false, code: "EINVAL_PATH", message: `memory path refused at the system/user boundary: ${boundary.reason}` };
  }
  return { ok: true, abs };
}

// ── Entry validation ──

interface ValidationOutcome {
  accepted: string[];
  malformed: number;
  overlength: number;
  duplicates: number;
  injection: number;
  /** The refused entries, so a drop is reviewable instead of silent. */
  injection_samples: string[];
  /** Entries that arrived carrying an echoed reviewer-prompt annotation. */
  annotations_stripped: number;
}

/** Exported so the write chokepoint's drop/strip behavior is testable without widening the path allowlist. */
export function validateAndDedup(entries: string[]): ValidationOutcome {
  const seen = new Set<string>();
  const accepted: string[] = [];
  const injection_samples: string[] = [];
  let malformed = 0;
  let overlength = 0;
  let duplicates = 0;
  let injection = 0;
  let annotations_stripped = 0;

  for (const raw of entries) {
    // Strip any echoed age/durability annotation BEFORE every other check.
    // MemoryEntryMeta renders ⟨since DATE · survived N⟩ into the reviewer
    // prompt as read-only context, and the prompt says never to echo it — but a
    // prompt is not a guarantee, and an echoed annotation passes every check
    // below (prefix matches, it fits the cap, it isn't instruction-shaped, and
    // the marker check only knows BEGIN/END). It would then land on disk and
    // orphan the metadata record it came from, resetting that entry's history.
    // Stripped rather than refused: under set-overwrite a refusal would evict
    // the fact outright.
    const entry = raw.replace(ANNOTATION_PATTERN, "").trim();
    if (entry.length === 0) continue;
    if (entry !== raw.trim()) annotations_stripped++;

    // One entry = one physical line. An embedded newline would serialize as
    // multiple on-disk lines, inflating the real entry count past every cap and
    // desyncing accepted/new_count from what a reparse sees.
    if (/[\r\n]/.test(entry)) {
      malformed++;
      continue;
    }

    const m = entry.match(PREFIX_PATTERN);
    if (!m) {
      malformed++;
      continue;
    }

    // Entries may never contain the structural markers: a marker substring inside
    // an entry would pollute the block and blind naive parsers. A pre-existing
    // on-disk offender still parses whole (markers are line-based), but
    // resubmission drops it here — visible as dropped_malformed.
    if (entry.includes(BEGIN_MARKER) || entry.includes(END_MARKER)) {
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

    // Instruction-shaped entries are REFUSED, not merely hidden.
    //
    // These two files are injected into every single turn, which makes them the
    // most durable surface in the system: one entry that reads as a standing
    // directive keeps giving that directive forever, long after whatever
    // transcript produced it is gone. The reviewer that writes here is reading
    // transcripts that contain web pages, mail, and feed items, so the text it
    // proposes is not always the principal's.
    //
    // A display-layer version of this check already existed and only withheld
    // the SAMPLE from the notification line while the entry itself still landed
    // and still loaded. Same pattern, wrong layer. This is the write chokepoint,
    // and every path into these files goes through it.
    //
    // Refusal is loud on purpose: an entry that genuinely needs to relax a gate
    // is exactly the kind a human should approve, not one an autonomic curation
    // pass should install. The refused text is returned for review.
    if (isInstructionShaped(entry)) {
      injection++;
      if (injection_samples.length < 5) injection_samples.push(entry);
      continue;
    }

    if (seen.has(entry)) {
      duplicates++;
      continue;
    }
    seen.add(entry);
    accepted.push(entry);
  }

  return { accepted, malformed, overlength, duplicates, injection, injection_samples, annotations_stripped };
}

// ── File parse / serialize ──

// Line-based canonical model (public PR #1593, @anikinsasha). The former
// indexOf-over-the-whole-body parse had three compounding defects that produced
// permanent, SILENT memory loss in the wild:
//
//   1. A stray END before BEGIN sent every write down the recovery branch, forever.
//   2. serializeFile's self-heal appended the missing BEGIN *after* that stray END,
//      manufacturing a permanent END-before-BEGIN inversion, and re-emitted one
//      fresh END per write — files grew a stack of END markers, +1 per curation,
//      never compacted.
//   3. Every reader bailed to zero entries on marker disorder, so sessions ran with
//      no memory loaded while the writer kept curating and the health check
//      reported clean headroom (0/48).
//
// The model that fixes it: markers are recognized ONLY as whole trimmed lines, so
// an entry that merely mentions a marker can never truncate the block. Parse is
// uniformly lenient — every valid-prefix line anywhere after the frontmatter is an
// entry (block ∪ orphans, order-preserved, first-seen deduped); marker lines are
// structural and dropped; everything else is body, preserved verbatim, including
// invalid-prefix orphans, which are never silently absorbed or deleted. Serialize
// always emits the canonical shape (frontmatter → body → BEGIN → entries → END →
// newline), so ONE write converges any historical corruption and repeated writes
// are byte-identical.
//
// This is THE parser for the memory files. Every consumer (LoadMemory hook, Pulse
// memory panel, MemoryHealthCheck, MemoryRestore) imports it — reader and writer
// can never diverge again. Never write a second marker-parsing implementation.

export interface ParsedMemoryFile {
  frontmatter: string;
  bodyLines: string[];
  entries: string[];
}

export function parseMemoryContent(content: string): ParsedMemoryFile {
  const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  // A "frontmatter" that swallowed a marker line is a mis-close: an unterminated
  // opening fence closing on some later body `---` would hide the whole entries
  // block inside frontmatter, blinding the parse AND the shrink guard while
  // marker-sanity checks stay green. Demote to no-frontmatter so every entry is
  // recovered from the body instead.
  const fmRaw = fmMatch ? fmMatch[0] : "";
  const fmValid = fmRaw !== "" && !fmRaw.includes(BEGIN_MARKER) && !fmRaw.includes(END_MARKER);
  const frontmatter = fmValid ? fmRaw.replace(/\r\n/g, "\n") : "";
  const afterFm = fmValid ? content.slice(fmRaw.length) : content;

  const bodyLines: string[] = [];
  const entries: string[] = [];
  const seen = new Set<string>();

  for (const line of afterFm.split(/\r?\n/)) {
    const t = line.trim();
    if (t === BEGIN_MARKER || t === END_MARKER) continue;
    if (t.length > 0 && PREFIX_PATTERN.test(t)) {
      if (!seen.has(t)) {
        seen.add(t);
        entries.push(t);
      }
      continue;
    }
    bodyLines.push(line);
  }

  // Trailing blank body lines are separator artifacts; serialize re-adds exactly
  // one, keeping parse→serialize→parse byte-stable.
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
    bodyLines.pop();
  }

  return { frontmatter, bodyLines, entries };
}

function updateFrontmatterTimestamp(frontmatter: string, at?: string): string {
  if (!frontmatter) return frontmatter;
  // `at` pins the stamp to the ledger event's ts so the live write-through and a
  // later fold render byte-identical documents. Wall clock only when no event ts
  // exists (legacy callers).
  const now = at ?? new Date().toISOString();
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

/**
 * Always emits the canonical shape — frontmatter → body → BEGIN → entries → END →
 * trailing newline. No self-heal branches: there is exactly one output shape, so a
 * single write converges any corrupted file and a repeat write is byte-identical.
 */
export function serializeMemoryContent(
  parsed: ParsedMemoryFile,
  newEntries: string[],
  updatedBy: string,
  at?: string,
): string {
  let fm = updateFrontmatterTimestamp(parsed.frontmatter, at);
  fm = updateFrontmatterUpdatedBy(fm, updatedBy);

  let out = fm;
  if (parsed.bodyLines.length > 0) out += parsed.bodyLines.join("\n") + "\n\n";
  out += BEGIN_MARKER + "\n";
  if (newEntries.length > 0) out += newEntries.join("\n") + "\n";
  out += END_MARKER + "\n";
  return out;
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

// Snapshots hold full prior memory, so they are owner-only whatever the umask: 0600 files in a
// 0700 directory, written through the shared Boundary.atomicWrite.
const SNAPSHOT_FILE_MODE = 0o600;
const SNAPSHOT_DIR_MODE = 0o700;

/** Narrow `p` to `want` when it is wider; never widens. */
function tightenMode(p: string, want: number): void {
  const st = statSync(p);
  if ((st.mode & 0o777 & ~want) !== 0) chmodSync(p, st.mode & 0o777 & want);
}

/**
 * Where the snapshot of `absPath` goes: `<snapshotDir>/<base>__<stamp>.md`, with `base` its file name
 * without `.md`. Taking the name with split("/") returned the whole path on Windows, which escaped the
 * snapshot directory. Exported so a test can pass `path.win32` on any platform.
 */
export function snapshotTarget(snapshotDir: string, absPath: string, stamp: string, p: PlatformPath = nativePath): { base: string; target: string } {
  const base = p.basename(absPath).replace(/\.md$/, "");
  return { base, target: p.resolve(snapshotDir, `${base}__${stamp}.md`) };
}

/** The ledger's key for a memory file: root-relative with "/" on every platform (the absolute path when outside the root). */
export function ledgerKey(abs: string, root: string = CLAUDE_ROOT, p: PlatformPath = nativePath): string {
  return rootRelativeKey(root, abs, p) ?? abs;
}

function snapshotBeforeWrite(absPath: string, priorContent: string): void {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const { base, target } = snapshotTarget(SNAPSHOT_DIR, absPath, stamp);
    invariant(dirname(target) === SNAPSHOT_DIR && base.length > 0, `snapshot target ${target} must sit directly in ${SNAPSHOT_DIR}`);
    // A ring created by an older build (0755 / 0644) is tightened before the new copy lands in it.
    if (existsSync(SNAPSHOT_DIR)) tightenMode(SNAPSHOT_DIR, SNAPSHOT_DIR_MODE);
    boundaryAtomicWrite(target, priorContent, { mode: SNAPSHOT_FILE_MODE, dirMode: SNAPSHOT_DIR_MODE });
    // No POSIX permission bits on Windows (stat reports 0o666 for files and directories); the profile ACL applies instead.
    if (hasPosixModes()) {
      invariant((statSync(SNAPSHOT_DIR).mode & 0o777 & ~SNAPSHOT_DIR_MODE) === 0, `snapshot dir ${SNAPSHOT_DIR} is wider than 0700`);
    }
    // Trim the ring: keep the newest SNAPSHOT_RING per base file; tighten the survivors.
    const mine = readdirSync(SNAPSHOT_DIR)
      .filter((f: string) => f.startsWith(`${base}__`))
      .sort(); // ISO stamp sorts chronologically
    const cut = Math.max(0, mine.length - SNAPSHOT_RING);
    for (const stale of mine.slice(0, cut)) {
      try { rmSync(pathResolve(SNAPSHOT_DIR, stale)); } catch { /* best-effort */ }
    }
    for (const kept of mine.slice(cut)) {
      try { tightenMode(pathResolve(SNAPSHOT_DIR, kept), SNAPSHOT_FILE_MODE); } catch { /* best-effort */ }
    }
  } catch (e) {
    if (e instanceof InvariantViolation) throw e; // impossible states die loud, never as a skipped backup
    // Snapshotting is best-effort; never fail a write because the backup failed.
  }
}

/** Exported for CortexLedger's fold --heal and compact — the ONE atomic-write implementation. */
export function atomicWriteContent(filePath: string, content: string): true | SetEntriesErrIO {
  return atomicWrite(filePath, content);
}

function atomicWrite(filePath: string, content: string): true | SetEntriesErrIO {
  const tmpPath = `${filePath}.tmp`;
  // Keep the target's permissions: a fresh tmp file is created at the umask
  // default (0644), so a rewrite dropped a 0600 file to world-readable. Mode is
  // applied at create time, as in LIFEOS/PULSE/lib/atomic-write.ts.
  // Sibling of GHSA-mqwg-v87w-pggm, @elhoim
  let priorMode: number | undefined;
  try { priorMode = statSync(filePath).mode & 0o777; } catch { /* new file: umask default */ }
  try {
    // O_EXCL ("wx") after a best-effort unlink: a symlink planted at the
    // predictable tmpPath would otherwise be written THROUGH — the write lands on
    // its target before the rename ever runs. O_EXCL refuses any pre-existing
    // path, symlinks included. (public PR #1593, @anikinsasha)
    try { unlinkSync(tmpPath); } catch { /* absent is the normal case */ }
    // One fd for create, write and fsync: reopening a 0444 tmp file for writing would fail.
    const fd = openSync(tmpPath, "wx", priorMode ?? 0o666);
    try {
      writeFileSync(fd, content, "utf8");
      invariant(priorMode === undefined || (fstatSync(fd).mode & 0o777 & ~priorMode) === 0,
        `atomic rewrite of ${filePath} would widen its permissions beyond ${priorMode?.toString(8)}`);
      fsyncSync(fd); // durability before rename
    } finally {
      closeSync(fd);
    }
    renameSync(tmpPath, filePath);
    // fsync the containing directory so the rename itself is durable — without it
    // a power/kernel crash can roll the rename back despite this returning ok.
    try {
      const dirFd = openSync(dirname(filePath), "r");
      try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
    } catch { /* dir fsync unsupported on some filesystems — best-effort */ }
    return true;
  } catch (e: any) {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    if (e instanceof InvariantViolation) throw e; // fail loud, never a typed error
    return {
      ok: false,
      code: "EWRITE_FAILED",
      message: `Atomic write failed: ${e?.message || String(e)}`,
    };
  }
}

// ── Rejection events ──

/**
 * Record a write the guard REFUSED as a non-folding `memory/rejected` ledger
 * event. Written here, not just returned: the memory-review hook spawns the
 * reviewer with `stdio: "ignore"`, so a refusal that only travels back in the
 * result object goes to /dev/null and the block is invisible to every surface
 * meant to report it (public issue #1761, @jacobo-ortiz). The eviction and
 * addition lists are logged in full — a blocked write is precisely the sample
 * you need to tell erosion from consolidation later.
 *
 * Best-effort BY CONTRAST with the fail-closed memory/set append: a rejection
 * changes no state, so failing to record it must not mask the rejection itself.
 */
function logRejectedWrite(
  filePath: string,
  rejection: { code: string; message: string; prior_count: number; new_count: number },
  delta: { evictions: string[]; additions: string[] },
  options: SetEntriesOptions,
): void {
  try {
    appendEvent({
      kind: "memory/rejected",
      ts: new Date().toISOString(),
      file: ledgerKey(filePath),
      updated_by: options.updatedBy ?? "unknown",
      ...(options.sessionId ? { session_id: options.sessionId } : {}),
      ...(options.runId ? { run_id: options.runId } : {}),
      rejected: true,
      rejection_code: rejection.code,
      rejection_message: rejection.message,
      prior_count: rejection.prior_count,
      new_count: rejection.new_count,
      evictions: delta.evictions,
      additions: delta.additions,
    });
  } catch { /* audit-only event; the rejection outcome stands regardless */ }
}

// ── Adopt: legitimate out-of-band edits become ledger events ──
//
// The ledger is not the only writer of these files: rename sweeps and hand
// edits change them too. Refusing every write until a human reconciles cost
// four multi-day stalls (09-16 → 10-09), and the only remedy on offer,
// `fold --heal`, erased the edit. Adopt records the live bytes as a
// `memory/adopt` event instead, attributed to git when the edit is committed.

/** Entries of `from` with no counterpart in `to`, counting duplicates. */
function missingFrom(from: string[], to: string[]): string[] {
  const left = new Map<string, number>();
  for (const e of to) left.set(e, (left.get(e) ?? 0) + 1);
  const out: string[] = [];
  for (const e of from) {
    const n = left.get(e) ?? 0;
    if (n > 0) left.set(e, n - 1);
    else out.push(e);
  }
  return out;
}

/** Environment for git subprocesses: a caller's GIT_DIR / GIT_INDEX_FILE (inside a git hook) must not redirect the query. */
export function cleanGitEnv(): Record<string, string> {
  return Object.fromEntries(Object.entries(process.env).filter(([k, v]) => !k.startsWith("GIT_") && v !== undefined)) as Record<string, string>;
}

/** The file at git HEAD and when it was last committed, through symlinks; null when untracked or outside a repository. */
function gitHeadContent(abs: string): { sha: string; content: string; committedAt: string } | null {
  try {
    const real = realpathSync(abs);
    const env = cleanGitEnv();
    const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: dirname(real), encoding: "utf8", env });
    if (top.status !== 0) return null;
    const repo = realpathSync(top.stdout.trim());
    // A `HEAD:<path>` spec takes "/" on every platform; a backslash path never resolves on Windows.
    const path = rootRelativeKey(repo, real);
    if (path === null) return null;
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8", env });
    const show = spawnSync("git", ["show", `HEAD:${path}`], { cwd: repo, encoding: "utf8", env, maxBuffer: 16 * 1024 * 1024 });
    const when = spawnSync("git", ["log", "-1", "--format=%cI", "--", path], { cwd: repo, encoding: "utf8", env });
    if (head.status !== 0 || show.status !== 0 || when.status !== 0 || !when.stdout.trim()) return null;
    return { sha: head.stdout.trim(), content: show.stdout, committedAt: when.stdout.trim() };
  } catch {
    return null;
  }
}

/** When the ledger last set this file's content: its newest folding row for the file. */
function ledgerHeadTs(rel: string): string | null {
  let ts: string | null = null;
  for (const row of readRows()) {
    const covers = row.kind === "checkpoint"
      ? Boolean((row.files as Record<string, string> | undefined)?.[rel])
      : row.file === rel && typeof row.content === "string";
    if (covers) ts = row.ts;
  }
  return ts;
}

export interface LedgerDrift {
  rel: string;
  content: string;
  live: string[];
  folded: string[];
  /** Ledger entries the live file no longer has. */
  lost: string[];
  /** Live entries the ledger has never folded. */
  gained: string[];
  /** Live entries a redact tombstone removed; only `fold --heal` may resolve these. */
  redacted: string[];
  /** Gained entries the writer would refuse (malformed, overlength, instruction-shaped). */
  invalid: string[];
  /**
   * The live entries match git HEAD AND that commit is newer than the ledger's
   * last write to the file. A file reverted to an older commit matches HEAD
   * too, but it is not a new edit (Astra audit of de9d79013).
   */
  committed: boolean;
  gitHead: string | null;
}

/** Compare a file's live entries with the ledger head. Null when the ledger has no head for it or they agree. */
function inspectDrift(rel: string, content: string, live: string[]): LedgerDrift | null {
  const ledger = foldState();
  const head = ledger.files.get(rel);
  if (head === undefined) return null; // pre-genesis: nothing to drift from
  // Same render as CortexLedger verify: redact tombstones filter the head's entries.
  const folded = parseMemoryContent(head).entries.filter((e) => !ledger.redacted.has(sha256(e)));
  if (entriesHash(folded) === entriesHash(live)) return null;
  const git = gitHeadContent(pathResolve(CLAUDE_ROOT, rel));
  const headTs = ledgerHeadTs(rel);
  const committed = git !== null
    && entriesHash(parseMemoryContent(git.content).entries) === entriesHash(live)
    // Commit times have one-second resolution, so compare at the second.
    && (headTs === null || Date.parse(git.committedAt) >= Math.floor(Date.parse(headTs) / 1000) * 1000);
  const gained = missingFrom(live, folded);
  const valid = new Set(validateAndDedup(gained).accepted);
  return {
    rel,
    content,
    live,
    folded,
    lost: missingFrom(folded, live),
    gained,
    redacted: live.filter((e) => ledger.redacted.has(sha256(e))),
    invalid: gained.filter((e) => !valid.has(e)),
    committed,
    gitHead: committed && git ? git.sha : null,
  };
}

/**
 * An edit is safe to adopt unattended when it drops nothing the ledger had, or
 * when it is a fresh commit whose net loss stays under the erosion limit (a
 * rename sweep loses and gains the same count). Never when it carries a
 * redacted entry (a redaction awaiting `fold --heal`) or an entry the writer
 * itself would refuse (malformed, overlength, instruction-shaped).
 */
const ADOPT_NET_LOSS_LIMIT = 2;
function autoAdoptable(d: LedgerDrift): boolean {
  if (d.redacted.length > 0 || d.invalid.length > 0) return false;
  return d.lost.length === 0 || (d.committed && d.lost.length - d.gained.length < ADOPT_NET_LOSS_LIMIT);
}

function appendAdopt(d: LedgerDrift, by: { updatedBy: string; sessionId?: string; reason: string }): AppendResult {
  invariant(d.content.length > 0, "adopt requires the live file's bytes");
  archiveContent(d.content);
  return appendEvent({
    kind: "memory/adopt",
    ts: new Date().toISOString(),
    file: d.rel,
    updated_by: by.updatedBy,
    ...(by.sessionId ? { session_id: by.sessionId } : {}),
    reason: by.reason,
    committed: d.committed,
    ...(d.gitHead ? { git_head: d.gitHead } : {}),
    prior_count: d.folded.length,
    new_count: d.live.length,
    lost: d.lost,
    gained: d.gained,
    entries: d.live,
    prior_entries_hash: entriesHash(d.folded),
    entries_hash: entriesHash(d.live),
    content: d.content,
  });
}

export type AdoptResult =
  | { ok: true; adopted: false; file: string }
  | { ok: true; adopted: true; file: string; seq: number; lost: string[]; gained: string[]; committed: boolean }
  | { ok: false; code: string; message: string; lost?: string[] };

/**
 * Adopt a fold-owned file's live entries into the ledger. No-op when the file
 * agrees with the ledger. Without `force`, an uncommitted edit that drops
 * ledger entries is refused (the caller should commit it or confirm); `force`
 * is the human's confirmation, and the lost entries stay on the event row.
 */
export function adoptLive(filePath: string, opts: { updatedBy: string; sessionId?: string; force?: boolean }): AdoptResult {
  const pathCheck = validatePath(filePath);
  if (!("abs" in pathCheck)) return pathCheck;
  const abs = pathCheck.abs;
  if (!existsSync(abs)) return { ok: false, code: "EINVAL_PATH", message: `Memory file does not exist: ${abs}` };
  const result = withLock(abs, (): AdoptResult => {
    const content = readFileSync(abs, "utf8");
    const rel = ledgerKey(abs);
    const drift = inspectDrift(rel, content, parseMemoryContent(content).entries);
    if (drift === null) return { ok: true, adopted: false, file: rel };
    if (drift.invalid.length > 0) {
      return { ok: false, code: "EINVALID_ENTRY", message: `${rel}: the edit adds ${drift.invalid.length} entr${drift.invalid.length === 1 ? "y" : "ies"} the writer refuses (malformed, overlength or instruction-shaped): ${drift.invalid.map((e) => JSON.stringify(e.slice(0, 80))).join(", ")}. Fix the file, then adopt.` };
    }
    if (drift.redacted.length > 0) {
      return { ok: false, code: "EREDACTED", message: `${rel}: the live file still holds ${drift.redacted.length} redacted entr${drift.redacted.length === 1 ? "y" : "ies"}; finish the redaction with CortexLedger fold --heal.` };
    }
    if (!opts.force && !autoAdoptable(drift)) {
      return {
        ok: false,
        code: "EDRIFT_LOSSY",
        message: `${rel}: the edit drops ${drift.lost.length} ledger entr${drift.lost.length === 1 ? "y" : "ies"} (net ${drift.lost.length - drift.gained.length}) and is not a fresh commit under the loss limit. Check the entries below, then adopt with --force.`,
        lost: drift.lost,
      };
    }
    const reason = opts.force ? "confirmed" : drift.committed ? "committed" : "no-loss";
    const ev = appendAdopt(drift, { updatedBy: opts.updatedBy, sessionId: opts.sessionId, reason });
    if (!ev.ok) return { ok: false, code: "EWRITE_FAILED", message: `Ledger append failed — nothing adopted: ${ev.message}` };
    return { ok: true, adopted: true, file: rel, seq: ev.row.seq, lost: drift.lost, gained: drift.gained, committed: drift.committed };
  });
  return result as AdoptResult;
}

// ── Public API ──

export interface SetEntriesOptions {
  /** Who is writing — appears in the file's frontmatter last_updated_by. */
  updatedBy?: string;
  /**
   * HUMAN-invoked bypass of BOTH data-loss guards (legitimate full-clear /
   * restore). Never set this from model-originated intent — use `consolidation`.
   */
  allowDrastic?: boolean;
  /**
   * Declares a deliberate merge pass. Lifts ONLY the erosion net-loss limit, and
   * only at/above CONSOLIDATE_THRESHOLD occupancy with the result staying
   * at/above CONSOLIDATION_FLOOR. The catastrophic-shrink guard stays live, so a
   * model that sets this can compress memory but can never wipe it
   * (public issue #1905, @ksjayeshks).
   */
  consolidation?: boolean;
  /** Provenance: harness session that produced this write (threads to the ledger row). */
  sessionId?: string;
  /** Provenance: reviewer run id, when the reviewer is the writer. */
  runId?: string;
  /**
   * If supplied, setEntries will verify that the current entries match this fingerprint
   * before writing. A mismatch (e.g. file changed after read) raises ESTALE_BASE.
   * Intended for use by op:"set" memory reviewers to prevent overwrites of concurrent manual edits
   * (public PR #2097, @hjbrandt).
   */
  expectedFingerprint?: string;
}

export interface SetEntriesErrDrift {
  ok: false;
  code: "EDRIFT";
  message: string;
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
    const parsed = parseMemoryContent(content);
    const priorEntries = parsed.entries;
    const newEntries = validated.accepted;
    const rel = ledgerKey(abs);

    // Drift check (curated ⟺ folded): when an out-of-band writer changed the
    // entries region, adopt that edit as a ledger event first, so the guards
    // below judge THIS write's delta against the file as it really is. A
    // committed edit, or one that drops nothing, adopts unattended; an
    // uncommitted edit that drops ledger entries is refused for a human to
    // confirm. Frontmatter/body edits (release version bumper) are not drift
    // and fold in via this write's full-content event. Pre-genesis the check
    // is vacuous.
    let adoptedDrift: SetEntriesOk["adopted_drift"];
    const drift = inspectDrift(rel, content, priorEntries);
    if (drift !== null && !autoAdoptable(drift)) {
      const driftErr: SetEntriesErrDrift = {
        ok: false,
        code: "EDRIFT",
        message: drift.invalid.length > 0
          ? `Refused: the live file holds ${drift.invalid.length} out-of-band entr${drift.invalid.length === 1 ? "y" : "ies"} the writer refuses (malformed, overlength or instruction-shaped). Fix the file, then run: bun LIFEOS/TOOLS/CortexLedger.ts adopt.`
          : drift.redacted.length > 0
          ? `Refused: the live file still holds ${drift.redacted.length} redacted entr${drift.redacted.length === 1 ? "y" : "ies"}. Finish the redaction first: bun LIFEOS/TOOLS/CortexLedger.ts fold --heal.`
          : `Refused: the live file's entries changed outside the ledger (${priorEntries.length} live vs ${drift.folded.length} folded), and the change drops ${drift.lost.length} ledger entr${drift.lost.length === 1 ? "y" : "ies"} (net ${drift.lost.length - drift.gained.length}) without a fresh commit under the loss limit. If the edit is intended, run: bun LIFEOS/TOOLS/CortexLedger.ts adopt --force. Edits that drop nothing, and fresh commits such as a rename sweep, adopt automatically.`,
      };
      // A still-live redacted entry is never copied into the audit row.
      logRejectedWrite(abs, { code: "EDRIFT", message: driftErr.message, prior_count: priorEntries.length, new_count: newEntries.length }, { evictions: drift.lost, additions: drift.gained.filter((e) => !drift.redacted.includes(e)) }, options);
      return driftErr;
    }

    // Tombstones before any event of this write, the drift adopt below included: a redacted entry never re-enters
    // live memory through a submission. Checked in-lock so a redact landing mid-review still
    // binds. A live file still holding a redacted entry was refused above as drift, with the fold --heal instruction.
    const tombstoned = tombstonedIn(newEntries);
    if (tombstoned.length > 0) {
      const err = redactedRefusal(tombstoned, "submission");
      // The audit row carries counts only; logging the additions would copy the redacted text into the ledger.
      logRejectedWrite(abs, { code: "EREDACTED", message: err.message, prior_count: priorEntries.length, new_count: newEntries.length }, { evictions: [], additions: [] }, options);
      return err;
    }

    if (drift !== null) {
      const adopted = appendAdopt(drift, {
        updatedBy: `${options.updatedBy ?? "unknown"} (auto-adopt)`,
        sessionId: options.sessionId,
        reason: drift.committed ? "committed" : "no-loss",
      });
      if (!adopted.ok) {
        return {
          ok: false,
          code: "EWRITE_FAILED",
          message: `Ledger append failed while adopting an out-of-band edit — write aborted, file untouched (fail-closed): ${adopted.message}`,
        } satisfies SetEntriesErrIO;
      }
      adoptedDrift = { seq: adopted.row.seq, lost: drift.lost, gained: drift.gained, committed: drift.committed };
    }

    // Stale-base guard (public PR #2097, @hjbrandt): the reviewer reads the file,
    // thinks for minutes, then writes back a full replacement. If anything else
    // changed the file during those minutes, reject and re-read at the next review.
    // Frontmatter-only changes don't count (the file still has the same entries).
    if (options.expectedFingerprint !== undefined) {
      // Fingerprint the SAME snapshot read() handed out — the VALIDATED entries,
      // not the raw parse. read() excludes entries that fail validation (and
      // reports them as dropped_invalid), so on a file holding one malformed or
      // overlength entry the two sides hashed different lists: the fingerprints
      // could never match and every reviewer write was refused as stale on an
      // otherwise untouched file. public PR #2097, @hjbrandt / #2098, @NAmorim
      const currentFingerprint = sha256(JSON.stringify(validateAndDedup(priorEntries).accepted));
      if (currentFingerprint !== options.expectedFingerprint) {
        const staleErr: SetEntriesErrStaleBase = {
          ok: false,
          code: "ESTALE_BASE",
          message: `Refused: file's entries changed since the read before inference (expected fingerprint ${options.expectedFingerprint.slice(0, 8)}… but found ${currentFingerprint.slice(0, 8)}…). A concurrent write (manual edit, another reviewer pass) won the race. The next review will start from the current file.`,
          expected_fingerprint: options.expectedFingerprint,
          actual_fingerprint: currentFingerprint,
        };
        logRejectedWrite(abs, { code: "ESTALE_BASE", message: staleErr.message, prior_count: priorEntries.length, new_count: newEntries.length }, { evictions: [], additions: [] }, options);
        return staleErr;
      }
    }

    // Compute the symmetric delta: evictions (present before, absent now) and
    // additions (absent before, present now). Both feed the visibility surface.
    const newSet = new Set(newEntries);
    const priorSet = new Set(priorEntries);
    const evictions = priorEntries.filter((e) => !newSet.has(e));
    const additions = newEntries.filter((e) => !priorSet.has(e));

    // Both data-loss guards, decided IN-LOCK against the just-read prior state
    // so neither can race a concurrent write. See evaluateWriteGuards for which
    // option lifts which guard — allowDrastic lifts both, consolidation lifts
    // only erosion and only within a deterministic floor.
    const verdict = evaluateWriteGuards(priorEntries, newEntries, options);
    {
      if (verdict === "shrink") {
        const shrinkErr: SetEntriesErrShrink = {
          ok: false,
          code: "ESUSPECT_SHRINK",
          message: `Refused: op would shrink ${priorEntries.length} → ${newEntries.length} entries (${evictions.length} dropped, ${additions.length} added). Near-empty results and mass-deletion-without-curation are blocked as likely-bad output. A real consolidation that drops many should also ADD merged entries.`,
          prior_count: priorEntries.length,
          new_count: newEntries.length,
        };
        logRejectedWrite(abs, shrinkErr, { evictions, additions }, options);
        return shrinkErr;
      }

      // Slow-erosion guard (public issue #1761, @jacobo-ortiz): the shapes
      // above only catch catastrophes. The failure that actually destroys
      // memory is LLM re-transcription quietly dropping a few entries per
      // cycle — each write ~10% smaller, each carrying additions, so nothing
      // above fires; 12 durable rules died in 48h that way on a reporter's
      // install. Replayed against 94 historical writes by the reporter:
      // 5 blocked, all genuine erosion, 0 false positives.
      const netLoss = evictions.length - additions.length;
      if (verdict === "erosion") {
        const erosionErr: SetEntriesErrErosion = {
          ok: false,
          code: "ESUSPECT_EROSION",
          message: `Refused: op would net-drop ${netLoss} entries (${priorEntries.length} → ${newEntries.length}: ${evictions.length} dropped, ${additions.length} added). Slow erosion via re-transcription is blocked. A deliberate consolidation at >=${CONSOLIDATE_THRESHOLD} entries may set consolidation: true, which lifts this limit only while the result stays at/above ${CONSOLIDATION_FLOOR} entries.`,
          prior_count: priorEntries.length,
          new_count: newEntries.length,
        };
        logRejectedWrite(abs, erosionErr, { evictions, additions }, options);
        return erosionErr;
      }
    }

    // Snapshot the prior content before we overwrite — individual-write recovery
    // (ring for fast restore UX) plus the content-addressed archive (unbounded).
    snapshotBeforeWrite(abs, content);
    archiveContent(content);

    const ts = new Date().toISOString();
    const newContent = serializeMemoryContent(parsed, newEntries, options.updatedBy || "MemoryWriter", ts);

    // EVENT FIRST, FAIL-CLOSED. The ledger row carries the full rendered
    // document, so the file below is a byte copy of it. If this append fails,
    // the write is aborted with the file untouched — one lost curation cycle is
    // strictly cheaper than a file the ledger cannot reconstruct. If the file
    // write below fails AFTER the append, the ledger is ahead of the file;
    // `CortexLedger verify` flags it and `fold --heal` converges forward.
    const ev = appendEvent({
      kind: "memory/set",
      ts,
      file: rel,
      updated_by: options.updatedBy ?? "unknown",
      ...(options.sessionId ? { session_id: options.sessionId } : {}),
      ...(options.runId ? { run_id: options.runId } : {}),
      rejected: false,
      prior_count: priorEntries.length,
      new_count: newEntries.length,
      accepted: newEntries.length,
      dropped_malformed: validated.malformed,
      dropped_overlength: validated.overlength,
      dropped_duplicates: validated.duplicates,
      dropped_injection: validated.injection,
      refused_injection: validated.injection_samples,
      evictions,
      additions,
      entries: newEntries,
      prior_entries_hash: entriesHash(priorEntries),
      entries_hash: entriesHash(newEntries),
      content: newContent,
    });
    if (!ev.ok) {
      return {
        ok: false,
        code: "EWRITE_FAILED",
        message: `Ledger append failed — write aborted, file untouched (fail-closed): ${ev.message}`,
      } satisfies SetEntriesErrIO;
    }

    const writeRes = atomicWrite(abs, newContent);
    if (writeRes !== true) return writeRes;
    archiveContent(newContent);
    bumpMemoryGeneration();

    // Per-entry age and durability, folded from the same prior/new lists the
    // guards were decided against. Deliberately NOT fail-closed like the ledger
    // append above: this is a reviewer-context optimization, and stale metadata
    // is strictly cheaper than a refused curation cycle. recordWrite swallows
    // its own I/O failures, so the ignored return can only ever mean "stale".
    recordWrite(rel, priorEntries, newEntries, ts);

    return {
      ok: true,
      accepted: newEntries.length,
      dropped_malformed: validated.malformed,
      dropped_overlength: validated.overlength,
      dropped_duplicates: validated.duplicates,
      dropped_injection: validated.injection,
      refused_injection: validated.injection_samples,
      prior_count: priorEntries.length,
      new_count: newEntries.length,
      evictions,
      additions,
      detail: { fingerprint: sha256(JSON.stringify(newEntries)) },
      ...(adoptedDrift ? { adopted_drift: adoptedDrift } : {}),
    } satisfies SetEntriesOk;
  });

  return result;
}

/**
 * Byte-restore a memory file from recovery content (snapshot ring or the
 * content-addressed archive). The sanctioned restore path: in-lock, event-first
 * (`memory/restore` carries the restored bytes inline so a fold never depends
 * on ring retention), fail-closed like setEntries. Curation guards do not run —
 * a restore is recovery, not curation — and the restore SETS the new ledger
 * head, so the next curation write's drift check passes against it.
 */
export function restoreContent(
  filePath: string,
  content: string,
  source: { updatedBy: string; snapshotRef?: string; sessionId?: string },
): SetEntriesResult {
  const pathCheck = validatePath(filePath);
  if (!("abs" in pathCheck)) return pathCheck;
  const abs = pathCheck.abs;

  const result = withLock(abs, () => {
    const rel = ledgerKey(abs);
    // A restore is recovery, not curation, but recovery content predating a redaction must not resurrect it.
    const tombstoned = tombstonedIn(parseMemoryContent(content).entries);
    if (tombstoned.length > 0) return redactedRefusal(tombstoned, "restore content");
    if (existsSync(abs)) {
      const prior = readFileSync(abs, "utf8");
      snapshotBeforeWrite(abs, prior);
      archiveContent(prior);
    }
    const restoredHash = archiveContent(content);
    const parsed = parseMemoryContent(content);
    const ev = appendEvent({
      kind: "memory/restore",
      ts: new Date().toISOString(),
      file: rel,
      updated_by: source.updatedBy,
      ...(source.sessionId ? { session_id: source.sessionId } : {}),
      ...(source.snapshotRef ? { snapshot_ref: source.snapshotRef } : {}),
      entries_hash: entriesHash(parsed.entries),
      content_archive_hash: restoredHash,
      content,
    });
    if (!ev.ok) {
      return {
        ok: false,
        code: "EWRITE_FAILED",
        message: `Ledger append failed — restore aborted, file untouched (fail-closed): ${ev.message}`,
      } satisfies SetEntriesErrIO;
    }
    const writeRes = atomicWrite(abs, content);
    if (writeRes !== true) return writeRes;
    bumpMemoryGeneration();
    return {
      ok: true,
      accepted: parsed.entries.length,
      dropped_malformed: 0,
      dropped_overlength: 0,
      dropped_duplicates: 0,
      dropped_injection: 0,
      refused_injection: [],
      prior_count: 0,
      new_count: parsed.entries.length,
      evictions: [],
      additions: [],
    } satisfies SetEntriesOk;
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
      dropped_invalid: [],
    };
  }

  const content = readFileSync(abs, "utf8");
  const parsed = parseMemoryContent(content);
  // Entries invalid at read time are excluded from `entries` but REPORTED, never
  // silently swallowed: a set-overwrite computed from `entries` would otherwise
  // erase them with no trace anywhere, since the write's dropped_* counts only
  // cover the submission, which by then no longer contains them.
  const valid = validateAndDedup(parsed.entries);
  const acceptedSet = new Set(valid.accepted);
  const dropped_invalid: ReadResult["dropped_invalid"] = [];
  for (const entry of parsed.entries) {
    if (acceptedSet.has(entry)) continue;
    const m = entry.match(PREFIX_PATTERN);
    const overlength = !!m && entry.slice(m[0].length).length > MAX_CHARS_PER_ENTRY;
    dropped_invalid.push({ entry, reason: overlength ? "overlength" : "malformed" });
  }
  const chars_used = valid.accepted.reduce((sum, e) => sum + e.length, 0);

  return {
    entries: valid.accepted,
    count: valid.accepted.length,
    chars_used,
    cap_entries: MAX_ENTRIES,
    cap_chars: MAX_ENTRIES * MAX_CHARS_PER_ENTRY,
    dropped_invalid,
    // Fingerprint of the valid entries list; used by ESTALE_BASE guard (public PR #2097, @hjbrandt).
    fingerprint: sha256(JSON.stringify(valid.accepted)),
  };
}

// ── CLI ──

function smokeTest(): number {
  console.log("MemoryWriter smoke test starting…");

  // Pure canonical-rebuild fixtures — NO filesystem, and in particular NOT the
  // live memory files. The pre-port smoke test ran setEntries against the real
  // PRINCIPAL_MEMORY.md and its step-7 cleanup submitted [], so running
  // `bun MemoryWriter.ts test` on a populated install WIPED real memory.
  // Write-path coverage lives in test/tools/MemoryWriter.test.ts.
  // (public PR #1593, @anikinsasha)
  const corrupted =
    [
      "---",
      "schema_version: 1",
      "---",
      "# Hot-Layer Memory",
      "",
      "<!-- template comment -->",
      END_MARKER,
      BEGIN_MARKER,
      END_MARKER,
      END_MARKER,
      "FACT: legacy invalid-prefix orphan stays in body",
      "NAME: Fixture User",
      `RULE: keep the ${END_MARKER} marker pair intact`,
      END_MARKER,
    ].join("\n") + "\n";

  const p1 = parseMemoryContent(corrupted);
  if (p1.entries.length !== 2) {
    console.error(`FAIL: corrupted fixture expected 2 entries, got ${p1.entries.length}`);
    return 1;
  }
  if (p1.entries[1] !== `RULE: keep the ${END_MARKER} marker pair intact`) {
    console.error(`FAIL: marker-substring entry truncated on parse: ${p1.entries[1]}`);
    return 1;
  }
  if (!p1.bodyLines.some((l) => l.startsWith("FACT: "))) {
    console.error("FAIL: invalid-prefix orphan was silently absorbed instead of kept in body");
    return 1;
  }
  console.log(`  parse: recovered ${p1.entries.length} entries from an END-before-BEGIN + END-stack file`);

  // One write converges to canonical shape: exactly one BEGIN, one END, in order.
  const rebuilt = serializeMemoryContent(p1, p1.entries, "smoke-test");
  const begins = rebuilt.split("\n").filter((l) => l.trim() === BEGIN_MARKER).length;
  const ends = rebuilt.split("\n").filter((l) => l.trim() === END_MARKER).length;
  if (begins !== 1 || ends !== 1) {
    console.error(`FAIL: canonical rebuild expected 1 BEGIN / 1 END, got ${begins} / ${ends}`);
    return 1;
  }
  if (rebuilt.indexOf(BEGIN_MARKER) > rebuilt.indexOf(END_MARKER)) {
    console.error("FAIL: canonical rebuild left END before BEGIN");
    return 1;
  }
  console.log(`  serialize: converged ${begins} BEGIN / ${ends} END, in order`);

  // Idempotency: a second round-trip is byte-identical apart from the stamp.
  const stripStamp = (s: string) => s.replace(/^last_updated: .*$/m, "last_updated: X");
  const again = serializeMemoryContent(parseMemoryContent(rebuilt), p1.entries, "smoke-test");
  if (stripStamp(again) !== stripStamp(rebuilt)) {
    console.error("FAIL: second write was not byte-identical — rebuild is not idempotent");
    return 1;
  }
  console.log("  idempotency: second write byte-identical");

  // Entry set is preserved verbatim across the heal (zero set-diff).
  const after = parseMemoryContent(rebuilt).entries;
  if (after.join("\u0000") !== p1.entries.join("\u0000")) {
    console.error("FAIL: entry set changed across the heal");
    return 1;
  }
  console.log(`  preservation: ${after.length}/${p1.entries.length} entries survived verbatim`);

  // CRLF and frontmatter-less shapes parse the same way.
  const crlf = `${BEGIN_MARKER}\r\nNAME: CRLF User\r\n${END_MARKER}\r\n`;
  if (parseMemoryContent(crlf).entries.length !== 1) {
    console.error("FAIL: CRLF file did not parse to 1 entry");
    return 1;
  }
  if (parseMemoryContent("NAME: No Frontmatter\n").entries.length !== 1) {
    console.error("FAIL: frontmatter-less file did not parse to 1 entry");
    return 1;
  }
  console.log("  tolerance: CRLF + frontmatter-less parse correctly");

  // Path allowlist still refuses anything outside the two memory files.
  const w = setEntries("/etc/passwd", ["NAME: hacker"], { updatedBy: "smoke-test" });
  if (w.ok || w.code !== "EINVAL_PATH") {
    console.error(`FAIL: expected EINVAL_PATH for /etc/passwd, got ${w.ok ? "success" : w.code}`);
    return 1;
  }
  console.log("  allowlist: /etc/passwd correctly rejected with EINVAL_PATH");

  console.log("✓ MemoryWriter smoke test PASSED (no live memory file was touched)");
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
