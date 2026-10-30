/**
 * Attest — is this install's system payload the release it says it is?
 *
 * Fresh installs are expensive for contributors to reproduce on (public
 * discussion #1847, @garthsch). Attesting is cheap: fetch the release tarball
 * for the installed version, render the identity placeholders the way the
 * installer did, and byte-compare the system-owned trees. The answer is
 * `unmodified`, `modified` with the diverging files, or `unattested` with the
 * reason. It never says `unmodified` from anything but the compare.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { detectDevTree, substituteTree, type TemplateVars } from "./InstallEngine";
import { configTomlPath, SYSTEM_TREES } from "./Redact";
import { optInNotInstalled, resolveIdentityVars } from "./OverlaySystem";

export { SYSTEM_TREES };
const SKIP = new Set(["node_modules", ".git", ".next", "dist", "out"]);
/** Rewritten by `bun install` on every install/update; never a user modification. */
const SKIP_FILES = new Set(["bun.lock", "bun.lockb", "package-lock.json", "yarn.lock", ".DS_Store"]);
/** On an install this dir holds only the bootstrap; in the release it holds the whole payload. Never comparable. */
const BOOTSTRAP_DIR = join("skills", "LifeOS", "install");

export interface Attestation {
  status: "unmodified" | "modified" | "unattested";
  reason?: string;
  reference?: string;
  compared: number;
  modified: string[];
  missing: number;
}

export function installedVersion(lifeosDir: string): string | null {
  const p = join(lifeosDir, "VERSION");
  if (!existsSync(p)) return null;
  const v = readFileSync(p, "utf8").trim();
  return /^\d+\.\d+\.\d+$/.test(v) ? v : null;
}

function sha256(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function walkFiles(root: string, rel = ""): string[] {
  const dir = join(root, rel);
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const r = rel ? join(rel, e.name) : e.name;
    if (e.isDirectory()) out.push(...walkFiles(root, r));
    else if (e.isFile() && !SKIP_FILES.has(e.name)) out.push(r);
  }
  return out;
}

/**
 * System-owned single files outside the trees, placed by the same path in payload and install (OverlaySystem's
 * SYSTEM_FILES). Compared when the install has them: an absent one is a declined enhancement or a file a fresh install
 * has not overlaid yet, not a modification. CLAUDE.md and the Cortex index policy are left out because the operator and a
 * runtime writer are expected to change them.
 */
export const SYSTEM_SINGLE_FILES: readonly string[] = ["LIFEOS/LIFEOS_SYSTEM_PROMPT.md", "settings.system.json", "LIFEOS/LIFEOS_StatusLine.sh"];

/** Byte compare of the system trees and single files present in both roots. Extra installed files are the user's business. */
export function compareTrees(installed: string, reference: string): Pick<Attestation, "compared" | "modified" | "missing"> {
  const modified: string[] = [];
  let compared = 0, missing = 0;
  for (const tree of SYSTEM_TREES) {
    // A declined opt-in tree (agents/, commands/) is absent by the user's choice, and the updater never lays it down
    // either, so its files are not missing.
    if (optInNotInstalled(tree, join(installed, tree))) continue;
    for (const rel of walkFiles(join(reference, tree))) {
      if (join(tree, rel).startsWith(BOOTSTRAP_DIR + "/")) continue;
      const ref = join(reference, tree, rel);
      const inst = join(installed, tree, rel);
      if (!existsSync(inst)) { missing++; continue; }
      compared++;
      if (sha256(ref) !== sha256(inst)) modified.push(join(tree, rel));
    }
  }
  for (const rel of SYSTEM_SINGLE_FILES) {
    const ref = join(reference, rel);
    const inst = join(installed, rel);
    if (!existsSync(ref) || !existsSync(inst)) continue;
    compared++;
    if (sha256(ref) !== sha256(inst)) modified.push(rel);
  }
  return { compared, modified, missing };
}

/**
 * The variables the reference payload is rendered with. They come from OverlaySystem.resolveIdentityVars, the one
 * resolver the installer renders with, so attestation cannot drift from it: shipped scaffold names stay tokens
 * (the install left them as tokens too) and the configured principal timezone applies instead of the machine's.
 * The installed version overrides the payload's own marker, which is the release being compared.
 */
