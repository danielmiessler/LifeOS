#!/usr/bin/env bun
/**
 * DoctrineReplay — sampled doctrine-coverage replay over archived ISAs.
 *
 * The regression corpus the Algorithm never had: 80+ doctrine versions shipped
 * with no way to check a rewrite against real past work. This tool does the
 * SAMPLING half deterministically: stratified pick of N archived ISAs across
 * tier × domain × month, biased to completed runs with real criteria counts.
 * The EVALUATION half is judgment work — delegates read each sampled ISA plus
 * the candidate doctrine and report lost teeth (v7's 3-task version of this
 * caught 4 real gaps pre-flip; this scales that move).
 *
 * NOT behavioral re-runs: archived ISAs are mutations of a live system
 * (deploys, env state) and cannot be re-executed. Coverage replay asks
 * "would every tooth that governed this run still exist and fire under the
 * new doctrine?" — that question is answerable from the artifacts alone.
 *
 * Usage:
 *   bun DoctrineReplay.ts sample [--n 24] [--out <path>]   # emit manifest JSON
 *   bun DoctrineReplay.ts sample --json                    # manifest to stdout only
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { claudeDir } from "./lifeos-root";

const WORK_DIR = join(claudeDir(), "LIFEOS/MEMORY/WORK");

type IsaMeta = {
  slug: string;
  path: string;
  effort: string;
  phase: string;
  started: string;
  month: string;
  task: string;
  iscCount: number;
  antiCount: number;
  domain: string;
  bytes: number;
};

const DOMAIN_RULES: Array<[string, RegExp]> = [
  ["core-system", /\b(hook|algorithm|router|system prompt|doctrine|isa (format|skill|system)|classifier|claude\.md|bpe|memory system)\b/i],
  ["web-deploy", /\b(site|website|deploy|cloudflare|worker|pages|astro|hono|domain|dns|wrangler)\b/i],
  ["experiential", /\b(art|design|logo|wallpaper|thumbnail|song|music|story|essay|blog|post|video|image)\b/i],
  ["ops-infra", /\b(network|unifi|camera|backup|launchd|service|install|mac mini|ssh|server|credential|token|rotate)\b/i],
  ["data-research", /\b(research|analy|audit|investigat|report|scan|metrics|stats|data)\b/i],
];

function classifyDomain(text: string): string {
  for (const [name, re] of DOMAIN_RULES) if (re.test(text)) return name;
  return "other";
}

function fm(body: string, key: string): string {
  const m = body.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?`, "m"));
  return m ? m[1].trim() : "";
}

function collect(): IsaMeta[] {
  const out: IsaMeta[] = [];
  for (const dir of readdirSync(WORK_DIR)) {
    const p = join(WORK_DIR, dir, "ISA.md");
    try {
      const st = statSync(p);
      const body = readFileSync(p, "utf8");
      const iscCount = (body.match(/^- \[[ x]\] ISC-/gm) || []).length;
      const antiCount = (body.match(/^- \[[ x]\] Anti-/gm) || []).length;
      const started = fm(body, "started") || st.mtime.toISOString();
      out.push({
        slug: dir,
        path: p,
        effort: fm(body, "effort") || "?",
        phase: fm(body, "phase") || "?",
        started,
        month: started.slice(0, 7),
        task: fm(body, "task"),
        iscCount,
        antiCount,
        domain: classifyDomain(dir + " " + fm(body, "task")),
        bytes: st.size,
      });
    } catch { /* no ISA.md in this dir */ }
  }
  return out;
}

// Deterministic stratified sample: round-robin across (tier, domain) cells,
// newest-first within each cell, months spread by construction. No RNG — the
// same corpus always yields the same manifest (replay runs are comparable).
function sample(all: IsaMeta[], n: number): IsaMeta[] {
  const eligible = all
    .filter((i) => i.iscCount >= 4 && i.phase !== "?" && i.effort !== "?")
    .sort((a, b) => b.started.localeCompare(a.started));
  const cells = new Map<string, IsaMeta[]>();
  for (const i of eligible) {
    const key = `${i.effort}|${i.domain}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(i);
  }
  // Order cells rarest-tier-first so E1/E5 survive the cut; then round-robin.
  const ordered = [...cells.entries()].sort((a, b) => a[1].length - b[1].length);
  const picked: IsaMeta[] = [];
  const seenMonthCell = new Set<string>();
  let round = 0;
  while (picked.length < n && round < 50) {
    let took = false;
    for (const [key, items] of ordered) {
      if (picked.length >= n) break;
      // Within a cell, prefer an item from a month this cell hasn't contributed yet.
      const next =
        items.find((i) => !picked.includes(i) && !seenMonthCell.has(`${key}|${i.month}`)) ||
        items.find((i) => !picked.includes(i));
      if (next) {
        picked.push(next);
        seenMonthCell.add(`${key}|${next.month}`);
        took = true;
      }
    }
    if (!took) break;
    round++;
  }
  return picked;
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "sample") {
    console.error("Usage: bun DoctrineReplay.ts sample [--n 24] [--out <path>] [--json]");
    process.exit(2);
  }
  const nIdx = args.indexOf("--n");
  const n = nIdx >= 0 ? parseInt(args[nIdx + 1], 10) : 24;
  const outIdx = args.indexOf("--out");

  const all = collect();
  const picked = sample(all, n);
  const manifest = {
    corpusSize: all.length,
    eligible: all.filter((i) => i.iscCount >= 4 && i.phase !== "?" && i.effort !== "?").length,
    sampled: picked.length,
    byTier: Object.fromEntries([...new Set(picked.map((i) => i.effort))].map((t) => [t, picked.filter((i) => i.effort === t).length])),
    byDomain: Object.fromEntries([...new Set(picked.map((i) => i.domain))].map((d) => [d, picked.filter((i) => i.domain === d).length])),
    byMonth: Object.fromEntries([...new Set(picked.map((i) => i.month))].sort().map((m) => [m, picked.filter((i) => i.month === m).length])),
    isas: picked.map(({ path: _p, ...rest }) => ({ ...rest, path: _p })),
  };

  const json = JSON.stringify(manifest, null, 2);
  if (outIdx >= 0) {
    writeFileSync(args[outIdx + 1], json, "utf8");
    console.log(`manifest → ${args[outIdx + 1]} (${picked.length}/${n} sampled from ${all.length})`);
  }
  if (args.includes("--json") || outIdx < 0) console.log(json);
}

main();
