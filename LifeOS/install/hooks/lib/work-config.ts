/**
 * work-config.ts — Single-source loader for the Work System repo binding.
 *
 * Repo identity comes from `LIFEOS/USER/WORK/work_repo.json` (privacy-attested,
 * gh-verified at write time by `skills/_ULWORK/Tools/SetWorkRepo.ts`).
 * Kanban columns + poll interval come from `LIFEOS/USER/WORK/config.yaml`
 * (UX defaults, not privacy-sensitive).
 *
 * Privacy contract:
 *   - work_repo.json missing                          → disabled, reason="missing"
 *   - JSON has verified_private=false                 → disabled, reason="not_private"
 *   - verified_at older than half-TTL (12h default)   → loader attempts gh re-verify
 *       - on success: writes back fresh verified_at, continues enabled
 *       - on failure with cache < full-TTL: continues enabled with reason note (grace)
 *       - on failure with cache >= full-TTL: disabled, reason="stale_unverified"
 *
 * The loader NEVER trusts a manually-edited verified_private without a recent
 * verified_at. SetWorkRepo is the only sanctioned write path.
 *
 * Consumers:
 *   - hooks/ULWorkSync.hook.ts     — SessionEnd capture
 *   - hooks/ReminderRouter.hook.ts — UserPromptSubmit reminder/research routing
 *   - LIFEOS/PULSE/modules/work.ts    — kanban renderer
 *
 * Zero deps, zero throws — config breakage degrades to disabled state.
 */
import { existsSync, readFileSync, writeFileSync, chmodSync } from "fs";
import { join } from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


declare const Bun: { spawnSync: (cmd: string[], opts?: any) => any };

const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const REPO_JSON_PATH = join(LIFEOS_DIR, "USER", "WORK", "work_repo.json");
const COLUMNS_YAML_PATH = join(LIFEOS_DIR, "USER", "WORK", "config.yaml");

// Slimmed kanban — {{PRINCIPAL_NAME}} asked for 5 lanes that map to how he actually moves work.
const DEFAULT_COLUMNS = ["Queued", "Blocked", "In-Progress", "In-Review", "Complete"];
const DEFAULT_POLL_SECONDS = 60;
const REPO_REGEX = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

export type DisabledReason =
  | "missing"
  | "not_private"
  | "stale_unverified"
  | "malformed"
  | "read_failed";

export interface WorkConfig {
  enabled: boolean;
  repo: string | null;
  kanbanColumns: string[];
  pollIntervalSeconds: number;
  captureNative: boolean;
  captureSweep: boolean;
  projectProperty: (project: string | undefined) => string;
  reason?: string;
  reasonCode?: DisabledReason;
  privacy?: {
    verified_private: boolean;
    verified_at: string;
    visibility: string;
    ageHours: number;
    revalidatedThisLoad: boolean;
  };
}

interface RepoJson {
  $schema_version?: number;
  repo: string;
  privacy: {
    verified_private: boolean;
    verified_at: string;
    visibility: string;
    ttl_hours?: number;
    verification_command?: string;
  };
}

