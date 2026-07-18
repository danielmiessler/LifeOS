import { readFileSync, existsSync } from "node:fs";
import { watch } from "node:fs";
import { resolve } from "node:path";
import { atomicWriteText } from "./atomic-write";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";
import { claudeDir } from "../../TOOLS/lifeos-root";

const HOME = process.env.HOME!;
const EDITS_LOG = resolve(claudeDir(), "LIFEOS", "MEMORY", "OBSERVABILITY", "pulse-edits.jsonl");
const PULSE_EDIT_GRACE_MS = 5_000;

export interface WatcherOptions {
  watchPaths: string[];
  onFlip?: (file: string, prev: string, next: string) => void;
}

function recentPulseEdit(file: string): boolean {
  if (!existsSync(EDITS_LOG)) return false;
  try {
    const lines = readFileSync(EDITS_LOG, "utf8").trim().split("\n").slice(-50);
    const cutoff = Date.now() - PULSE_EDIT_GRACE_MS;
    for (const line of lines) {
      try {
        const e = JSON.parse(line) as { ts?: string; sourceFile?: string };
        if (!e.ts || !e.sourceFile) continue;
        if (Date.parse(e.ts) < cutoff) continue;
        if (file.endsWith(e.sourceFile.replace(/^LifeOS\//, ""))) return true;
      } catch { /* skip malformed line */ }
    }
  } catch { /* ignore */ }
  return false;
}

export function flipToCustomized(absPath: string, onFlip?: WatcherOptions["onFlip"]): boolean {
  if (!existsSync(absPath)) return false;
  if (!absPath.endsWith(".md") && !absPath.endsWith(".markdown")) return false;
  try {
    const fm = parseFrontmatter(readFileSync(absPath, "utf8"));
    const prev = fm.data.provenance;
    if (prev !== "template") return false;
    if (recentPulseEdit(absPath)) return false;
    const next = serializeFrontmatter({ ...fm.data, provenance: "customized", last_updated: new Date().toISOString().slice(0, 10) }, fm.body);
    atomicWriteText(absPath, next);
    onFlip?.(absPath, "template", "customized");
    return true;
  } catch {
    return false;
  }
}

export function startWatcher(opts: WatcherOptions): () => void {
  const watchers: { close(): void }[] = [];
  for (const p of opts.watchPaths) {
    if (!existsSync(p)) continue;
    const w = watch(p, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const full = resolve(p, filename);
      flipToCustomized(full, opts.onFlip);
    });
    watchers.push(w);
  }
  return () => { for (const w of watchers) w.close(); };
}
