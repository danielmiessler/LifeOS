/**
 * @version 1.3.1
 * egress-shapes.ts — the secret-VALUE shapes and sensitive-path rules, alone.
 *
 * PURE: no imports, no I/O. Extracted from egress-class-core.ts on 2026-09-05 so
 * the LifeOSHooks function-hook plugin can carry a byte-identical copy (a hooks
 * module cannot import anything outside its own folder — not even a symlink).
 * egress-class-core re-exports from here; the plugin's copy is held equal to
 * this file by skills/LifeOSHooks/tests/parity.test.ts. Edit HERE, then run
 * `bun skills/LifeOSHooks/scripts/SyncCores.ts`.
 */

export type EgressDataClass = "RESTRICTED" | "CONFIDENTIAL" | "INTERNAL" | "PUBLIC";

/** Secret VALUE shapes — THE credential inventory. Every credential family LifeOS knows sits here
 * and nowhere else: the egress gate, the Safety MCP scan, the router, the engine client, the
 * PUBLIC-lane spawn check, Proof, capture redaction, and the public-push generic signatures
 * (public-deny-list.ts compiles this list to git ERE) all read it. A family that one scanner
 * refuses and another passes is the bug class this closes (LOSIntegrity 2026-10-13, ranks 3-4).
 * Add a new family HERE, never to a consumer's own list. */
