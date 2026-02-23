# PAI Hook System

> **Lifecycle event handlers that extend Claude Code with voice, memory, and security.**

This document is the authoritative reference for PAI's hook system. When modifying any hook, update both the hook's inline documentation AND this README.

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

---

## Architecture Overview

Hooks are TypeScript scripts that execute at specific lifecycle events in Claude Code. They enable:

- **Voice Feedback**: Spoken announcements of tasks and completions
- **Memory Capture**: Session summaries, work tracking, learnings
- **Security Validation**: Command filtering, path protection, prompt injection defense
- **Context Injection**: Identity, preferences, format specifications

### Design Principles

1. **Non-blocking by default**: Hooks should not delay the user experience
2. **Fail gracefully**: Errors in one hook must not crash the session
3. **Single responsibility**: Each hook does one thing well
4. **Orchestration over duplication**: Use StopOrchestrator for shared data needs

### Execution Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Claude Code Session                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SessionStart ──┬──► StartupGreeting (banner + stats)               │
│                 ├──► LoadContext (PAI skill injection)             │
│                 └──► CheckVersion (update notification)             │
│                                                                     │
│  UserPromptSubmit ──┬──► RatingCapture (algo reminder + ratings)    │
│                     ├──► AutoWorkCreation (work directory setup)    │
│                     ├──► UpdateTabTitle (tab + voice announcement)  │
│                     └──► SessionAutoName (session naming)           │
│                                                                     │
│  PreToolUse ──┬──► SecurityValidator (Bash/Edit/Write/Read)         │
│               ├──► SetQuestionTab (AskUserQuestion)                 │
│               ├──► AgentExecutionGuard (Task)                       │
│               └──► SkillGuard (Skill)                               │
│                                                                     │
│  PostToolUse ──┬──► AlgorithmTracker (phase + criteria tracking)    │
│                └──► QuestionAnswered (AskUserQuestion)               │
│                                                                     │
│  Stop ──► StopOrchestrator ──┬──► VoiceNotification                 │
│                              ├──► TabState                          │
│                              └──► RebuildSkill                      │
│                                                                     │
│  SessionEnd ──┬──► WorkCompletionLearning (insight extraction)      │
│               ├──► SessionSummary (work directory completion)       │
│               ├──► RelationshipMemory (relationship notes)          │
│               ├──► UpdateCounts (system counts + usage cache)       │
│               └──► IntegrityCheck (PAI + doc drift detection)       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Hook Lifecycle Events

| Event | When It Fires | Typical Use Cases |
|-------|---------------|-------------------|
| `SessionStart` | Session begins | Context loading, banner display, version check |
| `UserPromptSubmit` | User sends a message | Format injection, work tracking, sentiment analysis |
| `PreToolUse` | Before a tool executes | Security validation, UI state changes |
| `PostToolUse` | After a tool executes | Phase tracking, tab state reset |
| `Stop` | Claude responds | Voice feedback, tab updates, skill rebuild |
| `SessionEnd` | Session terminates | Summary, learning, counts, integrity checks |

### Event Payload Structure

All hooks receive JSON via stdin with event-specific fields:

```typescript
// Common fields
interface BasePayload {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
}

// UserPromptSubmit
interface UserPromptPayload extends BasePayload {
  prompt: string;
}

// PreToolUse
interface PreToolUsePayload extends BasePayload {
  tool_name: string;
  tool_input: Record<string, any>;
}

// Stop
interface StopPayload extends BasePayload {
  stop_hook_active: boolean;
}
```

---

## Hook Registry

### SessionStart Hooks

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `StartupGreeting.hook.ts` | Display PAI banner with system stats | No | None |
| `LoadContext.hook.ts` | Inject PAI skill into context | Yes (stdout) | `skills/PAI/SKILL.md` |
| `CheckVersion.hook.ts` | Notify if CC update available | No | npm registry |

### UserPromptSubmit Hooks

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `RatingCapture.hook.ts` | Algorithm format reminder + explicit/implicit rating capture | Yes (stdout) | Inference API, `ratings.jsonl` |
| `AutoWorkCreation.hook.ts` | Create/update work directories | No | `MEMORY/STATE/current-work.json` |
| `UpdateTabTitle.hook.ts` | Set tab title + voice announcement | No | Inference API, Voice Server |
| `SessionAutoName.hook.ts` | Name session on first prompt | No | Inference API, `session-names.json` |

