/**
 * Pursuit — what is moving each ideal-state target and goal, and whether it is alive.
 *
 * A row is linked to a mechanism two ways: its own `— pursuit:` suffix, or a
 * Workflow or ISA that names it with `serves:`. A link is live when its workflow
 * is installed, enabled and ran within twice its period (or has no period), or
 * when its ISA is still open. From that each row is:
 *
 *   pursued    at least one live link
 *   stalled    links exist, none live
 *   unpursued  no links at all
 *   declined   `pursuit: none:<reason>`, deliberately not pursued
 *
 * Read-only: this module never writes. Reconcile records its result.
 *
 * Overrides (tests, other installs): IDEALSTATE_INVENTORY_FILE (inventory JSON in
 * place of `Workflows.ts list --json`), IDEALSTATE_ISA_DIR (one dir of <slug>/ISA.md).
 *
 * @version 1.0.0
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { lifeosPath } from "../TOOLS/Paths";
import { phaseBracket } from "../TOOLS/ascent";
import { ID_RE, rowRef, type Owner, type Row } from "./Rows";
import { userDir } from "./Store";

export type WorkflowInfo = { name: string; enabled: boolean; installed?: string; periodMinutes: number | null; lastRunAt: string | null; serves: string[] };
export type IsaInfo = { slug: string; path: string; phase: string; serves: string[] };
export type PursuitSources = { workflows: () => WorkflowInfo[]; isas: () => IsaInfo[] };
export type PursuitState = "pursued" | "stalled" | "unpursued" | "declined";
export type Link = { via: "suffix" | "serves"; kind: "workflow" | "isa"; name: string; owner?: Owner; live: boolean; why: string };
export type PursuitRow = {
  id: string; file: string; section: string; type: Row["type"]; status?: Row["status"];
  state: PursuitState; sensed: boolean; links: Link[]; reason?: string; issues?: string[];
};
export type Tally = { total: number; pursued: number; stalled: number; unpursued: number; declined: number; sensed: number };
export type PursuitSummary = { targets: Tally; goals: Tally };

/** Done is whatever ascent.ts says is done; these are the ways an ISA stops without finishing. */
const STOPPED_PHASES = new Set(["abandoned", "closed", "cancelled", "dropped", "archived"]);
export const isaClosed = (phase: string): boolean => phaseBracket(phase) === "cairn" || STOPPED_PHASES.has(phase);
/** An unscheduled or custom-cron workflow counts as moving something only if it ran this recently. */
export const UNSCHEDULED_FRESH_DAYS = 45;
const RUNNING_INSTALLS = new Set(["loaded", "deployed"]);

// ── sources ────────────────────────────────────────────────────────────────

