#!/usr/bin/env bun
/**
 * DeriveDenyHashes.ts — turn the principal's PRIVATE corpus into a SALTED-HASH
 * leak filter, so the guard can block private data appearing in shipping code
 * WITHOUT the filter ever containing that data in the clear.
 *
 *   bun ~/.claude/LIFEOS/TOOLS/DeriveDenyHashes.ts            # regenerate DENY_HASHES.json
 *   bun ~/.claude/LIFEOS/TOOLS/DeriveDenyHashes.ts --dry-run  # counts only, write nothing
 *   bun ~/.claude/LIFEOS/TOOLS/DeriveDenyHashes.ts --show-tokens  # LOCAL review: print derived
 *                                                                  # plaintext tokens (never persisted)
 *
 * WHY THIS EXISTS: the hand-maintained DENY_LIST.txt is a BLOCKLIST — it only
 * catches strings someone remembered to add, and it holds them in plaintext.
 * This derives the filter from the private data itself (identity, contacts, gear,
 * TELOS, network topology), so a NEW device / contact / place is auto-forbidden in
 * code the moment it lands in the corpus — and stores only SALTED HASHES, so the
 * filter is opaque even if it leaked. Public LifeOS ships this tool + the guard;
 * each user runs it against their own corpus. No principal data in any shipped file.
 *
 * OUTPUT: skills/_LIFEOS/DENY_HASHES.json (private _-skill -> stripped at release):
 *   { version, algo, ngramSizes, count, hashes: ["<hex>", ...] }   <- hashes only, no plaintext.
 * SALT: ~/.claude/.env `DENYLIST_SALT` (generated once; never ships). The guard reads
 *   the same salt to reproduce hashes at scan time.
 *
 * FALSE-POSITIVE CONTROL is entirely on THIS side: only distinctive proper-noun-ish
 * tokens are hashed (capitalized, length >= MIN_LEN, not a common word, not on the
 * generic-term allowlist). A content token matches only if it EQUALS a derived
 * token, so filtering here keeps the scan precise. Tune ALLOWLIST/STOPWORDS with
 * --show-tokens.
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { claudeDir } from "./lifeos-root";

const HOME = process.env.HOME || homedir();
const CLAUDE = join(claudeDir());
const ENV_PATH = join(CLAUDE, ".env");
const OUT_PATH = join(CLAUDE, "skills", "_LIFEOS", "DENY_HASHES.json");
const MIN_LEN = 4;          // single tokens shorter than this are too FP-prone
const HASH_HEX_LEN = 24;    // truncated sha256 — collision-safe at this corpus size, smaller file
const NGRAM_SIZES = [1, 2]; // 1-grams (surnames, hostnames) + 2-grams (multi-word names/places)

// Private source corpus. Paths resolve through the USER/MEMORY symlinks. A file
// that doesn't exist on a given install is simply skipped.
function corpusFiles(): string[] {
  const rel = [
    "LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md",
    "LIFEOS/USER/PRINCIPAL/RESUME.md",
    "LIFEOS/USER/CONTACTS.md",
    "LIFEOS/USER/GEAR.md",
    "LIFEOS/USER/TELOS/TELOS.md",
    "LIFEOS/MEMORY/_NETWORK/assets.json",
  ].map((r) => join(CLAUDE, r));
  const netDir = join(CLAUDE, "LIFEOS/MEMORY/_NETWORK");
  try {
    const snap = readdirSync(netDir).filter((f) => /^topology-snapshot-.*\.md$/.test(f)).sort().pop();
    if (snap) rel.push(join(netDir, snap));
  } catch { /* none */ }
  return rel.filter(existsSync);
}

