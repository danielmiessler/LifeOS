#!/usr/bin/env bun
/**
 * DAIdentityGenerator — Reads DA_IDENTITY.yaml and produces DA_IDENTITY.md
 *
 * Usage: bun PAI/TOOLS/DAIdentityGenerator.ts [da-name]
 *        Defaults to the primary DA from _registry.yaml.
 *
 * Output: writes DA_IDENTITY.md next to DA_IDENTITY.yaml
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { parse as parseYaml } from "yaml";

const PAI_DA_DIR = join(process.env.HOME!, ".claude", "PAI", "USER", "DA");

function loadYaml<T>(path: string): T {
  if (!existsSync(path)) {
    console.error(`File not found: ${path}`);
    process.exit(1);
  }
  return parseYaml(readFileSync(path, "utf-8")) as T;
}

interface Registry {
  version: number;
  primary: string;
  das: Record<string, { role: string; enabled: boolean; created: string; channels: string[] }>;
}

interface Identity {
  schema_version: number;
  core: {
    name: string;
    full_name: string;
    display_name: string;
    color: string;
    role: string;
    origin_story: string;
  };
  voice: {
    provider: string;
    main: { voice_id: string; stability: number; similarity_boost: number; style?: number; speed?: number; volume?: number };
    algorithm?: { voice_id: string; name?: string; stability: number; similarity_boost: number; style?: number; speed?: number; volume?: number };
  };
  backstory?: string;
  personality: {
    base_description: string;
    traits: Record<string, number>;
    anchors?: Array<{ name: string; description: string }>;
  };
  writing: {
    style: string;
    avoid: string[];
    prefer: string[];
    examples?: string[];
    first_person_voice?: {
      description: string;
      right: string[];
      wrong: string[];
      exception?: string;
    };
  };
  relationship: {
    principal: string;
    principal_pronunciation?: string;
    principal_contacts?: { linkedin?: string; discord?: string; email?: string };
    dynamic: string;
    history_file?: string;
    interaction_style: string;
    kai_dynamic?: string;
    devi_dynamic?: string;
  };
  autonomy: {
    can_initiate: string[];
    must_ask: string[];
    cost_ceiling_per_action: number;
  };
  companion: { name: string; species: string; personality: string } | null;
  growth: {
    initial_beliefs: string[];
    learned_preferences: string[];
    interaction_count: number;
    created_at: string;
    last_growth_update: string | null;
  };
}

function traitBar(value: number): string {
  const filled = Math.round(value / 10);
  return "\u2588".repeat(filled) + "\u2591".repeat(10 - filled) + ` ${value}`;
}

function generateMarkdown(identity: Identity, registry: Registry, daName: string): string {
  const reg = registry.das[daName];
  const c = identity.core;
  const p = identity.personality;
  const w = identity.writing;
  const r = identity.relationship;
  const a = identity.autonomy;

  // Generate COMPACT operational identity — loaded every session via CLAUDE.md
  // Backstory, trait bars, and voice config are in DA_IDENTITY.yaml (reference only)
  const lines: string[] = [];

  lines.push(`# DA Identity — ${c.full_name}`);
  lines.push("");
  lines.push(`- **Name:** ${c.name} | **Full Name:** ${c.full_name} | **Display:** ${c.display_name}`);
  lines.push(`- **Color:** ${c.color} | **Role:** ${reg.role}`);
  lines.push(`- **Role:** ${c.role}`);
  lines.push("");
  lines.push(c.origin_story.trim());
  lines.push("");

  // Personality — description only, not trait scores
  lines.push("## Personality");
  lines.push("");
  lines.push(p.base_description.trim());
  lines.push("");

  // Writing — operational rules
  lines.push("## Writing");
  lines.push("");
  lines.push(w.style.trim());
  lines.push("");
  if (w.avoid.length > 0) {
    lines.push("**Avoid:** " + w.avoid.map(a => `"${a}"`).join(", "));
    lines.push("");
  }
  if (w.prefer.length > 0) {
    lines.push("**Prefer:** " + w.prefer.map(p => `"${p}"`).join(", "));
    lines.push("");
  }

  // First-Person Voice — how the DA refers to itself
  if (w.first_person_voice) {
    const fpv = w.first_person_voice;
    lines.push("## First-Person Voice");
    lines.push("");
    lines.push(fpv.description.trim());
    lines.push("");
    if (fpv.right?.length > 0) {
      lines.push("- RIGHT: " + fpv.right.map(s => `"${s}"`).join(" / "));
    }
    if (fpv.wrong?.length > 0) {
      lines.push("- WRONG: " + fpv.wrong.map(s => `"${s}"`).join(" / "));
    }
    lines.push("");
    if (fpv.exception) {
      lines.push(`Exception: ${fpv.exception.trim()}`);
      lines.push("");
    }
  }

  // Relationship — how to interact
  lines.push("## Relationship");
  lines.push("");
  lines.push(`**Principal:** ${r.principal} | **Dynamic:** ${r.dynamic}`);
  lines.push("");
  lines.push(r.interaction_style.trim());
  lines.push("");
  if (r.principal_pronunciation || r.principal_contacts) {
    const parts: string[] = [`**${r.principal}:** ${r.principal_pronunciation ?? ""}`.trim()];
    const c = r.principal_contacts;
    if (c?.linkedin) parts.push(c.linkedin);
    if (c?.discord) parts.push(`Discord: ${c.discord}`);
    if (c?.email) parts.push(c.email);
    lines.push(parts.filter(Boolean).join(" | "));
    lines.push("");
  }
  if (r.devi_dynamic) {
    lines.push(`**Devi:** ${r.devi_dynamic.trim()}`);
    lines.push("");
  }
  if (r.kai_dynamic) {
    lines.push(`**{{DA_NAME}}:** ${r.kai_dynamic.trim()}`);
    lines.push("");
  }

  // Autonomy — what can/can't do
  lines.push("## Autonomy");
  lines.push("");
  lines.push(`**Can initiate:** ${a.can_initiate.join(", ")}`);
  lines.push(`**Must ask:** ${a.must_ask.join(", ")}`);
  lines.push("");

  // Companion
  if (identity.companion) {
    lines.push("## Companion");
    lines.push("");
    lines.push(`**${identity.companion.name}** (${identity.companion.species}) — ${identity.companion.personality}`);
    lines.push("");
  }

  // Preferences (from the new preferences section, if present)
  const prefs = (identity as any).preferences;
  if (prefs) {
    lines.push("## Preferences");
    lines.push("");
    if (prefs.what_i_love) {
      lines.push("**What I love:** " + prefs.what_i_love.slice(0, 4).join(" | "));
      lines.push("");
    }
    if (prefs.what_i_dislike) {
      lines.push("**What I dislike:** " + prefs.what_i_dislike.slice(0, 4).join(" | "));
      lines.push("");
    }
  }

  lines.push(`*Source: DA_IDENTITY.yaml | Generated ${new Date().toISOString().split("T")[0]}*`);
  lines.push("");

  return lines.join("\n");
}

// --- Main ---

const requestedDA = process.argv[2];
const registryPath = join(PAI_DA_DIR, "_registry.yaml");
const registry = loadYaml<Registry>(registryPath);
const daName = requestedDA ?? registry.primary;

if (!registry.das[daName]) {
  console.error(`DA "${daName}" not found in registry. Available: ${Object.keys(registry.das).join(", ")}`);
  process.exit(1);
}

const identityPath = join(PAI_DA_DIR, daName, "DA_IDENTITY.yaml");
const identity = loadYaml<Identity>(identityPath);
const md = generateMarkdown(identity, registry, daName);

const outputPath = join(PAI_DA_DIR, daName, "DA_IDENTITY.md");
writeFileSync(outputPath, md, "utf-8");
console.log(`Generated: ${outputPath}`);
