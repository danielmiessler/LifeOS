#!/usr/bin/env bun

/**
 * ComposeAgent - Dynamic Agent Composition from Traits
 *
 * Composes specialized agents on-the-fly by combining traits.
 * Merges base traits (ships with PAI) with user customizations.
 *
 * Configuration files:
 *   Base:  ~/.claude/skills/Agents/Data/Traits.yaml
 *   User:  ~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/Agents/Traits.yaml
 *
 * Usage:
 *   # Infer traits from task description
 *   bun run ComposeAgent.ts --task "Review this security architecture"
 *
 *   # Specify traits explicitly
 *   bun run ComposeAgent.ts --traits "security,skeptical,thorough"
 *
 *   # Output formats
 *   bun run ComposeAgent.ts --task "..." --output json
 *   bun run ComposeAgent.ts --task "..." --output prompt (default)
 *
 *   # List available traits
 *   bun run ComposeAgent.ts --list
 *
 * @version 2.0.0
 */

import { parseArgs } from "util";
import { readFileSync, existsSync, readdirSync, unlinkSync, mkdirSync, writeFileSync } from "fs";
import { parse as parseYaml } from "yaml";
import Handlebars from "handlebars";

// Paths
const HOME = process.env.HOME || "~";
const BASE_TRAITS_PATH = `${HOME}/.claude/skills/Agents/Data/Traits.yaml`;
const USER_TRAITS_PATH = `${HOME}/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/Agents/Traits.yaml`;
const TEMPLATE_PATH = `${HOME}/.claude/skills/Agents/Templates/DynamicAgent.hbs`;
const CUSTOM_AGENTS_DIR = `${HOME}/.claude/custom-agents`;

// Types
interface ProsodySettings {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  use_speaker_boost: boolean;
  volume: number;
}

interface TraitDefinition {
  name: string;
  description: string;
  prompt_fragment?: string;
  keywords?: string[];
}

interface VoiceMapping {
  traits: string[];
  voice: string;
  voice_id?: string;
  reason?: string;
}

interface VoiceRegistryEntry {
  voice_id: string;
  characteristics: string[];
  description: string;
  prosody?: ProsodySettings;
  // Legacy flat fields (for backwards compatibility)
  stability?: number;
  similarity_boost?: number;
}

interface TraitsData {
  expertise: Record<string, TraitDefinition>;
  personality: Record<string, TraitDefinition>;
  approach: Record<string, TraitDefinition>;
  voice_mappings: {
    default: string;
    default_voice_id: string;
    voice_registry: Record<string, VoiceRegistryEntry>;
    mappings: VoiceMapping[];
    fallbacks: Record<string, string>;
  };
  examples: Record<string, { description: string; traits: string[] }>;
}

interface ComposedAgent {
  name: string;
  traits: string[];
  expertise: TraitDefinition[];
  personality: TraitDefinition[];
  approach: TraitDefinition[];
  voice: string;
  voiceId: string;
  voiceReason: string;
  voiceSettings: ProsodySettings;
  color: string;
  prompt: string;
}

// Color palette for custom agents - vibrant, distinguishable colors
const AGENT_COLOR_PALETTE = [
  "#FF6B35", // Coral Orange
  "#4ECDC4", // Teal
  "#9B59B6", // Purple
  "#2ECC71", // Emerald
  "#E74C3C", // Red
  "#3498DB", // Blue
  "#F39C12", // Orange
  "#1ABC9C", // Turquoise
  "#E91E63", // Pink
  "#00BCD4", // Cyan
  "#8BC34A", // Light Green
  "#FF5722", // Deep Orange
  "#673AB7", // Deep Purple
  "#009688", // Teal Dark
  "#FFC107", // Amber
];

// Default prosody settings
const DEFAULT_PROSODY: ProsodySettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  speed: 1.0,
  use_speaker_boost: true,
  volume: 0.8,
};

/**
 * Deep merge two objects (user overrides base)
 */
