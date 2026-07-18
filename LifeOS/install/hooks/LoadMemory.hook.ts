#!/usr/bin/env bun
/**
 * @version 1.2.1
 * LoadMemory — UserPromptSubmit hook that injects the two hot-layer memory
 * files (PRINCIPAL_MEMORY.md, DA_MEMORY.md) as additionalContext on every
 * prompt, so the Claude Code CLI session sees the same memory the Telegram
 * pipeline already injects via buildLifeosContextBlock.
 *
 * Closes the CLI-vs-Telegram parity gap (the autonomic loop was writing
 * memory files but the CLI session was never reading them in-prompt).
 *
 * Performance: hot-path hook. Must be cheap. Both files cap at 48 entries
 * × 256 chars = ~12K chars each, ~24K combined max. We render only the
 * entries (no help comments), so practical injection is far smaller.
 *
 * Failure mode: any error logs to stderr and exits 0 (never block the prompt).
 *
 * Subagent skip: subagents see only what their parent passed them; the per-
 * turn memory loop is for the principal's primary session. Detect and skip
 * via env markers the harness sets on subagent processes.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import { homedir } from "node:os";
import { getClaudeDir } from "./lib/paths";

const CLAUDE_ROOT = pathResolve(getClaudeDir());
const PRINCIPAL_MEMORY = pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md");
const DA_MEMORY = pathResolve(CLAUDE_ROOT, "LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md");

const ENTRIES_START = "<!-- BEGIN ENTRIES -->";
const ENTRIES_END = "<!-- END ENTRIES -->";

interface MemoryRead {
  entries: string[];
  count: number;
  charsUsed: number;
}

function isSubagentInvocation(): boolean {
  return Boolean(
    process.env.CLAUDE_CODE_SUBAGENT_NAME ||
    process.env.CLAUDE_CODE_SUBAGENT_TYPE ||
    process.env.CLAUDE_AGENT_SDK === "1"
  );
}

function readMemory(path: string): MemoryRead {
  if (!existsSync(path)) return { entries: [], count: 0, charsUsed: 0 };
  try {
    const raw = readFileSync(path, "utf8");
    const startIdx = raw.indexOf(ENTRIES_START);
    const endIdx = raw.indexOf(ENTRIES_END);
    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
      return { entries: [], count: 0, charsUsed: 0 };
    }
    const block = raw.slice(startIdx + ENTRIES_START.length, endIdx).trim();
    if (!block) return { entries: [], count: 0, charsUsed: 0 };
    const entries = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const charsUsed = entries.reduce((sum, e) => sum + e.length, 0);
    return { entries, count: entries.length, charsUsed };
  } catch {
    return { entries: [], count: 0, charsUsed: 0 };
  }
}

function renderBlock(title: string, mem: MemoryRead, capEntries = 48, capChars = 12288): string {
  const header = `## ${title} [${mem.count}/${capEntries} entries · ${mem.charsUsed}/${capChars} chars]`;
  if (mem.count === 0) {
    return `${header}\n(no entries yet)`;
  }
  return `${header}\n${mem.entries.join("\n")}`;
}

/** Returns the <pai-memory> context block, or null on error. Pure — no exit. */
export function run(): string | null {
  try {
    const principal = readMemory(PRINCIPAL_MEMORY);
    const da = readMemory(DA_MEMORY);

    const principalBlock = renderBlock("PRINCIPAL MEMORY", principal);
    const daBlock = renderBlock("DA MEMORY", da);

    return `<pai-memory>\n${principalBlock}\n\n${daBlock}\n</pai-memory>\n`;
  } catch (e) {
    process.stderr.write(`LoadMemory error: ${(e as Error)?.message || String(e)}\n`);
    return null;
  }
}

if (import.meta.main) {
  if (!isSubagentInvocation()) {
    const out = run();
    if (out) process.stdout.write(out);
  }
  process.exit(0);
}
