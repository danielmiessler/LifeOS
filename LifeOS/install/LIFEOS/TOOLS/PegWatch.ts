#!/usr/bin/env bun
/**
 * PegWatch — scheduled CPU/GPU peg detector with cause heuristics.
 *
 * Runs once per invocation (launchd fires it every 960s via
 * com.lifeos.pegwatch). Detects a pegged GPU (two ioreg samples ≥ threshold,
 * 5s apart) or pegged CPU (top second-sample ≥ threshold), attributes a likely
 * cause from the live process table, and surfaces a recommendation:
 *   - appends a JSONL record to MEMORY/OBSERVABILITY/pegwatch.jsonl (every run)
 *   - on a peg: Pulse banner via /notify with voice_enabled:false (cadence job
 *     — never voice, OPERATIONAL_RULES § Background work), deduped to one
 *     alert per cause per hour via MEMORY/STATE/pegwatch.json
 *
 * GPU attribution is dynamic, never an app-signature table: per-process GPU
 * ms/s via `sudo -n powermetrics` when a sudoers carve-out permits it, else
 * live AGXDeviceUserClient context owners (IORegistry, root-free) ranked by
 * current CPU — output labeled "measured" vs "correlated, not proven".
 *
 *   bun PegWatch.ts            # one scheduled check (quiet unless pegged)
 *   bun PegWatch.ts --force    # verbose run to stdout regardless of state
 *   bun PegWatch.ts --simulate-peg gpu|cpu   # exercise alert+dedupe path
 *
 * @version 1.0.0
 */

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { invariant } from "./Invariant";
import { PULSE_BASE } from "../PULSE/endpoint";

const HOME = homedir();
const OBS_DIR = join(HOME, ".claude", "LIFEOS", "MEMORY", "OBSERVABILITY");
const LOG_PATH = join(OBS_DIR, "pegwatch.jsonl");
const STATE_PATH = join(HOME, ".claude", "LIFEOS", "MEMORY", "STATE", "pegwatch.json");
const PULSE_NOTIFY = `${PULSE_BASE}/notify`; // port via endpoint.ts resolver (#2392)

const GPU_PEG = 90; // % — both samples must reach it
const CPU_PEG = 90; // % — total (100 - idle)
const DEDUPE_MS = 60 * 60 * 1000;

const FORCE = process.argv.includes("--force");
const SIM = (() => {
  const i = process.argv.indexOf("--simulate-peg");
  return i >= 0 ? process.argv[i + 1] : null;
})();

async function run(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out;
}

/** Max "Device Utilization %" across IOAccelerator entries; null if unavailable. */
async function gpuUtil(): Promise<number | null> {
  const out = await run(["/usr/sbin/ioreg", "-r", "-c", "IOAccelerator", "-d", "1"]);
  const matches = [...out.matchAll(/"Device Utilization %"=(\d+)/g)].map((m) => Number(m[1]));
  return matches.length ? Math.max(...matches) : null;
}

/** Total CPU % from top's second sample (first sample is since-boot garbage). */
async function cpuUtil(): Promise<number | null> {
  const out = await run(["/usr/bin/top", "-l", "2", "-n", "0", "-s", "2"]);
  const lines = out.split("\n").filter((l) => l.startsWith("CPU usage:"));
  const last = lines[lines.length - 1];
  const idle = last?.match(/([\d.]+)% idle/);
  return idle ? 100 - Number(idle[1]) : null;
}

interface Proc { cpu: number; mem: number; name: string }

async function topProcs(): Promise<Proc[]> {
  const out = await run(["/bin/ps", "-Aceo", "pcpu=,rss=,comm="]);
  return out
    .split("\n")
    .map((l) => l.trim().match(/^([\d.]+)\s+(\d+)\s+(.+)$/))
    .flatMap((m) => (m ? [{ cpu: Number(m[1]), mem: Number(m[2]), name: m[3] }] : []))
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 8);
}

// ---- Dynamic GPU attribution (no hardcoded app names) ----------------------
// Ground truth (per-process GPU ms/s) exists only behind root: powermetrics.
// If a sudoers carve-out permits it non-interactively, use it. Otherwise fall
// back to correlation: the AGX driver lists every GPU context's owning pid in
// the IORegistry (no root needed) — rank those owners by live CPU. Correlation
// is labeled as such and never stated as fact.