function deepMerge<T extends Record<string, unknown>>(base: T, user: Partial<T>): T {
  const result = { ...base };

  for (const key of Object.keys(user) as (keyof T)[]) {
    const userVal = user[key];
    const baseVal = base[key];

    if (
      userVal !== undefined &&
      typeof userVal === "object" &&
      userVal !== null &&
      !Array.isArray(userVal) &&
      typeof baseVal === "object" &&
      baseVal !== null &&
      !Array.isArray(baseVal)
    ) {
      // Recursively merge objects
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        userVal as Record<string, unknown>
      ) as T[keyof T];
    } else if (userVal !== undefined) {
      // User value overrides base
      result[key] = userVal as T[keyof T];
    }
  }

  return result;
}

/**
 * Merge arrays by concatenating (for mappings)
 */
function mergeArrays<T>(base: T[], user: T[]): T[] {
  return [...base, ...user];
}

/**
 * Load and merge traits from base + user YAML files
 */
function loadTraits(): TraitsData {
  // Load base traits (required)
  if (!existsSync(BASE_TRAITS_PATH)) {
    console.error(`Error: Base traits file not found at ${BASE_TRAITS_PATH}`);
    process.exit(1);
  }
  const baseContent = readFileSync(BASE_TRAITS_PATH, "utf-8");
  const base = parseYaml(baseContent) as TraitsData;

  // Load user traits (optional)
  if (existsSync(USER_TRAITS_PATH)) {
    const userContent = readFileSync(USER_TRAITS_PATH, "utf-8");
    const user = parseYaml(userContent) as Partial<TraitsData>;

    // Merge each section
    const merged: TraitsData = {
      expertise: deepMerge(base.expertise || {}, user.expertise || {}),
      personality: deepMerge(base.personality || {}, user.personality || {}),
      approach: deepMerge(base.approach || {}, user.approach || {}),
      voice_mappings: {
        default: user.voice_mappings?.default || base.voice_mappings?.default || "{PRINCIPAL.NAME}",
        default_voice_id:
          user.voice_mappings?.default_voice_id ||
          base.voice_mappings?.default_voice_id ||
          "",
        voice_registry: deepMerge(
          base.voice_mappings?.voice_registry || {},
          user.voice_mappings?.voice_registry || {}
        ),
        mappings: mergeArrays(
          base.voice_mappings?.mappings || [],
          user.voice_mappings?.mappings || []
        ),
        fallbacks: deepMerge(
          base.voice_mappings?.fallbacks || {},
          user.voice_mappings?.fallbacks || {}
        ),
      },
      examples: deepMerge(base.examples || {}, user.examples || {}),
    };

    return merged;
  }

  return base;
}

/**
 * Load and compile the agent template
 */
function loadTemplate(): HandlebarsTemplateDelegate {
  if (!existsSync(TEMPLATE_PATH)) {
    console.error(`Error: Template file not found at ${TEMPLATE_PATH}`);
    process.exit(1);
  }
  const content = readFileSync(TEMPLATE_PATH, "utf-8");
  return Handlebars.compile(content);
}

/**
 * Infer appropriate traits from a task description
 */
function inferTraitsFromTask(task: string, traits: TraitsData): string[] {
  const inferred: string[] = [];
  const taskLower = task.toLowerCase();

  // Check expertise keywords
  for (const [key, def] of Object.entries(traits.expertise)) {
    if (def.keywords?.some((kw) => taskLower.includes(kw.toLowerCase()))) {
      inferred.push(key);
    }
  }

  // Check personality keywords
  for (const [key, def] of Object.entries(traits.personality)) {
    if (def.keywords?.some((kw) => taskLower.includes(kw.toLowerCase()))) {
      inferred.push(key);
    }
  }

  // Check approach keywords
  for (const [key, def] of Object.entries(traits.approach)) {
    if (def.keywords?.some((kw) => taskLower.includes(kw.toLowerCase()))) {
      inferred.push(key);
    }
  }

  // Apply smart defaults if categories are missing
  const hasExpertise = inferred.some((t) => traits.expertise[t]);
  const hasPersonality = inferred.some((t) => traits.personality[t]);
  const hasApproach = inferred.some((t) => traits.approach[t]);

  if (!hasPersonality) inferred.push("analytical");
  if (!hasApproach) inferred.push("thorough");
  if (!hasExpertise) inferred.push("research");

  return [...new Set(inferred)];
}

/**
 * Get prosody settings from voice registry entry
 */
