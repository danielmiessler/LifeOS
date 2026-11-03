#!/usr/bin/env bun
/**
 * Secrets.ts — the sealed-.env contract.
 *
 * The plaintext `~/.claude/.env` is LOCAL ONLY (gitignored; every consumer keeps reading
 * it unchanged). What git carries is `.env.age`: the same bytes encrypted with age to one
 * post-quantum hybrid recipient whose private identity lives in the macOS login Keychain,
 * never in any repo. `.env.age.meta.json` (committed) records the sha256 of the plaintext
 * that was sealed so `status` can tell SEALED from STALE without decrypting.
 *
 *   init              generate the identity → Keychain (refuses to overwrite without --force)
 *   seal              .env → .env.age (+ meta); verifies the round trip before reporting
 *   unseal            .env.age → .env (refuses to clobber a differing .env without --force)
 *   status            SEALED | STALE | UNSEALED | NOSEAL | CORRUPT   (exit 0 only when SEALED; CORRUPT exits 5)
 *                     SEALED means the .env.age on disk is an age v1 envelope matching the sha256 and size
 *                     seal recorded in meta; a seal made before those were recorded reads STALE until re-sealed.
 *   export-identity   print the private identity for new-machine bootstrap (--yes required)
 *   install-hook      install pre-commit and pre-push into every private tree, commit-msg into ~/.claude
 *   has KEY [KEY...]  presence check — prints `KEY yes|no` per name, exit 0 only when all present.
 *                     A key whose value is empty (`KEY=`, `KEY=""`, `KEY= # note`) is `no`: it cannot authenticate.
 *   set KEY           store one value: read from the terminal with echo off (or from stdin when piped, one
 *                     trailing newline dropped), write .env atomically at mode 0600, then reseal when a seal
 *                     identity exists. The value is never printed, never taken from argv.
 *   keys              list the KEY names in .env, never the values
 *
 * `has` and `keys` exist so no session ever greps/cats .env in Bash: those commands trip the
 * Read(.env) ask rule and the rg/cat/grep deny rules in settings.json, which is where the
 * "constant permission prompts" came from (2026-09-03). `bun` is allowlisted, so
 * these run silently and still never expose a value.
 *
 * Env overrides (tests): LIFEOS_SECRETS_ENV, LIFEOS_SECRETS_SEALED, LIFEOS_SECRETS_KEYCHAIN_SERVICE, and
 * LIFEOS_SECRETS_SECURITY_BIN (the `security` binary; tests point it at a stub so no test reaches the real
 * Keychain — it grants nothing a PATH entry would not).
 * Never prints a key value. Identity reaches `age` via /dev/stdin, never argv or a temp file.
 */
