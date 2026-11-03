/**
 * @version 1.6.0
 * 1.6.0 (2026-10-14): realpathDeepest walks the path as written and follows each link before the `..` after it; one exported token normalization (hashWords, hashPhraseToken, saltedTokenHash) shared with DeriveDenyHashes, and every declared n-gram size is scanned.
 * 1.5.0 (2026-10-13, LOSIntegrity security ranks 11 + 12): classifyTarget judges the canonical path —
 * relative paths resolved, ".." normalized, the deepest existing ancestor realpathed (symlink aliases,
 * dangling links followed) — against each root and its realpath, and takes the strictest result; a path
 * whose real location cannot be established is refused. A deny-list that exists but yields zero usable
 * patterns (empty or comment-only) is unusable, and a DENY_HASHES.json that exists but cannot be used
 * blocks SYSTEM writes the same way.
 * system-file-guard-core.ts — pure classifier + deny-list scanner.
 *
 * Imported by:
 *   - LIFEOS/TOOLS/githooks/StagedLeakScan.ts (the pre-commit leak scan over staged SYSTEM files)
 *   - LIFEOS/TOOLS/CheckFileBoundary.ts (on-demand CLI / CI gate)
 *   - LIFEOS/TOOLS/DeriveDenyHashes.ts (the shared token normalization)
 *
 * Pure functions; no fs writes, no process.exit, no logging side effects.
 * Callers add the side effects on top.
 */