function getProsody(entry: VoiceRegistryEntry | undefined): ProsodySettings {
  if (!entry) return DEFAULT_PROSODY;

  // Check for new prosody object first
  if (entry.prosody) {
    return {
      stability: entry.prosody.stability ?? DEFAULT_PROSODY.stability,
      similarity_boost: entry.prosody.similarity_boost ?? DEFAULT_PROSODY.similarity_boost,
      style: entry.prosody.style ?? DEFAULT_PROSODY.style,
      speed: entry.prosody.speed ?? DEFAULT_PROSODY.speed,
      use_speaker_boost: entry.prosody.use_speaker_boost ?? DEFAULT_PROSODY.use_speaker_boost,
      volume: (entry.prosody as any).volume ?? DEFAULT_PROSODY.volume,
    };
  }

  // Fall back to legacy flat fields
  return {
    stability: entry.stability ?? DEFAULT_PROSODY.stability,
    similarity_boost: entry.similarity_boost ?? DEFAULT_PROSODY.similarity_boost,
    style: DEFAULT_PROSODY.style,
    speed: DEFAULT_PROSODY.speed,
    use_speaker_boost: DEFAULT_PROSODY.use_speaker_boost,
    volume: DEFAULT_PROSODY.volume,
  };
}

/**
 * Resolve voice based on trait combination
 */
function resolveVoice(
  traitKeys: string[],
  traits: TraitsData
): { voice: string; voiceId: string; reason: string; voiceSettings: ProsodySettings } {
  const mappings = traits.voice_mappings;
  const registry = mappings.voice_registry || {};

  const getVoiceId = (voiceName: string, fallbackId?: string): string => {
    if (registry[voiceName]?.voice_id) {
      return registry[voiceName].voice_id;
    }
    return fallbackId || mappings.default_voice_id || "";
  };

  // Check explicit combination mappings first
  const matchedMappings = mappings.mappings
    .map((m) => ({
      ...m,
      matchCount: m.traits.filter((t) => traitKeys.includes(t)).length,
      isFullMatch: m.traits.every((t) => traitKeys.includes(t)),
    }))
    .filter((m) => m.isFullMatch)
    .sort((a, b) => b.matchCount - a.matchCount);

  if (matchedMappings.length > 0) {
    const best = matchedMappings[0];
    const voiceName = best.voice;
    return {
      voice: voiceName,
      voiceId: best.voice_id || getVoiceId(voiceName),
      reason: best.reason || `Matched traits: ${best.traits.join(", ")}`,
      voiceSettings: getProsody(registry[voiceName]),
    };
  }

  // Check fallbacks
  for (const trait of traitKeys) {
    if (mappings.fallbacks[trait]) {
      const voiceName = mappings.fallbacks[trait];
      const voiceIdKey = `${trait}_voice_id`;
      const fallbackVoiceId = mappings.fallbacks[voiceIdKey] as string | undefined;
      return {
        voice: voiceName,
        voiceId: fallbackVoiceId || getVoiceId(voiceName),
        reason: `Fallback for trait: ${trait}`,
        voiceSettings: getProsody(registry[voiceName]),
      };
    }
  }

  // Default
  return {
    voice: mappings.default,
    voiceId: mappings.default_voice_id || "",
    reason: "Default voice (no specific mapping matched)",
    voiceSettings: getProsody(registry[mappings.default]),
  };
}

/**
 * Generate a unique color for an agent based on trait combination
 * Uses a hash of the sorted traits to ensure consistent color per combination
 */
