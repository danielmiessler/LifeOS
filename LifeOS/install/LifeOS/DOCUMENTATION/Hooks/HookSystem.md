---
last_updated: 2026-07-01
last_updated_by: kai
last_reviewed: 2026-07-02
last_reviewed_by: kai
convention: pai-freshness-v1
---

# Hook System

> Hooks are why the LifeOS runs when nobody is looking. The thesis (`LifeOs/LifeOsThesis.md`) assigns them their job: automate the loop — capture current state, enforce doctrine, fire the next move — without the principal having to ask. A hill-climb that only advances when prompted is a chatbot; the hook lifecycle below is what makes it an operating system.

> **LifeOS 5.0** — Stable event-driven automation infrastructure.

**Event-Driven Automation Infrastructure**

**Location:** `~/.claude/hooks/`
**Configuration:** `~/.claude/settings.json`
**Status:** Active — hook count auto-computed by `UpdateCounts.ts` at session end

---

## Overview

The LifeOS hook system is an event-driven automation infrastructure built on Claude Code's native hook support. Hooks are executable scripts (TypeScript/Python) that run automatically in response to specific events during Claude Code sessions.

**Core Capabilities:**
- **Session Management** - Auto-load context, capture summaries, manage state
- **Voice Notifications** - Text-to-speech announcements for task completions
- **History Capture** - Automatic work/learning documentation to `~/.claude/LIFEOS/MEMORY/`
- **Security Validation** - Active (v5+, consolidated 2026-05-14) — Single `Safety.hook.ts` dispatching by `hook_event_name`: PermissionRequest gates outgoing tool calls via the shape classifier in `lib/safety-classifier.ts` (auto-allows safe shapes, neutral on dangerous/credential/injection); PostToolUse tags WebFetch/WebSearch responses with the "treat as data" warning + injection marker. Replaces the prior split between `SmartApprover.hook.ts` and `PromptInjection.hook.ts`. The v4.0 Inspector Pipeline was deleted 2026-05-06. See `LIFEOS/DOCUMENTATION/Security/README.md`.
- **Multi-Agent Support** - Agent-specific hooks with voice routing
- **Tab Titles** - Dynamic terminal tab updates with task context
- **Unified Event Stream** - All hooks emit structured events to `events.jsonl` for real-time observability

**Key Principle:** Most hooks run asynchronously and fail gracefully. Security hooks (e.g. `hooks/Safety.hook.ts`) are synchronous — the PermissionRequest path emits `decision: allow` JSON when safe (otherwise stdout is empty and the native engine prompts). All `.ts` hooks have `#!/usr/bin/env bun` shebangs and `+x` permissions — settings.json references them directly (e.g., `$HOME/.claude/hooks/Safety.hook.ts`) without a `bun` prefix. HTTP hooks (SkillGuard, AgentGuard) run via Pulse routes on `localhost:31337`.

**Freshness Authority:** When adding or modifying hooks, consult the `claude-code-guide` agent to verify current hook event types, return value schemas, and available fields.

---

## Available Hook Types

Claude Code supports the following hook events:

### 1. **SessionStart**
**When:** Claude Code session begins (new conversation)
**Use Cases:**
- Load LifeOS context (CLAUDE.md auto-loads routing + identity + PRINCIPAL_TELOS via @-imports)
- Initialize session state
- Capture session metadata

**Current Hooks:**
```json
{
  "SessionStart": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/KittyEnvPersist.hook.ts"
        },
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/LoadContext.hook.ts"
        }
      ]
    }
  ]
}
```

**What They Do:**
- `KittyEnvPersist.hook.ts` - Persists Kitty terminal env vars both to the shared `MEMORY/STATE/kitty-env.json` and to a per-session `MEMORY/STATE/kitty-sessions/{sessionId}.json` (required by out-of-process consumers like Pulse voice daemon), then resets tab title to clean state
- `LoadContext.hook.ts` - Injects dynamic context (relationship, learning, work summary) as `<system-reminder>` at session start

---

### 2. **SessionEnd**
**When:** Claude Code session terminates (conversation ends)
**Use Cases:**
- Capture work completions and learning moments
- Generate session summaries
- Record relationship context
- Update system counts (skills, hooks, signals)
- Run integrity checks

**Current Hooks:**
```json
{
  "SessionEnd": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/WorkCompletionLearning.hook.ts"
        },
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/ULWorkSync.hook.ts"
        },
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/SessionCleanup.hook.ts"
        },
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/RelationshipMemory.hook.ts"
        },
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/UpdateCounts.hook.ts"
        },
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/IntegrityCheck.hook.ts"
        }
      ]
    }
  ]
}
```

**What They Do:**
- `WorkCompletionLearning.hook.ts` - Reads ISA.md frontmatter for work metadata and ISC section for criteria status, captures learning to `MEMORY/LEARNING/` for significant work sessions
- `ULWorkSync.hook.ts` - Syncs UL work state at session end
- `SessionCleanup.hook.ts` - Marks ISA.md frontmatter status→COMPLETED and sets completed_at timestamp, clears session state, resets tab, cleans session names
- `RelationshipMemory.hook.ts` - Captures relationship context (observations, behaviors) to `MEMORY/RELATIONSHIP/`
- `UpdateCounts.hook.ts` - Updates system counts (skills, hooks, signals, workflows, files) displayed in the startup banner
- `IntegrityCheck.hook.ts` - Runs DocCrossRefIntegrity and SystemIntegrity checks at session end

---

### 3. **UserPromptSubmit**
**When:** User submits a new prompt to Claude
**Use Cases:**
- Update UI indicators
- Pre-process user input
- Capture prompts for analysis
- Detect ratings and sentiment

**Current Hooks:**
```json
{
  "UserPromptSubmit": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/PromptGuard.hook.ts",
          "timeout": 10
        }
      ]
    },
    {
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/EffortRouter.hook.ts",
          "timeout": 30,
          "async": true
        }
      ]
    },
    {
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/PromptProcessing.hook.ts",
          "timeout": 30,
          "async": true
        }
      ]
    },
    {
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/SatisfactionCapture.hook.ts",
          "timeout": 20,
          "async": true
        }
      ]
    },
    {
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/ReminderRouter.hook.ts",
          "timeout": 5,
          "async": true
        }
      ]
    }
  ]
}
```

**What It Does (current state, 2026-05-06):**

