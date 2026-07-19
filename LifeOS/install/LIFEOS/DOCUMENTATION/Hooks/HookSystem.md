---
last_updated: 2026-07-11
last_updated_by: kai
last_reviewed: 2026-07-11
last_reviewed_by: kai
convention: pai-freshness-v1
version: 1.2.50
---

# Hook System

> Hooks are why the LifeOS runs when nobody is looking. The thesis (`LifeOs/LifeOsThesis.md`) assigns them their job: automate the loop — capture current state, enforce doctrine, fire the next move — without the principal having to ask. A hill-climb that only advances when prompted is a chatbot; the hook lifecycle below is what makes it an operating system.

> **LifeOS 5.0** — Stable event-driven automation infrastructure.

**Event-Driven Automation Infrastructure**

**Location:** `$LIFEOS_ROOT/hooks/`
**Configuration:** `$LIFEOS_ROOT/settings.json` (GENERATED — merged from `settings.system.json` + `LIFEOS/USER/CONFIG/settings.user.json` by `MergeSettings.ts`; for events the user file defines as a plain array — UserPromptSubmit, PostToolUse, PreToolUse, Stop, SessionEnd — the user array REPLACES the system array, so `settings.json` is the only registration truth)
**Status:** Active — hook count auto-computed by `UpdateCounts.ts` at session end

> **Post-consolidation state (2026-07-11 hooks-BPE pass).** 30 distinct `.hook.ts` files are registered in `settings.json` (31 counting `ContextReduction.hook.sh`), plus 2 Pulse HTTP routes; **38 `.hook.ts` files exist on disk.** The 8 files that are on disk but NOT registered directly are not dead — each is imported as a `run()`/`check()` module by a consolidating dispatcher and still runnable standalone via its own shim: `SystemFileGuard`, `CommunicationSkillGuard`, `EgressClassGuard` → `PreToolGuard`; `VerificationGate`, `WritingGate` → `StopGates`; `LoadMemory`, `MemoryDeltaSurface` → `MemoryTurnStart`; `LoopDetector` → `PostToolObserver`. The consolidation retired `TheRouter` entirely (mode/tier classification abolished; model rungs now live in `LIFEOS/TOOLS/models.ts` + `AgentInvocation.hook.ts`) and folded a family of single-purpose loggers/gates/painters into `EventLogger`, `TabState`, `StopGates`, `MemoryTurnStart`, `MemoryReviewFire`, and `PostToolObserver`. Details per event below.

---

## Overview

The LifeOS hook system is an event-driven automation infrastructure built on Claude Code's native hook support. Hooks are executable scripts (TypeScript/Python) that run automatically in response to specific events during Claude Code sessions.

**Core Capabilities:**
- **Session Management** - Auto-load context, capture summaries, manage state
- **Voice Notifications** - Text-to-speech announcements for task completions
- **History Capture** - Automatic work/learning documentation to `$LIFEOS_DIR/MEMORY/`
- **Security Validation** - Active (v5+, consolidated 2026-05-14) — Single `Safety.hook.ts` dispatching by `hook_event_name`: PermissionRequest gates outgoing tool calls via the shape classifier in `lib/safety-classifier.ts` (auto-allows safe shapes, neutral on dangerous/credential/injection); PostToolUse tags WebFetch/WebSearch responses with the "treat as data" warning + injection marker. Replaces the prior split between `SmartApprover.hook.ts` and `PromptInjection.hook.ts`. The v4.0 Inspector Pipeline was deleted 2026-05-06. See `LIFEOS/DOCUMENTATION/Security/README.md`.
- **Multi-Agent Support** - Agent-specific hooks with voice routing
- **Tab Titles** - Dynamic terminal tab updates with task context
- **Unified Event Stream** - All hooks emit structured events to `events.jsonl` for real-time observability

**Key Principle:** Most hooks run asynchronously and fail gracefully. Security hooks (e.g. `hooks/Safety.hook.ts`) are synchronous — the PermissionRequest path emits `decision: allow` JSON when safe (otherwise stdout is empty and the native engine prompts). All `.ts` hooks have `#!/usr/bin/env bun` shebangs and `+x` permissions — settings.json references them directly (e.g., `$LIFEOS_ROOT/hooks/Safety.hook.ts`) without a `bun` prefix. HTTP hooks (SkillGuard, AgentGuard) run via Pulse routes on `localhost:31337`.

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

**Current Hooks (fire order per settings.json):**
```json
{
  "SessionStart": [
    {
      "hooks": [
        { "type": "command", "command": "bun $LIFEOS_ROOT/hooks/HookHealer.hook.ts", "timeout": 10 },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/KittyEnvPersist.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/LoadContext.hook.ts" },
        { "type": "command", "command": "bun $LIFEOS_DIR/TOOLS/FreshnessCache.ts --quiet", "timeout": 5, "async": true },
        { "type": "command", "command": "bun $LIFEOS_DIR/TOOLS/SettingsBackport.ts; bun $LIFEOS_DIR/TOOLS/MergeSettings.ts --system $LIFEOS_ROOT/settings.system.json --user $LIFEOS_DIR/USER/CONFIG/settings.user.json --output $LIFEOS_ROOT/settings.json", "timeout": 15, "async": true }
      ]
    }
  ]
}
```

**What They Do:**
- `HookHealer.hook.ts` - Self-heals the registered-script exec-bit class: sweeps every script a settings hook execs directly, `chmod +x` on a missing exec bit, warns on a missing file/shebang. Registered via `bun <path>` so it is immune to losing its own exec bit. Writes `MEMORY/OBSERVABILITY/hook-healer.jsonl`.
- `KittyEnvPersist.hook.ts` - Persists Kitty terminal env vars both to the shared `MEMORY/STATE/kitty-env.json` and to a per-session `MEMORY/STATE/kitty-sessions/{sessionId}.json` (required by out-of-process consumers like Pulse voice daemon), then resets tab title to clean state
- `LoadContext.hook.ts` - Injects dynamic context (relationship, learning, work summary) as `<system-reminder>` at session start
- `FreshnessCache.ts` *(a `LIFEOS/TOOLS/` script, not a `hooks/` file)* - Warms the `pai-freshness-v1` staleness cache (async)
- `SettingsBackport.ts` + `MergeSettings.ts` *(TOOLS, not hooks)* - Backport source-vs-generated drift, then regenerate `settings.json` from `settings.system.json` + `settings.user.json` (async). This is why `settings.json` is a generated artifact.