// Common words + generic tech terms that must never be hashed (they appear in code).
const STOPWORDS = new Set<string>([
  "the","and","for","with","this","that","from","have","will","your","you","are","was","were","been","they","them","their","what","when","where","which","while","would","could","should","about","into","over","under","then","than","also","some","most","more","much","many","such","only","other","these","those","here","there","after","before","being","because","between","through","during","above","below","again","once","each","both","very","just","like","make","made","time","work","home","user","name","role","note","kind","item","list","data","code","file","path","true","false","null","type","value","model","details","primary","secondary","sample","example","default",
  // generic gear/tech nouns that legitimately appear in code/docs
  "computer","laptop","monitor","display","camera","cameras","router","switch","switches","server","network","device","devices","system","software","language","framework","infrastructure","workstation","headphones","microphone","thermostat","garage","lighting","internet","studio","office","audio","music","coffee","health","sleep","house","stack","brand",
  // modern-common words the classic /usr/share/dict/words list omits, so they read
  // as the "distinctive" half of Title-Case phrases and got hashed as false private
  // fingerprints (2026-07-08 fix; words ordered so no two form a currently-hashed pair).
  "online","lifecycle","credentials","technologies","minis","wifi","division","mobile","live","fucking",
]);

// Tokens that legitimately appear in SHIPPING/public files — public attribution,
// product names, and generic vendor/model terms LifeOS references. Lowercase.
const ALLOWLIST = new Set<string>([
  "danielmiessler","miessler","lifeos","github","claude","anthropic","opus","sonnet","haiku","fable","cloudflare","typescript","react","astro","vitepress","hono","wrangler","stripe","google","apple","openai","gemini","descript","elevenlabs",
  // generic vendor/product terms that appear in feature code (not private fingerprints)
  "unifi","ubiquiti","ecobee","homebridge","homekit","oura","limitless","beehiiv","fabric","substrate","telos","surface","arbol","pulse","interceptor","genelec","ratgdo","shure","hario","chemex","clever","philz","kinu","weber","herman","miller","meshuggah","boris","brejcha",
  // generic security/tech abbreviations (not in the dictionary, but appear in code/docs)
  "auth","oauth","ciso","cissp","csslp","comptia","appsec","vulnmgmt","cpus","saas","chatgpt","aes67","xhtml","itops","secops","devops","kubernetes","webhook","webhooks","jsonl","esp32","zigbee",
  // public social/platform names + shared email-provider LABELS (the domain check
  // tests domain.split(".")[0] against this set, so a bare label suffices). All are
  // public, never private fingerprints — like github/google above (2026-07-08 fix).
  "linkedin","youtube","twitter","instagram","facebook","tiktok","bluesky","mastodon","threads","discord","reddit","medium","substack","patreon","twitch","spotify",
  "gmail","googlemail","icloud","outlook","hotmail","yahoo","aol","proton","protonmail","mac",
  // public brands / orgs / products / certs — non-dictionary but PUBLIC (former
  // employers, OS/tool names, gear brands the principal references openly). Ordered
  // so no two form a currently-hashed pair (2026-07-08 fix).
  "kali","owasp","linux","waymo","hewlett","ioactive","packard","robinhood","microsoft","sdlc","mcse","merging","nvidia","anubis","sennheiser","ubuntu","debian","macos","android","windows","intel",
]);

// Real English words are dropped — what survives is proper nouns (surnames,
// brands, hostnames, place names), which ARE the private fingerprint. This is the
// main false-positive control: "build"/"content"/"design" are dictionary words and
// never hashed, so they can't block legitimate code.
function loadDict(): Set<string> {
  for (const p of ["/usr/share/dict/words", "/usr/dict/words"]) {
    try {
      return new Set(readFileSync(p, "utf8").split("\n").map((w) => w.trim().toLowerCase()).filter(Boolean));
    } catch { /* try next */ }
  }
  return new Set();
}
const DICT = loadDict();

// True if the word — OR its de-inflected stem — is a real dictionary word. The
// dict only holds base forms, so plurals/inflections ("books","clients","created",
// "avoiding") need stemming or they'd survive as false "distinctive" tokens.
function dictish(lw: string): boolean {
  if (DICT.has(lw)) return true;
  const tries: string[] = [];
  if (lw.endsWith("ies")) tries.push(lw.slice(0, -3) + "y");
  for (const suf of ["s", "es", "ed", "ing", "'s", "’s", "ly", "er", "ers"]) {
    if (lw.endsWith(suf)) tries.push(lw.slice(0, -suf.length));
  }
  return tries.some((s) => s.length >= 3 && DICT.has(s));
}