**EffortRouter.hook.ts** — Mode + Tier classification. **Owns the classifier role.**
- Three-stage cascade: deterministic fast-paths (`/eN`, ratings, praise, system text) → 60s decision cache → EffortRouter classifier (`Inference.ts --level high` — Opus; re-pinned off `max` on 2026-07-01 so the per-prompt keystone doesn't ride Fable, while `max`=Fable stays for E4/E5 + the advisor)
- Emits `MODE: MINIMAL|NATIVE|ALGORITHM | TIER: E1-E5 | REASON: … | SOURCE: classifier|fail-safe|fast-path|cache|explicit` to `additionalContext` via `hookSpecificOutput`
- **Fail-safe:** classifier timeout/error → `ALGORITHM E3 | SOURCE: fail-safe` (under-escalation is the failure mode the system is built to prevent — Algorithm v6.3.0 line 97)
- **Inference:** Sonnet via `claude` subscription-billed subprocess (Inference.ts pattern)
- **Telemetry:** `MEMORY/OBSERVABILITY/effort-router.jsonl`
- Runs FIRST on UserPromptSubmit so PromptProcessing and downstream hooks can read the classification.

**PromptProcessing.hook.ts** — Tab Title + Session Naming via Haiku
- Single responsibility: terminal tab title updates and session auto-naming
- Does NOT do mode/tier classification (EffortRouter), rating capture (SatisfactionCapture), or repeat detection (removed 2026-05-06).
- Fast paths: deterministic tab title on first prompt, deterministic session name fallback
- Inference: one Haiku call returning `{ tab_title, session_name }`
- Writes to: `session-names.json`, `work.json`, tab state, voice server
- **Naming-context isolation (2026-04-19):** `getRecentContext()` strips Assistant turns when `isFirstPrompt` is true. Session names are permanent, so Algorithm scaffolding in assistant output — phase headers, agent names, SUMMARY lines — must never reach the naming prompt.

**SatisfactionCapture.hook.ts** — User satisfaction signal capture
- Reads `MEMORY/STATE/last-response.txt` (written by `LastResponseCache.hook.ts` at Stop) to access the previous response
- Detects explicit ratings ("8 - great"), positive praise, low-rating learning signals
- Writes to: `ratings.jsonl`, low-rating learning failures, complaint clusters
- Async (timeout 20s)

**ReminderRouter.hook.ts** — "remind me to X" → labeled GitHub issue in `WORK.REPO`
- Parses reminder-shaped prompts; routes to `gh issue create` with reminder labels
- Async (timeout 5s)

> **Migration notes (2026-05-06):**
> - The v4.0 Inspector Pipeline (PromptGuard, ContentScanner, SmartApprover, SecurityPipeline, ContainmentGuard) was deleted in the security simplification. See `LIFEOS/DOCUMENTATION/Security/README.md`.
> - `RepeatDetection.hook.ts` was cut as a pre-classifier-era safety net now redundant with EffortRouter + Opus reading conversation context. Pre-state tag: `pre-bpe-cuts-2026-05-06`.
> - The ModeClassifier/ClassifierTelemetry consolidation hinted at in older docs was reverted: classifier (EffortRouter) and namer/tab-setter (PromptProcessing) are separate hooks again, in that order, on UserPromptSubmit.

---

### 4. **Stop**
**When:** Main agent ({DA_IDENTITY.NAME}) completes a response
**Use Cases:**
- Voice notifications for task completion
- Capture work summaries and learnings
- **Update terminal tab with final state** (color + suffix based on outcome)

**Current Hooks:**
```json
{
  "Stop": [
    {
      "hooks": [
        { "type": "command", "command": "$HOME/.claude/hooks/LastResponseCache.hook.ts" },
        { "type": "command", "command": "$HOME/.claude/hooks/ResponseTabReset.hook.ts" },
        { "type": "command", "command": "$HOME/.claude/hooks/VoiceCompletion.hook.ts" },
        { "type": "command", "command": "$HOME/.claude/hooks/DocIntegrity.hook.ts" }
      ]
    }
  ]
}
```

**What They Do:**

Each Stop hook is a self-contained `.hook.ts` file that reads stdin via shared `hooks/lib/hook-io.ts`, calls its handler, and exits. Handlers in `hooks/handlers/` are unchanged — each hook is a thin wrapper.

**`LastResponseCache.hook.ts`** — Cache last response for SatisfactionCapture bridge
- Writes `last_assistant_message` (or transcript fallback) to `MEMORY/STATE/last-response.txt`
- SatisfactionCapture reads this on the next UserPromptSubmit (`getLastResponse()`, line 86) to access the previous response when scoring satisfaction signals

**`ResponseTabReset.hook.ts`** — Reset Kitty tab title/color after response
- Calls `handlers/TabState.ts` to set completed state
- Converts working gerund title to past tense

**`VoiceCompletion.hook.ts`** — Send 🗣️ voice line to TTS server
- Calls `handlers/VoiceNotification.ts` for voice delivery
- Voice gate: only main sessions (checks `kitty-sessions/{sessionId}.json`)
- Subagents have no kitty-sessions file → voice blocked

**`DocIntegrity.hook.ts`** — Cross-reference + semantic drift checks + architecture summary regen
- Calls `handlers/DocCrossRefIntegrity.ts` — deterministic + inference-powered doc updates
- Calls `handlers/RebuildArchSummary.ts` — regenerates `LIFEOS_ARCHITECTURE_SUMMARY.md` when system files change
- Self-gating: returns instantly when no system files were modified

**Tab State System:** See `TERMINALTABS.md` for complete documentation

---

### 5. **PreToolUse**
**When:** Before Claude executes any tool
**Use Cases:**
- Voice curl gating (prevent background agents from speaking)
- Security validation across file operations (Bash, Edit, Write, Read, MultiEdit) — SecurityPipeline (Pattern → Egress → Rules inspectors) blocks dangerous commands, protects credentials, enforces path tiers
- Tab state updates on questions
- Agent execution guardrails — Pulse HTTP route at localhost:31337/hooks/agent-guard
- Skill invocation validation — Pulse HTTP route at localhost:31337/hooks/skill-guard

**Current Hooks:**
```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        { "type": "command", "command": "$HOME/.claude/hooks/SecurityPipeline.hook.ts" },
        { "type": "command", "command": "$HOME/.claude/hooks/ContextReduction.hook.sh" }
      ]
    },
    {
      "matcher": "Write|Edit|MultiEdit|Read",
      "hooks": [
        { "type": "command", "command": "$HOME/.claude/hooks/SecurityPipeline.hook.ts" }
      ]
    },
    {
      "matcher": "Skill",
      "hooks": [
        { "type": "http", "url": "http://localhost:31337/hooks/skill-guard" }
      ]
    },
    {
      "matcher": "Agent",
      "hooks": [
        { "type": "http", "url": "http://localhost:31337/hooks/agent-guard" }
      ]
    },
    {
      "matcher": "AskUserQuestion",
      "hooks": [
        { "type": "command", "command": "$HOME/.claude/hooks/SetQuestionTab.hook.ts" }
      ]
    }
  ]
}
```

**Security hooks (active, v4.0 Inspector Pipeline):** SecurityPipeline runs on Bash/Write/Edit/MultiEdit matchers (composable inspector chain: PatternInspector(100) → EgressInspector(90); RulesInspector(50) disabled — empty SECURITY_RULES.md; exit(2) hard-block). ContentScanner runs on PostToolUse WebFetch/WebSearch matchers (InjectionInspector for prompt injection detection in external content). SmartApprover runs on PermissionRequest (trusted workspace auto-approval + read/write classification). PromptGuard runs on UserPromptSubmit (PromptInspector(95) — heuristic-only injection/exfiltration/evasion/security-disable detection, no LLM). SkillGuard and AgentGuard run via Pulse HTTP routes (`localhost:31337`). AgentGuard also injects a Monitor watchdog reminder for background agents (`run_in_background: true`) — `Tools/AgentWatchdog.ts` monitors tool-activity.jsonl for silence and alerts when agents may be hung. Inspector core: `hooks/security/{types,pipeline,logger}.ts`, inspectors: `hooks/security/inspectors/`. See `DOCUMENTATION/Security/SecuritySystem.md` for full architecture.

**What They Do:**
- `ContextReduction.hook.sh` - Context reduction via [RTK](https://github.com/rtk-ai/rtk). Transparently rewrites Bash commands to `rtk` equivalents for 60-90% token reduction across git, build, test, lint, and package manager output. Runs on the Bash matcher. Meta commands (use directly, not through hook): `rtk gain` (savings analytics), `rtk gain --history` (command history), `rtk discover` (missed opportunities), `rtk proxy <cmd>` (bypass filtering). Note: if `rtk gain` fails, check for name collision with reachingforthejack/rtk (Rust Type Kit).
- `SetQuestionTab.hook.ts` - Updates tab state to "awaiting input" when AskUserQuestion is invoked

---

### 6. **PostToolUse**
**When:** After Claude executes any tool
**Status:** Active - Algorithm state tracking

**Current Hooks:**
```json
{
  "PostToolUse": [
    {
      "hooks": [
        { "type": "command", "command": "$HOME/.claude/hooks/ContentScanner.hook.ts" }
      ]
    },
    {
      "matcher": "AskUserQuestion",
      "hooks": [
        { "type": "command", "command": "$HOME/.claude/hooks/QuestionAnswered.hook.ts" }
      ]
    },
    {
      "matcher": "Write",
      "hooks": [
        { "type": "command", "command": "$HOME/.claude/hooks/ISASync.hook.ts" },
        { "type": "command", "command": "$HOME/.claude/hooks/TelosSummarySync.hook.ts" }
      ]
    },
    {
      "matcher": "Edit",
      "hooks": [
        { "type": "command", "command": "$HOME/.claude/hooks/ISASync.hook.ts" },
        { "type": "command", "command": "$HOME/.claude/hooks/TelosSummarySync.hook.ts" }
      ]
    },
    {
      "hooks": [
        { "type": "command", "command": "$HOME/.claude/hooks/ToolActivityTracker.hook.ts" }
      ]
    }
  ]
}
```

**What They Do:**

**ContentScanner.hook.ts** - Prompt Injection Detection (Security v4.0)
- Fires after any tool use (global matcher)
- Runs InjectionInspector from the Inspector Pipeline to detect prompt injection attempts in tool output
- Part of the v4.0 security architecture; replaces the former PromptInjectionScanner
- Inspector source: `hooks/security/inspectors/`

**QuestionAnswered.hook.ts** - Post-Question Processing
- Fires after AskUserQuestion completes (user has answered)
- Captures the question and answer for session context
- Used for analytics and learning from user preferences

**ISASync.hook.ts** - ISA Frontmatter → work.json Sync
- Fires after Write/Edit to ISA files in `MEMORY/WORK/`
- Syncs ISA frontmatter (status, title, effort) to `MEMORY/STATE/work.json`
- Keeps work registry in sync without manual updates
- Non-blocking, fire-and-forget
- Uses `hooks/lib/isa-utils.ts::appendPhase()` (2026-04-16+) for phaseHistory with `source: "prd"` — the other source being voice notifications. Both feed the same phaseHistory array with dedup via upgrade to `source: "merged"`. See `LIFEOS/MEMORY/KNOWLEDGE/Ideas/dual-source-event-tracking-pattern.md`.

**TelosSummarySync.hook.ts** - Principal TELOS Sync
- Fires after Write/Edit alongside ISASync
- Regenerates PRINCIPAL_TELOS.md when TELOS source files are modified

**ToolActivityTracker.hook.ts** - Tool Activity Tracking + Ground-Truth Audit
- Fires after any tool use (global matcher)
- Tracks tool usage patterns for observability
- Captures a `ground_truth` payload for write-class tools (Edit/Write/MultiEdit/NotebookEdit): file path, bounded before/after diff, git HEAD + dirty flag
- Captures a `ground_truth` payload for Bash: command, stdout/stderr preview, exit code
- Feeds the Observer Team archetype (see PAIAGENTSYSTEM.md) which consumes the audit log rather than chat transcripts — watches what the model DID, not what it said

---

### 7. **PostToolUseFailure**
**When:** A tool execution fails
**Use Cases:**
- Track tool failure patterns for debugging
- Identify flaky tools or recurring errors
- Observability data for system health

**Current Hooks:**
```json
{
  "PostToolUseFailure": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/ToolFailureTracker.hook.ts"
        }
      ]
    }
  ]
}
```

**What It Does:**
- `ToolFailureTracker.hook.ts` - Appends structured failure events to `MEMORY/OBSERVABILITY/tool-failures.jsonl`
- Captures: tool name, error message, truncated tool input, session ID, timestamp
- Lightweight (<20ms) — file append only, no inference calls

---

### 8. **SubagentStart**
**When:** A subagent is spawned (command-only event)
**Status:** Empty registration. Claude Code's built-in `SubagentStart` payload omits `subagent_type` / `description` / `prompt`, so LifeOS tracks subagent lifecycle at the `PreToolUse:Agent` boundary via `AgentInvocation.hook.ts` (see Section 1) where that data is reliably present.

**Current Hooks:**
```json
{
  "SubagentStart": []
}
```

---

### 9. **ConfigChange**
**When:** Configuration settings are modified (command-only event)
**Use Cases:**
- Security audit trail for permission changes
- Track hook modifications
- Detect unauthorized config changes

**Current Hooks:**
```json
{
  "ConfigChange": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/ConfigAudit.hook.ts"
        }
      ]
    }
  ]
}
```

**What It Does:**
- `ConfigAudit.hook.ts` - Appends config change events to `MEMORY/OBSERVABILITY/config-changes.jsonl`
- Captures: config key, change summary (old → new), session ID, timestamp
- Flags sensitive keys (permissions, hooks, env, mcpServers) with extra logging
- Lightweight (<20ms) — file append only, no inference calls

---

### 10. **PreCompact**
**When:** Before Claude compacts context (long conversations)
**Status:** Active — `PreCompact.hook.ts`
**Matcher:** `"*"` (both auto and manual compaction)

**What It Does:**
- `PreCompact.hook.ts` - Captures active work context before conversation compaction
- Reads: `MEMORY/STATE/work.json` (resolves current session by sessionUUID), `MEMORY/WORK/*/ISA.md`
- Outputs structured handover note to stdout (preserved through compaction)
- Captures: active task, ISA summary, files modified, key decisions, working directory, session ID
- Lightweight (<100ms) — file reads only, no inference calls

**Configuration:**
```json
{
  "PreCompact": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/PreCompact.hook.ts"
        }
      ]
    }
  ]
}
```

**Relationship to Auto-Memory:**
Claude Code's built-in auto-memory system writes learnings to `~/.claude/projects/<project>/memory/MEMORY.md`. The PreCompact hook complements this by preserving work-in-progress state that auto-memory doesn't capture (active task context, ISA state, file lists). Auto-dream (server-controlled) periodically consolidates auto-memory files between sessions.

---

### 11. **PostCompact**
**When:** After Claude compacts context
**Status:** Active — `RestoreContext.hook.ts`

**Current Hooks:**
```json
{
  "PostCompact": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/RestoreContext.hook.ts"
        }
      ]
    }
  ]
}
```

**What It Does:**
- `RestoreContext.hook.ts` - Restores critical context after compaction to prevent context loss

---

### 12. **SubagentStop**
**When:** A subagent completes (command-only event)
**Status:** Empty registration. Subagent stop + duration is tracked at `PostToolUse:Agent` via `AgentInvocation.hook.ts` (see Section 1).

**Current Hooks:**
```json
{
  "SubagentStop": []
}
```

---

### 12a. **TeammateIdle** *(removed 2026-05-06)*
**When:** An agent team teammate is about to go idle
**Status:** Removed in BPE Phase A.1 (commit `31a4b9ad9`). The `teammate-events.jsonl` log it produced had zero readers across LIFEOS/, hooks/, skills/. Future reassignment-logic hint in the original docstring was never implemented.

To restore: `git revert 31a4b9ad9` (or `git show pre-bpe-cuts-2026-05-06:hooks/TeammateIdle.hook.ts > hooks/TeammateIdle.hook.ts` and re-add to settings.json `TeammateIdle` array).

---

### 13. **TaskCreated**
**When:** A task is created via TaskCreate tool
**Status:** Active — `TaskGovernance.hook.ts`

**Current Hooks:**
```json
{
  "TaskCreated": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/TaskGovernance.hook.ts"
        }
      ]
    }
  ]
}
```

**What It Does:**
- `TaskGovernance.hook.ts` - Validates and governs task creation for ISC quality standards

---

### 14. **StopFailure**
**When:** The main agent fails to complete a response
**Status:** Active — `StopFailureHandler.hook.ts`

**Current Hooks:**
```json
{
  "StopFailure": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/StopFailureHandler.hook.ts"
        }
      ]
    }
  ]
}
```

**What It Does:**
- `StopFailureHandler.hook.ts` - Handles stop failures, captures error context for debugging

---

### 15. **Elicitation** *(handler removed 2026-05-06)*
**When:** An MCP server requests structured input (e.g. Stripe, Bright Data mid-task prompt)
**Status:** Handler removed in BPE Phase A.2 (commit `1de31b0a7`). The single elicitation log file across the entire history contained one event (125 bytes from 2026-04-04). MCP elicitation already shows the dialog natively when the schema is unknown. Hook claimed it could auto-respond; never did.

To restore: `git revert 1de31b0a7`.

---

### 16. **FileChanged** *(handler removed 2026-05-06)*
**When:** A watched file is modified
**Status:** Handler removed in BPE Phase B.1 (commit `c43dbc019`). `ToolActivityTracker` (PostToolUse, catch-all) already captures every tool call including file paths and content — FileChanged was a redundant second log of the same events under a different schema.

To restore: `git revert c43dbc019`.

---

### 17. **InstructionsLoaded**
**When:** Instructions (CLAUDE.md or project instructions) are loaded
**Status:** Active — `InstructionsLoadedHandler.hook.ts`

**Current Hooks:**
```json
{
  "InstructionsLoaded": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "$HOME/.claude/hooks/InstructionsLoadedHandler.hook.ts"
        }
      ]
    }
  ]
}
```

**What It Does:**
- `InstructionsLoadedHandler.hook.ts` - Processes loaded instructions for context enrichment or validation

---

## Configuration

### Location
**File:** `~/.claude/settings.json`
**Section:** `"hooks": { ... }`

### Environment Variables
Hooks have access to all environment variables from `~/.claude/settings.json` `"env"` section:

```json
{
  "env": {
    "LIFEOS_DIR": "$HOME/.claude",
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "64000"
  }
}
```

**Key Variables:**
- `LIFEOS_DIR` - LifeOS installation directory (typically `~/.claude`)
- Hook scripts reference `$HOME/.claude` in command paths

### Identity Configuration (Central to Install Wizard)

**settings.json is the single source of truth for all daidentity/configuration.**

```json
{
  "daidentity": {
    "name": "LifeOS",
    "fullName": "Personal AI",
    "displayName": "LifeOS",
    "color": "#3B82F6",
    "voices": {
      "main": { "voiceId": "{YourElevenLabsVoiceId}", "stability": 0.85, "similarityBoost": 0.7 },
      "algorithm": { "voiceId": "{AlgorithmVoiceId}" }
    }
  },
  "principal": {
    "name": "{YourName}",
    "pronunciation": "{YourName}",
    "timezone": "America/Your_City"
  }
}
```

**Using the Identity Module:**
```typescript
import { getIdentity, getPrincipal, getDAName, getPrincipalName, getVoiceId } from './lib/identity';

// Get full identity objects
const identity = getIdentity();    // { name, fullName, displayName, mainDAVoiceID, color, voice, personality }
const principal = getPrincipal();  // { name, pronunciation, timezone }

// Convenience functions
const DA_NAME = getDAName();        // "LifeOS"
const USER_NAME = getPrincipalName(); // "{YourName}"
const VOICE_ID = getVoiceId();        // from settings.json daidentity.voices.main.voiceId
```

**Why settings.json?**
- Programmatic access via `JSON.parse()` - no regex parsing markdown
- Central to the LifeOS install wizard
- Tool-friendly: easy to read/write from any language

> **Note:** `settings.json` is now a **generated file** -- `ConfigRenderer.ts` writes it at session start from `LIFEOS_CONFIG.yaml`. Hooks should read it freely for runtime config, but understand that manual edits will be overwritten on next session start when ConfigRenderer detects a hash change. To make permanent config changes, edit `LIFEOS_CONFIG.yaml` instead.

### Hook Configuration Structure

```json
{
  "hooks": {
    "HookEventName": [
      {
        "matcher": "pattern",  // Optional: filter which tools/events trigger hook
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/my-hook.ts --arg value"
          }
        ]
      }
    ]
  }
}
```

**Fields:**
- `HookEventName` - One of: SessionStart, SessionEnd, UserPromptSubmit, Stop, StopFailure, PreToolUse, PostToolUse, PostToolUseFailure, SubagentStart, SubagentStop, ConfigChange, PreCompact, PostCompact, TaskCreated, TaskCompleted, TeammateIdle, Elicitation, ElicitationResult, FileChanged, CwdChanged, InstructionsLoaded, WorktreeCreate, WorktreeRemove, Notification, PermissionRequest
- `matcher` - Pattern to match (use `"*"` for all tools, or specific tool names)
- `type` - Always `"command"` (executes external script)
- `command` - Path to executable hook script (TypeScript/Python/Bash)

### Hook Input (stdin)
All hooks receive JSON data on stdin:

```typescript
{
  session_id: string;         // Unique session identifier
  transcript_path: string;    // Path to JSONL transcript
  hook_event_name: string;    // Event that triggered hook
  prompt?: string;            // User prompt (UserPromptSubmit only)
  tool_name?: string;         // Tool name (PreToolUse/PostToolUse)
  tool_input?: any;           // Tool parameters (PreToolUse)
  tool_output?: any;          // Tool result (PostToolUse)
  // ... event-specific fields
}
```

---

## Common Patterns

### 1. Voice Notifications

**Pattern:** Extract completion message → Send to voice server

```typescript
// handlers/VoiceNotification.ts pattern
import { getIdentity } from './lib/identity';

const identity = getIdentity();
const completionMessage = extractCompletionMessage(lastMessage);

const payload = {
  title: identity.name,
  message: completionMessage,
  voice_enabled: true,
  voice_id: identity.mainDAVoiceID  // From settings.json
};

await fetch('http://localhost:31337/notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

**Agent-Specific Voices:**
Configure voice IDs via `settings.json` daidentity section or environment variables.
Each agent can have a unique ElevenLabs voice configured. See the Agents skill for voice registry.

---

### 2. History Capture (UOCS Pattern)

**Pattern:** Parse structured response → Save to appropriate history directory

**File Naming Convention:**
```
YYYY-MM-DD-HHMMSS_TYPE_description.md
```

**Types:**
- `WORK` - General task completions
- `LEARNING` - Problem-solving learnings
- `SESSION` - Session summaries
- `RESEARCH` - Research findings (from agents)
- `FEATURE` - Feature implementations (from agents)
- `DECISION` - Architectural decisions (from agents)

**Example pattern (from WorkCompletionLearning.hook.ts):**
```typescript
import { getLearningCategory, isLearningCapture } from './lib/learning-utils';
import { getPSTTimestamp, getYearMonth } from './lib/time';

const structured = extractStructuredSections(lastMessage);
const isLearning = isLearningCapture(text, structured.summary, structured.analysis);

// If learning content detected, capture to LEARNING/
if (isLearning) {
  const category = getLearningCategory(text);  // 'SYSTEM' or 'ALGORITHM'
  const targetDir = join(baseDir, 'MEMORY', 'LEARNING', category, getYearMonth());
  const filename = generateFilename(description, 'LEARNING');
  writeFileSync(join(targetDir, filename), content);
}
```

**Structured Sections Parsed:**
- `📋 SUMMARY:` - Brief overview
- `🔍 ANALYSIS:` - Key findings
- `⚡ ACTIONS:` - Steps taken
- `✅ RESULTS:` - Outcomes
- `📊 STATUS:` - Current state
- `➡️ NEXT:` - Follow-up actions
- `🎯 COMPLETED:` - **Voice notification line**

---

### 3. Agent Type Detection

**Pattern:** Identify which agent is executing → Route appropriately

```typescript
// Agent detection pattern
let agentName = getAgentForSession(sessionId);

// Detect from Task tool
if (hookData.tool_name === 'Task' && hookData.tool_input?.subagent_type) {
  agentName = hookData.tool_input.subagent_type;
  setAgentForSession(sessionId, agentName);
}

// Detect from CLAUDE_CODE_AGENT env variable
else if (process.env.CLAUDE_CODE_AGENT) {
  agentName = process.env.CLAUDE_CODE_AGENT;
}

// Detect from path (subagents run in /agents/name/)
else if (hookData.cwd && hookData.cwd.includes('/agents/')) {
  const agentMatch = hookData.cwd.match(/\/agents\/([^\/]+)/);
  if (agentMatch) agentName = agentMatch[1];
}
```

**Session Mapping:** `~/.claude/LIFEOS/MEMORY/STATE/agent-sessions.json`
```json
{
  "session-id-abc123": "engineer",
  "session-id-def456": "researcher"
}
```

---

### 4. Tab Title + Color State Architecture

**Pattern:** Visual state feedback through tab colors and title suffixes

**State Flow:**

| Event | Hook | Tab Title | Inactive Color | State |
|-------|------|-----------|----------------|-------|
| UserPromptSubmit | `PromptProcessing.hook.ts` | `⚙️ Summary…` | Orange `#B35A00` | Working |
| Inference | `PromptProcessing.hook.ts` | `🧠 Analyzing…` | Orange `#B35A00` | Inference |
| Stop (success) | `handlers/TabState.ts` | `Summary` | Green `#022800` | Completed |
| Stop (question) | `handlers/TabState.ts` | `Summary?` | Teal `#0D4F4F` | Awaiting Input |
| Stop (error) | `handlers/TabState.ts` | `Summary!` | Orange `#B35A00` | Error |

**Active Tab:** Always Dark Blue `#002B80` (state colors only affect inactive tabs)

**Why This Design:**
- **Instant visual feedback** - See state at a glance without reading
- **Color-coded priority** - Teal tabs need attention, green tabs are done
- **Suffix as state indicator** - Works even in narrow tab bars
- **Haiku only on user input** - One AI call per prompt (not per tool)

**State Detection (in Stop hook):**
1. Check transcript for `AskUserQuestion` tool → `awaitingInput`
2. Check `📊 STATUS:` for error patterns → `error`
3. Default → `completed`

**Text Colors:**
- Active tab: White `#FFFFFF` (always)
- Inactive tab: Gray `#A0A0A0` (always)

**Active Tab Background:** Dark Blue `#002B80` (always - state colors only affect inactive tabs)

**Tab Icons:**
- 🧠 Brain - AI inference in progress (Haiku/Sonnet thinking)
- ⚙️ Gear - Processing/working state

**Full Documentation:** See `~/.claude/LIFEOS/DOCUMENTATION/Pulse/TerminalTabs.md`

---

### 5. Async Non-Blocking Execution

**Pattern:** Hook executes quickly → Launch background processes for slow operations

```typescript
// PromptProcessing.hook.ts pattern
// Set immediate tab title (fast)
execSync(`printf '\\033]0;${titleWithEmoji}\\007' >&2`);

// Launch background process for Haiku summary (slow)
Bun.spawn(['bun', `${paiDir}/hooks/PromptProcessing.hook.ts`, prompt], {
  stdout: 'ignore',
  stderr: 'ignore',
  stdin: 'ignore'
});

process.exit(0);  // Exit immediately
```

**Key Principle:** Hooks must never block Claude Code. Always exit quickly, use background processes for slow work.

---

### 6. Graceful Failure

**Pattern:** Wrap everything in try/catch → Log errors → Exit successfully

```typescript
async function main() {
  try {
    // Hook logic here
  } catch (error) {
    // Log but don't fail
    console.error('Hook error:', error);
  }

  process.exit(0);  // Always exit 0
}
```

**Why:** If hooks crash, Claude Code may freeze. Always exit cleanly.

---

## Creating Custom Hooks

### Step 1: Choose Hook Event
Decide which event should trigger your hook (SessionStart, Stop, PostToolUse, etc.)

### Step 2: Create Hook Script

**Template:**
```typescript
#!/usr/bin/env bun

interface HookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
  // ... event-specific fields
}

async function main() {
  try {
    // Read stdin
    const input = await Bun.stdin.text();
    const data: HookInput = JSON.parse(input);

    // Your hook logic here
    console.log(`Hook triggered: ${data.hook_event_name}`);

    // Example: Read transcript
    const fs = require('fs');
    const transcript = fs.readFileSync(data.transcript_path, 'utf-8');

    // Do something with the data

  } catch (error) {
    // Log but don't fail
    console.error('Hook error:', error);
  }

  process.exit(0);  // Always exit 0
}

main();
```

### Step 3: Make Executable
```bash
chmod +x ~/.claude/hooks/my-custom-hook.ts
```
> **Note:** Not needed when using the `bun` prefix in settings.json — all LifeOS hooks use `bun $HOME/.claude/hooks/...` which doesn't require the execute bit.

### Step 4: Add to settings.json
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/my-custom-hook.ts"
          }
        ]
      }
    ]
  }
}
```

### Step 5: Test
```bash
# Test hook directly
echo '{"session_id":"test","transcript_path":"/tmp/test.jsonl","hook_event_name":"Stop"}' | bun ~/.claude/hooks/my-custom-hook.ts
```

### Step 6: Restart Claude Code
Hooks are loaded at startup. Restart to apply changes.

---

## Hook Development Best Practices

### 1. **Fast Execution**
- Hooks should complete in < 500ms
- Use background processes for slow work (Haiku API calls, file processing)
- Exit immediately after launching background work

### 2. **Graceful Failure**
- Always wrap in try/catch
- Log errors to stderr (available in hook debug logs)
- Always `process.exit(0)` - never throw or exit(1)

### 3. **Non-Blocking**
- Never wait for external services (unless they respond quickly)
- Use `.catch(() => {})` for async operations
- Fail silently if optional services are offline

### 4. **Stdin Reading**
- Use timeout when reading stdin (Claude Code may not send data immediately)
- Handle empty/invalid input gracefully

```typescript
const decoder = new TextDecoder();
const reader = Bun.stdin.stream().getReader();