import { existsSync, readFileSync, writeFileSync, chmodSync, renameSync, mkdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

import { invariant } from "./Invariant";
import { hasPosixModes } from "../../hooks/lib/portable-path";
import { getClaudeDir } from "./Paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord

const ENV_PATH = process.env.LIFEOS_SECRETS_ENV ?? join(getClaudeDir(), ".env");
const SEALED_PATH = process.env.LIFEOS_SECRETS_SEALED ?? join(getClaudeDir(), ".env.age");
const META_PATH = `${SEALED_PATH}.meta.json`;
const KEYCHAIN_SERVICE = process.env.LIFEOS_SECRETS_KEYCHAIN_SERVICE ?? "lifeos-age-identity";
// A workflow step may run with USER unset, and Bun's userInfo() then says "unknown", so the fallback asks the OS (id -un), never a constant.
const KEYCHAIN_ACCOUNT = process.env.USER || Bun.spawnSync(["id", "-un"], { stdout: "pipe" }).stdout.toString().trim();
const SECURITY_BIN = process.env.LIFEOS_SECRETS_SECURITY_BIN ?? "security";
const REPO_ROOT = getClaudeDir();
const HOOK_SRC_PRE_COMMIT = join(REPO_ROOT, "LIFEOS", "TOOLS", "githooks", "pre-commit");
const HOOK_SRC_COMMIT_MSG = join(REPO_ROOT, "LIFEOS", "TOOLS", "githooks", "commit-msg");

/** ciphertextSha256 and ciphertextBytes fingerprint the .env.age that seal wrote; absent only in a seal made before 2026-10-13. */
type Meta = { plaintextSha256: string; recipient: string; sealedAt: string; bytes: number; tool: string; ciphertextSha256?: string; ciphertextBytes?: number };

const AGE_V1_HEADER = "age-encryption.org/v1";

const sha256 = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");

/**
 * Status may say SEALED only when the ciphertext on disk is the one seal wrote: an age v1 envelope
 * whose bytes match the fingerprint in meta. A truncated, replaced or non-age file with an intact
 * meta must never read as SEALED.
 * `legacy` means the file is a plausible age envelope but meta carries no fingerprint to check it against.
 */
export function verifyCiphertext(cipher: Uint8Array, meta: Pick<Meta, "ciphertextSha256" | "ciphertextBytes">): { ok: boolean; legacy: boolean; reason: string } {
  if (cipher.length === 0) return { ok: false, legacy: false, reason: ".env.age is empty" };
  if (Buffer.from(cipher.subarray(0, AGE_V1_HEADER.length)).toString("utf8") !== AGE_V1_HEADER) return { ok: false, legacy: false, reason: ".env.age is not an age v1 envelope" };
  if (meta.ciphertextSha256 === undefined && meta.ciphertextBytes === undefined) return { ok: false, legacy: true, reason: "meta carries no ciphertext fingerprint (sealed before fingerprints were recorded)" };
  if (typeof meta.ciphertextBytes !== "number" || cipher.length !== meta.ciphertextBytes) return { ok: false, legacy: false, reason: `.env.age is ${cipher.length} bytes, meta says ${meta.ciphertextBytes}` };
  if (typeof meta.ciphertextSha256 !== "string" || sha256(cipher) !== meta.ciphertextSha256) return { ok: false, legacy: false, reason: ".env.age does not match the sha256 recorded at seal time" };
  return { ok: true, legacy: false, reason: "" };
}

function run(cmd: string[], stdin?: string | Uint8Array): { code: number; out: string; err: string } {
  const p = Bun.spawnSync(cmd, { stdin: stdin === undefined ? "ignore" : (typeof stdin === "string" ? Buffer.from(stdin) : stdin), stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}

function requireAge(): void {
  const r = run(["age", "--version"]);
  if (r.code !== 0) die("age is not installed (brew install age)");
}

function die(msg: string, code = 1): never {
  console.error(`✗ ${msg}`);
  process.exit(code);
}

// ── Keychain ────────────────────────────────────────────────────────────────
function keychainRead(): string | null {
  const r = run([SECURITY_BIN, "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w"]);
  if (r.code !== 0) return null;
  const id = r.out.trim();
  return /^AGE-SECRET-KEY-(PQ-)?1/.test(id) ? id : null;
}

function keychainWrite(identity: string, force: boolean): void {
  invariant(/^AGE-SECRET-KEY-(PQ-)?1/.test(identity), "identity must be an age secret key");
  invariant(!/\s/.test(identity), "identity must not contain whitespace");
  if (keychainRead() && !force) die(`Keychain item '${KEYCHAIN_SERVICE}' already exists — pass --force to replace (you will lose the ability to unseal anything sealed to the old key)`);
  // `security -i` reads commands from stdin, so the secret never appears on argv / in `ps`.
  const flags = force ? "-U " : "";
  const r = run([SECURITY_BIN, "-i"], `add-generic-password ${flags}-a "${KEYCHAIN_ACCOUNT}" -s "${KEYCHAIN_SERVICE}" -l "LifeOS age identity (seals ~/.claude/.env)" -w "${identity}"\n`);
  if (r.code !== 0) die(`keychain write failed: ${r.err.trim()}`);
  invariant(keychainRead() === identity, "keychain read-back must equal what was written");
}

// ── age ─────────────────────────────────────────────────────────────────────
function recipientOf(identity: string): string {
  const r = run(["age-keygen", "-y"], identity + "\n");
  if (r.code !== 0) die(`age-keygen -y failed: ${r.err.trim()}`);
  const pub = r.out.trim();
  invariant(/^age1(pq1)?[a-z0-9]+$/.test(pub), "derived recipient must be an age1 / age1pq1 public key");
  return pub;
}

function encrypt(plaintext: Uint8Array, recipient: string): Uint8Array {
  const p = Bun.spawnSync(["age", "-r", recipient], { stdin: plaintext, stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) die(`age encrypt failed: ${p.stderr.toString().trim()}`);
  return new Uint8Array(p.stdout);
}

function decrypt(ciphertextPath: string, identity: string): Uint8Array {
  // identity on stdin via /dev/stdin; ciphertext by path — no temp file ever holds the key.
  const p = Bun.spawnSync(["age", "-d", "-i", "/dev/stdin", ciphertextPath], { stdin: Buffer.from(identity + "\n"), stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) die(`age decrypt failed: ${p.stderr.toString().trim()}`);
  return new Uint8Array(p.stdout);
}

// ── Library use ─────────────────────────────────────────────────────────────
// For callers that seal their own files to this machine's identity (STATVS review-diff originals, migration ISA ISC-88).
// They throw instead of exiting, and never write the identity to disk or argv.

/** Seal bytes to the Keychain identity's recipient; the result carries the age v1 header. */
export function sealBytes(plaintext: Uint8Array): Uint8Array {
  const identity = keychainRead();
  if (!identity) throw new Error(`no age identity in Keychain item '${KEYCHAIN_SERVICE}'`);
  const k = run(["age-keygen", "-y"], identity + "\n");
  if (k.code !== 0) throw new Error(`age-keygen -y failed: ${k.err.trim()}`);
  const p = Bun.spawnSync(["age", "-r", k.out.trim()], { stdin: plaintext, stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) throw new Error(`age encrypt failed: ${p.stderr.toString().trim()}`);
  const cipher = new Uint8Array(p.stdout);
  invariant(Buffer.from(cipher.subarray(0, AGE_V1_HEADER.length)).toString("utf8") === AGE_V1_HEADER, "sealed output must carry the age v1 header");
  return cipher;
}

/** Decrypt an age file sealed to the Keychain identity and return its exact bytes. */
export function openSealedFile(ciphertextPath: string): Uint8Array {
  const identity = keychainRead();
  if (!identity) throw new Error(`no age identity in Keychain item '${KEYCHAIN_SERVICE}'`);
  const p = Bun.spawnSync(["age", "-d", "-i", "/dev/stdin", ciphertextPath], { stdin: Buffer.from(identity + "\n"), stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) throw new Error(`age decrypt failed: ${p.stderr.toString().trim()}`);
  return new Uint8Array(p.stdout);
}

function readMeta(): Meta | null {
  if (!existsSync(META_PATH)) return null;
  try {
    const m = JSON.parse(readFileSync(META_PATH, "utf8")) as Partial<Meta> | null;
    // A meta that cannot be read as a seal record is no seal record: status then says NOSEAL, never SEALED.
    if (!m || typeof m.plaintextSha256 !== "string" || !/^[0-9a-f]{64}$/.test(m.plaintextSha256)) return null;
    if (typeof m.sealedAt !== "string" || typeof m.bytes !== "number") return null;
    if (m.ciphertextSha256 !== undefined && !(typeof m.ciphertextSha256 === "string" && /^[0-9a-f]{64}$/.test(m.ciphertextSha256))) return null;
    if (m.ciphertextBytes !== undefined && typeof m.ciphertextBytes !== "number") return null;
    return m as Meta;
  } catch { return null; }
}

function writeAtomic(path: string, data: Uint8Array | string, mode: number): void {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, data, { mode });
  chmodSync(tmp, mode);
  renameSync(tmp, path);
}

// ── read-only key inspection (no values ever leave this function) ──────────
const ENV_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;
const KEY_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function envKeyNames(): string[] {
  if (!existsSync(ENV_PATH)) die(`${ENV_PATH} not found`);
  const names: string[] = [];
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = ENV_LINE.exec(line);
    if (m) names.push(m[1]!);
  }
  return names;
}

/**
 * True when the right-hand side of `KEY=<rest>` holds a value. Quoted values count their inside;
 * unquoted ones drop a `#` comment (at the start or after whitespace) and surrounding whitespace.
 * Returns only a boolean: no value leaves this function.
 */
export function envValueIsNonEmpty(rest: string): boolean {
  const r = rest.replace(/^\s+/, "");
  const q = r[0];
  if (q === '"' || q === "'") {
    const end = r.indexOf(q, 1);
    return (end === -1 ? r.slice(1).trim() : r.slice(1, end)).length > 0;
  }
  return r.replace(/(^|\s)#.*$/, "").trim().length > 0;
}

/** Names whose last definition in .env carries a non-empty value (later lines win, as the loaders read them). */
function envKeysWithValues(): Set<string> {
  if (!existsSync(ENV_PATH)) die(`${ENV_PATH} not found`);
  const state = new Map<string, boolean>();
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = ENV_LINE.exec(line);
    if (m) state.set(m[1]!, envValueIsNonEmpty(m[2]!));
  }
  return new Set([...state].filter(([, v]) => v).map(([k]) => k));
}

function cmdHas(keys: string[]): number {
  if (keys.length === 0) die("usage: Secrets.ts has KEY [KEY...]");
  const present = envKeysWithValues();
  let missing = 0;
  for (const k of keys) {
    const ok = present.has(k);
    if (!ok) missing++;
    console.log(`${k} ${ok ? "yes" : "no"}`);
  }
  return missing === 0 ? 0 : 1;
}

function cmdKeys(): void {
  for (const k of envKeyNames()) console.log(k);
}

// ── set: one value in, never echoed, never on argv ─────────────────────────
/** The slice of a TTY stream readHidden uses; tests pass a fake to watch raw mode and the bytes shown. */
export interface HiddenInput {
  setRawMode(on: boolean): unknown;
  resume(): unknown;
  pause(): unknown;
  on(ev: "data", fn: (chunk: Buffer) => void): unknown;
  off(ev: "data", fn: (chunk: Buffer) => void): unknown;
}

/**
 * Read one line from the terminal with echo off: raw mode is on before the first byte is read, so the
 * terminal never echoes what is typed, and nothing typed is written back. Ctrl-C aborts with nothing written.
 */
export async function readHidden(prompt: string, stdin: HiddenInput = process.stdin, shown: { write(s: string): unknown } = process.stderr): Promise<string> {
  shown.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  try {
    return await new Promise<string>((resolve, reject) => {
      let buf = "";
      const onData = (chunk: Buffer) => {
        for (const ch of chunk.toString("utf8")) {
          if (ch === "\r" || ch === "\n" || (ch === "\u0004" && buf === "")) { stdin.off("data", onData); resolve(buf); return; }
          if (ch === "\u0003") { stdin.off("data", onData); reject(new Error("aborted (Ctrl-C) — nothing written")); return; }
          if (ch === "\u007f" || ch === "\b") { buf = buf.slice(0, -1); continue; }
          buf += ch;
        }
      };
      stdin.on("data", onData);
    });
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
    shown.write("\n");
  }
}

/**
 * The `KEY=value` line for a value: bare when every character is shell- and dotenv-inert, else single-quoted
 * (literal in both `source` and the dotenv loaders), else double-quoted when that needs no escaping.
 */
export function formatEnvLine(key: string, value: string): string {
  invariant(KEY_NAME.test(key), "key must be a valid env name");
  invariant(value.length > 0, "value must be non-empty");
  invariant(!/[\r\n\0]/.test(value), "value must be one line");
  if (/^[A-Za-z0-9_\-.:\/+=@,~%^]+$/.test(value)) return `${key}=${value}`;
  if (!value.includes("'")) return `${key}='${value}'`;
  if (!/["\\$`]/.test(value)) return `${key}="${value}"`;
  die("the value mixes single quotes with characters that would need escaping; store it by editing .env directly");
}

/** The .env text with KEY set: the first definition replaced in place, later duplicates dropped, else appended. */
export function upsertEnvText(text: string, key: string, line: string): string {
  const out: string[] = [];
  let placed = false;
  for (const l of text.split("\n")) {
    const m = ENV_LINE.exec(l);
    if (m && m[1] === key) { if (!placed) { out.push(line); placed = true; } continue; }
    out.push(l);
  }
  if (!placed) {
    while (out.length > 0 && out[out.length - 1] === "") out.pop();
    out.push(line, "");
  }
  return out.join("\n");
}

async function cmdSet(key: string | undefined): Promise<void> {
  if (!key || !KEY_NAME.test(key)) die("usage: Secrets.ts set KEY   (the value is read from the terminal with echo off, or from stdin when piped)");
  const raw = process.stdin.isTTY
    ? await readHidden(`Value for ${key} (input hidden): `).catch((e: Error) => die(e.message, 130))
    : await Bun.stdin.text();
  const value = process.stdin.isTTY ? raw : raw.replace(/\r?\n$/, "");
  if (value.length === 0) die(`no value given for ${key} — nothing written`);
  if (/[\r\n\0]/.test(value)) die(`the value for ${key} spans more than one line — nothing written`);
  const line = formatEnvLine(key, value);

  // Write through a symlinked .env to its target, so the link survives (LIFEOS/.env points here).
  const target = existsSync(ENV_PATH) ? realpathSync(ENV_PATH) : ENV_PATH;
  const before = existsSync(target) ? readFileSync(target, "utf8") : "";
  const after = upsertEnvText(before, key, line);
  const namesBefore = new Set(before.split("\n").map((l) => ENV_LINE.exec(l)?.[1]).filter(Boolean));
  const namesAfter = after.split("\n").map((l) => ENV_LINE.exec(l)?.[1]).filter(Boolean);
  invariant(namesAfter.filter((n) => n === key).length === 1, "the new .env must define the key exactly once");
  invariant([...namesBefore].every((n) => namesAfter.includes(n)), "setting one key must keep every other key");
  mkdirSync(dirname(target), { recursive: true });
  writeAtomic(target, after, 0o600);
  // Windows reports 0o666 whatever was set; the profile ACL keeps .env private there.
  if (hasPosixModes()) invariant((statSync(target).mode & 0o777) === 0o600, ".env must be mode 0600 after set");
  console.log(`✓ set ${key} in ${ENV_PATH} (mode 600; value not shown)`);

  // Reseal whenever this machine seals; a machine that never set up sealing is told how, not failed.
  if (keychainRead()) { cmdSeal(); return; }
  if (existsSync(SEALED_PATH)) die(`${key} is written, but .env.age is now STALE: no seal identity in the Keychain (service '${KEYCHAIN_SERVICE}') — restore it, then run \`Secrets.ts seal\``, 6);
  console.log("• not sealed: this machine has no seal identity. To keep an encrypted copy, run `Secrets.ts init` then `Secrets.ts seal`.");
}

// ── commands ────────────────────────────────────────────────────────────────
function cmdInit(force: boolean): void {
  requireAge();
  const r = run(["age-keygen", "-pq"]);
  if (r.code !== 0) die(`age-keygen failed: ${r.err.trim()}`);
  const identity = r.out.split("\n").find((l) => /^AGE-SECRET-KEY-(PQ-)?1/.test(l))?.trim();
  invariant(identity, "age-keygen output must contain an identity line");
  keychainWrite(identity, force);
  console.log(`✓ identity stored in login Keychain (service '${KEYCHAIN_SERVICE}', account '${KEYCHAIN_ACCOUNT}')`);
  console.log(`  recipient: ${recipientOf(identity)}`);
  console.log(`  back the identity up out-of-band once: bun LIFEOS/TOOLS/Secrets.ts export-identity --yes`);
}

function cmdSeal(): void {
  requireAge();
  const identity = keychainRead() ?? die("no identity in Keychain — run `Secrets.ts init` first");
  if (!existsSync(ENV_PATH)) die(`${ENV_PATH} not found`);
  const plain = new Uint8Array(readFileSync(ENV_PATH));
  invariant(plain.length > 0, ".env must be non-empty");
  invariant(/^[A-Z0-9_]+=/m.test(Buffer.from(plain).toString("utf8")), ".env must contain at least one KEY= line");
  const recipient = recipientOf(identity);
  const cipher = encrypt(plain, recipient);
  invariant(cipher.length > plain.length, "ciphertext must be larger than plaintext (age header)");
  invariant(Buffer.from(cipher.subarray(0, 21)).toString("utf8") === "age-encryption.org/v1", "output must carry the age v1 header");
  mkdirSync(dirname(SEALED_PATH), { recursive: true });
  writeAtomic(SEALED_PATH, cipher, 0o644);
  // Round trip before we claim anything.
  const back = decrypt(SEALED_PATH, identity);
  invariant(sha256(back) === sha256(plain), "round-trip decrypt must reproduce the plaintext exactly");
  const onDisk = new Uint8Array(readFileSync(SEALED_PATH));
  invariant(sha256(onDisk) === sha256(cipher), "the .env.age on disk must be the ciphertext just produced");
  const meta: Meta = { plaintextSha256: sha256(plain), recipient, sealedAt: new Date().toISOString(), bytes: plain.length, tool: "LIFEOS/TOOLS/Secrets.ts", ciphertextSha256: sha256(onDisk), ciphertextBytes: onDisk.length };
  writeAtomic(META_PATH, JSON.stringify(meta, null, 2) + "\n", 0o644);
  console.log(`✓ sealed ${plain.length} bytes → ${SEALED_PATH} (round-trip verified, sha256 ${meta.plaintextSha256.slice(0, 12)}…)`);
}

function cmdUnseal(force: boolean): void {
  requireAge();
  const identity = keychainRead() ?? die("no identity in Keychain — restore it with `security` or re-run init on a machine that has it");
  if (!existsSync(SEALED_PATH)) die(`${SEALED_PATH} not found`);
  const plain = decrypt(SEALED_PATH, identity);
  invariant(plain.length > 0, "decrypted .env must be non-empty");
  const meta = readMeta();
  if (meta) invariant(sha256(plain) === meta.plaintextSha256, "decrypted bytes must match the sealed sha256 in meta");
  if (existsSync(ENV_PATH)) {
    const cur = new Uint8Array(readFileSync(ENV_PATH));
    if (sha256(cur) === sha256(plain)) { console.log("✓ .env already matches the sealed copy — nothing to do"); return; }
    if (!force) die(`${ENV_PATH} exists and differs from the sealed copy — pass --force to replace it (a .env.bak-<ts> is kept, mode 600)`);
    const bak = `${ENV_PATH}.bak-${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}`;
    writeAtomic(bak, cur, 0o600);
    console.log(`  kept previous .env at ${bak}`);
  }
  writeAtomic(ENV_PATH, plain, 0o600);
  console.log(`✓ unsealed ${plain.length} bytes → ${ENV_PATH} (mode 600)`);
}

function cmdStatus(): number {
  const meta = readMeta();
  const hasEnv = existsSync(ENV_PATH);
  const hasSealed = existsSync(SEALED_PATH);
  if (!hasSealed || !meta) { console.log(hasEnv ? "NOSEAL   .env exists but has never been sealed — run `Secrets.ts seal`" : "NOSEAL   no .env and no .env.age"); return 3; }
  // The ciphertext is checked before any state that implies it is usable (SEALED, UNSEALED).
  const verdict = verifyCiphertext(new Uint8Array(readFileSync(SEALED_PATH)), meta);
  if (verdict.legacy) { console.log(`STALE    ${verdict.reason} — run \`Secrets.ts seal\` to record one`); return 2; }
  if (!verdict.ok) { console.log(`CORRUPT  ${verdict.reason} — restore .env.age from git, or run \`Secrets.ts seal\` if the plaintext .env is good`); return 5; }
  if (!hasEnv) { console.log(`UNSEALED .env.age present (sealed ${meta.sealedAt}), no plaintext .env — run \`Secrets.ts unseal\``); return 4; }
  const cur = sha256(new Uint8Array(readFileSync(ENV_PATH)));
  if (cur === meta.plaintextSha256) { console.log(`SEALED   .env matches .env.age (sealed ${meta.sealedAt}, ${meta.bytes} bytes)`); return 0; }
  console.log(`STALE    .env changed since last seal (${meta.sealedAt}) — run \`Secrets.ts seal\``);
  return 2;
}

function cmdExportIdentity(yes: boolean): void {
  if (!yes) die("this prints the PRIVATE identity. Re-run with --yes, and store the output in a password manager — never in a repo, a note, or a chat.");
  const identity = keychainRead() ?? die("no identity in Keychain");
  process.stdout.write(identity + "\n");
}

function cmdInstallHook(): void {
  invariant(existsSync(HOOK_SRC_PRE_COMMIT), `hook source missing at ${HOOK_SRC_PRE_COMMIT}`);
  invariant(existsSync(HOOK_SRC_COMMIT_MSG), `hook source missing at ${HOOK_SRC_COMMIT_MSG}`);
  const hooksDir = join(REPO_ROOT, ".git", "hooks");
  invariant(existsSync(hooksDir), `${hooksDir} missing — is ~/.claude a git repo?`);

  const preCommitBody = readFileSync(HOOK_SRC_PRE_COMMIT, "utf8");
  invariant(preCommitBody.includes("lifeos-secrets-guard"), "pre-commit hook source must carry the lifeos-secrets-guard marker");

  // Install commit-msg hook (SYSTEM tree only: it guards layer-one rule removals)
  const commitMsgDst = join(hooksDir, "commit-msg");
  const commitMsgBody = readFileSync(HOOK_SRC_COMMIT_MSG, "utf8");
  invariant(commitMsgBody.includes("lifeos-judgment-lane-guard"), "commit-msg hook source must carry the lifeos-judgment-lane-guard marker");
  writeAtomic(commitMsgDst, commitMsgBody, 0o755);
  console.log(`✓ installed ${commitMsgDst}`);

  // Install pre-commit and pre-push in every private tree: this repo and the USER data repo behind
  // LIFEOS/USER. pre-commit's env and gitleaks checks apply to both; its SYSTEM leak scan runs only
  // where LIFEOS/TOOLS/githooks/StagedLeakScan.ts exists under the tree's top level.
  const prePushSrc = join(REPO_ROOT, "LIFEOS", "TOOLS", "githooks", "pre-push");
  invariant(existsSync(prePushSrc), `hook source missing at ${prePushSrc}`);
  const prePushBody = readFileSync(prePushSrc, "utf8");
  invariant(prePushBody.includes("lifeos-pre-push"), "pre-push hook source must carry the lifeos-pre-push marker");
  const userLink = join(REPO_ROOT, "LIFEOS", "USER");
  const trees = [REPO_ROOT];
  if (existsSync(userLink)) {
    const top = spawnSync("git", ["-C", realpathSync(userLink), "rev-parse", "--show-toplevel"], { encoding: "utf8" });
    if (top.status === 0 && top.stdout.trim()) trees.push(top.stdout.trim());
  }
  for (const tree of trees) {
    invariant(existsSync(join(tree, ".git", "hooks")), `${tree}/.git/hooks missing`);
    for (const [name, body] of [["pre-commit", preCommitBody], ["pre-push", prePushBody]] as const) {
      const dst = join(tree, ".git", "hooks", name);
      writeAtomic(dst, body, 0o755);
      console.log(`✓ installed ${dst}`);
    }
  }
}

// ── main ────────────────────────────────────────────────────────────────────
if (import.meta.main) {
  const [cmd, ...rest] = process.argv.slice(2);
  const force = rest.includes("--force");
  const yes = rest.includes("--yes");
  switch (cmd) {
    case "init": cmdInit(force); break;
    case "seal": cmdSeal(); break;
    case "unseal": cmdUnseal(force); break;
    case "status": process.exitCode = cmdStatus(); break;
    case "export-identity": cmdExportIdentity(yes); break;
    case "install-hook": cmdInstallHook(); break;
    case "has": process.exitCode = cmdHas(rest.filter((a) => !a.startsWith("--"))); break;
    case "keys": cmdKeys(); break;
    case "set": {
      const pos = rest.filter((a) => !a.startsWith("--"));
      if (pos.length > 1) die("never pass a value on the command line (it lands in shell history and ps); run `Secrets.ts set KEY` and type it, or pipe it in");
      // No top-level await: Workflows bundles this module for Workers through engine/secrets.ts, and Bun refuses a
      // require of a module with one (the cloud runner build failed on it from 2026-10-14).
      cmdSet(pos[0]).catch((e: Error) => die(e.message));
      break;
    }
    default:
      console.log("usage: Secrets.ts init [--force] | seal | unseal [--force] | status | export-identity --yes | install-hook | has KEY [KEY...] | set KEY | keys");
      process.exit(cmd ? 1 : 0);
  }
}