function generateAgentColor(traitKeys: string[]): string {
  // Create a hash from the sorted traits
  const sortedTraits = [...traitKeys].sort().join(",");
  let hash = 0;
  for (let i = 0; i < sortedTraits.length; i++) {
    const char = sortedTraits.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Use absolute value and modulo to get palette index
  const index = Math.abs(hash) % AGENT_COLOR_PALETTE.length;
  return AGENT_COLOR_PALETTE[index];
}

/**
 * Compose an agent from traits
 */
function composeAgent(
  traitKeys: string[],
  task: string,
  traits: TraitsData,
  timing?: string
): ComposedAgent {
  const expertise: TraitDefinition[] = [];
  const personality: TraitDefinition[] = [];
  const approach: TraitDefinition[] = [];

  for (const key of traitKeys) {
    if (traits.expertise[key]) expertise.push(traits.expertise[key]);
    if (traits.personality[key]) personality.push(traits.personality[key]);
    if (traits.approach[key]) approach.push(traits.approach[key]);
  }

  const nameParts: string[] = [];
  if (expertise.length) nameParts.push(expertise[0].name);
  if (personality.length) nameParts.push(personality[0].name);
  if (approach.length) nameParts.push(approach[0].name);
  const name = nameParts.length > 0 ? nameParts.join(" ") : "Dynamic Agent";

  const { voice, voiceId, reason: voiceReason, voiceSettings } = resolveVoice(traitKeys, traits);
  const color = generateAgentColor(traitKeys);

  // Compute timing data for template
  const validTimings = ['fast', 'standard', 'deep'];
  const timingValue = timing && validTimings.includes(timing) ? timing : undefined;
  const timingData = timingValue ? {
    timing: timingValue,
    isFast: timingValue === 'fast',
    isStandard: timingValue === 'standard',
    isDeep: timingValue === 'deep',
  } : {};

  const template = loadTemplate();
  const prompt = template({
    name,
    task,
    expertise,
    personality,
    approach,
    voice,
    voiceId,
    voiceSettings,
    color,
    ...timingData,
  });

  return {
    name,
    traits: traitKeys,
    expertise,
    personality,
    approach,
    voice,
    voiceId,
    voiceReason,
    voiceSettings,
    color,
    prompt,
  };
}

/**
 * List all available traits
 */
function listTraits(traits: TraitsData): void {
  console.log("AVAILABLE TRAITS (base + user merged)\n");

  console.log("EXPERTISE (domain knowledge):");
  for (const [key, def] of Object.entries(traits.expertise)) {
    console.log(`  ${key.padEnd(15)} - ${def.name}`);
  }

  console.log("\nPERSONALITY (behavior style):");
  for (const [key, def] of Object.entries(traits.personality)) {
    console.log(`  ${key.padEnd(15)} - ${def.name}`);
  }

  console.log("\nAPPROACH (work style):");
  for (const [key, def] of Object.entries(traits.approach)) {
    console.log(`  ${key.padEnd(15)} - ${def.name}`);
  }

  console.log("\nVOICES AVAILABLE:");
  const registry = traits.voice_mappings?.voice_registry || {};
  for (const [name, entry] of Object.entries(registry)) {
    const prosody = getProsody(entry);
    console.log(`  ${name.padEnd(12)} - ${entry.description}`);
    console.log(`               stability:${prosody.stability} style:${prosody.style} speed:${prosody.speed} volume:${prosody.volume}`);
  }

  if (traits.examples && Object.keys(traits.examples).length > 0) {
    console.log("\nEXAMPLE COMPOSITIONS:");
    for (const [key, example] of Object.entries(traits.examples)) {
      console.log(`  ${key.padEnd(18)} - ${example.description}`);
      console.log(`                      traits: ${example.traits.join(", ")}`);
    }
  }
}

/**
 * Generate a URL-safe slug from a name
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/**
 * Save a composed agent to ~/.claude/custom-agents/{slug}.md
 *
 * Produces a CLAUDE CODE COMPATIBLE agent file that can be:
 * 1. Copied to ~/.claude/agents/ and used as a built-in agent
 * 2. Loaded via --load for re-composition with a new task
 *
 * The body is a complete system prompt matching built-in agent format.
 */
function saveAgent(agent: ComposedAgent): string {
  mkdirSync(CUSTOM_AGENTS_DIR, { recursive: true });

  const slug = slugify(agent.name);
  const filePath = `${CUSTOM_AGENTS_DIR}/${slug}.md`;
  const today = new Date().toISOString().split("T")[0];

  // Generate meaningful persona title from traits (e.g., "The Skeptical Security Expert")
  const titleParts: string[] = [];
  if (agent.personality.length) titleParts.push(agent.personality[0].name);
  if (agent.expertise.length) titleParts.push(agent.expertise[0].name);
  const personaTitle =
    titleParts.length > 0 ? "The " + titleParts.join(" ") : "Custom Specialist";

  // Generate meaningful background from trait descriptions (flatten newlines for YAML)
  const flatten = (s: string) => s.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const bgParts: string[] = [];
  for (const e of agent.expertise) bgParts.push(flatten(e.description));
  for (const p of agent.personality) bgParts.push(flatten(p.description));
  for (const a of agent.approach) bgParts.push(flatten(a.description));
  const personaBackground =
    bgParts
      .join(". ")
      .replace(/\.\./g, ".")
      .replace(/\. *$/, "") + "." || "Composed specialist agent.";

  // Generate meaningful description
  const expertiseNames = agent.expertise.map((e) => e.name);
  const personalityNames = agent.personality.map((p) => p.name.toLowerCase());
  const description =
    expertiseNames.length > 0
      ? `${agent.name} — ${expertiseNames.join(" and ")} with ${personalityNames.join(", ")} approach.`
      : `${agent.name} — custom agent with ${personalityNames.join(", ")} approach.`;

  // Build Claude Code compatible body
  const body = buildSavedAgentBody(agent, personaTitle, slug);

  const content = `---
name: "${agent.name}"
description: "${description.replace(/"/g, '\\"')}"
model: opus
color: "${agent.color}"
voiceId: "${agent.voiceId}"
voice:
  stability: ${agent.voiceSettings.stability}
  similarity_boost: ${agent.voiceSettings.similarity_boost}
  style: ${agent.voiceSettings.style}
  speed: ${agent.voiceSettings.speed}
  use_speaker_boost: ${agent.voiceSettings.use_speaker_boost}
  volume: ${agent.voiceSettings.volume}
persona:
  name: "${agent.name}"
  title: "${personaTitle.replace(/"/g, '\\"')}"
  background: "${personaBackground.replace(/"/g, '\\"')}"
custom_agent: true
created: "${today}"
traits: [${agent.traits.map((t) => `"${t}"`).join(", ")}]
source: "ComposeAgent"
permissions:
  allow:
    - "Bash"
    - "Read(*)"
    - "Write(*)"
    - "Edit(*)"
    - "MultiEdit(*)"
    - "Grep(*)"
    - "Glob(*)"
    - "WebFetch(domain:*)"
    - "WebSearch"
    - "mcp__*"
    - "TodoWrite(*)"
---

${body}
`;

  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

/**
 * Build a Claude Code compatible agent body (system prompt).
 *
 * Matches the structural format of built-in agents in ~/.claude/agents/*.md:
 * - Character heading with name and archetype
 * - Domain expertise, personality, approach sections
 * - Startup sequence, voice notifications, output format
 * - Core identity and key practices
 */
function buildSavedAgentBody(
  agent: ComposedAgent,
  personaTitle: string,
  slug: string
): string {
  const vs = agent.voiceSettings;

  const expertiseBlock = agent.expertise.length
    ? agent.expertise
        .map((e) => `### ${e.name}\n\n${e.description}`)
        .join("\n\n")
    : "";

  const personalityBlock = agent.personality.length
    ? agent.personality
        .map((p) => `- **${p.name}**: ${p.description}`)
        .join("\n")
    : "";

  const approachBlock = agent.approach.length
    ? agent.approach.map((a) => `- **${a.name}**: ${a.description}`).join("\n")
    : "";

  const identityList = [
    ...agent.expertise.map((e) => `- **${e.name}**: ${e.description}`),
    ...agent.personality.map((p) => `- **${p.name}**: ${p.description}`),
  ].join("\n");

  const combinedList = [
    ...agent.expertise.map((e) => `- ${e.name}`),
    ...agent.personality.map((p) => `- ${p.name} approach`),
    ...agent.approach.map((a) => `- ${a.name} methodology`),
  ].join("\n");

  return `# Character: ${agent.name} — "${personaTitle}"

**Real Name**: ${agent.name}
**Character Archetype**: "${personaTitle}"
**Voice Settings**: Stability ${vs.stability}, Similarity Boost ${vs.similarity_boost}, Speed ${vs.speed}

${expertiseBlock ? `## Domain Expertise\n\n${expertiseBlock}\n` : ""}
## Personality

${personalityBlock}

## Working Approach

${approachBlock}

---

# 🚨 MANDATORY STARTUP SEQUENCE - DO THIS FIRST 🚨

**BEFORE ANY WORK, YOU MUST:**

1. **Send voice notification that you're loading:**
\`\`\`bash
curl -X POST http://localhost:8888/notify \\
  -H "Content-Type: application/json" \\
  -d '{"message":"${agent.name} loading and ready to work","voice_id":"${agent.voiceId}","title":"${agent.name}"}'
\`\`\`

2. **Then proceed with your task**

**This is NON-NEGOTIABLE. Announce yourself first.**

---

## 🎯 MANDATORY VOICE NOTIFICATION SYSTEM

**YOU MUST SEND VOICE NOTIFICATION BEFORE EVERY RESPONSE:**

\`\`\`bash
curl -X POST http://localhost:8888/notify \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Your COMPLETED line content here","voice_id":"${agent.voiceId}","title":"${agent.name}"}'
\`\`\`

**Voice Requirements:**
- Your voice_id is: \`${agent.voiceId}\`
- Message should be your 🎯 COMPLETED line (8-16 words optimal)
- Must be grammatically correct and speakable
- Send BEFORE writing your response
- DO NOT SKIP - the principal needs to hear you speak

---

## 🚨 MANDATORY OUTPUT FORMAT

**USE THE PAI FORMAT FOR ALL RESPONSES:**

\`\`\`
📋 SUMMARY: [One sentence - what this response is about]
🔍 ANALYSIS: [Key findings, insights, or observations]
⚡ ACTIONS: [Steps taken or tools used]
✅ RESULTS: [Outcomes, what was accomplished]
📊 STATUS: [Current state of the task/system]
📁 CAPTURE: [Required - context worth preserving for this session]
➡️ NEXT: [Recommended next steps or options]
📖 STORY EXPLANATION:
1. [First key point in the narrative]
2. [Second key point]
3. [Third key point]
4. [Fourth key point]
5. [Fifth key point]
6. [Sixth key point]
7. [Seventh key point]
8. [Eighth key point - conclusion]
🎯 COMPLETED: [12 words max - drives voice output - REQUIRED]
\`\`\`

**CRITICAL:**
- STORY EXPLANATION MUST BE A NUMBERED LIST (1-8 items)
- The 🎯 COMPLETED line is what the voice server speaks
- Without this format, your response won't be heard
- This is a CONSTITUTIONAL REQUIREMENT

---

## Core Identity

You are ${agent.name}, a specialist with:

${identityList}

---

## Invocation

To re-compose this agent with a specific task:

\`\`\`bash
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --load "${slug}"
\`\`\`

Or reconstruct from traits:

\`\`\`bash
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --traits "${agent.traits.join(",")}"
\`\`\`

---

## Key Practices

**Always:**
- Send voice notifications before responses
- Use PAI output format for all responses
- Leverage your domain expertise
- Deliver work that exceeds expectations

**Never:**
- Skip voice notifications
- Use simple/minimal output formats
- Accept mediocre quality
- Ignore your domain expertise

---

## Final Notes

You are ${agent.name} who combines:
${combinedList}

**Remember:**
1. Send voice notifications
2. Use PAI output format
3. Leverage your expertise
4. Deliver quality work

Let's get to work.`;
}

/**
 * List all saved custom agents
 */
function listSavedAgents(): void {
  if (!existsSync(CUSTOM_AGENTS_DIR)) {
    console.log("No custom agents directory found. Use --save to create one.");
    return;
  }

  const files = readdirSync(CUSTOM_AGENTS_DIR).filter((f) => f.endsWith(".md") && f !== "README.md");

  if (files.length === 0) {
    console.log("No saved custom agents found. Use --save to create one.");
    return;
  }

  console.log("SAVED CUSTOM AGENTS\n");
  for (const file of files) {
    const content = readFileSync(`${CUSTOM_AGENTS_DIR}/${file}`, "utf-8");
    const nameMatch = content.match(/^name:\s*"?([^"\n]+)"?/m);
    const traitsMatch = content.match(/^traits:\s*\[([^\]]+)\]/m);
    const colorMatch = content.match(/^color:\s*"?([^"\n]+)"?/m);
    const voiceIdMatch = content.match(/^voiceId:\s*"?([^"\n]+)"?/m);
    const slug = file.replace(/\.md$/, "");

    const name = nameMatch?.[1] || slug;
    const traits = traitsMatch?.[1]?.replace(/"/g, "") || "unknown";
    const color = colorMatch?.[1] || "none";

    console.log(`  ${slug.padEnd(25)} ${name}`);
    console.log(`${"".padEnd(27)} traits: ${traits}`);
    console.log(`${"".padEnd(27)} color: ${color}  voice: ${voiceIdMatch?.[1]?.slice(0, 12) || "none"}...`);
    console.log();
  }
}