const timeoutPromise = new Promise<void>((resolve) => {
  setTimeout(() => resolve(), 500);  // 500ms timeout
});

await Promise.race([readPromise, timeoutPromise]);
```

### 5. **File I/O**
- Check `existsSync()` before reading files
- Create directories with `{ recursive: true }`
- Use local-timezone timestamps for consistency (the utility resolves from your LifeOS config)

### 6. **Environment Access**
- All `settings.json` env vars available via `process.env`
- Use `$HOME/.claude` in settings.json for portability
- Access in code via `process.env.LIFEOS_DIR`

### 7. **Logging**
- Log useful debug info to stderr for troubleshooting
- Include relevant metadata (session_id, tool_name, etc.)
- Never log sensitive data (API keys, user content)

---

## Troubleshooting

### Hook Not Running

**Check:**
1. Is hook script executable? `chmod +x ~/.claude/hooks/my-hook.ts` (not needed when using `bun` prefix — all LifeOS hooks use `bun` prefix)
2. Is path correct in settings.json? Use `bun $HOME/.claude/hooks/...`
3. Is settings.json valid JSON? `jq . ~/.claude/settings.json`
4. Did you restart Claude Code after editing settings.json?

**Debug:**
```bash
# Test hook directly
echo '{"session_id":"test","transcript_path":"/tmp/test.jsonl","hook_event_name":"Stop"}' | bun ~/.claude/hooks/my-hook.ts