---

### 2. **SessionEnd**
**When:** Claude Code session terminates (conversation ends)
**Use Cases:**
- Capture work completions and learning moments
- Generate session summaries
- Record relationship context
- Update system counts (skills, hooks, signals)
- Run integrity checks

**Current Hooks (fire order per settings.json):**
```json
{
  "SessionEnd": [
    {
      "hooks": [
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/WorkCompletionLearning.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/SessionCleanup.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/UpdateCounts.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/MemoryHealthGate.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/DocIntegrity.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/IntegrityCheck.hook.ts" }
      ]
    },
    {
      "hooks": [
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/ULWorkSync.hook.ts", "timeout": 60 }
      ]
    }
  ]
}
```

**What They Do:**
- `WorkCompletionLearning.hook.ts` - Reads ISA.md frontmatter for work metadata and ISC section for criteria status, captures learning to `MEMORY/LEARNING/` for significant work sessions
- `SessionCleanup.hook.ts` - Marks ISA.md frontmatter status→COMPLETED and sets completed_at timestamp, clears session state, resets tab, cleans session names
- `UpdateCounts.hook.ts` - Updates system counts (skills, hooks, signals, workflows, files) displayed in the startup banner
- `MemoryHealthGate.hook.ts` - Runs `MemoryHealthCheck.ts`: asserts all autonomic-memory hooks registered in BOTH settings files, code files present on disk, last reviewer fire within 7d, state file readable. Writes `memory-health.jsonl`; WARN/CRITICAL to stderr. Non-blocking. *(Moved from Stop to SessionEnd during the consolidation.)*
- `DocIntegrity.hook.ts` - Cross-reference + semantic drift checks + architecture-summary regen (`handlers/DocCrossRefIntegrity.ts`, `handlers/RebuildArchSummary.ts`); self-gates to a no-op when no system files changed. *(Moved from Stop to SessionEnd during the consolidation.)*
- `IntegrityCheck.hook.ts` - Runs DocCrossRefIntegrity and SystemIntegrity checks at session end
- `ULWorkSync.hook.ts` *(separate block, 60s timeout)* - Syncs UL GitHub-Issues work state at session end

> **Historical (retired 2026-07-11):** `RelationshipMemory.hook.ts` (captured relationship context to `MEMORY/RELATIONSHIP/`) is no longer registered and no longer on disk; relationship signal is carried by the autonomic memory reviewer instead.

---

### 3. **UserPromptSubmit**
**When:** User submits a new prompt to Claude
**Use Cases:**
- Update UI indicators
- Pre-process user input
- Capture prompts for analysis
- Detect ratings and sentiment

**Current Hooks (fire order per settings.json — 6 hooks):**
```json
{
  "UserPromptSubmit": [
    { "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/PromptProcessing.hook.ts", "timeout": 30, "async": true } ] },
    { "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/SatisfactionCapture.hook.ts", "timeout": 20, "async": true } ] },
    { "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/ReminderRouter.hook.ts", "timeout": 5, "async": true } ] },
    { "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/DriftReminder.hook.ts", "timeout": 5, "async": true } ] },
    { "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/MemoryTurnStart.hook.ts", "timeout": 8 } ] },
    { "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/AlgorithmNudge.hook.ts", "timeout": 5, "async": true } ] }
  ]
}
```

**What They Do:**

**PromptProcessing.hook.ts** — Tab Title + Session Naming via Haiku
- Single responsibility: terminal tab title updates and session auto-naming
- Fast paths: deterministic tab title on first prompt, deterministic session name fallback
- Inference: one Haiku call returning `{ tab_title, session_name }`
- Writes to: `session-names.json`, `work.json`, tab state, voice server
- **Naming-context isolation (2026-04-19):** `getRecentContext()` strips Assistant turns when `isFirstPrompt` is true. Session names are permanent, so scaffolding in assistant output — phase headers, agent names, SUMMARY lines — must never reach the naming prompt.

**SatisfactionCapture.hook.ts** — User satisfaction signal capture
- Reads `MEMORY/STATE/last-response.txt` (written by `LastResponseCache.hook.ts` at Stop) to access the previous response
- Detects explicit ratings ("8 - great"), positive praise, low-rating learning signals
- Writes to: `ratings.jsonl`, low-rating learning failures, complaint clusters
- Async (timeout 20s)

**ReminderRouter.hook.ts** — "remind me to X" → labeled GitHub issue in `WORK.REPO`
- Parses reminder-shaped prompts; routes to `gh issue create` with reminder labels
- Async (timeout 5s)

**DriftReminder.hook.ts** — Deterministic voice/format drift nudges (added 2026-06-10)
- Scans the Stop-hook last-response cache (`MEMORY/STATE/last-response.txt`) with the banned-vocab regex (`hooks/lib/banned-vocab.ts`), banner-presence check, and em-dash count
- Fires at most one `DRIFT-REMINDER:` context line; budget 1-per-5-turns (`MEMORY/STATE/drift-reminder.json`); consecutive identical findings dedupe, a clean response re-arms; 30-min staleness guard. No LLM calls.

**MemoryTurnStart.hook.ts** — the ONE UserPromptSubmit memory hook (consolidated 2026-07-11)
- Dispatcher merging two per-prompt memory modules, each still runnable standalone: `LoadMemory.run()` (`<pai-memory>` hot-layer injection) then `MemoryDeltaSurface.run()` (`<pai-memory-health>?` + `<pai-memory-delta>`)
- Hot-layer injection is gated: injects `<pai-memory>` on a session's FIRST prompt, whenever the memory files' content hash changes, or after 20 turns without an injection (compaction backstop); the 🧠 delta line stays every-turn
- Subagent skip checked once here. Failure caught per-module; never blocks the prompt
- The former cadence tick (`MemoryReviewTrigger.run()`) was removed from this path 2026-07-11 — `MemoryReviewFire` (Stop) now owns the whole memory-review cadence

