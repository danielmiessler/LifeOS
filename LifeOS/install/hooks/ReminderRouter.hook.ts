#!/usr/bin/env bun
/**
 * ReminderRouter.hook.ts — UserPromptSubmit hook
 *
 * Parses the incoming prompt for narrow, precision-biased reminder/research/queue
 * intent. When the prompt clearly says "remind me to X" / "research the Y paper" /
 * "queue this for later", the hook spawns a fire-and-forget gh CLI call that opens
 * a labeled issue in the configured WORK.REPO. Non-matching prompts incur a single
 * regex test and exit immediately — no measurable added latency on the common path.
 *
 * Design contract:
 *   - PRECISION over recall. We accept false negatives (missed soft hints) before
 *     we accept false positives (a normal coding question turning into an issue).
 *   - Idempotent within a session — same prompt text hashed → routed once.
 *   - Always exit 0; never block the prompt. The reminder is a side effect.
 *   - Skip silently when WORK.REPO is unset.
 *
 * Issue body includes the original prompt verbatim and any parsed absolute date.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import { join, dirname } from "path";
import { loadWorkConfig } from "./lib/work-config";
import { getDAName } from "./lib/identity";

const HOME = process.env.HOME || "";
const STATE_PATH = join(HOME, ".claude", "LIFEOS", "MEMORY", "STATE", "reminder-router-seen.json");

interface HookInput {
  session_id?: string;
  prompt?: string;
  message?: { content?: string };
}

interface RouteMatch {
  kind: "reminder" | "research" | "queue";
  imperative: string;       // the raw matched phrase
  remainder: string;        // what comes after the trigger
  dueIso?: string;          // ISO date if a relative time was parsed
}

// ── Precision triggers ──────────────────────────────────────────────────────
// Each entry: a regex that MUST match very explicit imperative shape.
// The patterns require the hook to see one of these at a line boundary
// (start of prompt or after newline) — never mid-sentence.

const TRIGGERS: Array<{ kind: RouteMatch["kind"]; re: RegExp }> = [
  { kind: "reminder", re: /(?:^|\n)\s*(remind me to)\s+(.+)$/im },
  { kind: "reminder", re: /(?:^|\n)\s*(remind me about)\s+(.+)$/im },
  { kind: "reminder", re: /(?:^|\n)\s*(set a reminder (?:to|for|about))\s+(.+)$/im },
  { kind: "reminder", re: /(?:^|\n)\s*(add a reminder to)\s+(.+)$/im },
  { kind: "reminder", re: /(?:^|\n)\s*(remember to)\s+(.+)$/im },
  { kind: "research", re: /(?:^|\n)\s*(research the)\s+(.+)$/im },
  { kind: "research", re: /(?:^|\n)\s*(research this[:,]?)\s+(.+)$/im },
  { kind: "research", re: /(?:^|\n)\s*(we should research)\s+(.+)$/im },
  { kind: "queue",    re: /(?:^|\n)\s*(queue (?:this|that) (?:for|as))\s+(.+)$/im },
  { kind: "queue",    re: /(?:^|\n)\s*(add (?:this|that) to (?:my|the) (?:queue|todo|backlog))\b\s*(.+)?$/im },
  { kind: "queue",    re: /(?:^|\n)\s*(we should do)\s+(.+?)\s+later\.?\s*$/im },
];

function detectIntent(prompt: string): RouteMatch | null {
  for (const t of TRIGGERS) {
    const m = prompt.match(t.re);
    if (m) {
      return {
        kind: t.kind,
        imperative: m[1].trim(),
        remainder: (m[2] || "").trim(),
      };
    }
  }
  return null;
}

// ── Tiny relative-date parser ───────────────────────────────────────────────
// Returns ISO YYYY-MM-DD when the remainder names a recognizable relative day.

const DAY_NAMES = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

function parseRelativeDate(text: string, now = new Date()): string | undefined {
  const t = text.toLowerCase();

  if (/\btoday\b/.test(t)) return iso(now);
  if (/\btomorrow\b/.test(t)) return iso(addDays(now, 1));

  const inN = t.match(/\bin (\d+) days?\b/);
  if (inN) return iso(addDays(now, parseInt(inN[1], 10)));

  const inWeeks = t.match(/\bin (\d+) weeks?\b/);
  if (inWeeks) return iso(addDays(now, parseInt(inWeeks[1], 10) * 7));

  // "next Thursday" or just "Thursday"
  const next = t.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (next) return iso(nextWeekday(now, DAY_NAMES.indexOf(next[1]), true));

  for (const d of DAY_NAMES) {
    const re = new RegExp(`\\b${d}\\b`);
    if (re.test(t)) return iso(nextWeekday(now, DAY_NAMES.indexOf(d), false));
  }

  return undefined;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function nextWeekday(now: Date, target: number, forceNextWeek: boolean): Date {
  let delta = (target - now.getDay() + 7) % 7;
  if (delta === 0 || forceNextWeek) delta = forceNextWeek ? (delta === 0 ? 7 : delta + 7) : 7;
  return addDays(now, delta);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Session-scoped idempotency ──────────────────────────────────────────────

function alreadyRouted(sessionId: string, promptHash: string): boolean {
  if (!existsSync(STATE_PATH)) return false;
  try {
    const data = JSON.parse(readFileSync(STATE_PATH, "utf-8")) as Record<string, string[]>;
    return (data[sessionId] || []).includes(promptHash);
  } catch {
    return false;
  }
}

function markRouted(sessionId: string, promptHash: string): void {
  let data: Record<string, string[]> = {};
  if (existsSync(STATE_PATH)) {
    try {
      data = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
    } catch {
      data = {};
    }
  }
  if (!data[sessionId]) data[sessionId] = [];
  data[sessionId].push(promptHash);
  // Cap: keep last 64 hashes per session.
  if (data[sessionId].length > 64) data[sessionId] = data[sessionId].slice(-64);
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(data));
}

// ── Issue creation ──────────────────────────────────────────────────────────

function buildIssue(match: RouteMatch, prompt: string): { title: string; body: string; labels: string[] } {
  const titlePrefix = match.kind === "reminder" ? "[Reminder]" : match.kind === "research" ? "[Research]" : "[Queue]";
  const subjectRaw = match.remainder || prompt.slice(0, 80);
  const subject = subjectRaw.replace(/\s+/g, " ").trim().slice(0, 96);
  const title = `${titlePrefix} ${subject}`;

  const due = match.dueIso ? `\n**Due:** ${match.dueIso}\n` : "";
  const body = [
    `## ${titlePrefix} captured by LifeOS`,
    "",
    `**Trigger:** \`${match.imperative}\``,
    `**Kind:** ${match.kind}`,
    due,
    `### Original prompt`,
    "",
    "```",
    prompt.trim(),
    "```",
    "",
    `---`,
    `*Auto-routed by LifeOS ReminderRouter hook (UserPromptSubmit).*`,
  ].join("\n");

  const labels = [
    `Type:${match.kind}`,
    "Property:internal",
    "Status:queued",
    "Priority:P3",
    `Agent:${getDAName()}`,
    "pai-sync",
  ];

  return { title, body, labels };
}

async function createIssueDetached(repo: string, title: string, body: string, labels: string[]): Promise<void> {
  const labelArgs = labels.flatMap((l) => ["--label", l]);
  // Detached so we never block the prompt; gh runs in the background.
  const proc = Bun.spawn(
    ["gh", "issue", "create", "--repo", repo, "--title", title, "--body", body, ...labelArgs],
    { stdout: "ignore", stderr: "pipe", timeout: 8000 },
  );
  // We do not await exited — fire-and-forget.
  proc.exited.catch(() => undefined);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const cfg = loadWorkConfig();
  if (!cfg.enabled || !cfg.repo) process.exit(0);

  let input: HookInput;
  try {
    input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
  } catch {
    process.exit(0);
  }

  const prompt = (input.prompt || input.message?.content || "").trim();
  if (!prompt) process.exit(0);

  const match = detectIntent(prompt);
  if (!match) process.exit(0);

  match.dueIso = parseRelativeDate(match.remainder);

  const sessionId = input.session_id || "no-session";
  const promptHash = createHash("sha1").update(prompt).digest("hex").slice(0, 16);
  if (alreadyRouted(sessionId, promptHash)) {
    process.exit(0);
  }
  markRouted(sessionId, promptHash);

  const { title, body, labels } = buildIssue(match, prompt);
  await createIssueDetached(cfg.repo, title, body, labels);

  console.error(`[ReminderRouter] routed ${match.kind} → ${cfg.repo}: ${title}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`[ReminderRouter] Fatal: ${err}`);
  process.exit(0);
});
