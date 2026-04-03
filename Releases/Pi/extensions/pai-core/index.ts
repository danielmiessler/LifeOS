/**
 * PAI Core Extension for Pi
 *
 * Ports the key PAI capabilities to Pi's extension system:
 * - Voice notifications (optional TTS integration)
 * - Security validation (blocks dangerous commands)
 * - Session lifecycle (startup greeting, shutdown logging)
 * - PRD work tracking (Algorithm methodology support)
 * - Learning signal capture (cross-session improvement)
 *
 * Based on PAI v4.0.3 — https://github.com/danielmiessler/PAI
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ─── Configuration via environment variables ────────────────
const PAI_PI_DIR = process.env.PAI_PI_DIR || join(homedir(), ".config", "PAI-pi");
const MEMORY_DIR = join(PAI_PI_DIR, "memory");
const WORK_DIR = join(MEMORY_DIR, "work");
const LEARNING_DIR = join(MEMORY_DIR, "learning");
const STATE_DIR = join(MEMORY_DIR, "state");

// Voice configuration — set these env vars to enable TTS
const VOICE_ENDPOINT = process.env.PAI_VOICE_ENDPOINT || "http://localhost:8888/notify";
const VOICE_ID = process.env.PAI_VOICE_ID || "";
const VOICE_ENABLED = process.env.PAI_VOICE_ENABLED === "true";

// Ensure directories exist
for (const dir of [MEMORY_DIR, WORK_DIR, LEARNING_DIR, STATE_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export default function (pi: ExtensionAPI) {
  // ─── Voice Notification Tool ─────────────────────────
  pi.registerTool({
    name: "voice_notify",
    label: "Voice",
    description: "Send a voice notification via TTS server (requires PAI_VOICE_ENDPOINT and PAI_VOICE_ID env vars)",
    parameters: Type.Object({
      message: Type.String({ description: "Text to speak" }),
    }),
    async execute(_toolCallId, params) {
      if (!VOICE_ENABLED || !VOICE_ID) {
        return { content: [{ type: "text", text: "Voice disabled (set PAI_VOICE_ENABLED=true and PAI_VOICE_ID)" }] };
      }

      try {
        execSync(
          `curl -s -X POST ${VOICE_ENDPOINT} -H "Content-Type: application/json" -d '${JSON.stringify({
            message: params.message,
            voice_id: VOICE_ID,
            voice_enabled: true,
          })}'`,
          { timeout: 5000 }
        );
        return { content: [{ type: "text", text: `Voice: "${params.message}"` }] };
      } catch {
        return { content: [{ type: "text", text: "Voice server unavailable" }] };
      }
    },
    promptSnippet: "voice_notify - Speak text aloud via TTS",
    promptGuidelines: "Use for Algorithm phase transitions and task completion announcements.",
  });

  // ─── Security: Block dangerous commands ──────────────
  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return;
    const cmd = (event.input as { command?: string })?.command || "";

    const dangerous = [
      /rm\s+(-rf?|--recursive)\s+[\/~]/,
      /rm\s+-rf?\s+\./,
      /git\s+push\s+.*--force/,
      /git\s+reset\s+--hard/,
      /git\s+clean\s+-f/,
      /git\s+checkout\s+\./,
      /drop\s+table/i,
      /truncate\s+table/i,
      /:(){ :\|:& };:/,
      /mkfs\./,
      /dd\s+if=/,
    ];

    for (const pattern of dangerous) {
      if (pattern.test(cmd)) {
        return {
          block: true,
          reason: `BLOCKED: Dangerous command detected. Pattern: ${pattern.source}. Ask before proceeding.`,
        };
      }
    }
  });

  // ─── Session Start: Voice (non-blocking) ─────────────
  pi.on("session_start", async () => {
    if (!VOICE_ENABLED || !VOICE_ID) return;

    const child = spawn("curl", [
      "-s", "-X", "POST", VOICE_ENDPOINT,
      "-H", "Content-Type: application/json",
      "--connect-timeout", "1",
      "-m", "3",
      "-d", JSON.stringify({
        message: "PAI online. Ready for work.",
        voice_id: VOICE_ID,
        voice_enabled: true,
      }),
    ], { stdio: "ignore", detached: true });
    child.unref();
  });

  // ─── Session Shutdown: Capture learnings ─────────────
  pi.on("session_shutdown", async () => {
    const timestamp = new Date().toISOString();
    const logPath = join(LEARNING_DIR, "session-log.jsonl");

    const entry = {
      timestamp,
      event: "session_end",
      sessionName: pi.getSessionName() || "unnamed",
    };

    try {
      appendFileSync(logPath, JSON.stringify(entry) + "\n");
    } catch {
      // Best effort
    }
  });

  // ─── PRD Management Tool ─────────────────────────────
  pi.registerTool({
    name: "prd_create",
    label: "PRD",
    description: "Create a PRD (Product Requirements Document) for Algorithm work tracking",
    parameters: Type.Object({
      task: Type.String({ description: "8 word task description" }),
      slug: Type.String({ description: "kebab-case slug for the work directory" }),
      effort: Type.String({ description: "standard|extended|advanced|deep|comprehensive" }),
      phase: Type.String({ description: "observe|think|plan|build|execute|verify|learn|complete" }),
      criteria: Type.Optional(Type.Array(Type.String(), { description: "ISC criteria list" })),
      progress: Type.Optional(Type.String({ description: "e.g. 3/8" })),
    }),
    async execute(_toolCallId, params) {
      const workDir = join(WORK_DIR, params.slug);
      if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

      const timestamp = new Date().toISOString();
      const criteriaBlock = params.criteria
        ? params.criteria.map((c, i) => `- [ ] ISC-${i + 1}: ${c}`).join("\n")
        : "";

      const content = `---
task: ${params.task}
slug: ${params.slug}
effort: ${params.effort}
phase: ${params.phase}
progress: ${params.progress || "0/0"}
started: ${timestamp}
updated: ${timestamp}
---

## Context

${params.task}

## Criteria

${criteriaBlock}

## Decisions

## Verification
`;

      const prdPath = join(workDir, "PRD.md");
      writeFileSync(prdPath, content);

      return {
        content: [{ type: "text", text: `PRD created at ${prdPath}` }],
        details: { path: prdPath, slug: params.slug },
      };
    },
    promptSnippet: "prd_create - Create Algorithm PRD for work tracking",
    promptGuidelines:
      "Create a PRD at the start of every Algorithm session. Update phase and progress as work proceeds.",
  });

  // ─── PRD Update Tool ─────────────────────────────────
  pi.registerTool({
    name: "prd_update",
    label: "PRD Update",
    description: "Update PRD phase, progress, or mark criteria complete",
    parameters: Type.Object({
      slug: Type.String({ description: "PRD slug" }),
      phase: Type.Optional(Type.String({ description: "New phase" })),
      progress: Type.Optional(Type.String({ description: "e.g. 5/8" })),
      complete_criteria: Type.Optional(
        Type.Array(Type.Number(), { description: "ISC numbers to mark complete" })
      ),
    }),
    async execute(_toolCallId, params) {
      const prdPath = join(WORK_DIR, params.slug, "PRD.md");
      if (!existsSync(prdPath)) {
        return { content: [{ type: "text", text: `PRD not found: ${params.slug}` }] };
      }

      let content = readFileSync(prdPath, "utf-8");
      const timestamp = new Date().toISOString();

      if (params.phase) {
        content = content.replace(/^phase: .+$/m, `phase: ${params.phase}`);
      }
      if (params.progress) {
        content = content.replace(/^progress: .+$/m, `progress: ${params.progress}`);
      }
      content = content.replace(/^updated: .+$/m, `updated: ${timestamp}`);

      if (params.complete_criteria) {
        for (const num of params.complete_criteria) {
          content = content.replace(
            new RegExp(`^- \\[ \\] ISC-${num}:`, "m"),
            `- [x] ISC-${num}:`
          );
        }
      }

      writeFileSync(prdPath, content);
      return { content: [{ type: "text", text: `PRD updated: ${params.slug}` }] };
    },
    promptSnippet: "prd_update - Update Algorithm PRD phase/progress/criteria",
  });

  // ─── Learning Signal Tool ────────────────────────────
  pi.registerTool({
    name: "capture_learning",
    label: "Learn",
    description: "Capture a learning signal or reflection from this session",
    parameters: Type.Object({
      signal_type: Type.String({ description: "rating|reflection|failure|pattern" }),
      content: Type.String({ description: "The learning content" }),
      score: Type.Optional(Type.Number({ description: "Rating 1-10 if applicable" })),
    }),
    async execute(_toolCallId, params) {
      const timestamp = new Date().toISOString();
      const entry = {
        timestamp,
        type: params.signal_type,
        content: params.content,
        score: params.score,
        session: pi.getSessionName() || "unnamed",
      };

      const logPath = join(LEARNING_DIR, "signals.jsonl");
      appendFileSync(logPath, JSON.stringify(entry) + "\n");

      return {
        content: [{ type: "text", text: `Learning captured: ${params.signal_type}` }],
        details: entry,
      };
    },
    promptSnippet: "capture_learning - Store learning signals for cross-session improvement",
  });

  // ─── Status Line ─────────────────────────────────────
  pi.on("agent_start", async (_event, ctx) => {
    ctx.ui.setStatus("pai", "PAI on Pi | Algorithm v3.6.0");
  });

  // ─── Slash Commands ──────────────────────────────────
  pi.registerCommand("algorithm", {
    description: "Start an Algorithm session for complex work",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        "Algorithm mode activated. Use the 7-phase methodology for this task.",
        "info"
      );
      await pi.sendUserMessage("Use ALGORITHM mode for the next task. Follow all 7 phases.");
    },
  });

  pi.registerCommand("status", {
    description: "Show PAI system status",
    handler: async (_args, ctx) => {
      const sessionCount = (() => {
        try {
          const logPath = join(LEARNING_DIR, "session-log.jsonl");
          if (!existsSync(logPath)) return 0;
          return readFileSync(logPath, "utf-8").trim().split("\n").length;
        } catch {
          return 0;
        }
      })();

      const signalCount = (() => {
        try {
          const logPath = join(LEARNING_DIR, "signals.jsonl");
          if (!existsSync(logPath)) return 0;
          return readFileSync(logPath, "utf-8").trim().split("\n").length;
        } catch {
          return 0;
        }
      })();

      ctx.ui.notify(
        `PAI on Pi | Sessions: ${sessionCount} | Signals: ${signalCount}`,
        "info"
      );
    },
  });

  pi.registerCommand("voice", {
    description: "Send a voice notification",
    handler: async (args, _ctx) => {
      if (!VOICE_ENABLED || !VOICE_ID) return;
      const message = args || "Hello from PAI";
      try {
        execSync(
          `curl -s -X POST ${VOICE_ENDPOINT} -H "Content-Type: application/json" -d '${JSON.stringify({
            message,
            voice_id: VOICE_ID,
            voice_enabled: true,
          })}'`,
          { timeout: 5000 }
        );
      } catch {
        // Voice server may not be running
      }
    },
  });
}