**AlgorithmNudge.hook.ts** — Algorithm live nudge layer ("Events ask the rest"; unified 2026-07-11, formerly IsaNudge)
- TWO SCOPES. Always-on (any session): skill-routing on UserPromptSubmit (prompt matches a skill's USE WHEN → "invoke, don't handroll"; prebuilt index at `MEMORY/STATE/skill-usewhen-index.json`, detached rebuild, noise guards + per-skill 60-min cooldown) and late-ISA on PostToolUse (25+ tool calls, no registered run → "does done need writing down?", once per session)
- Run-scoped (live Algorithm run only): principal-message (UserPromptSubmit), probe-fail (PostToolUseFailure, execute/verify phases), agent-return / claim-close / stale-ISA / spend (~75 in-run tool calls with claims open, 30-min cooldown; tier-free replacement for the retired budget-half nudge) on PostToolUse
- Always-on **capability row** (2026-07-12, #1461): on `PostToolUseFailure` for a Bash command that exercises a Doctor-tracked capability (codex / wrangler / notify-curl / interceptor) while `MEMORY/STATE/capabilities.json` has that capability `broken`, fires ONE line with a static fix command (per-capability 60-min cooldown). Reads only `state` from the manifest — the fix string is a compile-time `CAP_FIX` constant, never sourced from the on-disk manifest (Forge audit: keeps a poisoned manifest from injecting runnable prose into model context). `declined`/`live`/absent-manifest all stay silent.
- Deterministic, zero inference, <20ms hot path; subagent tool events silenced via primary-transcript gate
- Registered on UserPromptSubmit (user settings, async) + PostToolUseFailure (system settings); PostToolUse reaches it via `PostToolObserver`'s import. Not a successor to the retired `SkillSurface.hook.ts` every-prompt top-3 line — routing nudges fire only on USE WHEN phrase match, driven by the 2026-07-11 dynamic-range audit's under-use finding

> **Historical — retired 2026-07-11 (hooks-BPE pass):**
> - **`TheRouter.hook.ts` retired entirely** (commit `4dd0fbe19`). It owned per-prompt Mode + Tier classification (emitting `MODE: MINIMAL|NATIVE|ALGORITHM | TIER: E1-E5`); that whole scheme was abolished. There is no successor classifier — the model discovers difficulty from the work, and model rungs now live in `LIFEOS/TOOLS/models.ts` + `AgentInvocation.hook.ts`. Its deterministic router libs (`router-deterministic`, `router-classifier`, `RouterShadow`, `ai-speak-patterns`) were deleted with it.
> - **`MemoryReviewTrigger.hook.ts` retired** (commit `4dd0fbe19`) — its per-prompt cadence tick was absorbed by `MemoryReviewFire` v2 at Stop.
> - **`SkillSurface.hook.ts` deleted** (commit `ac4f703ab`) — the deterministic top-3 skill-surfacing line is no longer emitted.
> - Earlier retirements still true: the v4.0 Inspector Pipeline (PromptGuard, ContentScanner, SmartApprover, SecurityPipeline, ContainmentGuard) and `RepeatDetection.hook.ts` were removed in the 2026-05-06 security simplification (tag `pre-bpe-cuts-2026-05-06`).

---

### 4. **Stop**
**When:** Main agent ({DA_IDENTITY.NAME}) completes a response
**Use Cases:**
- Voice notifications for task completion
- Capture work summaries and learnings
- **Update terminal tab with final state** (color + suffix based on outcome)

**Current Hooks (fire order per settings.json — 6 hooks):**
```json
{
  "Stop": [
    {
      "hooks": [
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/LastResponseCache.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/TabState.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/VoiceCompletion.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/ISARenderOnStop.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/StopGates.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/MemoryReviewFire.hook.ts" }
      ]
    }
  ]
}
```

**What They Do:**

Each Stop hook is a self-contained `.hook.ts` file that reads stdin via shared `hooks/lib/hook-io.ts`, calls its handler, and exits.

**`LastResponseCache.hook.ts`** — Cache last response for SatisfactionCapture bridge
- Writes `last_assistant_message` (or transcript fallback) to `MEMORY/STATE/last-response.txt`
- SatisfactionCapture and DriftReminder read this on the next UserPromptSubmit

**`TabState.hook.ts`** — Reset Kitty tab title/color after response *(the Stop branch; formerly `ResponseTabReset.hook.ts`, merged into the unified `TabState` hook 2026-07-10)*
- Calls `handlers/TabState.ts` to set the completed/past-tense state
- Same file also handles the PreToolUse and PostToolUse `AskUserQuestion` tab branches (see those events)

**`VoiceCompletion.hook.ts`** — Send 🗣️ voice line to TTS server
- Calls `handlers/VoiceNotification.ts` for voice delivery
- Voice gate: only main sessions (checks `kitty-sessions/{sessionId}.json`); subagents have no kitty-sessions file → voice blocked

**`ISARenderOnStop.hook.ts`** — Re-render edited ISAs at end-of-turn
- Reads the per-session state file written by `ISASync.hook.ts` on every ISA Edit/Write; for each ISA edited this turn spawns `ISARender.ts` ONLY IF the sibling `ISA.html` already exists (the ISA reached `phase: complete` at least once) — the doctrinal gate against constant remaking during authoring
- Renders spawned detached, never awaited (<100ms budget)

**`StopGates.hook.ts`** — the ONE Stop-event gate hook (consolidated 2026-07-11)
- Reads stdin ONCE and evaluates the per-turn gates in the old registration order; each gate file still owns its logic and stays runnable standalone:
  1. `VerificationGate.run()` — blocks done-claims lacking transcript evidence (T1 web-deploy / T2 flow / T3 appearance)
  2. `WritingGate.run()` — blocks publication prose without a real Pangram run (strong signals)
- The FIRST gate returning `decision:"block"` wins; the recovery turn re-runs all gates. Fails open per-gate so one gate's crash never silences the others
- `OutputFormatGate.run()` was dropped from the chain 2026-07-11 (it was telemetry-only and policed the retired mode-banner system; voice/format drift is now `DriftReminder`'s job)

**`MemoryReviewFire.hook.ts`** (v2) — owns the WHOLE memory-review cadence (consolidated 2026-07-11)
- On every primary-session Stop: `turn_count += 1`, `last_message_at = now`; if `turn_count >= turn_threshold` AND minutes since last review `>= min_minutes_between`, spawn `MemoryReviewer.ts` detached and reset
- Absorbed the former `MemoryReviewTrigger` per-prompt tick — firing at Stop already IS the quiet moment the idle/debounce machinery approximated, so `pending_review` stays false forever (kept for statusline schema compat)
- Subprocess is env-scrubbed (delete `ANTHROPIC_API_KEY` + `ANTHROPIC_AUTH_TOKEN`) to preserve subscription billing. State: `MEMORY/OBSERVABILITY/review-state.json`; params: `LIFEOS/USER/CONFIG/memory-review.json`

> **Historical (moved off Stop 2026-07-11):** `DocIntegrity.hook.ts` and `MemoryHealthGate.hook.ts` now run at SessionEnd (see Section 2). `OutputFormatGate.hook.ts` was deleted (commit `4dd0fbe19`).

**Tab State System:** See `TerminalTabs.md` for complete documentation

---

### 5. **PreToolUse**
**When:** Before Claude executes any tool
**Use Cases:**
- Security validation across write/exec operations (Bash, Write, Edit, MultiEdit) — `PreToolGuard` blocks USER content landing in SYSTEM files, raw email sends, and over-ceiling Tier-2 egress; the native permission denylist covers the rest
- Context reduction (RTK command rewrite on Bash)
- Tab state updates on questions
- Agent execution guardrails — Pulse HTTP route at localhost:31337/hooks/agent-guard
- Skill invocation validation — Pulse HTTP route at localhost:31337/hooks/skill-guard

**Current Hooks (per settings.json):**
```json
{
  "PreToolUse": [
    { "matcher": "Bash", "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/ContextReduction.hook.sh" } ] },
    { "matcher": "Skill", "hooks": [ { "type": "http", "url": "http://localhost:31337/hooks/skill-guard" } ] },
    { "matcher": "Agent", "hooks": [
        { "type": "http", "url": "http://localhost:31337/hooks/agent-guard" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/AgentInvocation.hook.ts" }
    ] },
    { "matcher": "AskUserQuestion", "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/TabState.hook.ts" } ] },
    { "matcher": "Bash|Write|Edit|MultiEdit", "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/PreToolGuard.hook.ts" } ] }
  ]
}
```

**Security guard (active — `PreToolGuard.hook.ts`, the ONE PreToolUse blocking dispatcher, consolidated 2026-07-11):** Reads stdin ONCE and routes by tool to the three isolated blocker modules (each still runnable standalone via its own shim), FIRST block wins (`exit 2`, message to stderr → model):
- `Write | Edit | MultiEdit` → `SystemFileGuard.check` (blocks deny-list USER content landing in a SYSTEM file; fail-OPEN)
- `Bash` → `CommunicationSkillGuard.check` (blocks raw email send; fail-OPEN), then `EgressClassGuard.check` (blocks over-ceiling Tier-2 egress; fail-CLOSED on a Tier-2-signature call whose classification throws, fail-OPEN otherwise)

Each check is wrapped in its own try/catch so one guard throwing can never suppress the others. `ContextReduction.hook.sh` stays a SEPARATE Bash hook because it REWRITES the command (`updatedInput`) rather than block/allow. `SkillGuard` and `AgentGuard` remain Pulse HTTP routes (`localhost:31337`); AgentGuard also injects a Monitor watchdog reminder for background agents (`run_in_background: true`) — `Tools/AgentWatchdog.ts` watches `tool-activity.jsonl` for silence. `AgentInvocation.hook.ts` captures subagent-start at the `Agent` boundary. See `DOCUMENTATION/Security/README.md` for full architecture.

**What They Do:**
- `ContextReduction.hook.sh` - Context reduction via [RTK](https://github.com/rtk-ai/rtk). Transparently rewrites Bash commands to `rtk` equivalents for 60-90% token reduction across git, build, test, lint, and package manager output. Runs on the Bash matcher. Meta commands (use directly, not through hook): `rtk gain` (savings analytics), `rtk gain --history` (command history), `rtk discover` (missed opportunities), `rtk proxy <cmd>` (bypass filtering). Note: if `rtk gain` fails, check for name collision with reachingforthejack/rtk (Rust Type Kit).
- `TabState.hook.ts` *(PreToolUse:AskUserQuestion branch; formerly `SetQuestionTab.hook.ts`)* - Sets the tab to teal "awaiting input" and saves the previous title so the PostToolUse branch can restore it when the question is answered.

> **Historical (retired 2026-07-11):** `SecurityPipeline.hook.ts` (the v4.0 Inspector Pipeline: PatternInspector → EgressInspector) is no longer registered — its blocking role was absorbed by `PreToolGuard` above and the native permission denylist. `SetQuestionTab.hook.ts` was merged into the unified `TabState.hook.ts`. The `Read` matcher was dropped (no PreToolUse security hook fires on Read anymore).

---

### 6. **PostToolUse**
**When:** After Claude executes any tool
**Status:** Active - Algorithm state tracking

**Current Hooks (per settings.json):**
```json
{
  "PostToolUse": [
    { "matcher": "Agent", "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/AgentInvocation.hook.ts" } ] },
    { "matcher": "WebFetch", "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/Safety.hook.ts", "timeout": 5 } ] },
    { "matcher": "WebSearch", "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/Safety.hook.ts", "timeout": 5 } ] },
    { "matcher": "mcp__.*([Gg]mail|[Mm]ail|[Dd]rive|[Cc]alendar|[Ii]nbox).*", "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/Safety.hook.ts", "timeout": 5 } ] },
    { "matcher": "ToolSearch", "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/Safety.hook.ts", "timeout": 5 } ] },
    { "matcher": "AskUserQuestion", "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/TabState.hook.ts" } ] },
    { "matcher": "Write", "hooks": [
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/ISASync.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/CheckpointPerISC.hook.ts", "timeout": 30 }
    ] },
    { "matcher": "Edit", "hooks": [
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/ISASync.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/CheckpointPerISC.hook.ts", "timeout": 30 }
    ] },
    { "matcher": "MultiEdit", "hooks": [
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/ISASync.hook.ts" },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/CheckpointPerISC.hook.ts", "timeout": 30 }
    ] },
    { "hooks": [
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/PostToolObserver.hook.ts", "timeout": 5 },
        { "type": "command", "command": "$LIFEOS_ROOT/hooks/EventLogger.hook.ts", "timeout": 5, "async": true }
    ] }
  ]
}
```

**What They Do:**

**AgentInvocation.hook.ts** *(matcher `Agent`)* - Records subagent-stop with duration at the `PostToolUse:Agent` boundary (also captures subagent-start at `PreToolUse:Agent`); this is where `subagent_type`/`description` are reliably present.

**Safety.hook.ts** *(matchers `WebFetch`, `WebSearch`, `mcp__…(Gmail|Mail|Drive|Calendar|Inbox)…`, `ToolSearch`)* - PostToolUse branch of the consolidated `Safety.hook.ts`: tags external content with the "treat as data" warning + injection marker. Same file dispatches the PermissionRequest branch (see Section: PermissionRequest).

**TabState.hook.ts** *(matcher `AskUserQuestion`; formerly `QuestionAnswered.hook.ts`)* - Restores the tab to working/orange after the user answers. Same unified file handles the PreToolUse question branch and the Stop reset.

**ISASync.hook.ts** *(matchers `Write`, `Edit`, `MultiEdit`)* - ISA Frontmatter → work.json Sync
- Fires after Write/Edit/MultiEdit to ISA files in `MEMORY/WORK/`; syncs ISA frontmatter (status, title, effort) to `MEMORY/STATE/work.json`; non-blocking, fire-and-forget
- Uses `hooks/lib/isa-utils.ts::appendPhase()` for phaseHistory with `source: "prd"` (the other source being voice notifications), dedup via upgrade to `source: "merged"`. See `LIFEOS/MEMORY/KNOWLEDGE/Ideas/dual-source-event-tracking-pattern.md`.

**CheckpointPerISC.hook.ts** *(matchers `Write`, `Edit`, `MultiEdit`; 30s timeout)* - Per-ISC auto-commit checkpoint of work-tree state.

**PostToolObserver.hook.ts** *(catch-all; the ONE sync catch-all hook, consolidated 2026-07-11)* - Dispatcher merging the two sync catch-all modules that emit `additionalContext`, joined into one `hookSpecificOutput`:
- `LoopDetector.run()` — exact-repeat / oscillation / hammering detection
- `AlgorithmNudge.run()` — the Algorithm live nudge layer (run-scoped: agent-return / claim-close / stale-ISA / spend; always-on: late-ISA when no run is registered)

**EventLogger.hook.ts** *(catch-all; async; the unified observability writer, consolidated 2026-07-10)* - On PostToolUse writes the ground-truth audit to `MEMORY/OBSERVABILITY/tool-activity.jsonl` and bumps the ISA heartbeat; when `tool == Skill` also appends to `MEMORY/SKILLS/execution.jsonl`. The same file dispatches PostToolUseFailure, StopFailure, and ConfigChange (see those events). Merged five former loggers: `ToolActivityTracker`, `SkillExecutionLog`, `ToolFailureTracker`, `StopFailureHandler`, `ConfigAudit`. Fail-open; never blocks a turn.

> **Historical (retired 2026-07-11):** `ContentScanner.hook.ts` (v4.0 InjectionInspector on the global matcher) is gone — external-content tagging is the `Safety.hook.ts` PostToolUse branch, now scoped to the specific egress/read matchers above. `TelosSummarySync.hook.ts` retired (commit `4dd0fbe19`) — PRINCIPAL_TELOS regeneration is handled by `DerivedSync` / `GenerateTelosSummary.ts` outside the hook layer. `ToolActivityTracker.hook.ts` and `QuestionAnswered.hook.ts` were folded into `EventLogger` and `TabState` respectively.

---

### 7. **PostToolUseFailure**
**When:** A tool execution fails
**Use Cases:**
- Track tool failure patterns for debugging
- Identify flaky tools or recurring errors
- Observability data for system health

**Current Hooks (per settings.json — 2 hooks):**
```json
{
  "PostToolUseFailure": [
    { "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/EventLogger.hook.ts" } ] },
    { "hooks": [ { "type": "command", "command": "$LIFEOS_ROOT/hooks/AlgorithmNudge.hook.ts", "timeout": 5 } ] }
  ]
}
```

**What They Do:**
- `EventLogger.hook.ts` *(PostToolUseFailure branch; formerly `ToolFailureTracker.hook.ts`)* - Appends structured failure events (tool name, error message, truncated tool input, session ID, timestamp) to `MEMORY/OBSERVABILITY/tool-failures.jsonl`. Lightweight, file append only, no inference calls.
- `AlgorithmNudge.hook.ts` - Fires the probe-failed nudge ("Claim wrong or code wrong? If the claim, update the ISA.") while an ALGORITHM-mode session is active.

---

### 8. **SubagentStart** *(not registered)*
**When:** A subagent is spawned (command-only event)
**Status:** Not present in `settings.json`. Claude Code's built-in `SubagentStart` payload omits `subagent_type` / `description` / `prompt`, so LifeOS tracks subagent lifecycle at the `PreToolUse:Agent` boundary via `AgentInvocation.hook.ts` (see Sections 5–6) where that data is reliably present.

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
          "command": "$LIFEOS_ROOT/hooks/EventLogger.hook.ts"
        }
      ]
    }
  ]
}
```

**What It Does:**
- `EventLogger.hook.ts` *(ConfigChange branch; formerly `ConfigAudit.hook.ts`, merged 2026-07-10)* - Appends config change events (config key, old → new summary, session ID, timestamp) to `MEMORY/OBSERVABILITY/config-changes.jsonl`; flags sensitive keys (permissions, hooks, env, mcpServers). Lightweight, file append only, no inference calls.
- **One improvement over the pre-merge behavior:** the settings-diff baseline snapshot moved from volatile `/tmp/pai-settings-snapshot.json` to `MEMORY/STATE/pai-settings-snapshot.json`, so the diff baseline now survives reboots.

---

### 10. **PreCompact** *(not registered)*
**When:** Before Claude compacts context (long conversations)
**Status:** Not present in `settings.json`; `PreCompact.hook.ts` is no longer on disk. Historically it captured active work context (task, ISA summary, files, decisions) to a stdout handover note preserved through compaction. Work-in-progress state is now carried by the ISA/`work.json` registry and the autonomic memory layer rather than a compaction hook.

---

### 11. **PostCompact** *(not registered)*
**When:** After Claude compacts context
**Status:** Not present in `settings.json`; `RestoreContext.hook.ts` is no longer on disk. It historically restored critical context after compaction.

---

### 12. **SubagentStop** *(not registered)*
**When:** A subagent completes (command-only event)
**Status:** Not present in `settings.json`. Subagent stop + duration is tracked at `PostToolUse:Agent` via `AgentInvocation.hook.ts` (see Sections 5–6) where `subagent_type`/`description`/duration are reliably present.

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
          "command": "$LIFEOS_ROOT/hooks/TaskGovernance.hook.ts"
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
**Status:** Active — `EventLogger.hook.ts` (StopFailure branch)

**Current Hooks:**
```json
{
  "StopFailure": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "$LIFEOS_ROOT/hooks/EventLogger.hook.ts"
        }
      ]
    }
  ]
}
```

**What It Does:**
- `EventLogger.hook.ts` *(StopFailure branch; formerly `StopFailureHandler.hook.ts`, merged 2026-07-10)* - Captures abnormal-stop diagnostics (log-only) to `MEMORY/SECURITY/<YYYY>/<MM>/stop-failures-<YYYY-MM-DD>.jsonl`.

---

### 15. **Elicitation** *(handler removed 2026-05-06)*
**When:** An MCP server requests structured input (e.g. Stripe, Bright Data mid-task prompt)
**Status:** Handler removed in BPE Phase A.2 (commit `1de31b0a7`). The single elicitation log file across the entire history contained one event (125 bytes from 2026-04-04). MCP elicitation already shows the dialog natively when the schema is unknown. Hook claimed it could auto-respond; never did.

To restore: `git revert 1de31b0a7`.

---

### 16. **FileChanged** *(handler removed 2026-05-06)*
**When:** A watched file is modified
**Status:** Handler removed in BPE Phase B.1 (commit `c43dbc019`). The PostToolUse catch-all logger (then `ToolActivityTracker`, now `EventLogger.hook.ts`) already captures every tool call including file paths and content — FileChanged was a redundant second log of the same events under a different schema.

To restore: `git revert c43dbc019`.

---

### 17. **InstructionsLoaded** *(not registered)*
**When:** Instructions (CLAUDE.md or project instructions) are loaded
**Status:** Not present in `settings.json`; `InstructionsLoadedHandler.hook.ts` is no longer on disk. CLAUDE.md / system-prompt / identity-file integrity is now checked by `InstructionsLoaded`-independent tooling — the SHA-256 audit runs inside `IntegrityCheck` / `HookHealer` and the release gates rather than a per-load hook.

---

## Configuration

### Location
**File:** `$LIFEOS_ROOT/settings.json`
**Section:** `"hooks": { ... }`

### Environment Variables
Hooks have access to all environment variables from `$LIFEOS_ROOT/settings.json` `"env"` section:

```json
{
  "env": {
    "LIFEOS_DIR": "$LIFEOS_ROOT",
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "64000"
  }
}
```

**Key Variables:**
- `LIFEOS_DIR` - LifeOS installation directory (typically `$LIFEOS_ROOT`)
- Hook scripts reference `$LIFEOS_ROOT` in command paths

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

> **Note:** `settings.json` is a **generated file** -- `MergeSettings.ts` writes it (async at SessionStart) by merging `settings.system.json` (SYSTEM) with `LIFEOS/USER/CONFIG/settings.user.json` (USER). For events the user file defines as a plain array (UserPromptSubmit, PostToolUse, PreToolUse, Stop, SessionEnd), the **user array REPLACES the system array** — so a system-side edit to those events silently no-ops unless the user file also carries it. Hooks read `settings.json` freely for runtime config, but manual edits are overwritten on the next merge. To make permanent changes, edit the appropriate source (`settings.system.json` or `settings.user.json`) and re-run `MergeSettings.ts`.

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
            "command": "$LIFEOS_ROOT/hooks/my-hook.ts --arg value"
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

**Session Mapping:** `$LIFEOS_DIR/MEMORY/STATE/agent-sessions.json`
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

**Full Documentation:** See `$LIFEOS_DIR/DOCUMENTATION/Pulse/TerminalTabs.md`

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
chmod +x $LIFEOS_ROOT/hooks/my-custom-hook.ts
```
> **Note:** Not needed when using the `bun` prefix in settings.json — all LifeOS hooks use `bun $LIFEOS_ROOT/hooks/...` which doesn't require the execute bit.