export function referenceVars(configRoot: string, reference: string, version: string): TemplateVars {
  // Assembled, never written literally: a literal double-brace token in a shipped .ts is exactly
  // what release gate G23 exists to catch (nothing substitutes code).
  const versionToken = "{{" + "LIFEOS_VERSION" + "}}";
  const ident = resolveIdentityVars(configRoot, reference, configTomlPath(configRoot));
  return { ...ident.vars, [versionToken]: version };
}

/**
 * The release ships as one skill directory with the whole system under its
 * `install/` (`<tag>/LifeOS/install/{hooks,LIFEOS,...}`), so the comparable
 * root is wherever `hooks/` and `LIFEOS/TOOLS/` sit together, not the tarball top.
 */
export function findPayloadRoot(dir: string, depth = 4): string | null {
  if (existsSync(join(dir, "hooks")) && existsSync(join(dir, "LIFEOS", "TOOLS"))) return dir;
  if (depth === 0) return null;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || SKIP.has(e.name)) continue;
    const found = findPayloadRoot(join(dir, e.name), depth - 1);
    if (found) return found;
  }
  return null;
}

function mkdtemp(prefix: string): string {
  const p = join(tmpdir(), `${prefix}${process.pid}-${Date.now()}`);
  mkdirSync(p, { recursive: true });
  return p;
}

export async function attest(repo: string, configRoot: string, lifeosDir: string): Promise<Attestation> {
  const none = (reason: string): Attestation => ({ status: "unattested", reason, compared: 0, modified: [], missing: 0 });
  if (detectDevTree(configRoot)) return none("this is the LifeOS source tree, not an install");
  const version = installedVersion(lifeosDir);
  if (!version) return none("no LIFEOS/VERSION marker on this install");
  if (repo === "OWNER/REPO") return none("no release repo configured (set LIFEOS_REPO)");
  const tag = `v${version}`;
  const url = `https://codeload.github.com/${repo}/tar.gz/refs/tags/${tag}`;
  const work = mkdtemp("lifeos-attest-");
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) return none(`release ${tag} not fetchable from ${repo} (HTTP ${res.status})`);
    const tarball = join(work, "ref.tgz");
    writeFileSync(tarball, new Uint8Array(await res.arrayBuffer()));
    const x = spawnSync("tar", ["-xzf", tarball, "-C", work], { encoding: "utf8", timeout: 120_000 });
    if (x.status !== 0) return none(`could not extract ${tag}: ${(x.stderr ?? "").trim().slice(0, 200)}`);
    const rootName = readdirSync(work).find((n) => n !== "ref.tgz" && statSync(join(work, n)).isDirectory());
    if (!rootName) return none("tarball had no root directory");
    const reference = findPayloadRoot(join(work, rootName));
    if (!reference) return none(`no system payload (hooks/ + LIFEOS/TOOLS/) found in ${tag}`);
    // The install renders identity placeholders into the payload; render the reference the same way.
    substituteTree(reference, referenceVars(configRoot, reference, version));
    const cmp = compareTrees(configRoot, reference);
    if (cmp.compared === 0) return none(`no system files to compare against ${repo}@${tag}`);
    return { status: attestationStatus(cmp), reference: `${repo}@${tag}`, ...cmp };
  } catch (e) {
    return none(`network: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** A file the release ships but the install lacks is a difference too: only zero modified and zero missing attests unmodified. */
export function attestationStatus(cmp: Pick<Attestation, "modified" | "missing">): "modified" | "unmodified" {
  return cmp.modified.length || cmp.missing ? "modified" : "unmodified";
}

export function attestationLine(a: Attestation | null): string {
  if (!a) return "attestation: not run";
  if (a.status === "unmodified") return `attestation: unmodified (${a.compared} system files match ${a.reference})`;
  if (a.status === "modified") {
    const list = a.modified.slice(0, 40).map((f) => `  - ${f}`).join("\n");
    const more = a.modified.length > 40 ? `\n  - …and ${a.modified.length - 40} more` : "";
    const missing = a.missing ? ` · ${a.missing} system file(s) missing` : "";
    // The list is the modified files, so it is labelled as such: after the missing count, a bare colon read as
    // though the list named the missing files.
    return `attestation: ${a.modified.length} system file(s) differ from ${a.reference}${missing}${a.modified.length ? "\ndiffering files:\n" + list + more : ""}`;
  }
  return `attestation: unattested (${a.reason})`;
}
