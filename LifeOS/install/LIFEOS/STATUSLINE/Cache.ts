import { chmodSync, closeSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join, sep } from "node:path";
import { invariant } from "../TOOLS/Invariant";

export function readText(path: string): string | null {
  try { return readFileSync(path, "utf8"); } catch { return null; }
}

/** tail -1: the last non-empty line, read from the end so a large append-only log costs one small read. */
export function readLastLine(path: string): string | null {
  let fd: number;
  try { fd = openSync(path, "r"); } catch { return null; }
  try {
    const size = fstatSync(fd).size;
    for (let span = Math.min(size, 65536); ; span = Math.min(size, span * 4)) {
      const buffer = Buffer.alloc(span);
      readSync(fd, buffer, 0, span, size - span);
      const lines = buffer.toString("utf8").replace(/\n+$/, "").split("\n");
      if (lines.length > 1 || span === size) return lines.at(-1) ?? "";
    }
  } catch { return null; } finally { closeSync(fd); }
}

export function readJson(path: string): unknown {
  const text = readText(path);
  try { return text === null ? null : JSON.parse(text); } catch { return null; }
}

export function mtime(path: string): number {
  try { return Math.floor(statSync(path).mtimeMs / 1000); } catch { return 0; }
}

/** One clock per render. Cache data is parsed, never evaluated as shell. */
export class Cache {
  constructor(readonly root: string, readonly now: number) {
    invariant(isAbsolute(root), "cache root must be absolute");
    invariant(Number.isSafeInteger(now), "cache clock must be epoch seconds");
  }

  path(name: string): string {
    invariant(name.length > 0 && !name.startsWith(".") && !/[\\/\0]/.test(name), "cache key must be a plain non-dot name");
    return join(this.root, name);
  }

  initialize(): void {
    invariant(isAbsolute(this.root), "cache initialization requires an absolute root");
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
    chmodSync(this.root, 0o700);
  }

  /** Daily sweep: runs before idle admission, so a replayed frame still ages the directory. */
  sweepDaily(): void {
    invariant(isAbsolute(this.root), "sweeps must stay inside the cache root");
    const daily = join(this.root, ".swept");
    if (this.now - mtime(daily) < 86400) return;
    writeFileSync(daily, "", { mode: 0o600 });
    this.reap(true, false);
  }

  /** Once-a-minute leak sweep, after the idle replay check. */
  sweepMinute(): void {
    invariant(isAbsolute(this.root), "sweeps must stay inside the cache root");
    const minuteAt = this.text("swept-minute.stamp")?.trim() ?? "0";
    if (this.now - (/^\d+$/.test(minuteAt) ? Number(minuteAt) : 0) < 60) return;
    this.put("swept-minute.stamp", `${this.now}\n`);
    this.reap(false, true);
  }

  /** Both sweeps, in bash order. */
  sweep(): void {
    this.sweepDaily();
    this.sweepMinute();
  }

  /** find's +N tests round down to whole days/minutes before comparing. */
  private reap(dailyDue: boolean, minuteDue: boolean): void {
    for (const name of readdirSync(this.root)) {
      if (name === ".swept") continue;
      const path = join(this.root, name);
      let info;
      try { info = lstatSync(path); } catch { continue; }
      const age = this.now - Math.floor(info.mtimeMs / 1000);
      const temporary = /\.(?:tmp|clip|hdr)\./.test(name);
      const dailyExpired = dailyDue && info.isFile() && (Math.floor(age / 86400) > 7 || (temporary && Math.floor(age / 60) > 60));
      const minuteExpired = minuteDue && ((info.isDirectory() && name.startsWith("parallel.") && Math.floor(age / 60) > 1) || (info.isFile() && (/^render-.*\.out\.tmp\./.test(name) || /\.(?:clip|hdr)\./.test(name)) && Math.floor(age / 60) > 2));
      if (dailyExpired || minuteExpired) rmSync(path, { recursive: info.isDirectory(), force: true });
    }
  }

  text(name: string): string | null { return readText(this.path(name)); }
  json(name: string): unknown { return readJson(this.path(name)); }
  age(name: string): number { return this.now - mtime(this.path(name)); }
  fresh(name: string, ttl: number): boolean {
    const at = mtime(this.path(name));
    return at > 0 && this.now - at <= ttl;
  }

  /** Exact bytes; callers choose their own trailing newline, matching each legacy format. */
  put(name: string, text: string): void {
    invariant(typeof text === "string", "cache payload must be text");
    const path = this.path(name);
    const temp = `${path}.tmp.${process.pid}.${crypto.randomUUID()}`;
    try {
      writeFileSync(temp, text, { mode: 0o600, flag: "wx" });
      renameSync(temp, path);
    } finally {
      try { unlinkSync(temp); } catch { /* Rename consumed it, or creation failed. */ }
    }
  }

  remove(name: string): void {
    const path = this.path(name);
    invariant(path.startsWith(this.root + sep), "cache removal must stay in its root");
    try { unlinkSync(path); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

/** Legacy numeric caches have a deliberately tiny grammar, with no shell execution. */
export function numericAssignments(text: string): Record<string, number> {
  const result: Record<string, number> = Object.create(null);
  for (const line of text.split("\n")) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=([0-9]+(?:\.[0-9]+)?)$/.exec(line);
    if (match && Number.isFinite(Number(match[2]))) result[match[1]] = Number(match[2]);
  }
  return result;
}
