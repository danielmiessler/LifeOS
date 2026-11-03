import { constants, accessSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { invariant } from "../../TOOLS/Invariant";
import { object, string, type State } from "../State";
import { mtime, type Cache } from "../Cache";
import type { RefreshJob } from "./Background";

export interface HerdrDeps {
  /** The pane's running delegates as a display agent (HerdrDisplayAgent), or "" when herdr cannot answer. */
  delegate: (pane: string, carrier: string, socket: string) => string;
  /** Run `herdr pane report-metadata`; true when herdr accepted it. */
  report: (args: string[]) => Promise<boolean>;
}

const PANE = /^w[0-9A-Za-z]+:p[0-9A-Za-z]+$/;
const clean = (text: string): string => text.replace(/[\x00-\x1f\x7f]/g, "");

/**
 * The lookup runs `herdr pane get` synchronously with this process's environment, so the pane's socket is set for exactly
 * that call and restored after it. An empty socket means the pane used herdr's default, so the variable is removed.
 */
function liveDelegate(pane: string, carrier: string, socket: string): string {
  const before = process.env.HERDR_SOCKET_PATH;
  if (socket) process.env.HERDR_SOCKET_PATH = socket; else delete process.env.HERDR_SOCKET_PATH;
  try { return (require("../../TOOLS/HerdrDisplayAgent") as typeof import("../../TOOLS/HerdrDisplayAgent")).paneDisplayAgent(pane, carrier); }
  catch { return ""; }
  finally { if (before === undefined) delete process.env.HERDR_SOCKET_PATH; else process.env.HERDR_SOCKET_PATH = before; }
}

function herdrBin(home: string): string {
  const local = join(home, ".local", "bin", "herdr");
  try { accessSync(local, constants.X_OK); return local; } catch { return "herdr"; }
}

/** The report runs with the pane's socket, as the bash's call did by inheriting the pane's environment. */
const liveReport = (home: string, socket: string) => async (args: string[]): Promise<boolean> => {
  try {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) if (value !== undefined && key !== "HERDR_SOCKET_PATH") env[key] = value;
    if (socket) env.HERDR_SOCKET_PATH = socket;
    const child = Bun.spawn([herdrBin(home), ...args], { env, stdin: "ignore", stdout: "ignore", stderr: "ignore" });
    const timer = setTimeout(() => child.kill(), 2000);
    try { return (await child.exited) === 0; } finally { clearTimeout(timer); }
  } catch { return false; }
};

/** What a herdr report needs: the pane's environment, the shared cache, and the values the render last saw. */
export interface HerdrInput {
  env: Record<string, string | undefined>;
  cache: Cache;
  now: number;
  home: string;
  model: string;
  effort: string;
  contextPct: number;
}

/** What the render records for one pane: the values it drew plus the pane and socket the report needs. */
export interface HerdrWant { pane: string; socket: string; model: string; effort: string; contextPct: number }

/** A live pane rewrites its want file at least this often, so its age says whether the pane still renders. */
export const HERDR_KEEPALIVE = 120;
/** Want, signature and delegate files untouched this long belong to a pane that stopped rendering. */
export const HERDR_PRUNE_AFTER = 900;
const SOCKET = /^\/[^\x00-\x1f\x7f]*$/;

const paneSlug = (env: Record<string, string | undefined>): string | null => {
  const pane = env.HERDR_PANE_ID ?? "";
  return env.HERDR_ENV === "1" && PANE.test(pane) ? pane.replaceAll(":", "-") : null;
};

/**
 * Render half. Inside herdr the render records what it drew (model, effort, context) and what a report needs from the
 * pane's environment (pane id, herdr socket) in `herdr-want-<pane>.json`, and nothing else: the lookup and the report
 * spawn herdr, so the scheduled refresher runs them (herdrRefresh), never the render. The file is rewritten when a value
 * changed or it is HERDR_KEEPALIVE seconds old, so its age tells the refresher the pane is still live. Outside herdr this
 * is one comparison.
 */
export function noteHerdr(state: State): void {
  const slug = paneSlug(state.env);
  if (slug === null) return;
  const name = `herdr-want-${slug}.json`;
  const rawSocket = state.env.HERDR_SOCKET_PATH ?? "";
  const want: HerdrWant = { pane: state.env.HERDR_PANE_ID ?? "", socket: SOCKET.test(rawSocket) ? rawSocket : "", model: state.model, effort: state.effort, contextPct: state.contextPct };
  const text = `${JSON.stringify(want)}\n`;
  if (state.cache.text(name) !== text || state.cache.age(name) >= HERDR_KEEPALIVE) state.cache.put(name, text);
}

/** One recorded want file, or null when it is unreadable or names no valid pane. */
export function readHerdrWant(cache: Cache, name: string): HerdrWant | null {
  const text = cache.text(name);
  if (text === null) return null;
  let body: Record<string, unknown>;
  try { body = object(JSON.parse(text)); } catch { return null; }
  const pane = string(body.pane);
  if (!PANE.test(pane) || `herdr-want-${pane.replaceAll(":", "-")}.json` !== name) return null;
  const socket = string(body.socket);
  const pct = typeof body.contextPct === "number" && Number.isFinite(body.contextPct) ? body.contextPct : 0;
  return { pane, socket: SOCKET.test(socket) ? socket : "", model: string(body.model, "unknown"), effort: string(body.effort), contextPct: pct };
}