function loadSalt(): string {
  const env = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const m = /^DENYLIST_SALT=(.+)$/m.exec(env);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  const salt = randomBytes(32).toString("hex");
  appendFileSync(ENV_PATH, `${env.endsWith("\n") || env === "" ? "" : "\n"}DENYLIST_SALT=${salt}\n`);
  console.log(`[DeriveDenyHashes] generated DENYLIST_SALT in ${ENV_PATH}`);
  return salt;
}

export function hashToken(token: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${token}`).digest("hex").slice(0, HASH_HEX_LEN);
}

/**
 * Extract HIGH-CONFIDENCE private tokens only. Lone single words are the main
 * false-positive source (a spelling dictionary omits much common jargon), so we
 * derive by TYPE: two-word capitalized name sequences, email local parts,
 * email/standalone domains, and — only from network sources (opts.singles) — lone
 * host/device identifiers. A pair is kept only if at least one word is a
 * non-dictionary token; all-dictionary/allowlisted pairs are dropped.
 */
export function extractTokens(text: string, opts: { singles?: boolean } = {}): Set<string> {
  const out = new Set<string>();
  const distinctive = (w: string) => {
    const lw = w.toLowerCase();
    if (/['’]/.test(lw)) return false; // contraction/possessive ("I've", "that's") — not a name
    return lw.length >= MIN_LEN && !STOPWORDS.has(lw) && !ALLOWLIST.has(lw) && !dictish(lw);
  };
  const pairRe = /\b([A-Z][a-zA-Z0-9'’]+)\s+([A-Z][a-zA-Z0-9'’]+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(text))) {
    if (distinctive(m[1]) || distinctive(m[2])) out.add(`${m[1]} ${m[2]}`.toLowerCase());
  }
  for (const em of text.matchAll(/\b([\w.+-]+)@([\w-]+(?:\.[\w-]+)+)\b/g)) {
    const local = em[1].toLowerCase();
    if (local.length >= MIN_LEN && !ALLOWLIST.has(local) && !dictish(local)) out.add(local);
    const domain = em[2].toLowerCase();
    if (!ALLOWLIST.has(domain.split(".")[0])) out.add(domain);
  }
  for (const dm of text.matchAll(/\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|ai|dev|co|app|lan|edu|gov)\b/gi)) {
    const d = dm[0].toLowerCase();
    if (!ALLOWLIST.has(d.split(".")[0])) out.add(d);
  }
  if (opts.singles) {
    for (const w of text.match(/[A-Za-z][A-Za-z0-9'’-]+/g) ?? []) if (distinctive(w)) out.add(w.toLowerCase());
  }
  return out;
}

function main(): void {
  const dryRun = process.argv.includes("--dry-run");
  const showTokens = process.argv.includes("--show-tokens");
  const files = corpusFiles();
  const tokens = new Set<string>();
  for (const f of files) {
    // Single-token extraction stays OFF: even network sources are prose-heavy and
    // yield generic tech words that false-positive. Name 2-grams + emails + domains
    // are the precise core; bare hostnames remain covered by the hand deny-list.
    try { for (const t of extractTokens(readFileSync(f, "utf8"))) tokens.add(t); }
    catch { /* skip unreadable */ }
  }
  console.log(`[DeriveDenyHashes] ${files.length} corpus files -> ${tokens.size} distinctive tokens`);
  if (showTokens) {
    console.log("[DeriveDenyHashes] --show-tokens (LOCAL review, NOT written to disk):");
    console.log([...tokens].sort().join(", "));
  }
  if (dryRun) { console.log("[DeriveDenyHashes] --dry-run: nothing written"); return; }

  const salt = loadSalt();
  const hashes = [...tokens].map((t) => hashToken(t, salt)).sort();
  const payload = {
    version: 1,
    algo: `sha256-salted-trunc${HASH_HEX_LEN}`,
    ngramSizes: NGRAM_SIZES,
    minLen: MIN_LEN,
    count: hashes.length,
    generated: "DeriveDenyHashes.ts",
    note: "Salted hashes of distinctive private tokens. No plaintext. Salt in .env (never ships).",
    hashes,
  };
  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 0) + "\n");
  console.log(`[DeriveDenyHashes] wrote ${hashes.length} salted hashes -> ${OUT_PATH} (no plaintext)`);
}

if (import.meta.main) main();