### PreToolUse Hooks

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `SecurityValidator.hook.ts` | Validate Bash/Edit/Write/Read | Yes (decision) | `patterns.yaml`, `MEMORY/SECURITY/` |
| `SetQuestionTab.hook.ts` | Set teal tab for questions | No | Kitty terminal |
| `AgentExecutionGuard.hook.ts` | Guard agent spawning (Task tool) | Yes (decision) | None |
| `SkillGuard.hook.ts` | Prevent erroneous skill invocations | Yes (decision) | None |

### PostToolUse Hooks

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `AlgorithmTracker.hook.ts` | Real-time phase tracking + ISC criteria tracking | No | `lib/algorithm-state.ts` |
| `QuestionAnswered.hook.ts` | Reset tab state after question answered | No | Kitty terminal |

### Stop Hooks

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `StopOrchestrator.hook.ts` | Coordinate all Stop handlers | No | Voice Server, Kitty |

### SessionEnd Hooks

| Hook | Purpose | Blocking | Dependencies |
|------|---------|----------|--------------|
| `WorkCompletionLearning.hook.ts` | Extract learnings from work | No | Inference API, `MEMORY/LEARNING/` |
| `SessionSummary.hook.ts` | Mark work as completed | No | `MEMORY/WORK/`, `current-work.json` |
| `RelationshipMemory.hook.ts` | Capture relationship notes | No | `MEMORY/RELATIONSHIP/` |
| `UpdateCounts.hook.ts` | Update system counts + usage cache | No | `settings.json`, Anthropic API |
| `IntegrityCheck.hook.ts` | PAI change detection + doc drift detection | No | `MEMORY/STATE/integrity-state.json`, handlers/ |

---

## Inter-Hook Dependencies

### Rating System Flow

```
User Message
    │
    ▼
RatingCapture ─── explicit "8 - great work"? ──► write + exit
    │ (no explicit match)
    ▼
    └── implicit sentiment (Haiku) ──────────► write
                                                │
                                                ▼
                                        ratings.jsonl
                                              │
                                              ▼
                                      Status Line Display
                                      (statusline-command.sh)
```

**Design**: Single hook handles both paths. Explicit pattern checked first (no inference). If no match, Haiku inference runs for implicit sentiment. Both paths write to `ratings.jsonl`.

### Work Tracking Flow

```
SessionStart
    │
    ▼
UserPromptSubmit ─► AutoWorkCreation ─► Creates WORK/<date>/<session>/
    │                                          │
    │                                          ▼
    │                               current-work.json (state)
    │                                          │
    ▼                                          │
SessionEnd ─┬─► WorkCompletionLearning ────────┤
            │                                  │
            └─► SessionSummary ─► Marks as COMPLETED
```

**Coordination**: `current-work.json` is the shared state file. AutoWorkCreation creates it, SessionSummary clears it.

### Security Validation Flow

```
PreToolUse (Bash/Edit/Write/Read)
    │
    ▼
SecurityValidator ─► patterns.yaml
    │
    ├─► {continue: true} ──────────────► Tool executes
    │
    ├─► {decision: "ask", message} ────► User prompted
    │
    └─► exit(2) ───────────────────────► Hard block

All events logged to: MEMORY/SECURITY/security-events.jsonl
```

### Voice + Tab State Flow

```
UserPromptSubmit
    │
    ▼
UpdateTabTitle
    ├─► Sets tab to PURPLE (#5B21B6) ─► "Processing..."
    │
    ├─► Inference summarizes prompt
    │
    ├─► Sets tab to ORANGE (#B35A00) ─► "Fixing auth..."
    │
    └─► Voice announces: "Fixing auth bug"

PreToolUse (AskUserQuestion)
    │
    ▼
SetQuestionTab ─► Sets tab to AMBER (#604800) ─► Shows question summary

Stop
    │
    ▼
StopOrchestrator
    ├─► Resets tab to DEFAULT (UL blue)
    └─► Voice announces completion
```

---

## Data Flow Diagrams

### Memory System Integration

