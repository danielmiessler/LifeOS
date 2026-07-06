#!/usr/bin/env bun
/**
 * ArtWorkflowGuard.hook.ts — PreToolUse Bash gate
 *
 * Catches Bash invocations of ~/.claude/skills/Art/Tools/Generate.ts that
 * lack `--workflow=<name>` (or `--workflow <name>`) and lack the explicit
 * `--freeform-confirmed` opt-out, and blocks them BEFORE the tool runs.
 *
 * The Art skill SKILL.md says "ALWAYS RUN A NAMED WORKFLOW. NEVER FREEFORM"
 * — that doctrine used to live in markdown only and was silently ignored
 * (see ISA 20260430-180000_art-skill-freeform-enforcement). This hook is
 * the early-warning layer; Generate.ts itself has the load-bearing gate.
 *
 * TRIGGER: PreToolUse (matcher: Bash)
 * EXIT CODES: 0 = allow, 2 = deny (blocks the call, message goes to model)
 */

import { readFileSync, readdirSync } from "node:fs";
import { displayPath, getSkillsDir } from "./lib/paths";

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: { command?: string; description?: string };
}

const ART_TOOL_PATH_FRAGMENTS = [
  "skills/Art/Tools/Generate.ts",
  ".claude/skills/Art/Tools/Generate.ts",
];

function readHookInput(): HookInput {
  try {
    const raw = readFileSync(0, "utf-8");
    return JSON.parse(raw) as HookInput;
  } catch {
    return {};
  }
}

function listWorkflows(): string[] {
  const dir = `${getSkillsDir()}/Art/Workflows`;
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""))
      .sort();
  } catch {
    return [];
  }
}

function isGenerateTsCall(command: string): boolean {
  return ART_TOOL_PATH_FRAGMENTS.some((frag) => command.includes(frag));
}

function hasWorkflowOrFreeform(command: string): boolean {
  // Accept --workflow=<name>, --workflow <name>, or --freeform-confirmed
  return (
    /--workflow[= ]\S+/.test(command) || /--freeform-confirmed\b/.test(command)
  );
}

function main(): never {
  const input = readHookInput();
  const command = input?.tool_input?.command ?? "";

  // Fast-path: not a Generate.ts call → allow.
  if (!isGenerateTsCall(command)) {
    process.exit(0);
  }

  // Generate.ts call WITH workflow or explicit freeform → allow.
  if (hasWorkflowOrFreeform(command)) {
    process.exit(0);
  }

  // Generate.ts call WITHOUT workflow → block with copy-paste workflow list.
  const workflows = listWorkflows();
  const lines = [
    "",
    "═══════════════════════════════════════════════════════════════════════════",
    "  ArtWorkflowGuard — Generate.ts call BLOCKED before execution.",
    "═══════════════════════════════════════════════════════════════════════════",
    "",
    `  This Bash command invokes ${displayPath(getSkillsDir())}/Art/Tools/Generate.ts but`,
    "  does not name a workflow. The Art skill requires every image generation",
    "  to run through a named workflow. Freeform prompts are documented to fail.",
    "",
    "  Re-issue the command with ONE of:",
    "    --workflow=<name>          (recommended — read the workflow file first)",
    "    --freeform-confirmed       (explicit opt-out, logged for audit)",
    "",
    "  Available workflows (each is a file under skills/Art/Workflows/):",
    ...workflows.map(
      (w) => `    --workflow=${w.padEnd(28)} → ${displayPath(getSkillsDir())}/Art/Workflows/${w}.md`
    ),
    "",
    "  Recommended next step: Read the workflow file matching your task,",
    "  follow its prompt template (palette, composition, validation gate),",
    "  then re-run the Bash command with --workflow=<that-workflow-name>.",
    "",
    "═══════════════════════════════════════════════════════════════════════════",
    "",
  ];
  process.stderr.write(lines.join("\n"));
  process.exit(2);
}

main();
