#!/usr/bin/env bun
/**
 * WinTaskRun.ts — the process every LifeOS Windows scheduled task actually runs.
 *
 *   bun WinTaskRun.ts <spec.json>
 *
 * Task Scheduler can start a program and nothing more: it cannot redirect
 * output, set environment per task, keep a job alive, or watch a path. This
 * runner supplies the four, reading the spec WinTask.ts wrote at install time:
 *
 *   interval / calendar  run `exec` once, append output to logPath, exit with its code
 *   daemon               run `exec`, respawn it restartSec after every exit (launchd KeepAlive)
 *   watch                run `exec` once, then again whenever a watched path changes,
 *                        debounced and throttled (launchd WatchPaths + ThrottleInterval)
 */

import { appendFileSync, existsSync, readFileSync, watch, type FSWatcher } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { UnitSpec } from "./SystemdUser";

declare const Bun: { spawn: (cmd: string[], opts?: any) => any };

type Spec = UnitSpec & { bun?: string };

/** Quiet period after the last change before a watch job runs. */
const DEBOUNCE_MS = 2_000;
/** Minimum gap between two watch runs, matching the plists' ThrottleInterval. */
const THROTTLE_MS = 30_000;
/** How often a watch re-arms paths that vanished or appeared. */
const REARM_MS = 60_000;

function stamp(): string {
  return new Date().toISOString();
}

function env(spec: Spec): Record<string, string> {
  const e: Record<string, string> = { ...(process.env as Record<string, string>) };
  // HOME is unset on Windows; LifeOS tools resolve every path from it.
  if (!e.HOME) e.HOME = e.USERPROFILE ?? homedir();
  // Task Scheduler sessions do not inherit PATH additions made after login, so
  // put bun's directory first. Git's usr\bin goes LAST: its POSIX find/sort must
  // not shadow System32 for children that expect the Windows tools.
  const bunDir = spec.bun ? dirname(spec.bun) : join(e.USERPROFILE ?? homedir(), ".bun", "bin");
  const gitUsr = "C:\\Program Files\\Git\\usr\\bin";
  e.PATH = [bunDir, e.PATH ?? e.Path ?? "", existsSync(gitUsr) ? gitUsr : ""].filter(Boolean).join(";");
  delete e.Path;
  return { ...e, ...(spec.environment ?? {}) };
}

function log(spec: Spec, line: string): void {
  try { appendFileSync(spec.logPath, line.endsWith("\n") ? line : line + "\n"); } catch { /* log dir gone: nothing else to tell */ }
}

async function runOnce(spec: Spec, why: string): Promise<number> {
  log(spec, `[${stamp()}] ${spec.label}: start (${why})`);
  const proc = Bun.spawn(spec.exec, {
    cwd: spec.workingDirectory ?? process.cwd(),
    env: env(spec),
    stdout: "pipe",
    stderr: "pipe",
  });
  const pump = async (stream: ReadableStream<Uint8Array>, file: string) => {
    const dec = new TextDecoder();
    for await (const chunk of stream) {
      try { appendFileSync(file, dec.decode(chunk, { stream: true })); } catch { /* see log() */ }
    }
  };
  await Promise.all([pump(proc.stdout, spec.logPath), pump(proc.stderr, spec.errLogPath ?? spec.logPath)]);
  const code = await proc.exited;
  log(spec, `[${stamp()}] ${spec.label}: exit ${code}`);
  return code;
}

async function daemon(spec: Spec, restartSec: number): Promise<never> {
  for (;;) {
    await runOnce(spec, "daemon");
    await Bun.sleep(Math.max(1, restartSec) * 1000);
  }
}

async function watchLoop(spec: Spec, paths: string[]): Promise<never> {
  let running = false;
  let pending = false;
  let lastStart = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const fire = async (why: string) => {
    if (running) { pending = true; return; }
    const wait = lastStart + THROTTLE_MS - Date.now();
    if (wait > 0) { schedule(why, wait); return; }
    running = true;
    lastStart = Date.now();
    try { await runOnce(spec, why); } finally {
      running = false;
      if (pending) { pending = false; schedule("change during run", DEBOUNCE_MS); }
    }
  };
  const schedule = (why: string, ms = DEBOUNCE_MS) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void fire(why); }, ms);
  };

  const watchers = new Map<string, FSWatcher>();
  const arm = () => {
    for (const p of paths) {
      if (watchers.has(p) || !existsSync(p)) continue;
      try {
        const w = watch(p, { persistent: true }, (_event, name) => schedule(`change: ${name ?? p}`));
        w.on("error", () => { w.close(); watchers.delete(p); });
        watchers.set(p, w);
      } catch (e) {
        log(spec, `[${stamp()}] ${spec.label}: cannot watch ${p}: ${e instanceof Error ? e.message : e}`);
      }
    }
    for (const [p, w] of watchers) if (!existsSync(p)) { w.close(); watchers.delete(p); }
  };

  arm();
  log(spec, `[${stamp()}] ${spec.label}: watching ${watchers.size}/${paths.length} path(s)`);
  await fire("load");
  setInterval(arm, REARM_MS);
  return new Promise<never>(() => { /* the watchers keep the process alive */ });
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file || !existsSync(file)) {
    console.error(`usage: bun WinTaskRun.ts <spec.json> (got ${file ?? "nothing"})`);
    process.exit(2);
  }
  const spec: Spec = JSON.parse(readFileSync(file, "utf8"));
  const s = spec.schedule;
  if (s.kind === "daemon") await daemon(spec, s.restartSec);
  if (s.kind === "watch") await watchLoop(spec, s.paths);
  process.exit(await runOnce(spec, s.kind));
}

if (import.meta.main) {
  main().catch((err) => { console.error(`[WinTaskRun] Fatal: ${err}`); process.exit(1); });
}