# Check hook logs (stderr output)
tail -f ~/.claude/hooks/debug.log  # If you add logging
```

---

### Hook Hangs/Freezes Claude Code

**Cause:** Hook not exiting (infinite loop, waiting for input, blocking operation)

**Fix:**
1. Add timeouts to all blocking operations
2. Ensure `process.exit(0)` is always reached
3. Use background processes for long operations
4. Check stdin reading has timeout

**Prevention:**
```typescript
// Always use timeout
setTimeout(() => {
  console.error('Hook timeout - exiting');
  process.exit(0);
}, 5000);  // 5 second max
```

---

### Voice Notifications Not Working

**Check:**
1. Is voice server running? `curl http://localhost:31337/health`
2. Is voice_id correct? See `settings.json` `daidentity.voices` for mappings
3. Is message format correct? `{"message":"...", "voice_id":"...", "title":"..."}`
4. Is ElevenLabs API key in `~/.claude/.env`?

**Debug:**
```bash
# Test voice server directly
curl -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message":"Test message","voice_id":"[YOUR_VOICE_ID]","title":"Test"}'
```

**Common Issues:**
- Wrong voice_id → Silent failure (invalid ID)
- Voice server offline → Hook continues (graceful failure)
- No `🎯 COMPLETED:` line → No voice notification extracted