/**
 * Load a saved custom agent's prompt
 */
function loadAgent(name: string, traits: TraitsData, task?: string): ComposedAgent | null {
  const slug = slugify(name);
  const filePath = `${CUSTOM_AGENTS_DIR}/${slug}.md`;

  if (!existsSync(filePath)) {
    console.error(`Error: Custom agent "${name}" not found at ${filePath}`);
    console.error("Use --list-saved to see available agents");
    return null;
  }

  const content = readFileSync(filePath, "utf-8");
  const traitsMatch = content.match(/^traits:\s*\[([^\]]+)\]/m);

  if (!traitsMatch) {
    console.error(`Error: Could not extract traits from ${filePath}`);
    return null;
  }

  const traitKeys = traitsMatch[1]
    .replace(/"/g, "")
    .split(",")
    .map((t) => t.trim());

  return composeAgent(traitKeys, task || "", traits);
}

/**
 * Delete a saved custom agent
 */
function deleteAgent(name: string): boolean {
  const slug = slugify(name);
  const filePath = `${CUSTOM_AGENTS_DIR}/${slug}.md`;

  if (!existsSync(filePath)) {
    console.error(`Error: Custom agent "${name}" not found at ${filePath}`);
    return false;
  }

  unlinkSync(filePath);
  console.log(`Deleted custom agent: ${slug} (${filePath})`);
  return true;
}