/** `serves:` from a workflow YAML root or ISA frontmatter: one id, a flow list, or a block list. */
export function parseServes(text: string): string[] {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => /^serves:/.test(l));
  if (i < 0) return [];
  const inline = lines[i]!.replace(/^serves:\s*/, "").replace(/#.*$/, "").trim();
  const raw = inline
    ? inline.replace(/^\[|\]$/g, "").split(",")
    : lines.slice(i + 1).filter((_, k, a) => a.slice(0, k + 1).every((l) => /^\s+-\s/.test(l))).map((l) => l.replace(/^\s+-\s+/, ""));
  return raw.map((s) => s.trim().replace(/^["']|["']$/g, "")).filter((s) => ID_RE.test(s));
}

const frontmatter = (text: string): string => { if (!text.startsWith("---")) return ""; const end = text.indexOf("\n---", 3); return end < 0 ? "" : text.slice(0, end); };

type InventoryEntry = { name?: string; runtime?: string; installed?: string; enabled?: boolean; trigger?: { periodMinutes?: number | null }; evidence?: { lastRunAt?: string | null } };

function readInventory(): InventoryEntry[] {
  const file = process.env.IDEALSTATE_INVENTORY_FILE;
  if (file) return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as InventoryEntry[]) : [];
  const r = Bun.spawnSync(["bun", lifeosPath("WORKFLOWS", "Workflows.ts"), "list", "--json"], { stdout: "pipe", stderr: "pipe", timeout: 60_000, env: { ...process.env, LIFEOS_NOTIFICATION_CHANNEL: "headless" } });
  if (r.exitCode !== 0) throw new Error(`workflow inventory exited ${r.exitCode}: ${r.stderr.toString().slice(0, 200)}`);
  return JSON.parse(r.stdout.toString()) as InventoryEntry[];
}

/** Every installed workflow or job, with `serves:` read from the definitions in USER/WORKFLOWS. */
export function liveWorkflows(): WorkflowInfo[] {
  const servesByName = new Map<string, string[]>();
  const dir = join(userDir(), "WORKFLOWS");
  if (existsSync(dir)) for (const f of readdirSync(dir).filter((n) => n.endsWith(".workflow.yaml"))) {
    const text = readFileSync(join(dir, f), "utf8");
    const name = text.match(/^name:\s*(\S+)/m)?.[1] ?? f.replace(/\.workflow\.yaml$/, "");
    servesByName.set(name, parseServes(text));
  }
  const seen = new Set<string>();
  const out: WorkflowInfo[] = [];
  for (const e of readInventory()) {
    if (!e.name || e.runtime === "skill" || seen.has(e.name)) continue; // skills are not workflows, and may share a name
    seen.add(e.name);
    out.push({ name: e.name, enabled: e.enabled !== false, ...(e.installed ? { installed: e.installed } : {}), periodMinutes: e.trigger?.periodMinutes ?? null, lastRunAt: e.evidence?.lastRunAt ?? null, serves: servesByName.get(e.name) ?? [] });
  }
  // A definition that serves a row but is not installed is a link that cannot be live.
  for (const [name, serves] of servesByName) if (!seen.has(name) && serves.length) out.push({ name, enabled: false, periodMinutes: null, lastRunAt: null, serves });
  return out;
}

export function isaDirs(): string[] {
  if (process.env.IDEALSTATE_ISA_DIR) return [process.env.IDEALSTATE_ISA_DIR];
  return [lifeosPath("MEMORY", "WORK"), lifeosPath()];
}

/** Every task and system ISA's slug, phase and `serves:`, from frontmatter only. */
export function liveIsas(): IsaInfo[] {
  const out: IsaInfo[] = [];
  for (const dir of isaDirs()) {
    if (!existsSync(dir)) continue;
    for (const d of readdirSync(dir)) {
      const path = join(dir, d, "ISA.md");
      if (!existsSync(path)) continue;
      let fm = "";
      try { fm = frontmatter(readFileSync(path, "utf8")); } catch { continue; }
      out.push({ slug: fm.match(/^slug:\s*(\S+)/m)?.[1] ?? basename(dirname(path)), path, phase: (fm.match(/^phase:\s*(\S+)/m)?.[1] ?? "").toLowerCase(), serves: parseServes(fm) });
    }
  }
  return out;
}

export const liveSources: PursuitSources = { workflows: liveWorkflows, isas: liveIsas };

// ── evaluation ─────────────────────────────────────────────────────────────

const DAY_MIN = 1440;

export function workflowLive(w: WorkflowInfo | undefined, now: number): { live: boolean; why: string } {
  if (!w) return { live: false, why: "not installed" };
  if (!w.enabled) return { live: false, why: "disabled or not installed" };
  if (w.installed && w.installed !== "n/a" && !RUNNING_INSTALLS.has(w.installed)) return { live: false, why: `scheduler ${w.installed}` };
  if (!w.periodMinutes) {
    // No known period: a manual or custom-cron workflow. Freshly installed counts; otherwise it must have run lately.
    if (!w.lastRunAt) return w.installed && RUNNING_INSTALLS.has(w.installed) ? { live: true, why: "installed, not run yet" } : { live: false, why: "never ran" };
    const days = (now - Date.parse(w.lastRunAt)) / 86_400_000;
    return days <= UNSCHEDULED_FRESH_DAYS ? { live: true, why: `ran ${Math.round(days)}d ago` } : { live: false, why: `last ran ${Math.round(days)}d ago` };
  }
  if (!w.lastRunAt) return { live: false, why: "never ran" };
  const age = (now - Date.parse(w.lastRunAt)) / 60_000;
  return age <= 2 * w.periodMinutes ? { live: true, why: `ran ${Math.round(age / 60)}h ago` } : { live: false, why: `last ran ${Math.round(age / DAY_MIN)}d ago, period ${Math.round(w.periodMinutes / 60)}h` };
}

export function isaLive(isa: IsaInfo | undefined): { live: boolean; why: string } {
  if (!isa) return { live: false, why: "no such ISA" };
  return isaClosed(isa.phase) ? { live: false, why: `ISA ${isa.phase}` } : { live: true, why: `ISA ${isa.phase || "open"}` };
}

/** Pure: each row's pursuit state from its links. `sensed` is the set of row refs whose measurement read this run. */
export function evaluate(rows: Row[], src: { workflows: WorkflowInfo[]; isas: IsaInfo[] }, sensed: Set<string>, now = Date.now()): PursuitRow[] {
  const wf = new Map(src.workflows.map((w) => [w.name, w]));
  const isaBySlug = new Map(src.isas.map((i) => [i.slug, i]));
  const findIsa = (name: string) => isaBySlug.get(name) ?? src.isas.find((i) => i.path.endsWith(`/${name}/ISA.md`) || i.path.endsWith(`/${name}`));
  return rows.map((r) => {
    const id = rowRef(r);
    const links: Link[] = [];
    if (r.pursuit && !("none" in r.pursuit)) {
      const p = r.pursuit;
      const l = p.kind === "workflow" ? workflowLive(wf.get(p.name), now) : isaLive(findIsa(p.name));
      links.push({ via: "suffix", kind: p.kind, name: p.name, owner: p.owner, ...l });
    }
    if (r.id) {
      for (const w of src.workflows) if (w.serves.includes(r.id)) links.push({ via: "serves", kind: "workflow", name: w.name, ...workflowLive(w, now) });
      for (const i of src.isas) if (i.serves.includes(r.id)) links.push({ via: "serves", kind: "isa", name: i.slug, ...isaLive(i) });
    }
    const declined = r.pursuit && "none" in r.pursuit ? r.pursuit.none : undefined;
    const state: PursuitState = links.some((l) => l.live) ? "pursued" : links.length ? "stalled" : declined ? "declined" : "unpursued";
    return { id, file: r.file, section: r.section, type: r.type, ...(r.status ? { status: r.status } : {}), state, sensed: sensed.has(id), links, ...(declined ? { reason: declined } : {}), ...(r.issues ? { issues: r.issues } : {}) };
  });
}

const tally = (rows: PursuitRow[]): Tally => ({
  total: rows.length,
  pursued: rows.filter((r) => r.state === "pursued").length,
  stalled: rows.filter((r) => r.state === "stalled").length,
  unpursued: rows.filter((r) => r.state === "unpursued").length,
  declined: rows.filter((r) => r.state === "declined").length,
  sensed: rows.filter((r) => r.sensed).length,
});

/** Targets are target rows; goals are active goals. North stars and closed goals are graphed but not counted. */
export function summarize(rows: PursuitRow[]): PursuitSummary {
  return { targets: tally(rows.filter((r) => r.type === "target")), goals: tally(rows.filter((r) => r.type === "goal" && r.status === "active")) };
}

/** The session chip for the pursuit summary (HookBridge band). Null when there is no summary yet. */
export function pursuitNudge(s: PursuitSummary | null | undefined): { text: string; severity: "info" | "warn"; prompt: string } | null {
  if (!s) return null;
  const t = s.targets, g = s.goals;
  const open = t.unpursued + t.stalled + g.unpursued + g.stalled;
  return {
    text: `pursued ${t.pursued}/${t.total} targets · ${g.pursued}/${g.total} goals`,
    severity: t.stalled + g.stalled > 0 ? "warn" : "info",
    prompt: open ? "Which ideal-state targets and goals have nothing moving them, and what is the first move on the most important one?" : "Show me what is pursuing each ideal-state target",
  };
}