```
┌──────────────────────────────────────────────────────────────────┐
│                         MEMORY/                                  │
├────────────────┬─────────────────┬───────────────────────────────┤
│    WORK/       │   LEARNING/     │   STATE/                      │
│                │                 │                               │
│ ┌────────────┐ │ ┌─────────────┐ │ ┌───────────────────────────┐ │
│ │ Session    │ │ │ SIGNALS/    │ │ │ current-work.json         │ │
│ │ Directories│ │ │ ratings.jsonl│ │ │ trending-cache.json       │ │
│ │            │ │ │             │ │ │ model-cache.txt           │ │
│ └─────▲──────┘ │ └──────▲──────┘ │ └───────────▲───────────────┘ │
│       │        │        │        │             │                 │
└───────┼────────┴────────┼────────┴─────────────┼─────────────────┘
        │                 │                      │
        │                 │                      │
┌───────┴─────────────────┴──────────────────────┴─────────────────┐
│                        HOOKS                                     │
│                                                                  │
│  AutoWorkCreation ──────────────────────────► current-work.json  │
│  RatingCapture ────────────────────────────► ratings.jsonl      │
│  WorkCompletionLearning ────────────────────► LEARNING/          │
│  SessionSummary ────────────────────────────► WORK/ + state      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Shared Libraries

Located in `hooks/lib/`:

| Library | Purpose | Used By |
|---------|---------|---------|
| `identity.ts` | Get DA name, principal from settings | Most hooks |
| `time.ts` | PST timestamps, ISO formatting | Rating hooks, work hooks |
| `paths.ts` | Canonical path construction | Work hooks, security |
| `notifications.ts` | ntfy push notifications | SessionEnd hooks, UpdateTabTitle |
| `output-validators.ts` | Tab title + voice output validation | UpdateTabTitle, TabState, VoiceNotification, SetQuestionTab |
| `learning-utils.ts` | Learning categorization | Rating hooks, WorkCompletion |
| `change-detection.ts` | Detect file/code changes | IntegrityCheck |
| `tab-constants.ts` | Tab title colors and states | tab-setter.ts |
| `tab-setter.ts` | Kitty tab title manipulation | Tab-related hooks |

---

## Configuration

Hooks are configured in `settings.json` under the `hooks` key:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "${PAI_DIR}/hooks/StartupGreeting.hook.ts" },
          { "type": "command", "command": "${PAI_DIR}/hooks/LoadContext.hook.ts" }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "${PAI_DIR}/hooks/SecurityValidator.hook.ts" }
        ]
      }
    ]
  }
}
```

### Matcher Patterns

For `PreToolUse` hooks, matchers filter by tool name:
- `"Bash"` - Matches Bash tool calls
- `"Edit"` - Matches Edit tool calls
- `"Write"` - Matches Write tool calls
- `"Read"` - Matches Read tool calls
- `"AskUserQuestion"` - Matches question prompts

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
 * - [Field]: [Description]
 *
 * OUTPUT:
 * - stdout: [What gets injected into context, if any]
 * - exit(0): [Normal completion]
 * - exit(2): [Hard block, for security hooks]
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
 * - [What happens on failure]
 *
 * PERFORMANCE:
 * - [Blocking vs async]
 * - [Typical execution time]
 * - [Resource usage notes]
 */

// Implementation follows...
```

### Inline Documentation

Functions should have JSDoc comments explaining:
- What the function does
- Parameters and return values
- Any side effects
- Error conditions

### Update Protocol

When modifying ANY hook:

1. Update the hook's header documentation
2. Update this README's Hook Registry section
3. Update Inter-Hook Dependencies if relationships change
4. Update Data Flow Diagrams if data paths change
5. Test the hook in isolation AND with related hooks

---

## Maintenance Checklist

Use this checklist when adding or modifying hooks:

### Adding a New Hook

- [ ] Create hook file with full documentation header
- [ ] Add to `settings.json` under appropriate event
- [ ] Add to Hook Registry table in this README
- [ ] Document inter-hook dependencies
- [ ] Update Data Flow Diagrams if needed
- [ ] Add to shared library imports if using lib/
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
- [ ] Verify no performance regressions

### Removing a Hook

- [ ] Remove from `settings.json`
- [ ] Remove from Hook Registry in this README
- [ ] Update inter-hook dependencies
- [ ] Update Data Flow Diagrams
- [ ] Check for orphaned shared state files
- [ ] Delete hook file
- [ ] Test related hooks still function

---

## Troubleshooting

### Hook Not Executing

1. Verify hook is in `settings.json` under correct event
2. Check file is executable: `chmod +x hook.ts`
3. Check shebang: `#!/usr/bin/env bun`
4. Run manually: `echo '{"session_id":"test"}' | bun hooks/HookName.hook.ts`

### Hook Blocking Session

1. Check if hook writes to stdout (only LoadContext/FormatEnforcer should)
2. Verify timeouts are set for external calls
3. Check for infinite loops or blocking I/O

### Security Validation Issues

1. Check `patterns.yaml` for matching patterns
2. Review `MEMORY/SECURITY/security-events.jsonl` for logs
3. Test pattern matching: `bun hooks/SecurityValidator.hook.ts < test-input.json`

---

*Last updated: 2026-02-09*
*Hooks count: 20 | Events: 6 | Shared libs: 10*
