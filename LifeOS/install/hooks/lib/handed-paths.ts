/**
 * handed-paths.ts — the files a Write/Edit/MultiEdit/NotebookEdit/Artifact call hands to the principal, with no
 * bytes computed: the output recorder's list of what to record when no hand-off approval was left for the call. Its one
 * consumer is the maintainer-side output recorder hook, which is not in the public release.
 */
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import type { Channel } from "./handoff-state";
import { isWithin } from "./portable-path";

export type Roots = { downloads: string; desktop: string };
export type HandedCall = { tool_name?: string; tool_input?: Record<string, unknown>; cwd?: string };

const defaultRoots = (): Roots => ({ downloads: resolve(homedir(), "Downloads"), desktop: resolve(homedir(), "Desktop") });
const absPath = (p: string, cwd: string): string => { const x = p.replace(/^~(?=\/|$)/, homedir()); return isAbsolute(x) ? x : resolve(cwd, x); };

/** The nearest existing ancestor resolved through symlinks, with the rest of the path re-appended. */
function canon(p: string): string {
  let head = p;
  const rest: string[] = [];
  while (!existsSync(head)) {
    const up = dirname(head);
    if (up === head) return p;
    rest.unshift(basename(head));
    head = up;
  }
  try { return join(realpathSync(head), ...rest); } catch { return p; }
}

/** Which delivery root a path is inside, lexically or through a symlink, or null. */
export function rootOf(abs: string, roots: Roots): "downloads" | "desktop" | null {
  const c = canon(abs);
  for (const [name, root] of [["downloads", roots.downloads], ["desktop", roots.desktop]] as const) {
    const cr = canon(root);
    for (const a of [abs, c]) for (const r of [root, cr]) if (isWithin(a, r)) return name;
  }
  return null;
}

/** Local source files an Artifact publish sends: file_path, file_paths and `files` sources (an {artifact} copy has none). */
function artifactPaths(ti: Record<string, unknown>, cwd: string): string[] {
  if (ti.action !== undefined && ti.action !== "publish") return [];
  // `root` is the base directory `files` sources resolve against (relative to the working directory, or absolute);
  // file_path and file_paths stay relative to the working directory.
  const base = typeof ti.root === "string" && ti.root ? absPath(ti.root, cwd) : cwd;
  const mapped = ti.files && typeof ti.files === "object" && !Array.isArray(ti.files)
    ? Object.values(ti.files as Record<string, unknown>).map((v) => typeof v === "string" ? v : v && typeof v === "object" && typeof (v as { from?: unknown }).from === "string" ? (v as { from: string }).from : null)
    : Array.isArray(ti.files) ? (ti.files as unknown[]).map((v) => v && typeof v === "object" && typeof (v as { path?: unknown }).path === "string" ? (v as { path: string }).path : null) : [];
  const direct = [ti.file_path, ...(Array.isArray(ti.file_paths) ? ti.file_paths : [])].filter((p): p is string => typeof p === "string" && p.length > 0);
  const sources = mapped.filter((p): p is string => typeof p === "string" && p.length > 0);
  return [...direct.map((p) => absPath(p, cwd)), ...sources.map((p) => absPath(p, base))];
}

const FILE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

/** The paths a Write/Edit/MultiEdit/NotebookEdit/Artifact call hands over: an Artifact's sources, or a file tool's target inside a delivery root. */
export function handedPaths(input: HandedCall, roots: Partial<Roots> = {}): { path: string; channel: Channel }[] {
  const cwd = input.cwd ?? process.cwd();
  const ti = input.tool_input;
  if (!ti) return [];
  if (input.tool_name === "Artifact") return artifactPaths(ti, cwd).map((path) => ({ path, channel: "artifact" as const }));
  const target = input.tool_name === "NotebookEdit" ? ti.notebook_path : ti.file_path;
  if (FILE_TOOLS.has(input.tool_name ?? "") && typeof target === "string" && target) {
    const path = absPath(target, cwd);
    const channel = rootOf(path, { ...defaultRoots(), ...roots });
    return channel ? [{ path, channel }] : [];
  }
  return [];
}