### Step 4: Add to settings.json
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$LIFEOS_ROOT/hooks/my-custom-hook.ts"
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
echo '{"session_id":"test","transcript_path":"/tmp/test.jsonl","hook_event_name":"Stop"}' | bun $LIFEOS_ROOT/hooks/my-custom-hook.ts
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
- Use `$LIFEOS_ROOT` in settings.json for portability
- Access in code via `process.env.LIFEOS_DIR`

### 7. **Logging**
- Log useful debug info to stderr for troubleshooting
- Include relevant metadata (session_id, tool_name, etc.)
- Never log sensitive data (API keys, user content)

---

## Troubleshooting

### Hook Not Running

**Check:**
1. Is hook script executable? `chmod +x $LIFEOS_ROOT/hooks/my-hook.ts` (not needed when using `bun` prefix — all LifeOS hooks use `bun` prefix)
2. Is path correct in settings.json? Use `bun $LIFEOS_ROOT/hooks/...`
3. Is settings.json valid JSON? `jq . $LIFEOS_ROOT/settings.json`
4. Did you restart Claude Code after editing settings.json?

**Debug:**
```bash
# Test hook directly
echo '{"session_id":"test","transcript_path":"/tmp/test.jsonl","hook_event_name":"Stop"}' | bun $LIFEOS_ROOT/hooks/my-hook.ts

# Check hook logs (stderr output)
tail -f $LIFEOS_ROOT/hooks/debug.log  # If you add logging
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
4. Is ElevenLabs API key in `$LIFEOS_ROOT/.env`?

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
1. Does `$LIFEOS_DIR/MEMORY/` directory exist?
2. Does `work.json` contain an entry for this session? `jq '.sessions | to_entries[] | select(.value.sessionUUID == "<uuid>")' $LIFEOS_DIR/MEMORY/STATE/work.json`
3. Is hook actually running? Check `$LIFEOS_DIR/MEMORY/RAW/` for events
4. File permissions? `ls -la $LIFEOS_DIR/MEMORY/WORK/`

**Debug:**
```bash
# All sessions in the registry, sorted by recency:
jq '.sessions | to_entries | map({slug: .key, phase: .value.phase, mode: .value.mode, updatedAt: .value.updatedAt}) | sort_by(.updatedAt) | reverse' $LIFEOS_DIR/MEMORY/STATE/work.json

