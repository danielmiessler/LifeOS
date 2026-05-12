#!/usr/bin/env bun

/**
 * GeneratePaiState — reads DIMENSIONS.md and writes PAI_STATE.json.
 *
 * PAI_STATE.json is read by statusline-command.sh to populate the STATE meter.
 * Run this any time DIMENSIONS.md is updated (cur/velo values change).
 *
 * Usage:
 *   bun GeneratePaiState.ts          Write PAI_STATE.json, print summary
 *   bun GeneratePaiState.ts --dry    Print JSON to stdout, do not write
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const HOME = process.env.HOME || "";
const PAI_DIR = process.env.PAI_DIR || join(HOME, ".claude", "PAI");
const DIMENSIONS_MD = join(PAI_DIR, "USER", "TELOS", "DIMENSIONS.md");
const OUT_FILE = join(PAI_DIR, "USER", "TELOS", "PAI_STATE.json");

type DimensionEntry = {
  pct: number;
  cur: number;
  ideal: number;
  velo: number;
};

function parseDimensions(src: string): Record<string, DimensionEntry> {
  const result: Record<string, DimensionEntry> = {};
  for (const line of src.split("\n")) {
    // Format: - id | Label | cur | ideal | velo | color
    const m = line.match(/^-\s+(\S+)\s*\|\s*[^|]+\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
    if (!m) continue;
    const [, id, cur, ideal, velo] = m;
    const c = parseFloat(cur);
    const t = parseFloat(ideal);
    result[id] = {
      pct: t > 0 ? Math.round((c / t) * 100) : 0,
      cur: c,
      ideal: t,
      velo: parseFloat(velo),
    };
  }
  return result;
}

function main(): void {
  const dry = process.argv.includes("--dry");

  if (!existsSync(DIMENSIONS_MD)) {
    console.error(`DIMENSIONS.md not found: ${DIMENSIONS_MD}`);
    process.exit(1);
  }

  const src = readFileSync(DIMENSIONS_MD, "utf-8");
  const dimensions = parseDimensions(src);

  if (Object.keys(dimensions).length === 0) {
    console.error("No dimension rows parsed from DIMENSIONS.md");
    process.exit(1);
  }

  const payload = {
    generated: new Date().toISOString(),
    source: "DIMENSIONS.md",
    dimensions,
  };

  const json = JSON.stringify(payload, null, 2);

  if (dry) {
    console.log(json);
    return;
  }

  writeFileSync(OUT_FILE, json, "utf-8");
  console.log(`Wrote ${OUT_FILE}`);
  for (const [id, d] of Object.entries(dimensions)) {
    console.log(`  ${id.padEnd(14)} ${d.cur}/${d.ideal} = ${d.pct}%`);
  }
}

main();