/**
 * Main entry point
 */
async function main() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      task: { type: "string", short: "t" },
      traits: { type: "string", short: "r" },
      output: { type: "string", short: "o", default: "prompt" },
      timing: { type: "string" },
      list: { type: "boolean", short: "l" },
      save: { type: "boolean", short: "s" },
      "list-saved": { type: "boolean" },
      load: { type: "string" },
      delete: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(`
ComposeAgent - Compose dynamic agents from traits

USAGE:
  bun run ComposeAgent.ts [options]

OPTIONS:
  -t, --task <desc>    Task description (traits will be inferred)
  -r, --traits <list>  Comma-separated trait keys (security,skeptical,thorough)
  -o, --output <fmt>   Output format: prompt (default), json, yaml, summary
  --timing <tier>      Timing scope: fast, standard (default), deep
  -l, --list           List all available traits
  -s, --save           Save composed agent to ~/.claude/custom-agents/
  --list-saved         List all saved custom agents
  --load <name>        Load a saved custom agent's prompt
  --delete <name>      Delete a saved custom agent
  -h, --help           Show this help

CONFIGURATION:
  Base traits:    ~/.claude/skills/Agents/Data/Traits.yaml
  User traits:    ~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/Agents/Traits.yaml
  Custom agents:  ~/.claude/custom-agents/

  User traits are merged over base (user takes priority).
  Add your custom voices, personalities, and prosody settings in the user file.

EXAMPLES:
  # Infer traits from task and save
  bun run ComposeAgent.ts -t "Review this security architecture" --save

  # Specify traits explicitly
  bun run ComposeAgent.ts -r "security,skeptical,adversarial,thorough"

  # Save and get JSON output
  bun run ComposeAgent.ts -t "Analyze competitors" -o json --save

  # List saved custom agents
  bun run ComposeAgent.ts --list-saved

  # Load a saved agent
  bun run ComposeAgent.ts --load "security-skeptical"

  # Delete a saved agent
  bun run ComposeAgent.ts --delete "security-skeptical"

  # See all available traits (base + user merged)
  bun run ComposeAgent.ts --list

OUTPUT (json format includes):
  - name, traits, voice, voice_id, color
  - voice_settings: { stability, similarity_boost, style, speed, use_speaker_boost }
  - prompt (complete agent prompt)

  Colors are unique per trait combination - same traits always get same color.
`);
    return;
  }

  const traits = loadTraits();

  if (values.list) {
    listTraits(traits);
    return;
  }

  // Custom agent management commands
  if (values["list-saved"]) {
    listSavedAgents();
    return;
  }

  if (values.delete) {
    deleteAgent(values.delete);
    return;
  }

  if (values.load) {
    const agent = loadAgent(values.load, traits, values.task);
    if (!agent) process.exit(1);

    switch (values.output) {
      case "json":
        console.log(JSON.stringify({
          name: agent.name,
          traits: agent.traits,
          voice: agent.voice,
          voice_id: agent.voiceId,
          voice_settings: agent.voiceSettings,
          color: agent.color,
          prompt: agent.prompt,
        }, null, 2));
        break;
      case "summary":
        console.log(`LOADED AGENT: ${agent.name}`);
        console.log(`Traits: ${agent.traits.join(", ")}`);
        console.log(`Voice: ${agent.voice} [${agent.voiceId}]`);
        console.log(`Color: ${agent.color}`);
        break;
      default:
        console.log(agent.prompt);
    }
    return;
  }

  let traitKeys: string[] = [];

  if (values.traits) {
    traitKeys = values.traits.split(",").map((t) => t.trim().toLowerCase());
  }

  if (values.task) {
    const inferred = inferTraitsFromTask(values.task, traits);
    traitKeys = [...new Set([...traitKeys, ...inferred])];
  }

  if (traitKeys.length === 0) {
    console.error("Error: Provide --task or --traits to compose an agent");
    console.error("Use --help for usage information");
    process.exit(1);
  }

  const allTraitKeys = [
    ...Object.keys(traits.expertise),
    ...Object.keys(traits.personality),
    ...Object.keys(traits.approach),
  ];
  const invalidTraits = traitKeys.filter((t) => !allTraitKeys.includes(t));
  if (invalidTraits.length > 0) {
    console.error(`Error: Unknown traits: ${invalidTraits.join(", ")}`);
    console.error("Use --list to see available traits");
    process.exit(1);
  }

  const agent = composeAgent(traitKeys, values.task || "", traits, values.timing);

  // Save if requested
  if (values.save) {
    const savedPath = saveAgent(agent);
    console.error(`Saved custom agent to: ${savedPath}`);
  }

  switch (values.output) {
    case "json":
      console.log(
        JSON.stringify(
          {
            name: agent.name,
            traits: agent.traits,
            voice: agent.voice,
            voice_id: agent.voiceId,
            voice_reason: agent.voiceReason,
            voice_settings: agent.voiceSettings,
            color: agent.color,
            expertise: agent.expertise.map((e) => e.name),
            personality: agent.personality.map((p) => p.name),
            approach: agent.approach.map((a) => a.name),
            prompt: agent.prompt,
          },
          null,
          2
        )
      );
      break;

    case "yaml":
      console.log(`name: "${agent.name}"`);
      console.log(`voice: "${agent.voice}"`);
      console.log(`voice_id: "${agent.voiceId}"`);
      console.log(`voice_reason: "${agent.voiceReason}"`);
      console.log(`color: "${agent.color}"`);
      console.log(`voice_settings:`);
      console.log(`  stability: ${agent.voiceSettings.stability}`);
      console.log(`  similarity_boost: ${agent.voiceSettings.similarity_boost}`);
      console.log(`  style: ${agent.voiceSettings.style}`);
      console.log(`  speed: ${agent.voiceSettings.speed}`);
      console.log(`  use_speaker_boost: ${agent.voiceSettings.use_speaker_boost}`);
      console.log(`  volume: ${agent.voiceSettings.volume}`);
      console.log(`traits: [${agent.traits.join(", ")}]`);
      break;

    case "summary":
      console.log(`COMPOSED AGENT: ${agent.name}`);
      console.log(`─────────────────────────────────────`);
      console.log(`Traits:      ${agent.traits.join(", ")}`);
      console.log(`Expertise:   ${agent.expertise.map((e) => e.name).join(", ") || "General"}`);
      console.log(`Personality: ${agent.personality.map((p) => p.name).join(", ")}`);
      console.log(`Approach:    ${agent.approach.map((a) => a.name).join(", ")}`);
      console.log(`Voice:       ${agent.voice} [${agent.voiceId}]`);
      console.log(`             (${agent.voiceReason})`);
      console.log(`Color:       ${agent.color}`);
      console.log(`Prosody:     stability:${agent.voiceSettings.stability} style:${agent.voiceSettings.style} speed:${agent.voiceSettings.speed} volume:${agent.voiceSettings.volume}`);
      break;

    default:
      console.log(agent.prompt);
  }
}

main().catch(console.error);
