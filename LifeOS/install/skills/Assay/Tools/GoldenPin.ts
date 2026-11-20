#!/usr/bin/env bun
/**
 * GoldenPin — the expected cases an ISA is graded against stay as they were before the build started.
 *
 * Applies only to an ISA whose frontmatter names `golden_set: <dir relative to the ISA>`; every other ISA passes
 * untouched. The pin is read from git history, never from a hash an agent could edit:
 *   anchor  the first commit whose ISA declares `golden_set` (a later edit cannot drop or repoint it)
 *   build   the first commit after the anchor that changes anything other than the golden set or the ISA
 *   pin     the golden set at the build commit's parent
 * History after the anchor must be linear: a merge could choose which commit counts as the first build.
 *
 *   bun GoldenPin.ts check <ISA.md>   exit 0 green or not applicable, exit 1 red (reasons on stderr)
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";

function git(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1 << 28 });
  return r.status === 0 ? r.stdout.trim() : "";
}
const lines = (s: string) => s.split("\n").filter(Boolean);

export function goldenSetOf(text: string): string | null {
  const fm = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  return fm.match(/^golden_set:\s*["']?([^"'\n]+?)["']?\s*$/m)?.[1] ?? null;
}

export type Verdict = { applies: false } | { applies: true; errors: string[]; pin?: string };

export function check(isaPath: string): Verdict {
  const abs = realpathSync(resolve(isaPath)); // git prints the real path (macOS /var is /private/var)
  const root = git(dirname(abs), ["rev-parse", "--show-toplevel"]);
  const isaRel = root ? relative(root, abs).split("\\").join("/") : "";
  let declared: string | null = null, anchor = "";
  // Full history in topological order: a merge must not simplify away the real first declaration.
  if (root) for (const c of lines(git(root, ["rev-list", "--reverse", "--topo-order", "--full-history", "--no-merges", "HEAD", "--", isaRel]))) {
    declared = goldenSetOf(git(root, ["show", `${c}:${isaRel}`]));
    if (declared) { anchor = c; break; }
  }
  const current = goldenSetOf(readFileSync(abs, "utf8"));
  if (!declared && !current) return { applies: false };
  const red = (why: string): Verdict => ({ applies: true, errors: [why] });
  // An uncommitted declaration (Review.ts reads a new ISA from the working tree) cannot set a pin after the fact.
  if (!declared) return red("the ISA's golden_set is not committed: commit the ISA and its golden set before the first build commit");
  if (current !== declared) return red(`golden_set was "${declared}" when first committed and is now "${current ?? "(removed)"}"`);

  const golden = posix.normalize(posix.join(posix.dirname(isaRel), declared));
  const outside = (c: string) => lines(git(root, ["diff-tree", "--no-commit-id", "--name-only", "-r", "--root", c]))
    .some((f) => f !== isaRel && f !== golden && !f.startsWith(`${golden}/`));
  if (outside(anchor)) return red(`the golden_set declaration came in the same commit as other changes (${anchor.slice(0, 7)})`);
  if (git(root, ["rev-list", "--merges", `${anchor}..HEAD`])) return red("history after the golden_set declaration has merges: the first build commit is ambiguous, keep it linear");
  const build = lines(git(root, ["rev-list", "--reverse", `${anchor}..HEAD`])).find(outside);
  if (!build) return red("no build commit yet, so nothing is pinned");

  const pin = git(root, ["rev-parse", `${build}^`]);
  const pinned = new Map(lines(git(root, ["ls-tree", "-r", pin, "--", golden])).map((l) => [l.slice(l.indexOf("\t") + 1), l.split(/\s/)[2]!]));
  if (!pinned.size) return red(`golden set ${golden} was not committed before the first build commit ${build.slice(0, 7)}`);
  // Files on disk are hashed raw as git blob ids, so ignore rules, index flags and clean filters cannot hide a change.
  const algo = git(root, ["rev-parse", "--show-object-format"]) || "sha1";
  const blobId = (p: string) => {
    try { const b = readFileSync(p); return createHash(algo).update(`blob ${b.length}\0`).update(b).digest("hex"); } catch { return "unreadable"; }
  };
  const dir = join(root, golden);
  const onDisk = new Map(existsSync(dir) ? readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => !d.isDirectory())
    .map((d) => { const p = join(d.parentPath, d.name); return [posix.join(golden, relative(dir, p).split("\\").join("/")), blobId(p)] as const; }) : []);
  const drift = [...new Set([...pinned.keys(), ...onDisk.keys()])].filter((p) => pinned.get(p) !== onDisk.get(p));
  return drift.length ? red(`golden set changed since its pin ${pin.slice(0, 7)}: ${drift.join(", ")}`) : { applies: true, errors: [], pin };
}

if (import.meta.main) {
  const [cmd, isa] = process.argv.slice(2);
  if (cmd !== "check" || !isa || !existsSync(isa)) { console.error("usage: GoldenPin.ts check <ISA.md>"); process.exit(2); }
  const v = check(isa);
  if (!v.applies) { console.log("not applicable: the ISA names no golden_set"); process.exit(0); }
  for (const e of v.errors) console.error(`RED: ${e}`);
  if (v.errors.length) process.exit(1);
  console.log(`GREEN: golden set matches its pin ${v.pin!.slice(0, 7)}`);
}
