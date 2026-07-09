#!/usr/bin/env bun
/**
 * SkillSurface — UserPromptSubmit hook for deterministic skill hints.
 *
 * Builds a cached index from skill description files, then scores the
 * current prompt against USE WHEN trigger phrases. Warm-path verification on
 * 2026-06-10 measured 22ms with an existing cache.
 *
 * Failure mode: any error logs to stderr and exits 0, never blocking prompts.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


interface HookInput {
  prompt?: string;
  user_prompt?: string;
}

interface SkillEntry {
  name: string;
  triggers: string[];
}

interface SkillIndex {
  schema_version: 1;
  built_at_ms: number;
  max_src_mtime_ms: number;
  skills: SkillEntry[];
}

interface SkillSource {
  dirName: string;
  path: string;
  mtimeMs: number;
}

interface ScoredSkill {
  name: string;
  score: number;
  distinctHits: number;
}

const STDIN_TIMEOUT_MS = 300;
const MAX_SKILLS_TO_EMIT = 3;
const MIN_DISTINCT_TRIGGER_TOKEN_HITS = 2;
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(process.env.HOME || "", ".claude", "LIFEOS");
const SKILLS_DIR = join(process.env.HOME || "", ".claude", "skills");
const CACHE_PATH = join(LIFEOS_DIR, "MEMORY", "STATE", "skill-index.json");

async function readStdinWithTimeout(timeoutMs: number = STDIN_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    const timer = setTimeout(() => resolve(data), timeoutMs);
    process.stdin.on("data", (chunk: Buffer) => {
      data += chunk.toString();
    });
    process.stdin.on("end", () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function parseHookInput(raw: string): HookInput {
  try {
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const record = parsed as Record<string, unknown>;
    return {
      prompt: typeof record.prompt === "string" ? record.prompt : undefined,
      user_prompt: typeof record.user_prompt === "string" ? record.user_prompt : undefined,
    };
  } catch {
    return {};
  }
}

function listSkillSources(): SkillSource[] {
  try {
    if (!existsSync(SKILLS_DIR)) return [];
    return readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const path = join(SKILLS_DIR, entry.name, "SKILL.md");
        try {
          return existsSync(path)
            ? { dirName: entry.name, path, mtimeMs: statSync(path).mtimeMs }
            : null;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is SkillSource => entry !== null);
  } catch {
    return [];
  }
}

function loadIndex(): SkillIndex | null {
  try {
    if (!existsSync(CACHE_PATH)) return null;
    const parsed = JSON.parse(readFileSync(CACHE_PATH, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const raw = parsed as Record<string, unknown>;
    if (raw.schema_version !== 1) return null;
    if (typeof raw.built_at_ms !== "number") return null;
    if (typeof raw.max_src_mtime_ms !== "number") return null;
    if (!Array.isArray(raw.skills)) return null;
    const skills = raw.skills
      .map((skill) => {
        if (!skill || typeof skill !== "object") return null;
        const record = skill as Record<string, unknown>;
        if (typeof record.name !== "string" || !Array.isArray(record.triggers)) return null;
        return {
          name: record.name,
          triggers: record.triggers.filter((trigger): trigger is string => typeof trigger === "string"),
        };
      })
      .filter((skill): skill is SkillEntry => skill !== null);
    return { schema_version: 1, built_at_ms: raw.built_at_ms, max_src_mtime_ms: raw.max_src_mtime_ms, skills };
  } catch {
    return null;
  }
}

function saveIndex(index: SkillIndex): void {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  const tmp = `${CACHE_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(index, null, 2) + "\n", "utf8");
  renameSync(tmp, CACHE_PATH);
}

function yamlValue(frontmatter: string, key: string): string | null {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!match) return null;
  const value = match[1]?.trim() ?? "";
  if (value.startsWith("\"") && value.endsWith("\"")) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

function frontmatterFor(raw: string): string | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  return match?.[1] ?? null;
}

function triggersFromDescription(description: string): string[] {
  const start = description.indexOf("USE WHEN");
  if (start === -1) return [];
  const triggerStart = start + "USE WHEN".length;
  const end = description.indexOf("NOT FOR", triggerStart);
  const triggerText = description.slice(triggerStart, end === -1 ? undefined : end);
  return [...new Set(triggerText
    .split(",")
    .map((trigger) => trigger.trim().toLowerCase())
    .filter((trigger) => trigger.length > 0))];
}

function readSkillEntry(source: SkillSource): SkillEntry | null {
  try {
    const raw = readFileSync(source.path, "utf8");
    const frontmatter = frontmatterFor(raw);
    if (!frontmatter) return null;
    const name = yamlValue(frontmatter, "name") || basename(source.dirName);
    const description = yamlValue(frontmatter, "description") || "";
    const triggers = triggersFromDescription(description);
    if (triggers.length === 0) return null;
    return { name, triggers };
  } catch {
    return null;
  }
}

function buildIndex(sources: SkillSource[]): SkillIndex {
  const skills = sources
    .map(readSkillEntry)
    .filter((entry): entry is SkillEntry => entry !== null);
  const maxSrcMtimeMs = sources.reduce((max, source) => Math.max(max, source.mtimeMs), 0);
  return {
    schema_version: 1,
    built_at_ms: Date.now(),
    max_src_mtime_ms: maxSrcMtimeMs,
    skills,
  };
}

function getIndex(): SkillIndex {
  const sources = listSkillSources();
  const maxSrcMtimeMs = sources.reduce((max, source) => Math.max(max, source.mtimeMs), 0);
  const cached = loadIndex();
  if (cached && cached.max_src_mtime_ms >= maxSrcMtimeMs) return cached;
  const rebuilt = buildIndex(sources);
  saveIndex(rebuilt);
  return rebuilt;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

function normalizeText(text: string): string {
  return tokenize(text).join(" ");
}

function scoreSkill(skill: SkillEntry, promptTokens: Set<string>, normalizedPrompt: string): ScoredSkill {
  const matchedTokens = new Set<string>();
  let phraseBonus = 0;

  for (const trigger of skill.triggers) {
    const triggerTokens = tokenize(trigger);
    if (triggerTokens.length === 0) {
      continue;
    }
    const normalizedTrigger = triggerTokens.join(" ");
    if (triggerTokens.length > 1) {
      if (normalizedPrompt.includes(normalizedTrigger)) {
        const cappedWeight = Math.min(triggerTokens.length, 4);
        phraseBonus += 0.5;
        for (const token of triggerTokens.slice(0, cappedWeight)) matchedTokens.add(token);
      }
      continue;
    }
    const [token] = triggerTokens;
    if (token && promptTokens.has(token)) matchedTokens.add(token);
  }

  // Score = distinct matched trigger tokens + 0.5 per whole phrase hit.
  // The confidence floor only counts distinct tokens, so phrase bonus can rank but not force emission.
  return {
    name: skill.name,
    score: matchedTokens.size + phraseBonus,
    distinctHits: matchedTokens.size,
  };
}

function scoreSkills(prompt: string, index: SkillIndex): ScoredSkill[] {
  const promptTokens = new Set(tokenize(prompt));
  const normalizedPrompt = [...promptTokens].join(" ");
  return index.skills
    .map((skill) => scoreSkill(skill, promptTokens, normalizedPrompt))
    .filter((skill) => skill.distinctHits >= MIN_DISTINCT_TRIGGER_TOKEN_HITS)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    });
}

function emit(line: string): void {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: line },
  }));
}

async function main(): Promise<void> {
  try {
    const raw = await readStdinWithTimeout();
    const input = parseHookInput(raw);
    const prompt = input.prompt || input.user_prompt || "";
    if (!prompt.trim()) {
      process.exit(0);
    }

    const index = getIndex();
    const scored = scoreSkills(prompt, index);
    if (scored.length === 0) {
      process.exit(0);
    }

    const names = scored.slice(0, MAX_SKILLS_TO_EMIT).map((skill) => skill.name);
    emit(`LIKELY SKILLS (may not apply): ${names.join(", ")}`);
  } catch (err) {
    process.stderr.write(`SkillSurface error: ${(err as Error)?.message || String(err)}\n`);
  }
  process.exit(0);
}

main();