---

### Work Not Capturing

**Check:**
1. Does `~/.claude/LIFEOS/MEMORY/` directory exist?
2. Does `work.json` contain an entry for this session? `jq '.sessions | to_entries[] | select(.value.sessionUUID == "<uuid>")' ~/.claude/LIFEOS/MEMORY/STATE/work.json`
3. Is hook actually running? Check `~/.claude/LIFEOS/MEMORY/RAW/` for events
4. File permissions? `ls -la ~/.claude/LIFEOS/MEMORY/WORK/`

**Debug:**
```bash
# All sessions in the registry, sorted by recency:
jq '.sessions | to_entries | map({slug: .key, phase: .value.phase, mode: .value.mode, updatedAt: .value.updatedAt}) | sort_by(.updatedAt) | reverse' ~/.claude/LIFEOS/MEMORY/STATE/work.json

# Hot session list via the Pulse API (uses the same data):
curl -s http://localhost:31337/api/algorithm | jq '.algorithms | map({sessionId, phase: .currentPhase, active})'

# Check recent work directories
ls -lt ~/.claude/LIFEOS/MEMORY/WORK/ | head -10
ls -lt ~/.claude/LIFEOS/MEMORY/LEARNING/$(date +%Y-%m)/ | head -10

# Check UUID-collision anomalies (multiple ISAs on one harness UUID):
tail ~/.claude/LIFEOS/MEMORY/OBSERVABILITY/work-anomalies.jsonl
```

