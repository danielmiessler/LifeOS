#!/usr/bin/env bun
/*
Usage:
  VerifyDesign.ts <url-or-path> <out-dir> [--viewport WIDTHxHEIGHT] [--a11y|--no-a11y]

Runs a thin Interceptor-driven smoke check for a rendered design. The viewport is
validated and reported, but not applied because Interceptor exposes no viewport
verb. Accessibility checks are viewport-independent tree heuristics, not axe-core.
*/
import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { displayPath, getClaudeDir } from "../../../LIFEOS/TOOLS/Paths";

type TreeNode = {
  ref?: string;
  role?: string;
  name?: string;
  text?: string;
  alt?: string;
  href?: string;
  level?: number;
  children?: TreeNode[];
};
type Violation = { type: string; count: number; examples: { ref?: string; text?: string }[] };
type A11yResult = {
  engine: "interceptor-tree-heuristic";
  limitations: string[];
  violations: Violation[];
  pass: boolean;
};

function resolveInterceptorBin(): string {
  const found = Bun.spawnSync(["which", "interceptor"]);
  const bin = found.stdout.toString().trim();
  if (found.exitCode !== 0 || bin.length === 0) {
    console.error(`interceptor CLI not found on PATH — install the Interceptor skill (see ${displayPath(getClaudeDir())}/skills/Interceptor/SKILL.md)`);
    process.exit(127);
  }
  return bin;
}

async function run(argv: string[], timeout: number): Promise<{ code: number; stdout: string; stderr: string }> {
  const p = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", signal: AbortSignal.timeout(timeout) });
  const [stdout, stderr, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { code, stdout, stderr };
}

function walkTree(node: TreeNode, out: TreeNode[] = []): TreeNode[] {
  out.push(node);
  for (const child of node.children ?? []) walkTree(child, out);
  return out;
}

function textOf(n: TreeNode): string {
  return `${n.name ?? ""} ${n.text ?? ""}`.trim();
}

function add(map: Map<string, Violation>, type: string, node: TreeNode): void {
  const v = map.get(type) ?? { type, count: 0, examples: [] };
  v.count += 1;
  if (v.examples.length < 5) v.examples.push({ ref: node.ref, text: textOf(node) });
  map.set(type, v);
}

function a11yFromTree(root: TreeNode): A11yResult {
  const nodes = walkTree(root);
  const violations = new Map<string, Violation>();
  let previousHeading = 0;
  let sawHeading = false;
  for (const n of nodes) {
    const role = (n.role ?? "").toLowerCase();
    const label = textOf(n);
    if (role === "img" && !label && !n.alt) add(violations, "img-alt", n);
    if (role === "button" && !label) add(violations, "button-name", n);
    if (role === "a" && (!label || !n.href)) add(violations, "link-name", n);
    if (["textbox", "combobox", "spinbutton"].includes(role) && !label) add(violations, "form-label", n);
    if (role === "heading" && typeof n.level === "number") {
      if (!sawHeading && n.level > 1) add(violations, "heading-order", n);
      if (sawHeading && n.level > previousHeading + 1) add(violations, "heading-order", n);
      sawHeading = true;
      previousHeading = n.level;
    }
  }
  const list = [...violations.values()];
  return {
    engine: "interceptor-tree-heuristic",
    limitations: ["no-contrast-check", "no-dynamic-aria-live-check", "no-css-parsed-check"],
    violations: list,
    pass: list.length === 0,
  };
}

function parseArgs(): { input: string; outDir: string; w: number; h: number; a11y: boolean } {
  const args = Bun.argv.slice(2);
  const input = args.shift();
  const outDir = args.shift();
  if (!input || !outDir) {
    console.error("usage: VerifyDesign.ts <url-or-path> <out-dir> [--viewport WIDTHxHEIGHT] [--a11y|--no-a11y]");
    process.exit(2);
  }
  let viewport = "1440x900";
  let a11y = true;
  while (args.length) {
    const flag = args.shift();
    if (flag === "--viewport") viewport = args.shift() ?? "";
    else if (flag === "--a11y") a11y = true;
    else if (flag === "--no-a11y") a11y = false;
    else {
      console.error(`unknown flag: ${flag ?? ""}`);
      process.exit(2);
    }
  }
  const m = /^(\d+)x(\d+)$/.exec(viewport);
  const w = m ? Number(m[1]) : 0;
  const h = m ? Number(m[2]) : 0;
  if (!m || w < 320 || h < 320 || w > 7680 || h > 7680) {
    console.error("invalid viewport; expected WIDTHxHEIGHT with each value in [320, 7680]");
    process.exit(2);
  }
  return { input, outDir, w, h, a11y };
}

async function resolveUrl(input: string): Promise<{ url: string; resolvedUrl: string }> {
  if (/^https?:\/\//.test(input)) return { url: input, resolvedUrl: input };
  const abs = resolve(input);
  const s = await stat(abs).catch(() => null);
  if (!s) {
    console.error(`path does not exist: ${abs}`);
    process.exit(2);
  }
  return { url: input, resolvedUrl: pathToFileURL(abs).href };
}

async function main(): Promise<void> {
  if (Bun.argv.slice(2).length === 0) {
    console.error("usage: VerifyDesign.ts <url-or-path> <out-dir> [--viewport WIDTHxHEIGHT] [--a11y|--no-a11y]");
    return;
  }
  const opts = parseArgs();
  const { url, resolvedUrl } = await resolveUrl(opts.input);
  const outDir = resolve(opts.outDir);
  const made = await run(["mkdir", "-p", outDir], 5_000);
  if (made.code !== 0) {
    console.error(made.stderr || "failed to create output directory");
    process.exit(2);
  }
  const bin = resolveInterceptorBin();
  const timestamp = new Date().toISOString();
  await run([bin, "open", resolvedUrl], 60_000);
  await run([bin, "wait-stable"], 30_000);
  const shot = join(outDir, `${timestamp.replace(/[:.]/g, "-")}.png`);
  let screenshot: string | null = shot;
  let screenshotError: string | undefined;
  const s = await run([bin, "screenshot", shot], 30_000);
  if (s.code !== 0) {
    screenshot = null;
    screenshotError = s.stderr || "screenshot failed";
  }
  let a11y: A11yResult | { skipped: true };
  if (opts.a11y) {
    const tree = await run([bin, "tree", "--json"], 30_000);
    if (tree.code === 0) {
      a11y = a11yFromTree(JSON.parse(tree.stdout) as TreeNode);
    } else {
      a11y = {
        engine: "interceptor-tree-heuristic",
        limitations: ["no-contrast-check", "no-dynamic-aria-live-check", "no-css-parsed-check"],
        violations: [{ type: "tree-unavailable", count: 1, examples: [{ text: tree.stderr || "tree failed" }] }],
        pass: false,
      };
    }
  } else {
    a11y = { skipped: true };
  }
  const a11yPass = "skipped" in a11y ? true : a11y.pass;
  const pass = screenshot !== null && a11yPass;
  const result = {
    url,
    resolvedUrl,
    viewport: { w: opts.w, h: opts.h },
    screenshot,
    ...(screenshotError ? { screenshotError } : {}),
    a11y,
    pass,
    timestamp,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(pass ? 0 : 1);
}

await main();