export function loadWorkConfig(): WorkConfig {
  const columns = loadKanbanColumns();
  const pollSeconds = loadPollSeconds();
  const captureNative = loadBool("CAPTURE_NATIVE", true);
  const captureSweep = loadBool("CAPTURE_SWEEP", true);
  const projectMap = loadProjectPropertyMap();
  const projectProperty = (project: string | undefined): string => {
    if (!project) return "Property:internal";
    const key = project.toLowerCase().replace(/\s+/g, "");
    return projectMap[key] ?? "Property:internal";
  };

  const disabled = (code: DisabledReason, reason: string): WorkConfig => ({
    enabled: false,
    repo: null,
    kanbanColumns: columns,
    pollIntervalSeconds: pollSeconds,
    captureNative,
    captureSweep,
    projectProperty,
    reason,
    reasonCode: code,
  });

  if (!existsSync(REPO_JSON_PATH)) {
    return disabled(
      "missing",
      "USER/WORK/work_repo.json missing — run `bun ~/.claude/skills/_ULWORK/Tools/SetWorkRepo.ts <owner/repo>`",
    );
  }

  let parsed: RepoJson;
  try {
    parsed = JSON.parse(readFileSync(REPO_JSON_PATH, "utf-8")) as RepoJson;
  } catch (err) {
    return disabled("read_failed", `parse failed: ${String(err)}`);
  }

  if (!parsed?.repo || !REPO_REGEX.test(parsed.repo)) {
    return disabled("malformed", "work_repo.json `repo` missing or not owner/repo");
  }
  if (!parsed.privacy || typeof parsed.privacy.verified_private !== "boolean") {
    return disabled("malformed", "work_repo.json `privacy` block missing or malformed");
  }
  if (parsed.privacy.verified_private !== true) {
    return disabled(
      "not_private",
      `verified_private=false (last visibility: ${parsed.privacy.visibility ?? "unknown"})`,
    );
  }

  const ttlHours = Number.isFinite(parsed.privacy.ttl_hours) ? parsed.privacy.ttl_hours! : 24;
  const halfTtlMs = (ttlHours / 2) * 3600 * 1000;
  const fullTtlMs = ttlHours * 3600 * 1000;
  const verifiedAt = Date.parse(parsed.privacy.verified_at || "");
  const ageMs = Number.isFinite(verifiedAt) ? Date.now() - verifiedAt : Infinity;
  const ageHours = Math.round((ageMs / 3600000) * 10) / 10;

  let revalidatedThisLoad = false;

  if (ageMs >= halfTtlMs) {
    const result = revalidatePrivate(parsed.repo);
    if (result.ok && result.isPrivate) {
      // Write back fresh attestation. Best-effort; swallow write failures.
      try {
        const updated: RepoJson = {
          ...parsed,
          privacy: {
            ...parsed.privacy,
            verified_private: true,
            verified_at: new Date().toISOString(),
            visibility: result.visibility ?? "PRIVATE",
            ttl_hours: ttlHours,
            verification_command: parsed.privacy.verification_command ??
              `gh repo view ${parsed.repo} --json visibility,isPrivate`,
          },
        };
        writeFileSync(REPO_JSON_PATH, JSON.stringify(updated, null, 2) + "\n");
        chmodSync(REPO_JSON_PATH, 0o600);
        parsed = updated;
        revalidatedThisLoad = true;
      } catch {
        // ok — re-verification still succeeded in-memory for this load
        revalidatedThisLoad = true;
      }
    } else if (result.ok && !result.isPrivate) {
      // Repo flipped to public — fail closed regardless of TTL.
      return disabled(
        "not_private",
        `gh re-verify shows visibility=${result.visibility} — repo is no longer private`,
      );
    } else if (ageMs >= fullTtlMs) {
      // Couldn't re-verify and cache exceeded full TTL — fail closed.
      return disabled(
        "stale_unverified",
        `verified_at older than ${ttlHours}h and gh re-verify failed (${result.reason ?? "unknown"})`,
      );
    }
    // else: gh failed but cache fresh; continue with cached state (grace period).
  }

  return {
    enabled: true,
    repo: parsed.repo,
    kanbanColumns: columns,
    pollIntervalSeconds: pollSeconds,
    captureNative,
    captureSweep,
    projectProperty,
    privacy: {
      verified_private: parsed.privacy.verified_private,
      verified_at: parsed.privacy.verified_at ?? "",
      visibility: parsed.privacy.visibility ?? "unknown",
      ageHours,
      revalidatedThisLoad,
    },
  };
}

// ── gh re-verification ──────────────────────────────────────────────────────

interface RevalidateResult {
  ok: boolean;
  isPrivate?: boolean;
  visibility?: string;
  reason?: string;
}

function revalidatePrivate(repo: string): RevalidateResult {
  try {
    // Bun's spawnSync — fast, no async required from the loader.
    const proc = Bun.spawnSync(
      ["gh", "repo", "view", repo, "--json", "visibility,isPrivate"],
      { stdout: "pipe", stderr: "pipe", timeout: 8000 },
    );
    if (!proc || proc.exitCode !== 0) {
      return { ok: false, reason: `gh exit ${proc?.exitCode ?? "unknown"}` };
    }
    const out = proc.stdout instanceof Uint8Array
      ? new TextDecoder().decode(proc.stdout)
      : String(proc.stdout ?? "");
    const data = JSON.parse(out);
    return {
      ok: true,
      isPrivate: data.isPrivate === true,
      visibility: typeof data.visibility === "string" ? data.visibility : "unknown",
    };
  } catch (err) {
    return { ok: false, reason: `gh spawn failed: ${String(err)}` };
  }
}

// ── Kanban yaml accessors ───────────────────────────────────────────────────

