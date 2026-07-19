# LifeOS Hook System

> **Lifecycle event handlers that extend Claude Code with voice, memory, classifier routing, and integrity checks.**

This document is the authoritative reference for LifeOS's hook system. When modifying any hook, update both the hook's inline documentation AND this README.

*Last updated: 2026-05-06 — post bpe-cuts. Pre-state tag: `pre-bpe-cuts-2026-05-06`.*

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Hook Lifecycle Events](#hook-lifecycle-events)
3. [Hook Registry](#hook-registry)
4. [Inter-Hook Dependencies](#inter-hook-dependencies)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Shared Libraries](#shared-libraries)
7. [Configuration](#configuration)
8. [Documentation Standards](#documentation-standards)
9. [Maintenance Checklist](#maintenance-checklist)
10. [Migration Notes](#migration-notes)

---

## Architecture Overview

Hooks are TypeScript scripts that execute at specific lifecycle events in Claude Code. They enable:

- **Mode/tier routing**: classifier (`TheRouter`) decides MINIMAL/NATIVE/ALGORITHM + tier on every prompt
- **Voice feedback**: spoken phase announcements and completion lines
- **Memory capture**: session summaries, work tracking, learnings, relationship notes
- **Security**: native `permissions.deny` + a single `Safety.hook.ts` that dispatches by event — gates outgoing tool calls (PermissionRequest) and tags external content (PostToolUse)
- **Context injection**: identity, dynamic context, post-compaction restoration

### Design Principles

1. **Non-blocking by default**: Hooks should not delay the user experience.
2. **Fail gracefully**: Errors in one hook must not crash the session.
3. **Single responsibility**: Each hook does one thing well.
4. **Shared utilities over duplication**: Use `hooks/lib/hook-io.ts` for stdin reading.
5. **The model is the security boundary**: Constitutional Security Protocol in `LIFEOS_SYSTEM_PROMPT.md` + native `permissions.deny` in `settings.json`. Hooks don't enforce — they tag.

### Execution Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Claude Code Session                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SessionStart ──┬──► KittyEnvPersist (terminal env + tab reset)     │
│                 ├──► LoadContext (dynamic context injection)        │
│                 └──► FreshnessCache (statusline jq cache)           │
│                                                                     │
│  UserPromptSubmit ──┬──► TheRouter   (MODE+TIER classifier)      │
│                     ├──► PromptProcessing (tab title + naming)      │
│                     ├──► SatisfactionCapture (rating + signals)     │
│                     └──► ReminderRouter (/remind → labeled issue)   │
│                                                                     │
│  PreToolUse ──┬──► ContextReduction (Bash → rtk rewrite)            │
│               ├──► ArtWorkflowGuard (Bash, Art skill enforcement)   │
│               ├──► SetQuestionTab (AskUserQuestion → teal tab)      │
│               ├──► AgentInvocation (Agent → subagent_start)         │
│               ├──► AgentGuard (HTTP route on Pulse 31337)           │
│               └──► SkillGuard (HTTP route on Pulse 31337)           │
│                                                                     │
│  PostToolUse ──┬──► AgentInvocation (Agent → subagent_stop)         │
│                ├──► Safety (WebFetch/WebSearch → tag as data)       │
│                ├──► QuestionAnswered (AskUserQuestion → reset tab)  │
│                ├──► ISASync (Edit/Write/MultiEdit → work.json)      │
│                ├──► CheckpointPerISC (Edit/Write/MultiEdit auto-commit)│
│                ├──► TelosSummarySync (Edit/Write/MultiEdit on TELOS)│
│                └──► ToolActivityTracker (catch-all observability)   │
│                                                                     │
│  PostToolUseFailure ──► ToolFailureTracker (error logging)          │
│                                                                     │
│  Stop ──┬──► LastResponseCache  (cache for SatisfactionCapture)     │
│         ├──► ResponseTabReset   (Kitty tab reset)                   │
│         ├──► VoiceCompletion    (TTS voice line)                    │
│         └──► DocIntegrity       (cross-refs + arch summary regen)   │
│                                                                     │
│  StopFailure ──► StopFailureHandler (API error logging + voice)     │
│  PostCompact ──► RestoreContext (re-inject context post-compaction) │
│  PreCompact  ──► PreCompact (handover note before compaction)       │
│  TaskCreated ──► TaskGovernance (rate-limit + quality gate)         │
│  ConfigChange ──► ConfigAudit (settings.json diff log)              │
│  InstructionsLoaded ──► InstructionsLoadedHandler (SHA-256 audit)   │
│                                                                     │
│  SessionEnd ──┬──► WorkCompletionLearning (insight extraction)      │
│               ├──► ULWorkSync (Algorithm work → GitHub issue)       │
│               ├──► SessionCleanup (work completion + state clear)   │
│               ├──► RelationshipMemory (relationship notes)          │
│               ├──► UpdateCounts (settings.json counts + cache)      │
│               └──► IntegrityCheck (system file change detection)    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Hook Lifecycle Events

| Event | When It Fires | Typical Use Cases |
|-------|---------------|-------------------|
| `SessionStart` | Session begins | Context loading, banner display, terminal env, freshness cache |
| `UserPromptSubmit` | User sends a message | Mode/tier classification, tab title, session naming, satisfaction capture, reminder routing |
| `PreToolUse` | Before a tool executes | Command rewrite, skill/agent enforcement, UI state |
| `PostToolUse` | After a tool executes | ISA sync, checkpoint commit, observability, external content tagging |
| `PostToolUseFailure` | Tool execution fails | Error tracking, debugging observability |
| `Stop` | Claude responds | Voice feedback, tab updates, doc integrity |
| `StopFailure` | Turn ends due to API error | Error logging, voice notification |
| `PreCompact` / `PostCompact` | Around compaction | Handover note out, context restoration in |
| `TaskCreated` | Subagent creates a task | Rate-limit + quality gate |
| `ConfigChange` | settings.json modified | Security audit trail |
| `InstructionsLoaded` | CLAUDE.md and rules files load | SHA-256 baseline audit |
| `SessionEnd` | Session terminates | Summary, learning, GitHub sync, counts, relationship memory |

### Event Payload Structure

All hooks receive JSON via stdin with event-specific fields:

```typescript
interface BasePayload {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
}

interface UserPromptPayload extends BasePayload {
  prompt: string;
}

interface PreToolUsePayload extends BasePayload {
  tool_name: string;
  tool_input: Record<string, any>;
}

interface StopPayload extends BasePayload {
  stop_hook_active: boolean;
}
```

---

## Hook Registry

### SessionStart Hooks

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `KittyEnvPersist.hook.ts` | Persist Kitty env vars + tab reset | No | None |
| `LoadContext.hook.ts` | Ground `{{LIFEOS_*}}` runtime paths, then inject relationship/learning/work context (path contract also loads for subagents) | Yes (stdout) | `settings.json`, `MEMORY/` |
| (inline) `FreshnessCache.ts` | Statusline freshness cache | No | None |

### UserPromptSubmit Hooks (in fire order)

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `TheRouter.hook.ts` | Mode + Tier classification → additionalContext | No | Inference (Sonnet via `claude` subprocess) |
| `PromptProcessing.hook.ts` | Tab title + session naming via Haiku | No | Inference (Haiku), Voice Server, `session-names.json` |
| `SatisfactionCapture.hook.ts` | Rating capture + low-rating learning signals | No | `last-response.txt` (from LastResponseCache), `ratings.jsonl` |
| `ReminderRouter.hook.ts` | "remind me to X" → labeled GitHub issue | No | `WORK.REPO` config, `gh` CLI |

### PreToolUse Hooks

| Hook | Matcher | Purpose | Blocking | Dependencies |
|------|---------|---------|----------|--------------|
| `PreToolGuard.hook.ts` | Bash / Write / Edit / MultiEdit / Read / Glob / Grep | Block unresolved `{{LIFEOS_*}}` tool paths for every matcher; dispatch the existing write/egress guards on their applicable tools | Yes (exit 2) | `SystemFileGuard`, `CommunicationSkillGuard`, `EgressClassGuard` |
| `ContextReduction.hook.sh` | Bash | rtk rewrite of STATUS-path commands only (git/gh/test/build/lint/containers — 60-90% token savings). READ-path commands (rg/grep, cat/head, ls/tree/find, diff, curl/wget, psql/aws) are NEVER rewritten: rtk's parse-fail falls back to a different binary (rg→BSD grep) and silently corrupts results the model reasons over. Invariant in hook header; incident 2026-06-10. Regression gate: `cd hooks && bun test ContextReduction.test.ts` (30 probes — read-path identity + kept-class structure). | Yes (updatedInput) | `rtk` binary, `jq` |
| `ArtWorkflowGuard.hook.ts` | Bash | Block freeform Art skill calls (force `--workflow=`) | Yes (decision) | None |
| `SetQuestionTab.hook.ts` | AskUserQuestion | Set teal tab for questions | No | Kitty terminal |
| `AgentInvocation.hook.ts` | Agent | Log subagent_start with real subagent_type | No | `MEMORY/OBSERVABILITY/` |
| *(Pulse HTTP route)* AgentGuard | Agent | Foreground agent warn / background watchdog inject | No | Pulse server `localhost:31337` |
| *(Pulse HTTP route)* SkillGuard | Skill | Erroneous-invocation guard | No | Pulse server `localhost:31337` |

> **Note:** AgentGuard and SkillGuard are NOT files on disk — they run as routes within the Pulse server.

### PostToolUse Hooks

| Hook | Matcher | Purpose | Blocking | Dependencies |
|------|---------|---------|----------|--------------|
| `AgentInvocation.hook.ts` | Agent | Log subagent_stop with duration | No | `MEMORY/OBSERVABILITY/` |
| `Safety.hook.ts` | WebFetch / WebSearch | Tag external content with "treat as data" warning + injection-shape marker. Same file as the PermissionRequest hook below; dispatches by event. | No | `lib/safety-classifier.ts` |
| `QuestionAnswered.hook.ts` | AskUserQuestion | Reset tab state after question answered | No | Kitty terminal |
| `ISASync.hook.ts` | Edit / Write / MultiEdit | Sync ISA frontmatter → `work.json` + KV push | No | `MEMORY/WORK/`, `work.json` |
| `CheckpointPerISC.hook.ts` | Edit / Write / MultiEdit | Auto-commit per-ISC durability checkpoint | No | `{{LIFEOS_ROOT}}/checkpoint-repos.txt` |
| `TelosSummarySync.hook.ts` | Edit / Write / MultiEdit | Regenerate `PRINCIPAL_TELOS.md` on TELOS edits | No | `GenerateTelosSummary.ts` |
| `ToolActivityTracker.hook.ts` | (catch-all) | Ground-truth audit log of every tool call | No | `MEMORY/OBSERVABILITY/tool-activity.jsonl` |

### PermissionRequest Hooks

| Hook | Matcher | Purpose | Blocking | Dependencies |
|------|---------|---------|----------|--------------|
| `Safety.hook.ts` | Write / Edit / MultiEdit / Bash, mcp__.* | Shape-classifier gate on outgoing tool calls. Auto-allows safe shapes (read-only commands, dev binaries, trusted-workspace paths, shell-control-flow over data, mcp pre-vetted). Falls through to native engine prompt on dangerous/credential/injection shapes or unknown commands. Cache + observability. Same file as the PostToolUse hook above; dispatches by event. | Yes (allow JSON when safe) | `lib/safety-classifier.ts`, `MEMORY/STATE/permission-cache.json`, `MEMORY/OBSERVABILITY/permission-decisions.jsonl` |

### PostToolUseFailure Hooks

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `ToolFailureTracker.hook.ts` | Log tool failures for debugging observability | No | `MEMORY/OBSERVABILITY/` |

### Stop Hooks (in fire order — matters for the LastResponseCache → SatisfactionCapture bridge)

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `LastResponseCache.hook.ts` | Cache last response for SatisfactionCapture bridge | No | None |
| `ResponseTabReset.hook.ts` | Reset Kitty tab title/color after response | No | Kitty terminal |
| `VoiceCompletion.hook.ts` | Send 🗣️ voice line to TTS server | No | Voice Server |
| `DocIntegrity.hook.ts` | Cross-ref + semantic drift checks + arch summary regen | No | Inference API, handlers/ |

### StopFailure Hooks

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `StopFailureHandler.hook.ts` | Log API errors (rate limit, auth, server errors) + voice | No | `MEMORY/SECURITY/`, Voice Server |

### PreCompact / PostCompact Hooks

| Hook | Event | Purpose | Blocking | Dependencies |
|------|-------|---------|----------|--------------|
| `PreCompact.hook.ts` | PreCompact | Handover note preserving context across compaction boundary | No (stdout) | `MEMORY/STATE/`, ISA |
| `RestoreContext.hook.ts` | PostCompact | Re-inject contextual knowledge (PROJECTS, identity, ISA) | Yes (stdout) | `settings.json` `postCompactRestore.fullFiles` |

### TaskCreated Hooks

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `TaskGovernance.hook.ts` | Block empty descriptions; rate-limit 50 tasks/session | Yes (decision) | None (per-session counter in `/tmp`) |

### ConfigChange Hooks

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `ConfigAudit.hook.ts` | Settings.json diff log for security audit | No | `MEMORY/OBSERVABILITY/config-changes.jsonl` |

### InstructionsLoaded Hooks

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `InstructionsLoadedHandler.hook.ts` | SHA-256 audit of CLAUDE.md, system prompt, identity files | No | `MEMORY/STATE/instruction-hashes.json` |

### Subagent Lifecycle Hooks

Subagent lifecycle is tracked via `AgentInvocation.hook.ts` on `PreToolUse:Agent` and `PostToolUse:Agent` — Claude Code's built-in `SubagentStart`/`SubagentStop` payloads omit `subagent_type` / `description` / `prompt`, so we capture at the tool-use boundary where that data is reliably present.

Outputs: `subagent-events.jsonl` (start + stop events), correlated by `session_id + description`.

### SessionEnd Hooks (in fire order)

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `WorkCompletionLearning.hook.ts` | Extract learnings from work | No | Inference API, `MEMORY/LEARNING/` |
| `ULWorkSync.hook.ts` | Sync Algorithm work to GitHub issue in `WORK.REPO` | No | `gh` CLI, `WORK.REPO` config |
| `SessionCleanup.hook.ts` | Mark work complete + clear state | No | `MEMORY/WORK/`, `MEMORY/STATE/work.json` |
| `RelationshipMemory.hook.ts` | Capture relationship notes (W/B/O markers) | No | `MEMORY/RELATIONSHIP/` |
| `UpdateCounts.hook.ts` | Update settings.json counts (skills/hooks/...) + Anthropic usage cache | No | `settings.json`, Anthropic API |
| `IntegrityCheck.hook.ts` | System file change detection → spawn IntegrityMaintenance | No | `MEMORY/STATE/integrity-state.json`, handlers/ |

---

## Inter-Hook Dependencies

### Mode/Tier Classification Flow

```
User Message
    │
    ▼
TheRouter ─── Stage A: deterministic fast-paths (/eN, ratings, praise) ──► emit + exit
    │ (no fast match)
    ├── Stage B: 60s decision cache (SHA-256 normalized prompt) ──► emit cached + exit
    │ (no cache hit)
    ▼
    Stage C: TheRouter classifier (Inference.ts --level high — Opus; re-pinned off max 2026-07-01 so max=Fable stays off the per-prompt path)
    │
    └── Emit: MODE: <…> | TIER: <…> | REASON: <…> | SOURCE: classifier|fail-safe|fast-path|cache|explicit
        Written to additionalContext via hookSpecificOutput.

PromptProcessing ── Tab title (Haiku) + session naming (Haiku) ──► tab state + session-names.json
SatisfactionCapture ── Rating + signals (reads last-response.txt) ──► ratings.jsonl + learning capture
ReminderRouter ── /remind parser ──► gh issue create with reminder labels
```

**Order matters.** TheRouter fires first so PromptProcessing and downstream hooks can read the classification line if needed. SatisfactionCapture reads `last-response.txt` written by `LastResponseCache.hook.ts` at the previous Stop.

### Stop → UserPromptSubmit Bridge

```
Stop:
  LastResponseCache  →  writes MEMORY/STATE/last-response.txt
  ResponseTabReset   →  Kitty tab → completion state
  VoiceCompletion    →  🗣️ line → TTS
  DocIntegrity       →  cross-ref scan + arch summary regen

[Next user prompt arrives]

UserPromptSubmit:
  TheRouter            (independent of last-response)
  PromptProcessing        (independent of last-response)
  SatisfactionCapture  ◄─ reads last-response.txt for sentiment scoring
  ReminderRouter          (independent of last-response)
```

### Work Tracking Flow

```
SessionStart
    │
    ▼
Algorithm (AI) ─► Creates WORK/<slug>/ISA.md directly
    │                                          │
    │                                          ▼ ISASync.hook.ts (PostToolUse)
    │                               MEMORY/STATE/work.json
    │                              (canonical session registry,
    │                               keyed by slug, includes sessionUUID)
    ▼
SessionEnd ─┬─► WorkCompletionLearning ─► reads work.json by sessionUUID
            ├─► ULWorkSync ─► finds slug via work.json, pushes ISA to gh issue in WORK.REPO
            └─► SessionCleanup ─► Marks phase=complete in work.json
```

**Coordination:** `MEMORY/STATE/work.json` is the shared registry. `ISASync` writes it on every ISA edit; `PromptProcessing` upserts native rows; SessionEnd hooks resolve "what was this session working on" by matching `sessionUUID`. The legacy `current-work.json` / `current-work-{sessionId}.json` contract was a phantom (read by 7+ files, written by zero) and is gone — `work.json` is the single source of truth.

### Voice + Tab State Flow

```
UserPromptSubmit
    ├─► TheRouter        (no tab interaction)
    ├─► PromptProcessing
    │       ├─► Sets tab to PURPLE (#5B21B6) ─► "🧠 Processing..."
    │       ├─► Single Haiku inference (title + name)
    │       └─► Sets tab to ORANGE (#B35A00) ─► "⚙️ Fixing auth..."
    └─► SatisfactionCapture  (no tab interaction)

PreToolUse (AskUserQuestion)
    └─► SetQuestionTab ─► Sets tab to AMBER (#604800) ─► Shows question summary

PostToolUse (AskUserQuestion)
    └─► QuestionAnswered ─► Restores tab to working state

Stop
    ├─► ResponseTabReset → DEFAULT (UL blue) + past-tense title
    └─► VoiceCompletion → 🗣️ TTS announcement
```

---

## Data Flow Diagrams

### Memory System Integration

```
┌──────────────────────────────────────────────────────────────────┐
│                         MEMORY/                                  │
├────────────────┬─────────────────┬───────────────────────────────┤
│    WORK/       │   LEARNING/     │   STATE/  +  OBSERVABILITY/   │
│ ┌────────────┐ │ ┌─────────────┐ │ ┌───────────────────────────┐ │
│ │ Session    │ │ │ SIGNALS/    │ │ │ work.json (sessions)      │ │
│ │ ISA.md     │ │ │ ratings.jsonl│ │ │ last-response.txt         │ │
│ │ ephemeral/ │ │ │ FAILURES/   │ │ │ session-names.json        │ │
│ └─────▲──────┘ │ └──────▲──────┘ │ │ tool-activity.jsonl       │ │
└───────┼────────┴────────┼────────┴─┴───────▲───────────────────┴─┘
        │                 │                  │
┌───────┴─────────────────┴──────────────────┴─────────────────────┐
│                            HOOKS                                 │
│  ISASync ─────────────────────────────────────► work.json        │
│  PromptProcessing ────────────────────────────► session-names.json│
│  SatisfactionCapture ─────────────────────────► ratings.jsonl    │
│  LastResponseCache ───────────────────────────► last-response.txt│
│  ToolActivityTracker ─────────────────────────► tool-activity    │
│  ToolFailureTracker ──────────────────────────► tool-failures    │
│  AgentInvocation ─────────────────────────────► subagent-events  │
│  ConfigAudit ─────────────────────────────────► config-changes   │
│  WorkCompletionLearning ──────────────────────► LEARNING/        │
│  RelationshipMemory ──────────────────────────► RELATIONSHIP/    │
│  SessionCleanup ──────────────────────────────► WORK/ + state    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Shared Libraries

Located in `hooks/lib/`:

| Library | Purpose | Used By |
|---------|---------|---------|
| `identity.ts` | Get DA name, principal from settings | Most hooks |
| `time.ts` | PST timestamps, ISO formatting | Rating hooks, work hooks |
| `paths.ts` | Canonical path construction | All hooks |
| `notifications.ts` | ntfy push notifications | SessionEnd hooks |
| `output-validators.ts` | Tab title + voice output validation | PromptProcessing, TabState, VoiceNotification, SetQuestionTab |
| `isa-utils.ts` | ISA / work.json manipulation | PromptProcessing, ISASync |
| `isa-template.ts` | ISA markdown template | Algorithm |
| `hook-io.ts` | Shared stdin reader + transcript parser | All Stop hooks |
| `learning-utils.ts` | Learning categorization | Rating hooks, WorkCompletion |
| `change-detection.ts` | Detect file/code changes via transcript parse | IntegrityCheck (SystemIntegrity handler) |
| `tab-constants.ts` | Tab title colors and states | tab-setter.ts |
| `tab-setter.ts` | Kitty + cmux tab title manipulation | All tab-related hooks |
| `containment-zones.ts` | Release-pipeline zone inventory | `ShadowRelease.ts` (used at release time, not by runtime hooks) |
| `learning-readback.ts` | Read prior failures for context | WorkCompletionLearning |

> Note: there is no log-rotation lib — observability JSONLs are NOT auto-rotated today. Rotation is queued with the sensor-loop iteration. (The former log-rotation lib here was dead code with zero importers and was removed 2026-06-12.)

---

## Configuration

Hooks are configured in `settings.json` under the `hooks` key:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "{{LIFEOS_ROOT}}/hooks/KittyEnvPersist.hook.ts" },
          { "type": "command", "command": "{{LIFEOS_ROOT}}/hooks/LoadContext.hook.ts" }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "{{LIFEOS_ROOT}}/hooks/ContextReduction.hook.sh" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "WebFetch",
        "hooks": [
          { "type": "command", "command": "{{LIFEOS_ROOT}}/hooks/Safety.hook.ts" }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "matcher": "Write|Edit|MultiEdit|Bash",
        "hooks": [
          { "type": "command", "command": "{{LIFEOS_ROOT}}/hooks/Safety.hook.ts" }
        ]
      }
    ]
  }
}
```

### Matcher Patterns

For `PreToolUse` and `PostToolUse` hooks, matchers filter by tool name:
- `"Bash"`, `"Edit"`, `"Write"`, `"MultiEdit"`, `"Read"`, `"Skill"`, `"Agent"`, `"AskUserQuestion"`, `"WebFetch"`, `"WebSearch"`
- Empty matcher (or absent) = catch-all on the event.

---

## Documentation Standards

### Hook File Structure

Every hook MUST follow this documentation structure:

```typescript
#!/usr/bin/env bun
/**
 * HookName.hook.ts - [Brief Description] ([Event Type])
 *
 * PURPOSE:
 * [2-3 sentences explaining what this hook does and why it exists]
 *
 * TRIGGER: [Event type, e.g., UserPromptSubmit]
 *
 * INPUT:
 * - [Field]: [Description]
 *
 * OUTPUT:
 * - stdout: [What gets injected into context, if any]
 * - exit(0): [Normal completion]
 * - exit(2): [Hard block, when applicable]
 *
 * SIDE EFFECTS:
 * - [File writes]
 * - [External calls]
 * - [State changes]
 *
 * INTER-HOOK RELATIONSHIPS:
 * - DEPENDS ON: [Other hooks this requires]
 * - COORDINATES WITH: [Hooks that share data/state]
 * - MUST RUN BEFORE: [Ordering constraints]
 * - MUST RUN AFTER: [Ordering constraints]
 *
 * ERROR HANDLING:
 * - [How errors are handled]
 *
 * PERFORMANCE:
 * - [Blocking vs async]
 * - [Typical execution time]
 */

// Implementation follows...
```

### Update Protocol

When modifying ANY hook:

1. Update the hook's header documentation
2. Update this README's Hook Registry section
3. Update Inter-Hook Dependencies if relationships change
4. Update Data Flow Diagrams if data paths change
5. Test the hook in isolation AND with related hooks

---

## Maintenance Checklist

### Adding a New Hook

- [ ] Create hook file with full documentation header
- [ ] Add to `settings.json` under appropriate event
- [ ] Add to Hook Registry table in this README
- [ ] Document inter-hook dependencies
- [ ] Update Data Flow Diagrams if needed
- [ ] Add to shared library imports if using `lib/`
- [ ] Test hook in isolation
- [ ] Test hook with related hooks
- [ ] Verify no performance regressions

### Modifying an Existing Hook

- [ ] Update inline documentation
- [ ] Update hook header if behavior changes
- [ ] Update this README if interface changes
- [ ] Update inter-hook docs if dependencies change
- [ ] Test modified hook
- [ ] Test hooks that depend on this hook

### Removing a Hook

- [ ] Remove from `settings.json`
- [ ] Remove from Hook Registry in this README
- [ ] Update inter-hook dependencies
- [ ] Update Data Flow Diagrams
- [ ] Check for orphaned shared state files
- [ ] Tag pre-state for restoration: `git tag pre-<change>-YYYY-MM-DD`
- [ ] Per-hook commit with rationale + restore command in body
- [ ] Delete hook file
- [ ] Test related hooks still function

---

## Troubleshooting

### Hook Not Executing

1. Verify hook is in `settings.json` under correct event
2. Check shebang: `#!/usr/bin/env bun`
3. Run manually: `echo '{"session_id":"test"}' | bun hooks/HookName.hook.ts`
4. For Pulse HTTP routes (AgentGuard, SkillGuard): verify Pulse is running at `localhost:31337/health`

### Hook Blocking Session

1. Check if hook writes to stdout (only LoadContext / RestoreContext / PreCompact / TheRouter should)
2. Verify timeouts are set for external calls
3. Check for infinite loops or blocking I/O

### Mode Classifier Drift

1. Confirm `TheRouter.hook.ts` is registered first in `UserPromptSubmit` block of `settings.json`
2. Tail `MEMORY/OBSERVABILITY/effort-router.jsonl` to see classifier outputs
3. Test with synthetic prompt: `echo '{"session_id":"t","prompt":"test"}' | bun hooks/TheRouter.hook.ts`

### External Content Tagging

1. Verify `Safety.hook.ts` registered on `PostToolUse` with matcher `WebFetch` and `WebSearch`
2. Test: `echo '{"session_id":"t","hook_event_name":"PostToolUse","tool_name":"WebFetch","tool_input":{},"tool_response":"hello"}' | bun hooks/Safety.hook.ts`

### Permission Auto-Approval

1. Verify `Safety.hook.ts` registered on `PermissionRequest` with matcher `Write|Edit|MultiEdit|Bash`
2. Test: `echo '{"session_id":"t","hook_event_name":"PermissionRequest","tool_name":"Bash","tool_input":{"command":"ls /tmp"}}' | bun hooks/Safety.hook.ts` — should emit `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}`
3. Tail observability: `tail -f "${LIFEOS_DIR}/MEMORY/OBSERVABILITY/permission-decisions.jsonl"`

---

## Migration Notes

### 2026-05-06 — bpe-cuts (this commit)

Removed:
- `RepeatDetection.hook.ts` (UserPromptSubmit) — pre-classifier-era safety net, redundant with TheRouter + Opus reading conversation context.
- `TeammateIdle.hook.ts` (TeammateIdle) — pure logging hook with zero readers.
- `ElicitationHandler.hook.ts` (Elicitation) — pure logging hook with zero readers.
- `FileChanged.hook.ts` (FileChanged) — duplicate of `ToolActivityTracker` capture.

Trimmed:
- `TaskGovernance.hook.ts` — audit log writes removed (zero readers); rate-limit + quality-gate behavior preserved.
- `PromptProcessing.hook.ts` — docstring rewritten to accurately reflect single responsibility (tab + naming, no longer claims classification).

Pre-state tag: `pre-bpe-cuts-2026-05-06`. Restoration: see `LIFEOS/MEMORY/WORK/20260506-comprehensive-hook-bpe-audit/RESTORATION.md`.

### 2026-05-06 — security simplification (yesterday's commit)

Removed (`a4e3522ca`):
- `SecurityPipeline.hook.ts`, `ContentScanner.hook.ts`, `PromptGuard.hook.ts`, `SmartApprover.hook.ts`, `ContainmentGuard.hook.ts`
- `hooks/security/` directory (pipeline, types, logger, 5 inspectors)
- `LIFEOS/USER/SECURITY/{PATTERNS.yaml, ...}` plus 8 of 9 `LIFEOS/DOCUMENTATION/Security/*.md`

Replacement: native `permissions.deny` in `settings.json` (42 entries) + a single 48-LOC `PromptInjection.hook.ts` on WebFetch/WebSearch. The model is the security boundary.

### 2026-04-19 — naming-context isolation

`PromptProcessing.hook.ts` (then `SessionAnalysis.hook.ts`) `getRecentContext()` strips Assistant turns when `isFirstPrompt` is true. Session names are permanent; Algorithm scaffolding in assistant output (phase headers, agent names, SUMMARY lines) must never reach the naming prompt.

### Earlier — classifier split

`PromptProcessing.hook.ts` (formerly `SessionAnalysis.hook.ts`) once briefly held the `Mode + Tier` classifier role. That responsibility was extracted to `TheRouter.hook.ts` to give the classifier its own three-stage cascade (fast-paths → 60s cache → Sonnet) with dedicated telemetry. PromptProcessing now does only tab + naming via Haiku.
