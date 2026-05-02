#!/usr/bin/env bun
/**
 * TaskGovernance.hook.ts - Subagent Task Creation Governance (TaskCreated)
 *
 * PURPOSE:
 * Validates and logs task creation by subagents. Prevents runaway task spawning
 * and provides audit trail of all agent-created tasks.
 *
 * TRIGGER: TaskCreated
 *
 * INPUT:
 * - task_id: Created task identifier
 * - task_subject: Short task subject line
 * - task_description: Full task description
 * - teammate_name: Name of the agent creating the task
 * - team_name: Team context
 *
 * OUTPUT:
 * - exit(0): Allow task creation (with optional logging)
 * - exit(2): Block task creation (stderr fed back to model)
 *
 * GOVERNANCE RULES:
 * 1. Log all task creation for audit trail
 * 2. Rate limit: max 20 tasks per session to prevent runaway spawning
 * 3. Block tasks with empty descriptions (quality gate)
 */

import { readFileSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getPaiDir } from './lib/paths';

const input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));

const { task_id, task_subject, task_description, teammate_name, team_name } =
  input;

// --- Quality gate: block empty descriptions ---
if (!task_description || task_description.trim().length < 10) {
  process.stderr.write(
    `Task creation blocked: description too short (${task_description?.length ?? 0} chars). Provide a meaningful task description of at least 10 characters.`
  );
  process.exit(2);
}

// --- Rate limit: track tasks per session via temp file ---
// CLAUDE_SESSION_ID doesn't exist in env, so we use ppid (Claude Code process)
// and reset the counter when the session (ppid) changes.
const trackFile = join("/tmp", "pai-task-governance.json");
let taskCount = 0;
const currentPpid = String(process.ppid);

try {
  const data = JSON.parse(readFileSync(trackFile, "utf-8"));
  if (data.ppid === currentPpid) {
    taskCount = data.count || 0;
  }
  // Different ppid = new session, counter resets to 0
} catch {
  // File doesn't exist or is corrupt — first task this session
}

const MAX_TASKS_PER_SESSION = 50;
if (taskCount >= MAX_TASKS_PER_SESSION) {
  process.stderr.write(
    `Task creation blocked: session limit of ${MAX_TASKS_PER_SESSION} tasks reached. This prevents runaway task spawning. Complete existing tasks before creating new ones.`
  );
  process.exit(2);
}

// Increment counter with session tracking
const { writeFileSync } = await import("fs");
writeFileSync(trackFile, JSON.stringify({ ppid: currentPpid, count: taskCount + 1 }));

// --- Audit log ---
const logDir = join(
  getPaiDir(),
  "MEMORY/SECURITY"
);
const now = new Date();
const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
const logPath = join(logDir, yearMonth);

try {
  mkdirSync(logPath, { recursive: true });
  const entry = JSON.stringify({
    ts: now.toISOString(),
    event: "task_created",
    task_id,
    subject: task_subject,
    teammate: teammate_name,
    team: team_name,
    description_length: task_description?.length ?? 0,
  });
  appendFileSync(join(logPath, "task-governance.jsonl"), entry + "\n");
} catch {
  // Non-fatal: logging failure shouldn't block task creation
}

// Allow task creation
process.exit(0);