import { readFileSync, existsSync, realpathSync, lstatSync, readlinkSync } from "node:fs";
import { basename, dirname, isAbsolute, join, parse, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { isContained, isPatternAllowlisted, relativeToClaudeRoot } from "./containment-zones";
import { getClaudeDir } from "./paths";
import { isWithin } from "./portable-path";

/**
 * The guarded roots (deny side), resolved at call time. Two, deduplicated: the
 * install's config root (getClaudeDir(): plugin root, CLAUDE_CONFIG_DIR,
 * LIFEOS_SKILLS_DIR, else ~/.claude) and the HOME profile's literal ~/.claude.
 *
 * The resolved root closes the relocated-install gap: with only the literal, every
 * write under a CLAUDE_CONFIG_DIR tree classified out-of-tree and nothing was
 * enforced. The literal stays so a session running a scratch profile still cannot
 * write deny-listed content into the home profile; replacing the literal with the
 * resolved root would have narrowed this deny boundary (see IntegrityCheck
 * CONFIG_ROOT_LITERAL_EXEMPT). A path is judged against the most specific root that
 * contains it, using that tree's own USER/SECURITY and USER/CONFIG files.
 */
export function guardRoots(): string[] {
  return Array.from(new Set([getClaudeDir(), join(process.env.HOME ?? homedir(), ".claude")]));
}

/** The most specific guarded root containing `absolutePath`, or null when it is out of every tree. */
export function rootFor(absolutePath: string): string | null {
  let best: string | null = null;
  for (const root of guardRoots()) {
    // A path test, not a string test: on Windows `root + "/"` never prefixed a real path, so the guard found no tree.
    const inside = isWithin(absolutePath, root);
    if (inside && (best === null || root.length > best.length)) best = root;
  }
  return best;
}

const denyListPathIn = (root: string): string => join(root, "LIFEOS/USER/SECURITY/DENY_LIST.txt");
// USER/SECURITY, not a private maintenance-skill path: on a public install, the old location
// caused DeriveDenyHashes to create a private-tree marker, whose existence is exactly
// the detectDevTree marker that disables seven installer tools (public issue
// #1689, @christauff).
const hashesPathIn = (root: string): string => join(root, "LIFEOS/USER/SECURITY/DENY_HASHES.json");
const envPathIn = (root: string): string => join(root, ".env");
// Install-local allowlist (USER-tree, never ships): private-skill source files that
// legitimately embed deny tokens by function — release tooling that greps for the
// patterns, the customer skill's own directory name. Consulted by the private-skill
// write tooth below so those files stay editable.
const hygieneAllowlistPathIn = (root: string): string => join(root, "LIFEOS/USER/CONFIG/skill-hygiene-allowlist.json");

// Runtime-data segments under a skill: machine-bound, regenerated, never shipped
// (mirror the skill-runtime-data containment zone). A private-skill path containing
// one of these is NOT source — it stays USER-classified and is not deny-scanned.
const SKILL_RUNTIME_SEGMENTS = new Set([
  "node_modules", "profile-data", "state", "cache", ".playwright-cli", ".cache", ".sdk_bootstrap",
]);

/**
 * Is this a private-skill SOURCE file? (an underscore-prefixed skill directory, excluding runtime-data dirs.)
 * The 2026-07-23 separation directive requires private skills to hold no identity, so
 * their source is deny-scanned even though the private-skills containment zone marks
 * the tree USER. Kept in evaluateWrite (not classifyTarget) so egress classification
 * and other classifyTarget consumers are unaffected.
 */
export function isPrivateSkillSource(rel: string): boolean {
  const parts = rel.split("/");
  if (parts.length < 3 || parts[0] !== "skills" || !parts[1].startsWith("_")) return false;
  return !parts.slice(2).some((seg) => SKILL_RUNTIME_SEGMENTS.has(seg));
}

const hygieneAllowlistCache = new Map<string, Set<string>>();
export function loadHygieneAllowlist(path = hygieneAllowlistPathIn(getClaudeDir())): Set<string> {
  const isDefault = guardRoots().some((root) => hygieneAllowlistPathIn(root) === path);
  const cached = isDefault ? hygieneAllowlistCache.get(path) : undefined;
  if (cached) return cached;
  let set: Set<string>;
  try {
    const arr = JSON.parse(readFileSync(path, "utf-8"));
    set = new Set(
      Array.isArray(arr) ? arr.map((e: { path?: string }) => e?.path).filter((p): p is string => typeof p === "string") : [],
    );
  } catch {
    set = new Set(); // fail-open: missing/broken allowlist never blocks
  }
  if (isDefault) hygieneAllowlistCache.set(path, set); // cache only a guarded tree's own file; injected test paths bypass
  return set;
}

export type GuardClassification = "system" | "user" | "out-of-tree";

export interface GuardHit {
  pattern: string;
  match: string;
  index: number;
}

export interface GuardDecision {
  classification: GuardClassification;
  filePath: string;
  relPath: string;
  /** Empty when classification != "system" or no patterns matched. */
  hits: GuardHit[];
  /** Convenience: hits.length > 0 && classification === "system". */
  block: boolean;
  /** Deny-list lines that did not compile and so were not enforced on this scan (path + line number, never the pattern). */
  invalidPatterns?: InvalidDenyPattern[];
}

/** A deny-list line that does not compile as a JS regex. The pattern text is identity data, so only its location is carried. */
export interface InvalidDenyPattern { path: string; line: number; error: string }

/**
 * A deny-list that EXISTS but cannot be used: the read threw (permissions, a
 * directory in its place) or no line in it compiles. Distinct from an absent
 * list (a fresh install, which scans nothing by design): an existing-but-broken
 * list means the principal's data is meant to be guarded and we cannot, so
 * evaluateWrite turns this into a block on every guarded write.
 */
export class DenyListUnusableError extends Error {
  constructor(readonly path: string, readonly reason: string) {
    super(`deny-list ${path} exists but cannot be used: ${reason}`);
    this.name = "DenyListUnusableError";
  }
}

/** Pattern name carried by the block decision when the deny-list exists but cannot be used. */
export const DENY_LIST_UNUSABLE_PATTERN = "deny-list-unusable";

/** Pattern name carried by the block decision when the real location of a target cannot be established. */
export const PATH_UNRESOLVED_PATTERN = "path-unresolved";

/**
 * Classify a target file path. SYSTEM files are everything under a guarded root
 * that does NOT live in a containment zone AND is not pattern-allowlisted.
 * USER files are anything inside a containment zone OR pattern-allowlisted.
 * Out-of-tree files (outside every guarded root, see guardRoots()) are never blocked.
 * An explicit `claudeRoot` judges against that one root only.
 */
export function classifyTarget(
  absolutePath: string,
  claudeRoot?: string,
): { classification: GuardClassification; relPath: string; unresolved?: true } {
  const { verdicts, unresolved } = classifyForms(absolutePath, claudeRoot);
  if (unresolved) return { classification: "system", relPath: absolutePath, unresolved: true };
  let best: { classification: GuardClassification; relPath: string } = { classification: "out-of-tree", relPath: absolutePath };
  for (const v of verdicts) if (RANK[v.classification] > RANK[best.classification]) best = v;
  return best;
}

const RANK: Record<GuardClassification, number> = { "out-of-tree": 0, user: 1, system: 2 };
const MAX_LINK_HOPS = 40;

/** Path components as written: empty and `.` segments dropped, `..` KEPT for the physical walk. */
function rawComponents(p: string): string[] {
  // Windows takes a backslash and "/" alike.
  return p.split(sep === "\\" ? /[\\/]/ : "/").filter((c) => c !== "" && c !== ".");
}

/** The filesystem root `p` starts at (`/`, `C:\`, `\\host\share\`), in native separators. */
function fsRoot(p: string): string {
  const r = parse(p).root;
  return sep === "\\" ? r.replace(/\//g, sep) : r;
}

/**
 * The real location of `p`, resolved the way the kernel resolves it:
 * the ORIGINAL components are walked from `/` (a relative path from the process cwd), each existing
 * component is lstat'ed and a symlink is replaced by its target before the next component applies,
 * so a `..` steps out of the directory a link leads to, never out of the link's lexical parent.
 * Lexical `resolve()` first would turn `<outside>/link-into-tree/../x` into `<outside>/x` and misjudge
 * a write the kernel lands inside the guarded tree. Once a component does not exist, the rest is
 * joined lexically: nothing below it exists, so there is no link left to follow, and a writer that
 * creates the missing directories (`mkdir -p`) gets the same `..` arithmetic. A dangling link is
 * followed to where a write through it would land.
 * null when the location cannot be established (a loop or too many hops, a permission error).
 */
export function realpathDeepest(p: string): string | null {
  if (!p) return null;
  const start = isAbsolute(p) ? p : `${process.cwd()}${sep}${p}`;
  // Walk from the path's own root: on Windows a walk from "/" made "C:" a component that never exists.
  let cur = fsRoot(start);
  const queue = rawComponents(start.slice(parse(start).root.length));
  let exists = true;
  let hops = 0;
  while (queue.length > 0) {
    const c = queue.shift()!;
    if (c === "..") { cur = dirname(cur); continue; } // `cur` is physical while `exists`: its dirname is the real parent
    const next = cur.endsWith(sep) ? `${cur}${c}` : `${cur}${sep}${c}`;
    if (!exists) { cur = next; continue; }
    let isLink = false;
    try {
      isLink = lstatSync(next).isSymbolicLink();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") return null;
      exists = false;
      cur = next;
      continue;
    }
    if (!isLink) { cur = next; continue; }
    if (++hops > MAX_LINK_HOPS) return null;
    let target: string;
    try { target = readlinkSync(next); } catch { return null; }
    // The link's target replaces it; a relative target resolves from the link's own directory (`cur`).
    if (isAbsolute(target)) cur = fsRoot(target);
    queue.unshift(...rawComponents(isAbsolute(target) ? target.slice(parse(target).root.length) : target));
  }
  return cur;
}

function insideRoot(p: string, root: string): boolean {
  return isWithin(p, root);
}

/**
 * Every (form of the target) x (form of each root) verdict. Forms of the target: the lexical path
 * (relative resolved against the process cwd, `..` normalized) and its real location (the path as
 * written, walked with every link followed before the `..` after it). Forms of a
 * root: as written and realpathed. `unresolved` when the real location cannot be established.
 */
export function classifyForms(
  path: string,
  claudeRoot?: string,
): { verdicts: Array<{ classification: GuardClassification; relPath: string }>; unresolved: boolean } {
  if (!path) return { verdicts: [], unresolved: false };
  const lexical = resolve(path);
  // The physical walk takes the path as written: `..` applies after each link is followed.
  const real = realpathDeepest(path);
  const targets = real && real !== lexical ? [lexical, real] : [lexical];
  const roots = claudeRoot ? [claudeRoot] : guardRoots();
  const rootForms = new Set<string>();
  for (const r of roots) {
    rootForms.add(resolve(r));
    const rr = realpathDeepest(r);
    if (rr) rootForms.add(rr);
  }
  const verdicts: Array<{ classification: GuardClassification; relPath: string }> = [];
  for (const t of targets) {
    // The most specific root form containing this target form.
    let root: string | null = null;
    for (const r of rootForms) if (insideRoot(t, r) && (root === null || r.length > root.length)) root = r;
    if (root === null) continue;
    const rel = relativeToClaudeRoot(t, root);
    if (isContained(t, root) || isPatternAllowlisted(rel)) verdicts.push({ classification: "user", relPath: rel });
    else verdicts.push({ classification: "system", relPath: rel });
  }
  return { verdicts, unresolved: real === null };
}

/**
 * Compile one deny-list line. The list is ripgrep syntax, scanned with -i; JS has no
 * inline flag groups, so a single LEADING Rust-style group ("(?-i)", "(?i)", "(?s)",
 * "(?m)", or a combination of i/m/s) is translated into RegExp flags. Anything else
 * compiles as written and throws if JS rejects it.
 */
export function compileDenyPattern(line: string): RegExp {
  const lead = /^\(\?([ims]*)(?:-([ims]+))?\)/.exec(line);
  if (!lead || (lead[1] === "" && lead[2] === undefined)) return new RegExp(line, "i");
  const flags = new Set(["i"]);
  for (const f of lead[1]) flags.add(f);
  for (const f of lead[2] ?? "") flags.delete(f);
  return new RegExp(line.slice(lead[0].length), [...flags].join(""));
}

/**
 * Read the deny-list(s) and compile each non-comment line. Throws
 * DenyListUnusableError when a list exists but cannot be read, or when it has
 * pattern lines and none of them compile. A line that does not compile is
 * returned in `invalid` (location only) and the rest of the list still applies.
 * With no path, reads every guarded root's own deny-list and returns the union:
 * a Bash command can target files in either tree, and the union is only stricter.
 */
let warnedNoDenyList = false;
const warnedInvalid = new Set<string>();
export function loadPatternsReport(
  denyListPath?: string,
): { patterns: Array<{ source: string; regex: RegExp }>; invalid: InvalidDenyPattern[] } {
  const candidates = denyListPath ? [denyListPath] : guardRoots().map(denyListPathIn);
  const present = candidates.filter((p) => existsSync(p));
  if (present.length === 0) {
    // Deliberate fail-open: public installs ship no private deny-list, so the
    // corpus scan is inactive there by design. Say so once instead of looking
    // active while scanning nothing (public issue #1504, @tzioup).
    if (!warnedNoDenyList) {
      warnedNoDenyList = true;
      console.error(`[SystemFileGuard] no deny-list at ${candidates.join(", ")} — private-corpus scan inactive (expected on public installs)`);
    }
    return { patterns: [], invalid: [] };
  }
  const out: Array<{ source: string; regex: RegExp }> = [];
  const invalid: InvalidDenyPattern[] = [];
  const seen = new Map<string, boolean>(); // line -> compiled
  for (const path of present) {
    let text: string;
    try {
      text = readFileSync(path, "utf-8");
    } catch (err) {
      throw new DenyListUnusableError(path, `unreadable (${(err as NodeJS.ErrnoException).code ?? String(err)})`);
    }
    let lines = 0;
    let compiled = 0;
    text.split(/\r?\n/).forEach((rawLine, i) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) return;
      lines++;
      const prior = seen.get(line);
      if (prior !== undefined) { if (prior) compiled++; return; }
      try {
        out.push({ source: line, regex: compileDenyPattern(line) });
        seen.set(line, true);
        compiled++;
      } catch {
        seen.set(line, false);
        // Engine messages can echo the pattern, which is identity data: carry a fixed reason.
        invalid.push({ path, line: i + 1, error: "does not compile as a JS regex" });
      }
    });
    // A list that exists but yields zero usable patterns guards nothing: unusable, never a silent pass.
    // An absent list (above) stays the fresh-install case.
    if (lines === 0) throw new DenyListUnusableError(path, "it has no pattern lines (empty or comment-only); add patterns, or remove the file to run without a deny-list");
    if (compiled === 0) throw new DenyListUnusableError(path, `none of its ${lines} pattern lines compile`);
  }
  return { patterns: out, invalid };
}