export const SECRET_VALUE_SHAPES: readonly RegExp[] = [
  /sk-or-v1-[A-Za-z0-9]{16,}/,            // OpenRouter
  /\bcsk-[A-Za-z0-9]{16,}/,               // Cerebras
  /\bsk-(?:ant-|proj-|live-)?[A-Za-z0-9_-]{20,}/, // OpenAI / Anthropic-style (includes sk-ant-api03-…, sk-proj-…, sk-live-…, sk-…)
  /\bghp_[A-Za-z0-9]{20,}/,               // GitHub PAT
  /\bglpat-[A-Za-z0-9_-]{16,}/,           // GitLab PAT
  /\bAKIA[0-9A-Z]{16}\b/,                 // AWS access key id
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,       // Slack
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,   // PEM private keys
  /\bAIza[0-9A-Za-z_-]{30,}/,             // Google API key
  /Bearer\s+[A-Za-z0-9._-]{24,}/,         // bearer tokens
  // Folded in from the redaction-only list on 2026-10-13: each is a live credential, so each refuses as well as redacts.
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,                                 // GitHub fine-grained PAT
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,  // JWT
  // Telegram bot token, bare or inside api.telegram.org/bot<token>/ (the colon
  // split it past SECRET_ASSIGNMENT). GHSA-8qfr-7fpx-68x9, @godagoo
  /(?<!\d)\d{8,10}:[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/,
  // URL userinfo `scheme://user:pass@host`; an `@` must follow, so `http://host:8080/` is untouched. GHSA-8qfr-7fpx-68x9 class follow-up, @godagoo
  /(?<=[A-Za-z][A-Za-z0-9+.-]*:\/\/)[^\s:@\/]*:[^\s@\/]+(?=@)/,
  // 2026-09-30 (Proof safety scan): the modern token families.
  /\bgh[opsu]_[A-Za-z0-9]{36}/,                                    // GitHub token (oauth, PAT, server-to-server, user-to-server), fixed 36
  /\bnpm_[A-Za-z0-9]{36}/,                                         // npm access token
  /\b[sr]k_live_[A-Za-z0-9]{24,}/,                                  // Stripe live secret / restricted key
  /\bxoxe(?:\.xox[bp])?-[A-Za-z0-9-]{10,}/,                         // Slack config / rotation token (xoxe-, xoxe.xoxp-)
  // AWS secret access key: 40 base64 chars, matched ONLY directly after an aws secret label (a bare 40-char run is far too
  // common to be a shape). The lookbehind keeps the label out of the match, so redaction leaves the label and replaces the value.
  // 1.3.1: the whitespace runs inside the lookbehind are bounded. Unbounded, every position of a long run of
  // spaces or newlines re-scanned the whole run backwards (about a second per 32k characters, x4 per doubling).
  /(?<=(?:aws[_ -]?secret[_ -]?(?:access[_ -]?)?key|secret[_ -]?access[_ -]?key)["']?\s{0,16}[:=]\s{0,16}["']?)[A-Za-z0-9\/+=]{40}(?![A-Za-z0-9\/+=])/i,
];

/** Sensitive path references — path list mirrored in
 * LIFEOS/DOCUMENTATION/Security/DataClassification.md (a former claim that this
 * mirrors a data-classification.json was wrong: no such file exists — public
 * issue #1615, @JohnnyDisco7).
 * Most-sensitive match wins (RESTRICTED sub-paths beat the LIFEOS/USER CONFIDENTIAL default).
 * Every rule is case-insensitive: macOS volumes are case-insensitive, so lifeos/user/finances/ reads
 * the same file as LIFEOS/USER/FINANCES/, and a case variant must never drop a path to PUBLIC
 * (2026-10-13). */
export const PATH_CLASS_RULES: ReadonlyArray<{ re: RegExp; cls: EgressDataClass }> = [
  { re: /(?:^|[\s'"`\/=])\.env\b/i, cls: "RESTRICTED" },
  { re: /(?:LIFEOS|PAI)\/USER\/CONFIG\/CREDENTIALS\//i, cls: "RESTRICTED" },
  // Customer-work anchor covers the SHIPPED scaffold names, not just this
  // machine's CUSTOMERS/ dir — on a stock install CUSTOMERS/ never exists, so
  // the old anchor was dead for every user (public issue #1615, @JohnnyDisco7).
  { re: /(?:LIFEOS|PAI)\/USER\/WORK\/(?:CUSTOMERS|YOUR_COMPANIES|SAMPLE_CUSTOMER|SAMPLE_CONSULTING)\//i, cls: "RESTRICTED" },
  { re: /skills\/_[a-z0-9]/i, cls: "CONFIDENTIAL" }, // any private (underscore-prefixed) skill dir, any case — generalized off a hardcoded customer prefix. Customer-RESTRICTED data is caught by USER/WORK/CUSTOMERS above + the release deny-list; on the capped GLM route (PUBLIC ceiling) CONFIDENTIAL blocks identically to RESTRICTED.
  { re: /(?:LIFEOS|PAI)\/USER\/(?:TELOS\/)?FINANCES\//i, cls: "RESTRICTED" }, // canonical USER/FINANCES since 2026-07-12; TELOS/ form kept as legacy alias — never weaken
  { re: /(?:LIFEOS|PAI)\/USER\/(?:TELOS\/)?HEALTH\//i, cls: "RESTRICTED" }, // health data home (was TELOS/HEALTH); previously only caught by the CONFIDENTIAL default
  { re: /(?:LIFEOS|PAI)\/USER\/CONTACTS\.md/i, cls: "RESTRICTED" },
  { re: /(?:LIFEOS|PAI)\/MEMORY\/KNOWLEDGE\/(?:People|Companies)\//i, cls: "CONFIDENTIAL" },
  { re: /(?:LIFEOS|PAI)\/MEMORY\/(?:RELATIONSHIP|SECURITY)\//i, cls: "CONFIDENTIAL" },
  { re: /(?:LIFEOS|PAI)\/USER\//i, cls: "CONFIDENTIAL" }, // privacy-boundary default
  // Relative spellings (2026-10-14): a command run from the LifeOS tree names
  // `USER/FINANCES/x.md` or `../USER/HEALTH/…` with no install prefix. A `USER/` segment, or a leading `./` or
  // `../`, anchors the relative form; a bare `FINANCES/x` relative to an unknown directory is classified through
  // pathClassAt with the command's working directory.
  // 1.3.1: one `./`-`../` run per alternative. The former `(?:\.{1,2}\/)*(?:USER\/|(?=\.{1,2}\/))(?:\.{1,2}\/)*`
  // put two unbounded runs side by side, so a long `../../…` run was split at every point (0.5 to 1 s per
  // rule on 24 KB). Same matches: dots, then USER/, then dots; or at least one dot segment and no USER/.
  { re: /(?:^|[\s'"`=(])(?:(?:\.{1,2}\/)*USER\/CONFIG\/CREDENTIALS\/|(?:\.{1,2}\/)+CONFIG\/CREDENTIALS\/)/i, cls: "RESTRICTED" },
  { re: /(?:^|[\s'"`=(])(?:(?:\.{1,2}\/)*USER\/(?:\.{1,2}\/)*|(?:\.{1,2}\/)+)(?:TELOS\/)?(?:FINANCES|HEALTH)\//i, cls: "RESTRICTED" },
  { re: /(?:^|[\s'"`=(])(?:(?:\.{1,2}\/)*USER\/(?:\.{1,2}\/)*|(?:\.{1,2}\/)+)CONTACTS\.md/i, cls: "RESTRICTED" },
  { re: /(?:^|[\s'"`=(])(?:(?:\.{1,2}\/)*USER\/(?:\.{1,2}\/)*|(?:\.{1,2}\/)+)WORK\/(?:CUSTOMERS|YOUR_COMPANIES|SAMPLE_CUSTOMER|SAMPLE_CONSULTING)\//i, cls: "RESTRICTED" },
];

/** Redaction-only shapes: none. Until 2026-10-13 this held credential families that were scrubbed
 * from captures but passed by the egress gate; they now live in SECRET_VALUE_SHAPES, which refuses
 * and redacts alike. Kept as an empty list because skills/Assay/Tools/Proof.ts still spreads it
 * beside SECRET_VALUE_SHAPES; a shape belongs here only if it should be scrubbed yet never refused. */
export const REDACTION_EXTRA_SHAPES: readonly RegExp[] = [];

/** A whole PEM private-key block, BEGIN through END — or through end of text when
 * truncation cut the END off. The list entry above matches the header line only,
 * which would leave the key body in the capture. */
const PEM_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----(?:[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----|[\s\S]*$)/g;

/** `NAME_KEY=value`, `token: value`, and the JSON / escaped-JSON spellings
 * (`"api_key":"value"`, `KEY=\"value\"`). Group 1 keeps the name so the log
 * still says WHICH setting was present; only the value is replaced. */
export const SECRET_ASSIGNMENT = /(\b[A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)[A-Za-z0-9_]*(?:\\?["'])?\s*[=:]\s*(?:\\?["'])?)[A-Za-z0-9._/+~-]{12,}/gi;

/** A bare key with no vendor prefix: 32+ letters and digits mixing upper case, lower case and digits.
 * Capture redaction only — kept out of REDACTION_EXTRA_SHAPES so Proof's output scan and the egress gate
 * do not change. 2026-10-11: a pasted bare API key (32 plain alphanumerics) passed every vendor shape into
 * captured records. Hex hashes lack upper case. */
export const BARE_TOKEN = /\b(?=[A-Za-z0-9]*[A-Z])(?=[A-Za-z0-9]*[a-z])(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{32,}\b/g;

const REDACTION_MARK = "[REDACTED]";
const GLOBAL_VALUE_SHAPES: readonly RegExp[] = [...SECRET_VALUE_SHAPES, ...REDACTION_EXTRA_SHAPES]
  .map((r) => new RegExp(r.source, r.flags.includes("g") ? r.flags : r.flags + "g"));

/** `text` with every secret-shaped value replaced by [REDACTED]. Run it BEFORE
 * truncating: a cut can split a token so its tail no longer matches a shape.
 * Pure and idempotent (redacting redacted text changes nothing). */
export function redactSecretValues(text: string): string {
  if (!text) return text;
  let out = text.replace(PEM_BLOCK, REDACTION_MARK);
  for (const re of GLOBAL_VALUE_SHAPES) out = out.replace(re, REDACTION_MARK);
  out = out.replace(BARE_TOKEN, REDACTION_MARK);
  return out.replace(SECRET_ASSIGNMENT, (_m, name: string) => name + REDACTION_MARK);
}

/**
 * A labeled opaque credential (2026-10-14): `api_key=…`, `"token": "…"`,
 * `DB_PASSWORD=…` whose value is opaque. SECRET_ASSIGNMENT redacted these while the refusal policy passed them.
 * The label must name the credential as a whole word segment (so `keyboard_layout` is not a key), and the value
 * must be opaque: 16+ characters mixing letters and digits, not a path, a variable reference, or a reviewed
 * placeholder (`your_api_key_here`, `xxxx…`, `example…`, `changeme`, `<…>`, `[REDACTED]`).
 */
// 1.3.1: the label starts only where its character run starts. `\b` also matched at every `-` inside a run,
// and each of those starts scanned to the end of the run (4 s on 32 KB of `a-`). The label test is a
// suffix test, so a label read from the start of its run still passes when its tail names a credential.
const LABELED_CREDENTIAL =
  /(?<![A-Za-z0-9_-])([A-Za-z0-9_-]*)(\\?["'])?\s*[=:]\s*(?:\\?["'])?([A-Za-z0-9._/+~=-]{16,})/g;
const CREDENTIAL_LABEL = /(?:^|[_-])(?:api_?)?(?:key|token|secret|password|passwd|credentials?)$|^(?:key|token|secret|password|passwd|credentials?)(?:[_-]|$)/i;
const PLACEHOLDER_VALUE = /^(?:x+|\*+|0+|\.+|-+)$|example|placeholder|your[_-]|changeme|redacted|dummy|sample|fake|insert|replace|todo/i;
export const LABELED_CREDENTIAL_SOURCE = "labeled-credential";
export function labeledCredential(text: string): boolean {
  for (const m of text.matchAll(LABELED_CREDENTIAL)) {
    const label = m[1] ?? "";
    const value = m[3] ?? "";
    if (!CREDENTIAL_LABEL.test(label)) continue;
    if (/^[/~.]/.test(value) || PLACEHOLDER_VALUE.test(value)) continue;
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) continue;
    return true;
  }
  return false;
}

/** The first secret-value shape `text` matches, as its source; null when clean. A labeled opaque credential
 * counts, reported as LABELED_CREDENTIAL_SOURCE, never as the value. */
export function firstSecretShape(text: string): string | null {
  for (const r of SECRET_VALUE_SHAPES) if (r.test(text)) return r.source;
  if (labeledCredential(text)) return LABELED_CREDENTIAL_SOURCE;
  return null;
}

/**
 * Path classification with relative references resolved against the command's working directory
 *. Pure and lexical: each relative path-shaped token is joined to `cwd` (`.` and `..`
 * folded) and the joined text is classified beside the original. The caller canonicalizes `cwd` (realpath)
 * before passing it; this module stays I/O-free for the plugin copy.
 */
export function pathClassAt(text: string, cwd: string | undefined): { cls: EgressDataClass; source: string } | null {
  if (!cwd || !cwd.startsWith("/")) return worstPathClass(text);
  const joined: string[] = [];
  const rels: string[] = [];
  for (const m of text.matchAll(/(?:^|[\s'"`=(<>|;&])((?:\.{1,2}\/)*[A-Za-z0-9_][A-Za-z0-9_.-]*\/[^\s'"`;&|<>()]*)/g)) rels.push(m[1]!);
  // A bare name with no slash names a file in the working directory: `cat CONTACTS.md` run in USER, `cat x.md`
  // run in USER/FINANCES. So does a bare glob, and `.` or `..` names the directory itself. The joined form only
  // classifies when the directory is sensitive, so elsewhere these words stay unclassified.
  for (const m of text.matchAll(/(?:^|[\s'"`=(<>|;&])([A-Za-z0-9_*?][A-Za-z0-9_.*?-]*\.[A-Za-z0-9_*?]{1,16}|\*|\.{1,2})(?=$|[\s'"`;&|<>()])/g)) {
    const word = m[1]!;
    rels.push(word === "*" || word === "." || word === ".." ? `${word}/` : word);
  }
  for (const rel of rels) {
    const parts = cwd.split("/").filter(Boolean);
    for (const seg of rel.split("/")) {
      if (seg === "" || seg === ".") continue;
      if (seg === "..") parts.pop(); else parts.push(seg);
    }
    joined.push("/" + parts.join("/") + (rel.endsWith("/") ? "/" : ""));
  }
  return worstPathClass(joined.length ? `${text}\n${joined.join("\n")}` : text);
}

/** The most sensitive path rule `text` references, or null. RESTRICTED beats CONFIDENTIAL. */
export function worstPathClass(text: string): { cls: EgressDataClass; source: string } | null {
  const rank: Record<EgressDataClass, number> = { RESTRICTED: 0, CONFIDENTIAL: 1, INTERNAL: 2, PUBLIC: 3 };
  let worst: { cls: EgressDataClass; source: string } | null = null;
  for (const { re, cls } of PATH_CLASS_RULES) {
    if (re.test(text) && (!worst || rank[cls] < rank[worst.cls])) worst = { cls, source: re.source };
  }
  return worst;
}