# Hot session list via the Pulse API (uses the same data):
curl -s http://localhost:31337/api/algorithm | jq '.algorithms | map({sessionId, phase: .currentPhase, active})'

# Check recent work directories
ls -lt $LIFEOS_DIR/MEMORY/WORK/ | head -10
ls -lt $LIFEOS_DIR/MEMORY/LEARNING/$(date +%Y-%m)/ | head -10

# Check UUID-collision anomalies (multiple ISAs on one harness UUID):
tail $LIFEOS_DIR/MEMORY/OBSERVABILITY/work-anomalies.jsonl
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
1. Is `$LIFEOS_DIR/MEMORY/STATE/agent-sessions.json` writable?
2. Is `[AGENT:type]` tag in `🎯 COMPLETED:` line?
3. Is agent running from correct directory? (`/agents/name/`)

**Debug:**
```bash
# Check session mappings
cat $LIFEOS_DIR/MEMORY/STATE/agent-sessions.json | jq .

# Check subagent-stop debug log
tail -f $LIFEOS_ROOT/hooks/subagent-stop-debug.log
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
1. Does `$LIFEOS_ROOT/CLAUDE.md` exist?
2. Is `LoadContext.hook.ts` executable?
3. Is `LIFEOS_DIR` env variable set correctly?

**Debug:**
```bash
# Test context loading directly
bun $LIFEOS_ROOT/hooks/LoadContext.hook.ts