/** Report each invalid deny-list line once per process on stderr (location only, never the pattern). */
export function warnInvalidPatterns(invalid: ReadonlyArray<InvalidDenyPattern>): void {
  for (const bad of invalid) {
    const key = `${bad.path}:${bad.line}`;
    if (warnedInvalid.has(key)) continue;
    warnedInvalid.add(key);
    console.error(`[SystemFileGuard] INVALID deny-list pattern at ${key} (${bad.error}) — that line is NOT enforced at write time; the rest of the list still applies. Fix the line.`);
  }
}

/** loadPatternsReport, with invalid lines reported via warnInvalidPatterns. Throws DenyListUnusableError like it. */
export function loadPatterns(
  denyListPath?: string,
): Array<{ source: string; regex: RegExp }> {
  const { patterns, invalid } = loadPatternsReport(denyListPath);
  warnInvalidPatterns(invalid);
  return patterns;
}

/**
 * Scan content for the first match of any pattern. Returns null when clean.
 * Stops at first hit — the hook only needs to know whether to block.
 */
export function scanForFirstHit(
  content: string,
  patterns: ReadonlyArray<{ source: string; regex: RegExp }>,
): GuardHit | null {
  if (!content) return null;
  for (const { source, regex } of patterns) {
    const m = regex.exec(content);
    if (m) return { pattern: source, match: m[0], index: m.index };
  }
  return null;
}