function loadKanbanColumns(): string[] {
  if (!existsSync(COLUMNS_YAML_PATH)) return DEFAULT_COLUMNS;
  try {
    const yaml = readFileSync(COLUMNS_YAML_PATH, "utf-8");
    const list = extractList(yaml, ["WORK", "KANBAN_COLUMNS"]);
    return list && list.length > 0 ? list : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function loadPollSeconds(): number {
  if (!existsSync(COLUMNS_YAML_PATH)) return DEFAULT_POLL_SECONDS;
  try {
    const yaml = readFileSync(COLUMNS_YAML_PATH, "utf-8");
    const raw = extractScalar(yaml, ["WORK", "POLL_INTERVAL_SECONDS"]);
    const n = raw ? parseInt(raw, 10) : DEFAULT_POLL_SECONDS;
    return Number.isFinite(n) && n >= 10 ? n : DEFAULT_POLL_SECONDS;
  } catch {
    return DEFAULT_POLL_SECONDS;
  }
}

function loadBool(key: string, def: boolean): boolean {
  if (!existsSync(COLUMNS_YAML_PATH)) return def;
  try {
    const yaml = readFileSync(COLUMNS_YAML_PATH, "utf-8");
    const raw = extractScalar(yaml, ["WORK", key]);
    if (!raw) return def;
    const v = raw.toLowerCase().trim();
    if (v === "true" || v === "yes" || v === "1") return true;
    if (v === "false" || v === "no" || v === "0") return false;
    return def;
  } catch {
    return def;
  }
}

// Parses a nested map block:
//   WORK:
//     PROJECT_PROPERTY:
//       website: Property:website
//       newsletter: Property:newsletter
function loadProjectPropertyMap(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(COLUMNS_YAML_PATH)) return out;
  try {
    const yaml = readFileSync(COLUMNS_YAML_PATH, "utf-8");
    const workBlock = sliceBlock(yaml, "WORK");
    if (!workBlock) return out;
    const lines = workBlock.split("\n");
    let inMap = false;
    let baseIndent = 0;
    for (const line of lines) {
      if (/^\s+PROJECT_PROPERTY:\s*$/.test(line)) {
        inMap = true;
        baseIndent = line.match(/^(\s+)/)?.[1].length ?? 0;
        continue;
      }
      if (inMap) {
        if (/^\s*$/.test(line)) continue;
        if (/^\s*#/.test(line)) continue;
        const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
        if (indent <= baseIndent) { inMap = false; continue; }
        const m = line.match(/^\s+([A-Za-z0-9_\-]+):\s*(.+?)\s*$/);
        if (m) out[m[1].toLowerCase()] = unquote(m[2]);
      }
    }
  } catch {
    // ignore — empty map is a valid state
  }
  return out;
}

function extractScalar(yaml: string, path: string[]): string | null {
  const block = sliceBlock(yaml, path[0]);
  if (block === null) return null;
  if (path.length === 1) {
    const m = yaml.match(new RegExp(`^${path[0]}:\\s*(.+?)\\s*$`, "m"));
    return m ? unquote(m[1]) : null;
  }
  const re = new RegExp(`^\\s+${path[1]}:\\s*(.+?)\\s*$`, "m");
  const m = block.match(re);
  return m ? unquote(m[1]) : null;
}

function extractList(yaml: string, path: string[]): string[] | null {
  const block = sliceBlock(yaml, path[0]);
  if (block === null) return null;
  const lines = block.split("\n");
  let inList = false;
  const items: string[] = [];
  for (const line of lines) {
    if (new RegExp(`^\\s+${path[1]}:\\s*$`).test(line)) {
      inList = true;
      continue;
    }
    if (inList) {
      const m = line.match(/^\s+-\s+(.+?)\s*$/);
      if (m) {
        items.push(unquote(m[1]));
      } else if (/^\S/.test(line) || /^\s+\w+:/.test(line)) {
        break;
      }
    }
  }
  return inList ? items : null;
}

function sliceBlock(yaml: string, topKey: string): string | null {
  const startRe = new RegExp(`^${topKey}:\\s*$`, "m");
  const start = yaml.search(startRe);
  if (start < 0) return null;
  const after = yaml.slice(start);
  const nextTop = after.search(/\n[A-Z][A-Z_]+:/);
  return nextTop > 0 ? after.slice(0, nextTop) : after;
}

function unquote(v: string): string {
  return v.replace(/^["']|["']$/g, "").trim();
}

// ── CLI smoke ────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const cfg = loadWorkConfig();
  console.log(JSON.stringify(cfg, null, 2));
  process.exit(0);
}