interface GpuActor { pid: number; name: string; metric: number; how: "measured" | "correlated" }

/** Definitive: per-process GPU ms/s from a 3s powermetrics sample (root path). */
async function gpuActorsMeasured(): Promise<GpuActor[] | null> {
  const proc = Bun.spawn(
    ["sudo", "-n", "/usr/bin/powermetrics", "--samplers", "tasks", "--show-process-gpu", "-i", "3000", "-n", "1"],
    { stdout: "pipe", stderr: "ignore" },
  );
  const out = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0) return null; // no sudoers carve-out — fall back
  const actors: GpuActor[] = [];
  for (const line of out.split("\n")) {
    // task table rows: "Name  pid  ... GPU ms/s" — take name, pid, last numeric column
    const m = line.match(/^(\S.*?)\s{2,}(\d+)\s.*?([\d.]+)\s*$/);
    if (m && Number(m[3]) > 0) actors.push({ pid: Number(m[2]), name: m[1].trim(), metric: Number(m[3]), how: "measured" });
  }
  return actors.sort((a, b) => b.metric - a.metric).slice(0, 5);
}

/** Fallback: GPU-context owners from the IORegistry, ranked by their live CPU. */
async function gpuActorsCorrelated(): Promise<GpuActor[]> {
  const out = await run(["/usr/sbin/ioreg", "-c", "AGXDeviceUserClient", "-r", "-d", "1"]);
  const owners = new Map<number, string>();
  for (const m of out.matchAll(/"IOUserClientCreator" = "pid (\d+), ([^"]+)"/g)) {
    owners.set(Number(m[1]), m[2]);
  }
  const actors: GpuActor[] = [];
  for (const [pid, name] of owners) {
    const psOut = (await run(["/bin/ps", "-o", "pcpu=,comm=", "-p", String(pid)])).trim();
    const m = psOut.match(/^([\d.]+)\s+(.+)$/);
    const cpu = m ? Number(m[1]) : NaN;
    // ioreg truncates creator names at 16 chars; ps has the full one
    const fullName = m ? (m[2].split("/").pop() ?? name) : name;
    if (Number.isFinite(cpu) && cpu > 10) actors.push({ pid, name: fullName, metric: cpu, how: "correlated" });
  }
  return actors.sort((a, b) => b.metric - a.metric).slice(0, 5);
}

async function gpuActors(): Promise<GpuActor[]> {
  return (await gpuActorsMeasured()) ?? (await gpuActorsCorrelated());
}

/**
 * GPU peg cause: derived from the measured/correlated actor ranking, never
 * from hardcoded app signatures (2026-08-14: a signature table confidently
 * blamed OBS for a Chrome-tab GPU peg — {{PRINCIPAL_NAME}} killed OBS, nothing changed).
 * WindowServer is the compositor: when it tops the ranking, the producer is
 * the next-ranked actor, so both are named.
 */
function diagnoseGpu(actors: GpuActor[]): { cause: string; rec: string } {
  if (actors.length === 0) {
    return {
      cause: "gpu-unattributed",
      rec: "GPU is pegged but no user-space actor is measurable (system/root process, or no busy context owners). Run `sudo powermetrics --samplers tasks --show-process-gpu -i 3000 -n 1` for ground truth.",
    };
  }
  const how = actors[0].how;
  const unit = how === "measured" ? "GPU ms/s" : "% CPU (context owner)";
  const ranking = actors.map((a) => `${a.name} (${a.metric.toFixed(1)} ${unit})`).join(", ");
  const producer = actors.find((a) => !/WindowServer/.test(a.name)) ?? actors[0];
  const viaCompositor = /WindowServer/.test(actors[0].name) && producer !== actors[0];
  const confidence = how === "measured" ? "measured" : "correlated, not proven";
  return {
    cause: `gpu:${producer.name}`,
    rec: `${confidence}: ${producer.name} is the top ${viaCompositor ? "producer behind WindowServer's compositing" : "GPU actor"}. Ranking: ${ranking}. Quit/inspect that process first${/Chrome|Safari|Helper/.test(producer.name) ? " (for a browser, its task manager shows the tab)" : ""}.`,
  };
}