/**
 * Salted-hash filter — the PRIVACY-PRESERVING half of the guard (added 2026-07-07).
 * DeriveDenyHashes.ts turns the principal's private corpus into salted hashes of its
 * distinctive tokens; here we reproduce the same hashing at scan time. The filter
 * never contains the principal's data in the clear, and the salt lives in .env
 * (never ships), so a leaked hash file is opaque. Catches NOVEL private tokens (a
 * new device/contact/place) with no hand-maintenance, unlike the literal deny-list.
 */
export interface HashContext { hashes: Set<string>; salt: string; ngramSizes: number[]; minLen: number; hexLen: number }

export function loadHashContext(
  hashesPath = hashesPathIn(getClaudeDir()),
  envPath = envPathIn(getClaudeDir()),
): HashContext | null {
  if (!existsSync(hashesPath) || !existsSync(envPath)) return null;
  try {
    const m = /^DENYLIST_SALT=(.+)$/m.exec(readFileSync(envPath, "utf-8"));
    if (!m) return null;
    const salt = m[1].trim().replace(/^["']|["']$/g, "");
    const data = JSON.parse(readFileSync(hashesPath, "utf-8"));
    if (!Array.isArray(data.hashes) || data.hashes.length === 0) return null;
    const hashes: Set<string> = new Set(data.hashes);
    const ngramSizes: unknown = data.ngramSizes ?? [1, 2];
    // An n-gram size the scan cannot honour is a filter that cannot be used (evaluateWrite then blocks).
    if (!Array.isArray(ngramSizes) || ngramSizes.length === 0
      || !ngramSizes.every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_PHRASE_WORDS)) return null;
    return { hashes, salt, ngramSizes: ngramSizes as number[], minLen: data.minLen ?? 4, hexLen: data.hashes[0].length };
  } catch {
    return null; // fail-open: a broken hash file never breaks writes
  }
}

/**
 * THE token normalization shared by the producer (LIFEOS/TOOLS/DeriveDenyHashes.ts) and this scan
 *. Content and secret values are both lower-cased and cut into
 * these words; an n-gram is its words joined by one space. A value the producer hashes is therefore
 * always a token the scan can generate, whatever spaces or punctuation it carries.
 */
export const HASH_WORD_RE = /[a-z0-9'’-]+/g;
/** The longest phrase (in words) a derived filter may declare; longer values hash their first this-many words. */
export const MAX_PHRASE_WORDS = 8;

export function hashWords(text: string): string[] {
  return text.toLowerCase().match(HASH_WORD_RE) ?? [];
}

/**
 * The token a whole secret VALUE hashes to, and its size in words: the value's words (capped at
 * MAX_PHRASE_WORDS; any occurrence of the full value contains that prefix) joined by one space.
 * null when the value has no word characters, so nothing the scan generates could match it.
 */
export function hashPhraseToken(value: string): { token: string; words: number } | null {
  const words = hashWords(value).slice(0, MAX_PHRASE_WORDS);
  if (words.length === 0) return null;
  return { token: words.join(" "), words: words.length };
}

/** Salted, truncated sha256 of one token: the one hash both sides compute. */
export function saltedTokenHash(token: string, salt: string, hexLen: number): string {
  return createHash("sha256").update(`${salt}:${token}`).digest("hex").slice(0, hexLen);
}

/** Tokenize content the SAME way DeriveDenyHashes derives: every declared n-gram size + emails/domains. */
export function contentTokens(content: string, minLen: number, ngramSizes: number[]): string[] {
  const lower = content.toLowerCase();
  const words = hashWords(lower);
  const out: string[] = [];
  if (ngramSizes.includes(1)) for (const w of words) if (w.length >= minLen) out.push(w);
  for (const n of ngramSizes) {
    if (n < 2) continue;
    for (let i = 0; i + n <= words.length; i++) out.push(words.slice(i, i + n).join(" "));
  }
  for (const em of lower.matchAll(/\b([\w.+-]+)@([\w-]+(?:\.[\w-]+)+)\b/g)) { out.push(em[1]); out.push(em[2]); }
  for (const dm of lower.matchAll(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/g)) out.push(dm[0]);
  return out;
}

/** First content token whose salted hash is in the derived set. Match text is the
 * token from the WRITE's own content (echoing the user's input — reveals nothing new). */
export function scanForHashHit(content: string, ctx: HashContext): GuardHit | null {
  if (!content) return null;
  for (const tok of contentTokens(content, ctx.minLen, ctx.ngramSizes)) {
    if (ctx.hashes.has(saltedTokenHash(tok, ctx.salt, ctx.hexLen))) {
      return { pattern: "derived:private-token (salted-hash)", match: tok, index: content.toLowerCase().indexOf(tok) };
    }
  }
  return null;
}

/**
 * The full decision: classify + (if SYSTEM) scan content + (if hit) block.
 * USER zone writes are never blocked even if content matches patterns.
 * Scans the literal deny-list FIRST, then the salted-hash filter (if present).
 */
/**
 * Fold-owned memory files (curated ⟺ folded, 20260816-cortex-ledger-build):
 * every byte is a deterministic render of ledger events, so a direct harness
 * Write/Edit would silently diverge the projection from its log. Mutations go
 * through the sanctioned writers (MemorySystem.add → MemoryWriter.setEntries,
 * MemoryRestore). This tooth is PARTIAL prevention by design — Bash, non-Claude
 * runtimes, and editors bypass any hook. Edits made that way are adopted into
 * the ledger (CommitOwn, the next memory write, or `CortexLedger adopt`), and
 * the cadenced `CortexLedger verify` in MemoryHealthCheck flags any that are not.
 */
const FOLD_OWNED_TAILS = [
  "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md",
  "LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md",
];

export function evaluateWrite(
  absolutePath: string,
  newContent: string,
  opts: { denyListPath?: string; claudeRoot?: string; hashesPath?: string; envPath?: string; hygieneAllowlistPath?: string } = {},
): GuardDecision {
  const { classification, relPath, unresolved } = classifyTarget(absolutePath, opts.claudeRoot);
  // Defaults come from the tree that holds the target: each tree's own USER files govern its writes.
  // A lexical path outside every tree can still land inside one through a link: judge by where it lands.
  const root = opts.claudeRoot ?? rootFor(resolve(absolutePath)) ?? rootFor(realpathDeepest(absolutePath) ?? "") ?? getClaudeDir();
  if (unresolved) {
    // Where the write would land cannot be established (a link loop, an unreadable ancestor): refuse.
    return {
      classification,
      filePath: absolutePath,
      relPath,
      hits: [{ pattern: PATH_UNRESOLVED_PATTERN, match: "the real location of this path cannot be established (symlink loop or unreadable ancestor)", index: 0 }],
      block: true,
    };
  }
  const allRels = classifyForms(absolutePath, opts.claudeRoot).verdicts.map((v) => v.relPath);
  if (FOLD_OWNED_TAILS.some((t) => relPath === t || allRels.includes(t))) {
    return {
      classification,
      filePath: absolutePath,
      relPath,
      hits: [{
        pattern: "fold-owned:cortex-ledger",
        match: "direct Write/Edit to a fold-owned memory file — use MemorySystem.add (curation) or MemoryRestore (recovery); a deliberate bulk edit (rename sweep) is committed through CommitOwn, which adopts it into the ledger (or run CortexLedger adopt)",
        index: 0,
      }],
      block: true,
    };
  }
  // Private-skill SOURCE files are deny-scanned even when the containment zone marks
  // them USER (2026-07-23 separation tooth) — unless the file is hygiene-allowlisted
  // (release tooling / the customer skill's own name) or pattern-allowlisted.
  const gateAsPrivateSkill =
    classification === "user" &&
    isPrivateSkillSource(relPath) &&
    !loadHygieneAllowlist(opts.hygieneAllowlistPath ?? hygieneAllowlistPathIn(root)).has(relPath) &&
    !isPatternAllowlisted(relPath);
  if (classification !== "system" && !gateAsPrivateSkill) {
    return { classification, filePath: absolutePath, relPath, hits: [], block: false };
  }
  // Fail closed on a deny-list that exists but cannot be used: the scan would
  // otherwise pass content it never looked at. An absent list returns [] (fresh install).
  let patterns: Array<{ source: string; regex: RegExp }>;
  let invalidPatterns: InvalidDenyPattern[];
  try {
    ({ patterns, invalid: invalidPatterns } = loadPatternsReport(opts.denyListPath ?? denyListPathIn(root)));
  } catch (err) {
    if (!(err instanceof DenyListUnusableError)) throw err;
    return {
      classification,
      filePath: absolutePath,
      relPath,
      hits: [{ pattern: DENY_LIST_UNUSABLE_PATTERN, match: err.message, index: 0 }],
      block: true,
    };
  }
  warnInvalidPatterns(invalidPatterns);
  // A line that does not compile guards nothing, and stderr alone leaves it unenforced until someone
  // reads it. Same path as an unreadable list: refuse the SYSTEM write, naming file and line, never the pattern.
  if (invalidPatterns.length > 0) {
    const where = invalidPatterns.map((bad) => `${bad.path} line ${bad.line}`).join(", ");
    const err = new DenyListUnusableError(invalidPatterns[0]!.path, `pattern line(s) do not compile: ${where}`);
    return {
      classification,
      filePath: absolutePath,
      relPath,
      hits: [{ pattern: DENY_LIST_UNUSABLE_PATTERN, match: err.message, index: 0 }],
      block: true,
      invalidPatterns,
    };
  }
  let hit = scanForFirstHit(newContent, patterns);
  if (!hit) {
    const hashesPath = opts.hashesPath ?? hashesPathIn(root);
    const hctx = loadHashContext(hashesPath, opts.envPath ?? envPathIn(root));
    if (hctx) hit = scanForHashHit(newContent, hctx);
    else if (existsSync(hashesPath)) {
      // Same rule as the literal list: a derived filter that exists but cannot be used (unparseable,
      // no hashes, or DENYLIST_SALT missing) would pass content it never looked at.
      const err = new DenyListUnusableError(hashesPath, "the derived hash filter exists but cannot be used (unparseable, empty, or DENYLIST_SALT missing from .env); rerun DeriveDenyHashes or fix .env");
      return { classification, filePath: absolutePath, relPath, hits: [{ pattern: DENY_LIST_UNUSABLE_PATTERN, match: err.message, index: 0 }], block: true };
    }
  }
  if (!hit) return { classification, filePath: absolutePath, relPath, hits: [], block: false };
  return { classification, filePath: absolutePath, relPath, hits: [hit], block: true };
}

/**
 * Extract new content from a Write/Edit/MultiEdit tool_input shape.
 * Unknown shapes return empty string (the hook treats empty as nothing-to-scan).
 */
export function extractNewContent(toolInput: unknown): string {
  if (!toolInput || typeof toolInput !== "object") return "";
  const ti = toolInput as {
    content?: unknown;
    new_string?: unknown;
    edits?: unknown;
  };
  if (typeof ti.content === "string") return ti.content;
  if (typeof ti.new_string === "string") return ti.new_string;
  if (Array.isArray(ti.edits)) {
    return ti.edits
      .map((e) => (e && typeof e === "object" && typeof (e as { new_string?: unknown }).new_string === "string"
        ? (e as { new_string: string }).new_string
        : ""))
      .join("\n");
  }
  return "";
}