# Should output <system-reminder> with SKILL.md content
```

**Common Issues:**
- Subagent sessions loading main context → Fixed (subagent detection in hook)
- File not found → Check `LIFEOS_DIR` environment variable
- Permission denied → `chmod +x $LIFEOS_ROOT/hooks/LoadContext.hook.ts` (not needed when using `bun` prefix — all LifeOS hooks use `bun` prefix)

---

## Advanced Topics

### Multi-Hook Execution Order

Hooks in same event execute **sequentially** in order defined in settings.json:

```json
{
  "Stop": [
    {
      "hooks": [
        { "command": "$LIFEOS_ROOT/hooks/VoiceCompletion.hook.ts" }  // Example: one of several Stop hooks
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

- **Voice System:** `$LIFEOS_ROOT/`
- **Agent System:** `LIFEOS/DOCUMENTATION/Agents/AgentSystem.md`
- **History/Memory:** `$LIFEOS_DIR/DOCUMENTATION/Memory/MemorySystem.md`

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

HOOKS BY EVENT (11 events wired in settings.json; rebuilt from the generated
settings.json 2026-07-11 hooks-BPE pass. 30 distinct .hook.ts registered
[31 counting ContextReduction.hook.sh] + 2 Pulse HTTP routes; 38 .hook.ts on
disk — the 8 unregistered are imported as run()/check() modules by dispatchers,
noted [via X] below):

SESSION START (3 hooks + 2 TOOLS):
  bun HookHealer.hook.ts         Self-heal registered-script exec bits [timeout 10]
  KittyEnvPersist.hook.ts        Persist Kitty env vars + tab reset
  LoadContext.hook.ts            Dynamic context injection (relationship, learning, work)
  bun FreshnessCache.ts          (TOOL) warm pai-freshness cache [async]
  bun SettingsBackport.ts; MergeSettings.ts  (TOOLS) regenerate settings.json [async]

USER PROMPT SUBMIT (6 hooks, in fire order):
  PromptProcessing.hook.ts       Tab title + session naming via Haiku [async]
  SatisfactionCapture.hook.ts    User satisfaction signal capture (reads last-response.txt) [async]
  ReminderRouter.hook.ts         "remind me" parser → labeled GitHub issue [async]
  DriftReminder.hook.ts          Deterministic voice/format drift nudge, no LLM [async]
  MemoryTurnStart.hook.ts        ONE memory hook: LoadMemory [via X] + MemoryDeltaSurface [via X]
  AlgorithmNudge.hook.ts         Algorithm live nudge (skill-routing always-on; principal-message in ALGORITHM sessions) [async]

PRE TOOL USE (4 distinct hooks + 2 Pulse HTTP routes):
  ContextReduction.hook.sh       Context reduction via RTK — REWRITES command [Bash]
  Pulse HTTP: skill-guard        Skill invocation validation (Pulse:31337) [Skill]
  Pulse HTTP: agent-guard        Background watchdog + foreground warn (Pulse:31337) [Agent]
  AgentInvocation.hook.ts        subagent_start capture [Agent]
  TabState.hook.ts               Tab teal "awaiting input" [AskUserQuestion]
  PreToolGuard.hook.ts           ONE blocking dispatcher: SystemFileGuard.check [via X] on
                                 Write/Edit/MultiEdit; CommunicationSkillGuard.check [via X] +
                                 EgressClassGuard.check [via X] on Bash. FIRST block wins (exit 2).
                                 [Bash|Write|Edit|MultiEdit]

POST TOOL USE (7 distinct hooks):
  AgentInvocation.hook.ts        subagent_stop with duration [Agent]
  Safety.hook.ts                 Tag external content as data [WebFetch, WebSearch,
                                 mcp__.*(Gmail|Mail|Drive|Calendar|Inbox).*, ToolSearch] — same
                                 file as PermissionRequest hook below; dispatches by event
  TabState.hook.ts               Post-question tab restore [AskUserQuestion]
  ISASync.hook.ts                ISA → work.json sync [Write, Edit, MultiEdit]
  CheckpointPerISC.hook.ts       Per-ISC auto-commit [Write, Edit, MultiEdit; timeout 30]
  PostToolObserver.hook.ts       ONE sync catch-all: LoopDetector [via X] + AlgorithmNudge [via X] (catch-all) [timeout 5]
  EventLogger.hook.ts            Unified observability writer: tool-activity + skill-execution (catch-all) [async]

POST TOOL USE FAILURE (2 hooks):
  EventLogger.hook.ts            tool-failures.jsonl (formerly ToolFailureTracker)
  AlgorithmNudge.hook.ts               probe-failed nudge [timeout 5]

STOP (6 hooks, in fire order):
  LastResponseCache.hook.ts      Cache response for SatisfactionCapture + DriftReminder bridge
  TabState.hook.ts               Tab title/color reset after response (formerly ResponseTabReset)
  VoiceCompletion.hook.ts        Voice TTS (main sessions only)
  ISARenderOnStop.hook.ts        Re-render completed ISAs (only if ISA.html already exists)
  StopGates.hook.ts              ONE gate hook: VerificationGate.run [via X] then WritingGate.run [via X]; FIRST block wins
  MemoryReviewFire.hook.ts       Owns the WHOLE memory-review cadence: tick at Stop, fire MemoryReviewer.ts
                                 detached (env-scrubbed) at turn_threshold ∧ min_minutes_between. pending_review always false now.

STOP FAILURE (1 hook):
  EventLogger.hook.ts            Capture abnormal-stop diagnostics (formerly StopFailureHandler)

SUBAGENT START / SUBAGENT STOP (not registered):
  (keys absent — tracked at PreToolUse:Agent / PostToolUse:Agent → AgentInvocation.hook.ts)

PERMISSION REQUEST (1 hook, 2 matchers):
  Safety.hook.ts                 Shape-classifier auto-approve [Write|Edit|MultiEdit|Bash, mcp__.*]
                                 — same file as PostToolUse hook above; dispatches by event.
                                 PermissionRequest path uses lib/safety-classifier.ts to allow safe shapes
                                 (read-only commands, dev binaries, trusted-workspace targets, mcp pre-vetted,
                                 shell-control-flow over data) and falls through to native prompt on
                                 dangerous/credential/injection shapes. Cache + observability JSONL.

TASK CREATED (1 hook):
  TaskGovernance.hook.ts         Empty-description block + task rate limit

CONFIG CHANGE (1 hook):
  EventLogger.hook.ts            Security audit trail to OBSERVABILITY/ (formerly ConfigAudit)

SESSION END (7 hooks):
  WorkCompletionLearning.hook.ts Work/learning capture to MEMORY/
  SessionCleanup.hook.ts         Mark WORK dir complete, clear state, reset tab
  UpdateCounts.hook.ts           Refresh system counts (skills, hooks, signals)
  MemoryHealthGate.hook.ts       MemoryHealthCheck.ts: autonomic-memory registration/health assertions → memory-health.jsonl
  DocIntegrity.hook.ts           Cross-ref + arch-summary regen (self-gates when no system files changed)
  IntegrityCheck.hook.ts         System integrity checks
  ULWorkSync.hook.ts             UL GitHub-Issues task sync [separate block; timeout 60]

NOT REGISTERED (event keys absent from settings.json; hook files also gone):
  PreCompact / PostCompact / InstructionsLoaded — see Sections 10, 11, 17.

RETIRED IN THE 2026-07-11 HOOKS-BPE PASS (deleted or folded):
  TheRouter, MemoryReviewTrigger, OutputFormatGate, SecurityPipeline,
  ContentScanner, TelosSummarySync, RelationshipMemory, GrepWiringEnrich,
  IdentityToSettingsSync, SettingsBackport.hook — folded loggers/gates/painters:
  ToolActivityTracker+ToolFailureTracker+SkillExecutionLog+ConfigAudit+
  StopFailureHandler → EventLogger; SetQuestionTab+QuestionAnswered+
  ResponseTabReset → TabState; VerificationGate+WritingGate → StopGates;
  LoadMemory+MemoryDeltaSurface → MemoryTurnStart; LoopDetector → PostToolObserver;
  SystemFileGuard+CommunicationSkillGuard+EgressClassGuard → PreToolGuard.

KEY FILES:
$LIFEOS_ROOT/settings.json              Hook configuration (GENERATED by MergeSettings.ts — read, don't hand-edit)
$LIFEOS_ROOT/settings.system.json       System-side hook/permission source (SYSTEM)
$LIFEOS_DIR/USER/CONFIG/settings.user.json  User-side source (USER); its plain-array events REPLACE the system array
$LIFEOS_DIR/TOOLS/MergeSettings.ts  Merges system + user → settings.json (runs async at SessionStart)
$LIFEOS_ROOT/hooks/                     Hook scripts (39 files: 38 .hook.ts + ContextReduction.hook.sh; 30 .hook.ts registered)
$LIFEOS_ROOT/hooks/handlers/            Handler modules (7 files)
$LIFEOS_ROOT/hooks/lib/                 Shared libraries (27 files)
$LIFEOS_ROOT/hooks/lib/learning-utils.ts Learning categorization
$LIFEOS_ROOT/hooks/lib/time.ts          PST timestamp utilities
$LIFEOS_DIR/MEMORY/WORK/               Work tracking
$LIFEOS_DIR/MEMORY/LEARNING/           Learning captures
$LIFEOS_DIR/MEMORY/STATE/              Runtime state
$LIFEOS_DIR/MEMORY/STATE/events.jsonl  Unified event log (append-only)
$LIFEOS_DIR/MEMORY/OBSERVABILITY/      Tool failures, agent spawns, config changes

INFERENCE TOOL (for hooks needing AI):
Path: $LIFEOS_DIR/TOOLS/Inference.ts
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
// appendEvent() writes to $LIFEOS_DIR/MEMORY/STATE/events.jsonl
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
tail -f $LIFEOS_DIR/MEMORY/STATE/events.jsonl | jq

# Filter by type
tail -f $LIFEOS_DIR/MEMORY/STATE/events.jsonl | jq 'select(.type | startswith("algorithm."))'

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

**Last Updated:** 2026-07-11
**Status:** Production — unified `events.jsonl` log; `EventLogger.hook.ts` is now the single observability writer across PostToolUse/PostToolUseFailure/StopFailure/ConfigChange (count auto-computed by UpdateCounts.ts)
**Maintainer:** LifeOS System

### Drift & Routing hooks (added 2026-06-10, Fable-prompt upgrades R1/R4)

- **`DriftReminder.hook.ts`** (UserPromptSubmit) — deterministic voice/format drift nudges. Scans the Stop-hook last-response cache (`MEMORY/STATE/last-response.txt`) with the banned-vocab regex (`hooks/lib/banned-vocab.ts`, derived from DA_IDENTITY's ban list — regenerate when that list changes), banner-presence check, and em-dash count. Fires at most one `DRIFT-REMINDER:` context line; budget 1-per-5-turns (`MEMORY/STATE/drift-reminder.json`); consecutive identical findings dedupe, a clean response re-arms; 30-min staleness guard prevents firing on a previous session's cached response. No LLM calls.
- **`SkillSurface.hook.ts`** *(retired 2026-07-11, commit `ac4f703ab`)* — historically a deterministic top-3 skill surfacer on UserPromptSubmit (`LIKELY SKILLS (may not apply): …`). Deleted in the hooks-BPE pass; no longer registered or on disk.
- **Chain note (updated 2026-07-11):** the UserPromptSubmit chain is 6 hooks (`PromptProcessing`, `SatisfactionCapture`, `ReminderRouter`, `DriftReminder`, `MemoryTurnStart`, `AlgorithmNudge`); the earlier per-prompt memory trio was already collapsed into `MemoryTurnStart`. The single-dispatcher-process consolidation the old note anticipated has partly landed via the per-event dispatchers (`MemoryTurnStart`, `PostToolObserver`, `StopGates`, `PreToolGuard`, `EventLogger`, `TabState`).