/** CPU peg cause: top of the ps table IS the measurement; only two known
 *  non-obvious interpretations are special-cased (they mislead operators). */
function diagnoseCpu(procs: Proc[]): { cause: string; rec: string } {
  const top = procs[0];
  if (procs.some((p) => /mds_stores|mdworker/.test(p.name) && p.cpu > 30)) {
    return {
      cause: "spotlight-indexing",
      rec: "Spotlight is (re)indexing — heavy after a reboot or big file churn. It settles on its own; check progress with `mdutil -s /`.",
    };
  }
  if (procs.some((p) => /kernel_task/.test(p.name) && p.cpu > 50)) {
    return {
      cause: "thermal",
      rec: "kernel_task high IS the cooling response, not a runaway process. Check vents/ambient temp and what else is hot; never kill it.",
    };
  }
  return {
    cause: `cpu:${top?.name ?? "unknown"}`,
    rec: `Top consumers: ${procs.slice(0, 3).map((p) => `${p.name} (${p.cpu}%)`).join(", ")}. Inspect with \`bun ~/.claude/skills/Vitals/Tools/Vitals.ts hogs\`.`,
  };
}

interface State { lastAlert?: { cause: string; ts: number } }

function readState(): State {
  try { return JSON.parse(readFileSync(STATE_PATH, "utf8")); } catch { return {}; }
}

function writeState(state: State): void {
  invariant(!state.lastAlert || (state.lastAlert.cause.length > 0 && state.lastAlert.ts > 0),
    "pegwatch state lastAlert must carry a non-empty cause and a positive timestamp");
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function logRecord(record: Record<string, unknown>): void {
  invariant(typeof record.ts === "string" && (record.ts as string).length > 0, "pegwatch record needs an ISO ts");
  const line = JSON.stringify(record);
  invariant(JSON.parse(line) !== null, "pegwatch record must round-trip as JSON");
  mkdirSync(OBS_DIR, { recursive: true });
  appendFileSync(LOG_PATH, line + "\n");
}

async function notify(message: string): Promise<boolean> {
  try {
    const res = await fetch(PULSE_NOTIFY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, voice_enabled: false }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false; // Pulse down: the JSONL record still carries the finding
  }
}

async function main(): Promise<void> {
  const gpu1 = SIM === "gpu" ? 97 : await gpuUtil();
  const cpu = SIM === "cpu" ? 95 : await cpuUtil();
  let gpu2: number | null = gpu1;
  if (gpu1 !== null && gpu1 >= GPU_PEG && !SIM) {
    await Bun.sleep(5000);
    gpu2 = await gpuUtil();
  }

  const gpuPegged = gpu1 !== null && gpu2 !== null && gpu1 >= GPU_PEG && gpu2 >= GPU_PEG;
  const cpuPegged = cpu !== null && cpu >= CPU_PEG;
  const ts = new Date().toISOString();

  if (!gpuPegged && !cpuPegged) {
    logRecord({ ts, gpu: gpu1, cpu, pegged: false });
    if (FORCE) console.log(`ok — gpu=${gpu1}% cpu=${cpu?.toFixed(1)}%`);
    return;
  }

  const kind = gpuPegged ? "gpu" : "cpu";
  const procs = await topProcs();
  const actors = gpuPegged ? await gpuActors() : [];
  const { cause, rec } = gpuPegged ? diagnoseGpu(actors) : diagnoseCpu(procs);
  logRecord({ ts, gpu: gpu1, gpu2, cpu, pegged: true, kind, cause, rec, actors, top: procs.slice(0, 5) });

  const state = readState();
  const dup = state.lastAlert && state.lastAlert.cause === cause && Date.now() - state.lastAlert.ts < DEDUPE_MS;
  if (!dup) {
    const pct = kind === "gpu" ? `${gpu1}%` : `${cpu?.toFixed(0)}%`;
    await notify(`⚠️ ${kind.toUpperCase()} pegged at ${pct} — likely ${cause}. ${rec}`);
    writeState({ lastAlert: { cause, ts: Date.now() } });
  }
  if (FORCE || SIM) {
    console.log(JSON.stringify({ kind, cause, rec, deduped: Boolean(dup), top: procs.slice(0, 3) }, null, 2));
  }
}

await main();
