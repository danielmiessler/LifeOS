import { readFileSync, existsSync, statSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { atomicWriteText } from "../lib/atomic-write";
import { parseFrontmatter, serializeFrontmatter } from "../lib/frontmatter";
import { sha256Hex } from "../lib/cache";
import { claudeDir } from "../../TOOLS/lifeos-root";

const HOME = process.env.HOME!;
const USER_ROOT = resolve(claudeDir(), "LIFEOS", "USER");
const EDITS_LOG = resolve(claudeDir(), "LIFEOS", "MEMORY", "OBSERVABILITY", "pulse-edits.jsonl");
const CONTAINMENT_PREFIX_DENY = ["MEMORY/PULSE_DATA", "MEMORY/OBSERVABILITY"];

export interface EditRequest {
  pageId: string;
  sourceFile: string;
  fieldPath: string;
  beforeHash: string;
  newContent: string;
  draftStartedAt: string;
}

export interface EditResult {
  ok: boolean;
  reason?: "out-of-tree" | "containment" | "conflict" | "unchanged" | "missing" | "noop";
  message?: string;
  beforeHash?: string;
  afterHash?: string;
  appliedAt?: string;
}

function isInUserTree(absPath: string): boolean {
  return absPath.startsWith(USER_ROOT + "/");
}

function isContainmentPath(absPath: string): boolean {
  const rel = absPath.replace(resolve(claudeDir(), "LIFEOS") + "/", "");
  return CONTAINMENT_PREFIX_DENY.some((p) => rel.startsWith(p));
}

function logEdit(entry: Record<string, unknown>): void {
  try {
    mkdirSync(resolve(EDITS_LOG, ".."), { recursive: true });
    appendFileSync(EDITS_LOG, JSON.stringify(entry) + "\n", { encoding: "utf8" });
  } catch {
    /* ignore */
  }
}

export function applyEdit(req: EditRequest): EditResult {
  const abs = resolve(USER_ROOT, "..", req.sourceFile.replace(/^LifeOS\//, ""));
  const truePath = resolve(abs);

  if (!isInUserTree(truePath)) {
    const r: EditResult = { ok: false, reason: "out-of-tree", message: `path is outside USER/: ${truePath}` };
    logEdit({ ts: new Date().toISOString(), ...req, ...r });
    return r;
  }
  if (isContainmentPath(truePath)) {
    const r: EditResult = { ok: false, reason: "containment", message: `path is in a containment zone` };
    logEdit({ ts: new Date().toISOString(), ...req, ...r });
    return r;
  }
  if (!existsSync(truePath)) {
    const r: EditResult = { ok: false, reason: "missing", message: `file does not exist` };
    logEdit({ ts: new Date().toISOString(), ...req, ...r });
    return r;
  }

  const current = readFileSync(truePath, "utf8");
  const currentHash = sha256Hex(current);
  if (currentHash !== req.beforeHash) {
    const draftMs = Date.parse(req.draftStartedAt);
    const fileMtime = statSync(truePath).mtimeMs;
    if (fileMtime > draftMs) {
      const r: EditResult = { ok: false, reason: "conflict", message: "file changed on disk after draft started", beforeHash: req.beforeHash, afterHash: currentHash };
      logEdit({ ts: new Date().toISOString(), ...req, ...r });
      return r;
    }
  }

  const fm = parseFrontmatter(current);
  const beforeBody = fm.body;
  const newBody = applyFieldEdit(beforeBody, req.fieldPath, req.newContent);
  if (newBody === beforeBody) {
    const r: EditResult = { ok: true, reason: "noop", message: "no change", beforeHash: currentHash, afterHash: currentHash };
    logEdit({ ts: new Date().toISOString(), ...req, ...r });
    return r;
  }

  const next = serializeFrontmatter({ ...fm.data, provenance: "customized", last_updated: new Date().toISOString().slice(0, 10) }, newBody);
  atomicWriteText(truePath, next);
  const afterHash = sha256Hex(next);
  const r: EditResult = { ok: true, beforeHash: currentHash, afterHash, appliedAt: new Date().toISOString() };
  logEdit({ ts: new Date().toISOString(), ...req, ...r });
  return r;
}

function applyFieldEdit(body: string, fieldPath: string, newContent: string): string {
  if (fieldPath.startsWith("section:")) {
    const heading = fieldPath.slice("section:".length);
    const lines = body.split("\n");
    const startIdx = lines.findIndex((l) => /^#{1,6}\s/.test(l) && l.replace(/^#+\s+/, "").trim() === heading);
    if (startIdx === -1) return body + (body.endsWith("\n") ? "" : "\n") + `\n## ${heading}\n\n${newContent}\n`;
    const headerLine = lines[startIdx]!;
    const headerLevel = headerLine.match(/^#+/)![0].length;
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      const m = lines[i]!.match(/^(#+)\s/);
      if (m && m[1]!.length <= headerLevel) { endIdx = i; break; }
    }
    return [...lines.slice(0, startIdx + 1), "", ...newContent.split("\n"), "", ...lines.slice(endIdx)].join("\n");
  }
  return newContent;
}

void join;
