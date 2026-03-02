#!/usr/bin/env bun

/**
 * BuildCLAUDE.ts — Generate CLAUDE.md from template + settings
 *
 * Reads CLAUDE.md.template, resolves variables from settings.json
 * and PAI/Algorithm/LATEST, writes CLAUDE.md.
 *
 * Called by:
 *   - PAI installer (first install)
 *   - SessionStart hook (keeps fresh automatically)
 *   - Manual: bun PAI/Tools/BuildCLAUDE.ts
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const PAI_DIR = join(process.env.HOME!, ".claude");
const TEMPLATE_PATH = join(PAI_DIR, "CLAUDE.md.template");
const OUTPUT_PATH = join(PAI_DIR, "CLAUDE.md");
const SETTINGS_PATH = join(PAI_DIR, "settings.json");
const ALGORITHM_DIR = join(PAI_DIR, "PAI/Algorithm");
const LATEST_PATH = join(ALGORITHM_DIR, "LATEST");

// ─── Load current algorithm version ───

function getAlgorithmVersion(): string {
  if (!existsSync(LATEST_PATH)) {
    console.error("⚠ PAI/Algorithm/LATEST not found, defaulting to v3.5.0");
    return "v3.5.0";
  }
  return readFileSync(LATEST_PATH, "utf-8").trim();
}

// ─── Load variables from settings.json ───

function loadVariables(): Record<string, string> {
  const settings = existsSync(SETTINGS_PATH)
    ? JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"))
    : {};

  const algoVersion = getAlgorithmVersion();

  return {
    "{DAIDENTITY.NAME}": settings.daidentity?.name || "Assistant",
    "{DAIDENTITY.FULLNAME}": settings.daidentity?.fullName || "Assistant",
    "{DAIDENTITY.DISPLAYNAME}": settings.daidentity?.displayName || "Assistant",
    "{PRINCIPAL.NAME}": settings.principal?.name || "User",
    "{PRINCIPAL.TIMEZONE}": settings.principal?.timezone || "UTC",
    "{{PAI_VERSION}}": settings.pai?.version || "4.0.0",
    "{{ALGO_VERSION}}": algoVersion,
    "{{ALGO_PATH}}": `PAI/Algorithm/${algoVersion}.md`,
  };
}

// ─── Check if rebuild is needed ───

export function needsRebuild(): boolean {
  if (!existsSync(OUTPUT_PATH)) return true;
  if (!existsSync(TEMPLATE_PATH)) return false; // no template = nothing to build

  const outputContent = readFileSync(OUTPUT_PATH, "utf-8");
  const variables = loadVariables();

  // Check if any template variable appears unresolved in output
  for (const key of Object.keys(variables)) {
    if (outputContent.includes(key)) return true;
  }

  // Check if algorithm version in output matches LATEST
  const algoVersion = getAlgorithmVersion();
  const algoPathPattern = /PAI\/Algorithm\/(.+?)\.md/;
  const match = outputContent.match(algoPathPattern);
  if (match && match[1] !== algoVersion) return true;

  // Check if DA name matches settings
  const settings = existsSync(SETTINGS_PATH)
    ? JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"))
    : {};
  const daName = settings.daidentity?.name || "Assistant";
  if (!outputContent.includes(`🗣️ ${daName}:`)) return true;

  return false;
}

// ─── Build ───

export function build(): { rebuilt: boolean; reason?: string } {
  if (!existsSync(TEMPLATE_PATH)) {
    return { rebuilt: false, reason: "No CLAUDE.md.template found" };
  }

  let content = readFileSync(TEMPLATE_PATH, "utf-8");
  const variables = loadVariables();

  for (const [key, value] of Object.entries(variables)) {
    content = content.replaceAll(key, value);
  }

  // Check if output already matches
  if (existsSync(OUTPUT_PATH)) {
    const existing = readFileSync(OUTPUT_PATH, "utf-8");
    if (existing === content) {
      return { rebuilt: false, reason: "CLAUDE.md already current" };
    }
  }

  writeFileSync(OUTPUT_PATH, content);
  return { rebuilt: true };
}

// ─── CLI entry point ───

if (import.meta.main) {
  const result = build();
  if (result.rebuilt) {
    const vars = loadVariables();
    console.log("✅ Built CLAUDE.md from template");
    console.log(`   Algorithm: ${vars["{{ALGO_VERSION}}"]}`);
    console.log(`   DA: ${vars["{DAIDENTITY.NAME}"]}`);
    console.log(`   Principal: ${vars["{PRINCIPAL.NAME}"]}`);
  } else {
    console.log(`ℹ ${result.reason}`);
  }
}