**Common Issues:**
- No entry in `work.json` for this sessionUUID → ISASync didn't fire (ISA never written), or PromptProcessing's `upsertSession` was skipped (rare)
- Session aged out → cleanup thresholds in `hooks/lib/isa-utils.ts` (native 4h, complete 24h, everything else 7d) — bump if you want longer
- Duplicate native rows for one UUID → upstream of native idempotency fix; clear with `jq` or wait for the cleanup pass
- UUID collision (two ISAs sharing one harness UUID) → check `work-anomalies.jsonl`; resolve by closing one ISA or by starting a fresh Claude Code session

---

### Stop Event Not Firing (RESOLVED)

**Original Issue:** Stop events were not firing consistently in earlier Claude Code versions, causing voice notifications and work capture to fail silently.

**Resolution:** Fixed in Claude Code updates. The Stop hooks now fire reliably. The individual hook pattern (each `.hook.ts` delegating to `handlers/`) was implemented in part to work around this — and remains the production architecture.

**Status:** RESOLVED — Stop events now fire reliably. Individual Stop hooks handle all post-response work.

---

### Agent Detection Failing

**Check:**
1. Is `~/.claude/LIFEOS/MEMORY/STATE/agent-sessions.json` writable?
2. Is `[AGENT:type]` tag in `🎯 COMPLETED:` line?
3. Is agent running from correct directory? (`/agents/name/`)

**Debug:**
```bash
# Check session mappings
cat ~/.claude/LIFEOS/MEMORY/STATE/agent-sessions.json | jq .

# Check subagent-stop debug log
tail -f ~/.claude/hooks/subagent-stop-debug.log
```

**Fix:**
- Ensure agents include `[AGENT:type]` in completion line
- Verify Task tool passes `subagent_type` parameter
- Check cwd includes `/agents/` in path

---

### Transcript Type Mismatch (Fixed 2026-01-11)

**Symptom:** Context reading functions return empty results even though transcript has data

**Root Cause:** Claude Code transcripts use `type: "user"` but hooks were checking for `type: "human"`.

**Affected Hooks:**
- `PromptProcessing.hook.ts` - Couldn't read user messages for context
- `SatisfactionCapture.hook.ts` - Same issue

**Fix Applied:**
1. Changed `entry.type === 'human'` → `entry.type === 'user'`
2. Improved content extraction to skip `tool_result` blocks and only capture actual text

**Verification:**
```bash
# Check transcript type field
grep '"type":"user"' "$(ls -d ~/.claude/projects/*/ | head -1)"*.jsonl | head -1 | jq '.type'
# Should output: "user" (not "human")
```

**Prevention:** When parsing transcripts, always verify the actual JSON structure first.

---

### Context Loading Issues (SessionStart)

**Check:**
1. Does `~/.claude/CLAUDE.md` exist?
2. Is `LoadContext.hook.ts` executable?
3. Is `LIFEOS_DIR` env variable set correctly?

**Debug:**
```bash
# Test context loading directly
bun ~/.claude/hooks/LoadContext.hook.ts

# Should output <system-reminder> with SKILL.md content
```

**Common Issues:**
- Subagent sessions loading main context → Fixed (subagent detection in hook)
- File not found → Check `LIFEOS_DIR` environment variable
- Permission denied → `chmod +x ~/.claude/hooks/LoadContext.hook.ts` (not needed when using `bun` prefix — all LifeOS hooks use `bun` prefix)

---

## Advanced Topics

### Multi-Hook Execution Order

Hooks in same event execute **sequentially** in order defined in settings.json:

```json
{
  "Stop": [
    {
      "hooks": [
        { "command": "$HOME/.claude/hooks/VoiceCompletion.hook.ts" }  // Example: one of several Stop hooks
      ]
    }
  ]
}
```

**Note:** If first hook hangs, second won't run. Keep hooks fast!

---

### Matcher Patterns

`"matcher"` field filters which events trigger hook:

```json
{
  "PostToolUse": [
    {
      "matcher": "Bash",  // Only Bash tool executions
      "hooks": [...]
    },
    {
      "matcher": "*",     // All tool executions
      "hooks": [...]
    }
  ]
}
```

**Patterns:**
- `"*"` - All events
- `"Bash"` - Specific tool name
- `""` - Empty (all events, same as `*`)

---

### Hook Data Payloads by Event Type

**SessionStart:**
```typescript
{
  session_id: string;
  transcript_path: string;
  hook_event_name: "SessionStart";
  cwd: string;
}
```

**UserPromptSubmit:**
```typescript
{
  session_id: string;
  transcript_path: string;
  hook_event_name: "UserPromptSubmit";
  prompt: string;  // The user's prompt text
}
```

**PreToolUse:**
```typescript
{
  session_id: string;
  transcript_path: string;
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: any;  // Tool parameters
}
```

**PostToolUse:**
```typescript
{
  session_id: string;
  transcript_path: string;
  hook_event_name: "PostToolUse";
  tool_name: string;
  tool_input: any;
  tool_output: any;  // Tool result
  error?: string;    // If tool failed
}
```

**Stop:**
```typescript
{
  session_id: string;
  transcript_path: string;
  hook_event_name: "Stop";
}
```

**SessionEnd:**
```typescript
{
  conversation_id: string;  // Note: different field name
  timestamp: string;
}
```

---

## Related Documentation

- **Voice System:** `~/.claude/`
- **Agent System:** `~/.claude/skills/Agents/SKILL.md`
- **History/Memory:** `~/.claude/LIFEOS/DOCUMENTATION/Memory/MemorySystem.md`

---

## Quick Reference Card