/**
 * Refresher half: one job that reports every live pane. A pane whose want file changed reports at once; an unchanged one
 * re-reports when its last success is 300 s old, inside herdr's 10-minute token ttl (planHerdr's own rule). A pane
 * that has not rendered for HERDR_PRUNE_AFTER seconds has its want, signature and delegate files removed, so a dead pane's
 * row clears itself when the ttl runs out. Null when there is nothing to report.
 */
export function herdrRefresh(cache: Cache, home: string, deps: Partial<HerdrDeps> = {}): RefreshJob | null {
  let names: string[];
  try { names = readdirSync(cache.root); } catch { return null; }
  const jobs: RefreshJob[] = [];
  for (const name of names) {
    if (!/^herdr-(?:want-.+\.json|agent-.+\.txt|w[0-9A-Za-z]+-p[0-9A-Za-z]+\.txt)$/.test(name)) continue;
    const age = cache.now - mtime(cache.path(name));
    if (age >= HERDR_PRUNE_AFTER) { pruneHerdr(cache, name); continue; }
    if (!name.startsWith("herdr-want-")) continue;
    const want = readHerdrWant(cache, name);
    if (want === null) continue;
    const env = { HERDR_ENV: "1", HERDR_PANE_ID: want.pane, HERDR_SOCKET_PATH: want.socket };
    const job = planHerdr({ env, cache, now: cache.now, home, model: want.model, effort: want.effort, contextPct: want.contextPct }, deps);
    if (job !== null) jobs.push(job);
  }
  if (jobs.length === 0) return null;
  return { name: "herdr", async run() { await Promise.all(jobs.map((job) => job.run())); } };
}

/**
 * The space rows' wait line: once a minute, move each waiting session's minutes and colour
 * (hooks/lib/herdr-tabs.ts `refreshHerdrWaits`). The hooks start and clear a wait; nothing else
 * would update a row while the session sits waiting. Reports only labels that changed.
 */
export function herdrWaitRefresh(lifeosRoot: string): RefreshJob | null {
  let tabs: typeof import("../../../hooks/lib/herdr-tabs");
  try { tabs = require("../../../hooks/lib/herdr-tabs") as typeof import("../../../hooks/lib/herdr-tabs"); } catch { return null; }
  const dir = tabs.herdrTurnDir(lifeosRoot);
  if (!tabs.hasHerdrWaits(dir)) return null;
  return {
    name: "herdr-wait",
    async run() {
      try { tabs.refreshHerdrWaits(Date.now(), dir); }
      catch { /* herdr absent: the rows keep their last label */ }
    },
  };
}

function pruneHerdr(cache: Cache, name: string): void {
  invariant(name.startsWith("herdr-") && cache.path(name).startsWith(cache.root + sep), "herdr pruning stays on herdr files in the cache root");
  cache.remove(name);
}

/**
 * Report half. Inside herdr the sidebar's agents row names the worker. The delegate lookup carries a 2-second
 * cache; the report itself fires only when the reported values changed or the last success is 300 s old, and the cache is
 * written only after herdr accepted it. Outside herdr this is one comparison and no job.
 */
export function planHerdr(state: HerdrInput, deps: Partial<HerdrDeps> = {}): RefreshJob | null {
  const pane = state.env.HERDR_PANE_ID ?? "";
  if (state.env.HERDR_ENV !== "1" || !PANE.test(pane)) return null;
  const { cache, now } = state;
  const slug = pane.replaceAll(":", "-");
  const ctx = (String(state.contextPct).split(".")[0] ?? "").replace(/\D/g, "") || "0";
  let agent = clean(state.model.split(" ")[0] ?? "") || "Assistant";
  const agentFile = `herdr-agent-${slug}.txt`;
  let delegate = "";
  const line = (cache.text(agentFile) ?? "").split("\n")[0] ?? "";
  const at = Number((line.split(" ")[0] ?? "").replace(/\D/g, "") || 0);
  if (line !== "" && now - at < 2) delegate = line.slice(line.indexOf(" ") + 1);
  if (!delegate) {
    delegate = (deps.delegate ?? liveDelegate)(pane, agent, state.env.HERDR_SOCKET_PATH ?? "");
    if (delegate) cache.put(agentFile, `${now} ${delegate}\n`);
  }
  if (delegate) agent = delegate;
  const sig = `${state.model}|${state.effort}|${ctx}|${agent}`;
  const sigFile = `herdr-${slug}.txt`;
  const previous = (cache.text(sigFile) ?? "").split("\n")[0] ?? "";
  const previousAt = Number((previous.split(" ")[0] ?? "").replace(/\D/g, "") || 0);
  const previousSig = previous.includes(" ") ? previous.slice(previous.indexOf(" ") + 1) : previous;
  if (previousSig === sig && now - previousAt < 300) return null;
  const effort = clean(state.effort.toLowerCase());
  const modelArg = effort ? ["--token", `model=${effort}`] : ["--clear-token", "model"];
  // Below 60% the number is noise, so the token is cleared and the row gives the room back.
  const percent = Number(ctx);
  const ctxLabel = percent > 80 ? `context ${ctx}% nearly full` : percent > 60 ? `context ${ctx}% filling` : "";
  const ctxArg = ctxLabel ? ["--token", `ctx=${ctxLabel}`] : ["--clear-token", "ctx"];
  return {
    name: "herdr",
    async run() {
      const ok = await (deps.report ?? liveReport(state.home, state.env.HERDR_SOCKET_PATH ?? ""))(["pane", "report-metadata", pane, "--source", "lifeos", "--display-agent", agent, ...modelArg, ...ctxArg, "--ttl-ms", "600000"]);
      if (ok) cache.put(sigFile, `${now} ${sig}\n`);
    },
  };
}
