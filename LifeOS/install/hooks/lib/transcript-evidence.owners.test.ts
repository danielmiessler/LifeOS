// Browser evidence owner registry: registered owners produce browser evidence,
// Interceptor behaviour is unchanged, deploy proof stays opt-in.
// Each case runs in a child process so the module-level owner cache starts empty.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const MODULE = join(import.meta.dir, "transcript-evidence.ts");

type Call = { cmd?: string; read?: string; edit?: string; out?: string; error?: boolean };

function transcript(calls: Call[]): string {
  const lines: unknown[] = [{ type: "user", message: { role: "user", content: "check the page" } }];
  calls.forEach((c, i) => {
    const id = `t${i}`;
    const [name, input] = c.cmd !== undefined ? ["Bash", { command: c.cmd }]
      : c.read !== undefined ? ["Read", { file_path: c.read }]
      : ["Edit", { file_path: c.edit, old_string: "a", new_string: "b" }];
    lines.push({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] } });
    lines.push({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: c.out ?? "ok", is_error: c.error === true }] } });
  });
  const dir = mkdtempSync(join(tmpdir(), "owners-tx-"));
  const path = join(dir, "t.jsonl");
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return path;
}

function lifeosDir(owners?: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "owners-lifeos-"));
  mkdirSync(join(dir, "USER", "CONFIG"), { recursive: true });
  if (owners !== undefined) {
    writeFileSync(join(dir, "USER", "CONFIG", "browser-evidence-owners.json"), typeof owners === "string" ? owners : JSON.stringify(owners));
  }
  return dir;
}

function run(owners: unknown, calls: Call[]) {
  const script = `const m = await import(${JSON.stringify(MODULE)});
const ev = m.parseTurnEvents(process.env.TX);
console.log(JSON.stringify({
  ev: ev.map((e) => ({ kind: e.kind, owner: e.owner?.id ?? null })),
  deploy: m.probedAfterDeploy(ev),
  flow: m.flowExercised(ev),
  pixel: m.pixelViewed(ev),
}));`;
  const env: Record<string, string> = { ...(process.env as Record<string, string>), LIFEOS_DIR: lifeosDir(owners), TX: transcript(calls) };
  // These outrank LIFEOS_DIR in Paths.lifeosDirFor; left set, the test would read the real install.
  delete env.CLAUDE_CONFIG_DIR;
  delete env.CLAUDE_PLUGIN_ROOT;
  delete env.LIFEOS_SKILLS_DIR;
  const r = Bun.spawnSync(["bun", "--eval", script], { env, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
  return JSON.parse(r.stdout.toString()) as { ev: { kind: string; owner: string | null }[]; deploy: boolean; flow: boolean; pixel: boolean };
}

const GSTACK = [{ id: "gstack", command: "^(\\S+[/])?browse\\s", interact: "\\b(click|fill|type|press|select|hover)\\b" }];

describe("browser evidence owners", () => {
  test("without a registry a non-Interceptor browser command is a plain command", () => {
    expect(run(undefined, [{ cmd: "browse screenshot /tmp/a.png" }]).ev).toEqual([{ kind: "command", owner: null }]);
  });

  test("a registered owner yields capture, interact and nav", () => {
    const r = run(GSTACK, [
      { cmd: "browse goto https://app.example.com" },
      { cmd: "browse press Enter" },
      { cmd: "~/.claude/skills/gstack/browse/dist/browse screenshot /tmp/a.png" },
    ]);
    expect(r.ev).toEqual([
      { kind: "interceptor-nav", owner: "gstack" },
      { kind: "interceptor-interact", owner: "gstack" },
      { kind: "interceptor-capture", owner: "gstack" },
    ]);
  });

  test("the owner pattern must match a segment start, not quoted text", () => {
    expect(run(GSTACK, [{ cmd: "echo 'browse screenshot'" }]).ev[0]!.owner).toBeNull();
    expect(run(GSTACK, [{ cmd: "cd app && browse click @e2" }]).ev).toEqual([{ kind: "interceptor-interact", owner: "gstack" }]);
  });

  test("Interceptor classification is unchanged and carries no owner", () => {
    expect(run(GSTACK, [{ cmd: "interceptor screenshot --type full" }]).ev).toEqual([{ kind: "interceptor-capture", owner: null }]);
  });

  test("render and flow evidence count from a registered owner", () => {
    const r = run(GSTACK, [
      { edit: "/repo/src/App.tsx" },
      { cmd: "browse goto https://app.example.com" },
      { cmd: "browse click @e3" },
      { cmd: "browse screenshot /tmp/after.png" },
      { read: "/tmp/after.png" },
    ]);
    expect(r.flow).toBe(true);
    expect(r.pixel).toBe(true);
  });

  test("deploy proof stays Interceptor or curl unless the owner opts in", () => {
    const calls: Call[] = [{ cmd: "wrangler pages deploy dist" }, { cmd: "browse goto https://site.example.com" }];
    expect(run(GSTACK, calls).deploy).toBe(false);
    expect(run([{ ...GSTACK[0], deployProof: true }], calls).deploy).toBe(true);
    expect(run(GSTACK, [calls[0]!, { cmd: "interceptor open https://site.example.com" }]).deploy).toBe(true);
  });

  test("a bad entry is skipped without dropping valid ones; interceptor id is reserved", () => {
    const r = run([{ id: "broken", command: "(" }, { id: "interceptor", command: "^browse" }, ...GSTACK], [{ cmd: "browse screenshot x.png" }]);
    expect(r.ev).toEqual([{ kind: "interceptor-capture", owner: "gstack" }]);
    expect(run("not json", [{ cmd: "browse screenshot x.png" }]).ev[0]!.kind).toBe("command");
  });
});