```
HOOK LIFECYCLE:
1. Event occurs (SessionStart, Stop, etc.)
2. Claude Code writes hook data to stdin
3. Hook script executes
4. Hook reads stdin (with timeout)
5. Hook performs actions (voice, capture, etc.)
6. Hook exits 0 (always succeeds)
7. Claude Code continues

HOOKS BY EVENT (19 event types wired in settings.json; verified 2026-04-30):

SESSION START (2 hooks):
  KittyEnvPersist.hook.ts        Persist Kitty env vars + tab reset
  LoadContext.hook.ts             Dynamic context injection (relationship, learning, work)

USER PROMPT SUBMIT (5 hooks, in fire order; verified 2026-05-23):
  EffortRouter.hook.ts            Mode + Tier classifier → additionalContext
  PromptProcessing.hook.ts        Tab title + session naming via Haiku
  SatisfactionCapture.hook.ts    User satisfaction signal capture (reads last-response.txt)
  ReminderRouter.hook.ts         /remind parser → labeled GitHub issue
  MemoryReviewTrigger.hook.ts    Turn-count debounced trigger for autonomic memory reviewer (2026-05-22). Increments turn count, sets pending_review=true when 3-gate fires (turn≥8 ∧ minutes_since_last_review≥30 ∧ idle_minutes≥2). Skips on MINIMAL-mode (reads effort-router.jsonl). New prompt before Stop cancels (debounce). ALSO emits `<autonomic-memory>` additionalContext on every UserPromptSubmit — cadence state + dispatch summary + health snapshot — which the DA reads to render the 🧠 MEMORY: indicator line (LIFEOS_SYSTEM_PROMPT.md NATIVE template).

PRE TOOL USE (5 distinct hooks + 2 Pulse HTTP routes):
  SystemFileGuard.hook.ts        Block USER content writes to SYSTEM files (Phase E, 2026-05-22). Runtime write-time boundary enforcement. Fail-safe-open on hook errors. 19/19 tests pass. [Write, Edit, MultiEdit]
  ContextReduction.hook.sh       Context reduction via RTK [Bash]
  ArtWorkflowGuard.hook.ts       Block freeform Art skill calls [Bash]
  SetQuestionTab.hook.ts         Tab state on question [AskUserQuestion]
  AgentInvocation.hook.ts        subagent_start capture [Agent]
  Pulse HTTP: agent-guard        Background watchdog + foreground warn (Pulse:31337)
  Pulse HTTP: skill-guard        Skill invocation validation (Pulse:31337)

POST TOOL USE (7 distinct hooks):
  AgentInvocation.hook.ts        subagent_stop with duration [Agent]
  Safety.hook.ts                 Tag external content as data [WebFetch, WebSearch] — same file as PermissionRequest hook below; dispatches by event
  QuestionAnswered.hook.ts       Post-question tab reset [AskUserQuestion]
  ISASync.hook.ts                ISA → work.json sync [Edit, Write, MultiEdit]
  CheckpointPerISC.hook.ts       Per-ISC auto-commit [Edit, Write, MultiEdit]
  TelosSummarySync.hook.ts       TELOS edits → regenerate PRINCIPAL_TELOS.md [Edit, Write, MultiEdit]
  ToolActivityTracker.hook.ts    Per-tool event log to OBSERVABILITY/ (catch-all)

POST TOOL USE FAILURE (1 hook):
  ToolFailureTracker.hook.ts     Error logging to OBSERVABILITY/

STOP (7 hooks):
  LastResponseCache.hook.ts      Cache response for SatisfactionCapture bridge
  ResponseTabReset.hook.ts       Tab title/color reset after response
  VoiceCompletion.hook.ts        Voice TTS (main sessions only)
  DocIntegrity.hook.ts           Cross-ref + arch summary regen
  ISARenderOnStop.hook.ts        ISA HTML mirror render on Stop
  OutputFormatGate.hook.ts       Enforce mode-template structure on response
  SuccessClaimGate.hook.ts       Block ungrounded success claims
  MemoryReviewFire.hook.ts       Spawn autonomic memory reviewer subprocess when pending_review=true (2026-05-22). Env-scrubbed (delete ANTHROPIC_API_KEY + ANTHROPIC_AUTH_TOKEN) to preserve subscription billing. Resets state atomically (turn_count→0, last_review_at→now, pending_review→false).
  MemoryHealthGate.hook.ts       Run MemoryHealthCheck.ts on every Stop (2026-05-24). Asserts all autonomic-memory hooks registered in BOTH settings files, code files present on disk, last reviewer fire within 7d, state file readable. Writes memory-health.jsonl. WARN/CRITICAL surfaces to stderr. Non-blocking.

STOP FAILURE (1 hook):
  StopFailureHandler.hook.ts     Capture abnormal-stop diagnostics

SUBAGENT START (0 hooks):
  (empty — see PreToolUse:Agent → AgentInvocation.hook.ts)

SUBAGENT STOP (0 hooks):
  (empty — see PostToolUse:Agent → AgentInvocation.hook.ts)

PERMISSION REQUEST (1 hook):
  Safety.hook.ts                 Shape-classifier auto-approve [Bash, Write, Edit, MultiEdit, mcp__reversinglabs__.*]
                                 — same file as PostToolUse hook above; dispatches by event.
                                 PermissionRequest path uses lib/safety-classifier.ts to allow safe shapes
                                 (read-only commands, dev binaries, trusted-workspace targets, mcp pre-vetted,
                                 shell-control-flow over data) and falls through to native prompt on
                                 dangerous/credential/injection shapes. Cache + observability JSONL.

TASK CREATED (1 hook):
  TaskGovernance.hook.ts         Empty-description block + 50-task rate limit

INSTRUCTIONS LOADED (1 hook):
  InstructionsLoadedHandler.hook.ts  SHA-256 audit of CLAUDE.md, system prompt, identity files

CONFIG CHANGE (1 hook):
  ConfigAudit.hook.ts            Security audit trail to OBSERVABILITY/

PRE COMPACT (1 hook):
  PreCompact.hook.ts             Capture work context before compaction

POST COMPACT (1 hook):
  RestoreContext.hook.ts         Rehydrate active ISA/state after compaction

SESSION END (6 hooks):
  WorkCompletionLearning.hook.ts Work/learning capture to MEMORY/
  ULWorkSync.hook.ts             UL GitHub-Issues task sync
  SessionCleanup.hook.ts         Mark WORK dir complete, clear state, reset tab
  RelationshipMemory.hook.ts     Relationship context to MEMORY/RELATIONSHIP/
  UpdateCounts.hook.ts           Refresh system counts (skills, hooks, signals)
  IntegrityCheck.hook.ts         System integrity checks

KEY FILES:
~/.claude/settings.json              Hook configuration (GENERATED by ConfigRenderer — read, don't hand-edit)
~/.claude/LIFEOS_CONFIG.yaml            Source of truth for config (ConfigRenderer reads this)
~/.claude/LIFEOS/TOOLS/ConfigRenderer.ts  Renders settings.json, CLAUDE.md, LIFEOS_SYSTEM_PROMPT.md from LIFEOS_CONFIG.yaml
~/.claude/hooks/                     Hook scripts (39 files, .hook.ts + .hook.sh)
~/.claude/hooks/handlers/            Handler modules (6 files)
~/.claude/hooks/lib/                 Shared libraries (16 files)
~/.claude/hooks/lib/learning-utils.ts Learning categorization
~/.claude/hooks/lib/time.ts          PST timestamp utilities
~/.claude/LIFEOS/MEMORY/WORK/               Work tracking
~/.claude/LIFEOS/MEMORY/LEARNING/           Learning captures
~/.claude/LIFEOS/MEMORY/STATE/              Runtime state
~/.claude/LIFEOS/MEMORY/STATE/events.jsonl  Unified event log (append-only)
~/.claude/LIFEOS/MEMORY/OBSERVABILITY/      Tool failures, agent spawns, config changes

INFERENCE TOOL (for hooks needing AI):
Path: ~/.claude/LIFEOS/TOOLS/Inference.ts
Import: import { inference } from '../../.claude/LIFEOS/TOOLS/Inference'
Levels: fast (haiku/15s) | standard (sonnet/30s) | smart (opus/90s)

TAB STATE SYSTEM:
Inference: 🧠…  Orange #B35A00  (AI thinking)
Working:   ⚙️…  Orange #B35A00  (processing)
Completed:      Green  #022800  (task done)
Awaiting:  ?    Teal   #0D4F4F  (needs input)
Error:     !    Orange #B35A00  (problem detected)
Active Tab: Always Dark Blue #002B80 (state colors = inactive only)

VOICE SERVER:
URL: http://localhost:31337/notify
Payload: {"message":"...", "voice_id":"...", "title":"..."}
Configure voice IDs in individual agent files (`agents/*.md` persona frontmatter)

```

---

## Shared Libraries

The hook system uses shared TypeScript libraries to eliminate code duplication:

### `hooks/lib/learning-utils.ts`
Shared learning categorization logic.

```typescript
import { getLearningCategory, isLearningCapture } from './lib/learning-utils';

// Categorize learning as SYSTEM (tooling/infra) or ALGORITHM (task execution)
const category = getLearningCategory(content, comment);
// Returns: 'SYSTEM' | 'ALGORITHM'

// Check if response contains learning indicators
const isLearning = isLearningCapture(text, summary, analysis);
// Returns: boolean (true if 2+ learning indicators found)
```

**Used by:** PromptProcessing, WorkCompletionLearning

### `hooks/lib/time.ts`
Shared PST timestamp utilities.

```typescript
import {
  getPSTTimestamp,    // "2026-01-10 20:30:00 PST"
  getPSTDate,         // "2026-01-10"
  getYearMonth,       // "2026-01"
  getISOTimestamp,    // ISO8601 with offset
  getFilenameTimestamp, // "2026-01-10-203000"
  getPSTComponents    // { year, month, day, hours, minutes, seconds }
} from './lib/time';
```

**Used by:** PromptProcessing, WorkCompletionLearning, SessionSummary

### `hooks/lib/identity.ts`
Identity and principal configuration from settings.json.

```typescript
import { getIdentity, getPrincipal, getDAName, getPrincipalName, getVoiceId } from './lib/identity';

const identity = getIdentity();    // { name, fullName, displayName, mainDAVoiceID, color, voice, personality }
const principal = getPrincipal();  // { name, pronunciation, timezone }
```

**Used by:** handlers/VoiceNotification.ts, PromptProcessing, handlers/TabState.ts

### `LIFEOS/TOOLS/Inference.ts`
Unified AI inference with four run levels (low/medium/high/max, bound via `models.ts` `EFFORT_MODEL`).

```typescript
import { inference } from '../../.claude/LIFEOS/TOOLS/Inference';

// Low (Haiku) - quick tasks, 15s timeout
const result = await inference({
  systemPrompt: 'Summarize in 3 words',
  userPrompt: text,
  level: 'low',
});

// Medium (Sonnet) - balanced reasoning, 30s timeout
const result = await inference({
  systemPrompt: 'Analyze sentiment',
  userPrompt: text,
  level: 'medium',
  expectJson: true,
});

// High (Opus) - deep reasoning, 90s timeout
const result = await inference({
  systemPrompt: 'Strategic analysis',
  userPrompt: text,
  level: 'high',
});

// Result shape
interface InferenceResult {
  success: boolean;
  output: string;
  parsed?: unknown;  // if expectJson: true
  error?: string;
  latencyMs: number;
  level: 'low' | 'medium' | 'high' | 'max';
}
```

**Used by:** PromptProcessing (consolidated from RatingCapture + UpdateTabTitle + SessionAutoName + SessionAnalysis + ModeClassifier + ClassifierTelemetry)

---

## Unified Event System

Alongside existing filesystem state writes (algorithm-state JSON, ISAs, session-names.json, etc.), hooks can emit structured events to a single append-only JSONL log. This provides a unified observability layer without replacing any existing state management.

### Components


### Usage in Hooks

Hooks call `appendEvent()` as a secondary write **alongside** their existing state writes. The emitter is synchronous, fire-and-forget, and silently swallows errors so it never blocks or crashes a hook.

```typescript
// Inside an existing hook, AFTER the normal state write:
// appendEvent() writes to ~/.claude/LIFEOS/MEMORY/STATE/events.jsonl
appendEvent({ type: 'work.created', source: 'ISASync', slug: 'my-task' });
```

### Event Structure

Every event has a common base shape plus type-specific fields:
- `timestamp` (ISO 8601) -- auto-injected by `appendEvent()`
- `session_id` -- auto-injected from `CLAUDE_SESSION_ID` env
- `source` -- the hook or handler name that emitted the event
- `type` -- dot-separated topic (e.g., `algorithm.phase`, `work.created`, `voice.sent`, `rating.captured`)

Events use a dot-separated topic hierarchy for filtering. A `custom.*` escape hatch allows arbitrary extension without modifying the type system.

### Event Type Categories

| Category | Types | Emitting Hooks |
|----------|-------|----------------|
| `work.*` | created, completed | ISASync, SessionCleanup |
| `session.*` | named, completed | SessionCleanup |
| `rating.*` | captured | SatisfactionCapture |
| `learning.*` | captured | WorkCompletionLearning |
| `voice.*` | sent | VoiceNotification |
| `isa.*` | synced | ISASync |
| `doc.*` | integrity | DocIntegrity |
| `build.*` | rebuild | RebuildSkill (DocRebuild handler) |
| `system.*` | integrity | IntegrityCheck |
| `settings.*` | counts_updated | UpdateCounts |
| `tab.*` | updated | TabState, PromptProcessing |
| `hook.*` | error | Any hook (error reporting) |
| `custom.*` | user-defined | Extensibility escape hatch |

### Consuming Events

```bash
# Live tail (real-time monitoring)
tail -f ~/.claude/LIFEOS/MEMORY/STATE/events.jsonl | jq

# Filter by type
tail -f ~/.claude/LIFEOS/MEMORY/STATE/events.jsonl | jq 'select(.type | startswith("algorithm."))'

# Programmatic (Node/Bun fs.watch)
import { watch } from 'fs';
const eventsPath = `${process.env.HOME}/.claude/LIFEOS/MEMORY/STATE/events.jsonl`;
watch(eventsPath, (eventType) => { /* read new lines */ });
```

### Key Principles

- **Additive only** -- events supplement existing state files, they never replace them
- **Append-only** -- `events.jsonl` is an immutable log, never rewritten or truncated by hooks
- **Graceful failure** -- write errors are swallowed; events are observability, not critical path
- **One file** -- all event types go to a single `events.jsonl` for simple tailing and watching

---

**Last Updated:** 2026-04-20
**Status:** Production — 10 event types, 3 observability loggers (count auto-computed by UpdateCounts.ts)
**Maintainer:** LifeOS System

### Drift & Routing hooks (added 2026-06-10, Fable-prompt upgrades R1/R4)

- **`DriftReminder.hook.ts`** (UserPromptSubmit) — deterministic voice/format drift nudges. Scans the Stop-hook last-response cache (`MEMORY/STATE/last-response.txt`) with the banned-vocab regex (`hooks/lib/banned-vocab.ts`, derived from DA_IDENTITY's ban list — regenerate when that list changes), banner-presence check, and em-dash count. Fires at most one `DRIFT-REMINDER:` context line; budget 1-per-5-turns (`MEMORY/STATE/drift-reminder.json`); consecutive identical findings dedupe, a clean response re-arms; 30-min staleness guard prevents firing on a previous session's cached response. No LLM calls.
- **`SkillSurface.hook.ts`** (UserPromptSubmit) — deterministic top-3 skill surfacing. Token/trigger-phrase index over `skills/*/SKILL.md` USE-WHEN descriptions, cached at `MEMORY/STATE/skill-index.json` (mtime-invalidated). Emits `LIKELY SKILLS (may not apply): …` only above a 2-trigger-hit confidence floor; gibberish surfaces nothing. No LLM calls.
- **Chain note:** UserPromptSubmit now runs 8 hooks, ≈270ms wall total (~33ms/hook, spawn-dominated). Consolidation into a single dispatcher process is a known future item.
