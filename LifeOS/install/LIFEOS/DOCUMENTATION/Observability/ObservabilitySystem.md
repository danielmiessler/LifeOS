---
version: 1.5.7
---

# The Observability System

> You can't steer a Life OS you can't see (`LIFEOS/DOCUMENTATION/LifeOs/LifeOsThesis.md`). Observability is the raw sensory feed behind the Life Dashboard — every tool call, agent, and failure as inspectable events, so both the principal and the DA can verify the hill-climb is actually climbing.

Single-source local event pipeline for LifeOS tool activity, voice events, subagent lifecycle, and tool failures. Pulse is the only consumer; it reads JSONL from local disk on demand.

> **Infrastructure:** The observability HTTP server (`localhost:31337`) runs as a module inside the unified Pulse daemon (`{{LIFEOS_DIR}}/PULSE/Observability/observability.ts`). There is no separate observability server process -- Pulse serves all local HTTP endpoints on port 31337.

## Architecture

```
JSONL Sources (local disk)
  ├─ tool-activity.jsonl (100)
  ├─ tool-failures.jsonl (50)
  ├─ voice-events.jsonl (50)
  └─ subagent-events.jsonl (50)
          │
          ▼
   Pulse (Observability/observability.ts)
   localhost:31337
   └─→ /api/events/recent  (read-on-demand from JSONL)
   └─→ /api/agents
   └─→ /api/observability/{tool-failures,voice-events,subagent-events,config-changes}
```

## Data Flow

1. **Emitters** — PostToolUse hooks write structured JSONL to `MEMORY/OBSERVABILITY/`
2. **Read-on-demand** — Pulse endpoints read the last N lines per source, merge, sort newest-first, cap at 200, and serve over HTTP
3. **Display** — The Observatory dashboard polls Pulse every 3s

## Event Sources

| Source | JSONL Path | Per-Source Count | Hook |
|--------|-----------|-----------------|------|
| Tool activity | `MEMORY/OBSERVABILITY/tool-activity.jsonl` | 100 | `EventLogger.hook.ts` (PostToolUse, catch-all) |
| Tool failures | `MEMORY/OBSERVABILITY/tool-failures.jsonl` | 50 | `EventLogger.hook.ts` (PostToolUseFailure) |
| Voice events | `MEMORY/VOICE/voice-events.jsonl` | 50 | Voice notification server |
| Subagent events | `MEMORY/OBSERVABILITY/subagent-events.jsonl` | 50 | `AgentInvocation.hook.ts` (PreToolUse:Agent / PostToolUse:Agent) |
| Agent watchdog | stdout (Monitor notifications) | — | `Tools/AgentWatchdog.ts` via Monitor tool. Reads tool-activity.jsonl + subagent-starts.json; alerts on 90s silence with active agents. Auto-triggered by Pulse agent-guard hook on background agent spawn. |
| Effort routing _(retired 2026-07-11)_ | `MEMORY/OBSERVABILITY/effort-router.jsonl` | — | `TheRouter.hook.ts` (retired/merged 2026-07-11) — mode/tier classification abolished, no successor writes this stream. The `MemoryReviewTrigger` MINIMAL-skip gate that read its tail is also gone. |
| ISA rework | `MEMORY/OBSERVABILITY/isa-rework.jsonl` | — | `ISASync.hook.ts` Resume-After-Complete path (Algorithm v6.9.0, 2026-05-22). One row per auto-rewind: ts, session_id, slug, prev_phase, new_phase, prev_iteration, new_iteration, body_delta_bytes. |
| Frame drift | `MEMORY/OBSERVABILITY/frame-drift.jsonl` | — | Algorithm VERIFY-phase emitter (v6.8.0). T1/T2/T3 boolean tests per ISA at VERIFY entry. |
| Reviewer runs | `MEMORY/OBSERVABILITY/reviewer-runs.jsonl` | — | `MemoryReviewer.ts` (autonomic memory). One row per reviewer execution: runId, transcript path, exchanges read, inference_duration_ms, parse_ok, dispatch_summary { total, by_type, succeeded, failed, failures }. |
| Reviewer fires | `MEMORY/OBSERVABILITY/reviewer-fires.jsonl` | — | `MemoryReviewFire.hook.ts` (Stop). Audit of when reviewer would fire if subprocess were unavailable. |
| Memory writes (Tier A) | `MEMORY/OBSERVABILITY/memory-writes.jsonl` | — | `MemoryWriter.ts`. One row per set-overwrite to `_MEMORY.md` hot-layer files. Tracks evictions. |
| Tier-B writes | `MEMORY/OBSERVABILITY/tier-b-writes.jsonl` | — | `MemorySystem.add()` routing. Audit row per logged-append to PROJECTS / CONTACTS / KNOWLEDGE / IDEAS (timestamp, type, bytes, path). |
| Pending proposals (Tier C queue) | `MEMORY/OBSERVABILITY/pending-proposals.jsonl` | — | `MemorySystem.add()` for `type:proposal`. Status lifecycle: pending → sent → accepted/rejected/edited. Surfaced by `LIFEOS/PULSE/lib/telegram-proposals.ts` as Telegram `yes/no/edit #id` replies. |
| Identity proposals (archive) | `MEMORY/OBSERVABILITY/identity-proposals.jsonl` | — | `LIFEOS/PULSE/modules/telegram.ts` surfacer. Archive of sent/accepted/rejected/edited proposals. |
| Proposal replies | `MEMORY/OBSERVABILITY/proposal-replies.jsonl` | — | `LIFEOS/PULSE/modules/telegram.ts` reply handler. Records Telegram yes/no/edit interactions. |
| Memory retrievals | `MEMORY/OBSERVABILITY/memory-retrievals.jsonl` | — | `MemoryRetriever.getRelevantContext()` (ISC-107..112; not yet populated as of 2026-05-23; infrastructure ready). Per-turn BM25 audit. |

Per-source counts are configured inline in `Pulse/Observability/observability.ts`.

## Event Format

All events conform to the `LifeosEvent` interface:

```typescript
interface LifeosEvent {
  timestamp: string;     // ISO-8601 with timezone
  session_id: string;    // Claude Code session ID
  source: string;        // "tool-activity" | "tool-failure" | "voice" | "subagent"
  type: string;          // Event type (e.g. "tool_use", "voice_start", "subagent_start")
  [key: string]: unknown; // Additional fields per source
}
```

## Read Timing

Pulse reads on demand. The Observatory dashboard polls `/api/events/recent` every 3s; each request reads JSONL tails from disk (no persistent in-memory cache; Bun fs is fast enough at 50-100 lines per source).

## Key Files

| File | Role |
|------|------|
| `{{LIFEOS_ROOT}}/hooks/EventLogger.hook.ts` | Consolidated event writer (absorbed ToolActivityTracker + ToolFailureTracker + SkillExecutionLog + ConfigAudit + StopFailureHandler 2026-07-11). PostToolUse catch-all → tool-activity.jsonl (+ SKILLS/execution.jsonl on Skill); PostToolUseFailure → tool-failures.jsonl; ConfigChange → config-changes.jsonl; StopFailure → SECURITY stop-failures (log-only) |
| `{{LIFEOS_DIR}}/PULSE/Observability/observability.ts` | Observability module inside unified Pulse daemon — serves events from JSONL at :31337 |
| `{{LIFEOS_DIR}}/PULSE/Observability/` | Next.js static dashboard — polls `/api/events/recent` |

## Dashboard Locations

| Destination | URL | Data Source |
|-------------|-----|-------------|
| LifeOS Observatory | `localhost:31337/` → Actions tab | Local JSONL via Pulse `Observability/observability.ts` |

## Observatory Dashboard

The LifeOS Observatory is the local observability UI -- a Next.js 15.5 static export served by Pulse on `localhost:31337`.

### Project Layout

| Item | Value |
|------|-------|
| Source | `{{LIFEOS_DIR}}/PULSE/Observability/` |
| Build command | `cd "${LIFEOS_DIR}/PULSE/Observability" && bun run build` (outputs to `out/`) |
| Serving mechanism | Direct: `{{LIFEOS_DIR}}/PULSE/Observability/out` (configured in PULSE.toml `dashboard_dir`) |
| URL | `http://localhost:31337/` (served by Pulse observability module) |
| Process management | Pulse runs under launchd (`com.lifeos.pulse`) with auto-restart. **Always** use `launchctl stop/start com.lifeos.pulse` -- never `kill`. |

### Dashboard Pages

| Page | URL | Purpose |
|------|-----|---------|
| Agents | `/agents` (default) | Work dashboard -- iterations, optimize, ideate, loops |
| Knowledge | `/knowledge` | Knowledge archive browser |
| Security | `/security` | Security system management -- patterns, rules, events, hooks |

### Security Page (`/security`)

The security page provides full management of the LifeOS security system through four tabs:

| Tab | Function |
|-----|----------|
| **Policy** | Edit `PATTERNS.yaml` -- blocked/alert/trusted commands, path protection tiers |
| **Rules** | Edit `SECURITY_RULES.md` -- natural language BLOCK/ALLOW rules, currently disabled (saved via `POST /api/security/rules`) |
| **Events** | Recent security events from `MEMORY/SECURITY/YYYY/MM/` |
| **Hooks** | Hook health status with expandable descriptions |

Additional features:

- **Architecture visual** -- Inspector pipeline flow diagram displayed at top of page
- **Injection defense** -- Shows InjectionInspector patterns and PromptInspector categories (injection, exfiltration, evasion, security_disable)
- **Live editing** -- All changes write directly to disk and take effect on next tool call

### API Reference (all served by Pulse on `localhost:31337`)

All endpoints served by the Pulse daemon's observability module (`Observability/observability.ts`) unless noted.

**Core Observability**

| Endpoint | Method | Purpose | Source |
|----------|--------|---------|--------|
| `/health` | GET | Pulse daemon health check | `pulse.ts` |
| `/api/observability/state` | GET | Current session state (ISA, phase, progress) | observability |
| `/api/observability/state` | POST | Push session state from hooks | observability |
| `/api/observability/events` | GET | Raw event data | observability |
| `/api/observability/events` | POST | Push events from hooks | observability |
| `/api/events/recent` | GET | Merged recent events across all sources | observability |
| `/api/observability/voice-events` | GET | Voice event log | observability |
| `/api/observability/tool-failures` | GET | Tool failure log | observability |

**Algorithm & Sessions**

| Endpoint | Method | Purpose | Source |
|----------|--------|---------|--------|
| `/api/algorithm` | GET | Work sessions — ISA metadata, ISC progress, phase history | observability |
| `/api/agents` | GET | Subagent events — start/stop/duration from JSONL | observability |
| `/api/novelty` | GET | Ideate-run telemetry (UI removed 2026-07-08, archived as future work) | observability |
| `/api/ladder` | GET | Improvement pipeline data (UI removed 2026-07-08, archived as future work) | observability |

**Security**

| Endpoint | Method | Purpose | Source |
|----------|--------|---------|--------|
| `/api/security` | GET | Combined: PATTERNS.yaml + SECURITY_RULES.md + events + hooks + PromptInspector patterns | observability |
| `/api/security/patterns` | POST | Mutate PATTERNS.yaml (add/remove/edit patterns and paths) | observability |
| `/api/security/rules` | POST | Save SECURITY_RULES.md content | observability |
| `/api/security/hooks-detail` | GET | Hook descriptions, events, blocking capability | observability |

**Knowledge**

| Endpoint | Method | Purpose | Source |
|----------|--------|---------|--------|
| `/api/knowledge` | GET | Knowledge archive — domains, notes, MOC data | observability |
| `/api/knowledge/:domain/:slug` | GET | Individual knowledge note content | observability |
| `/api/knowledge/:domain/:slug` | PUT | Update knowledge note | observability |

**Wiki (LifeOS system docs + knowledge browser)**

| Endpoint | Method | Purpose | Source |
|----------|--------|---------|--------|
| `/api/wiki` | GET | System doc index | `modules/wiki.ts` |
| `/api/wiki/search` | GET | Full-text search across system docs | `modules/wiki.ts` |
| `/api/wiki/graph` | GET | Knowledge graph data for visualization | `modules/wiki.ts` |

**DA (Digital Assistant)**

| Endpoint | Method | Purpose | Source |
|----------|--------|---------|--------|
| `/assistant/health` | GET | DA subsystem health | `Assistant/module.ts` |
| `/assistant/identity` | GET | Current DA identity summary | `Assistant/module.ts` |
| `/assistant/personality` | GET | DA personality traits | `Assistant/module.ts` |
| `/assistant/personality/traits` | PATCH | Update personality traits | `Assistant/module.ts` |
| `/assistant/avatar` | GET | DA avatar image | `Assistant/module.ts` |
| `/assistant/tasks` | GET | Unified task view (DA + Pulse cron + CC triggers) | `Assistant/module.ts` |
| `/assistant/tasks` | POST | Create DA scheduled task | `Assistant/module.ts` |
| `/assistant/tasks/:id` | DELETE | Cancel DA task | `Assistant/module.ts` |
| `/assistant/diary` | GET | Recent diary entries | `Assistant/module.ts` |
| `/assistant/opinions` | GET | Current DA opinions | `Assistant/module.ts` |

**Voice & Notifications**

| Endpoint | Method | Purpose | Source |
|----------|--------|---------|--------|
| `/notify` | POST | Send TTS notification via ElevenLabs | `pulse.ts` |
| `/notify/personality` | POST | Personality-aware notification | `pulse.ts` |
| `/voice` | GET | Voice status | `pulse.ts` |

**Hook Validation**

| Endpoint | Method | Purpose | Source |
|----------|--------|---------|--------|
| `/hooks/skill-guard` | POST | Validate Skill tool calls (PreToolUse HTTP hook) | `modules/hooks.ts` |
| `/hooks/agent-guard` | POST | Validate Agent tool calls (PreToolUse HTTP hook) | `modules/hooks.ts` |

**Stubs (reserved, not yet implemented)**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/loops` | GET | Loop system index |
| `/api/loops/control` | GET/POST | Loop control |
| `/api/loops/start` | POST | Start a loop |

### Deployment Checklist

1. Edit source in `{{LIFEOS_DIR}}/PULSE/Observability/src/`
2. Build: `cd "${LIFEOS_DIR}/PULSE/Observability" && bun run build`
3. Restart Pulse: `launchctl stop com.lifeos.pulse && launchctl start com.lifeos.pulse`
4. Hard refresh browser: Cmd+Shift+R

## Session State Tracking

Distinct from the event pipeline above, session state (active sessions, phase, progress, criteria, ratings) flows through a single canonical file. Both the Pulse dashboard and any external admin dashboard's agents page read the same file so they never drift.

**Canonical source:** `{{LIFEOS_DIR}}/MEMORY/STATE/work.json`

```
Writers (atomic read-modify-write via isa-utils.ts:writeRegistry)
├─ SessionAnalysis.hook.ts      UserPromptSubmit → upsertSession (native or starting)
├─ EventLogger.hook.ts          PostToolUse → bumpLastToolActivity (30s debounced)
├─ ISASync.hook.ts              syncToWorkJson() → promote native entry to full ISA session
└─ ISAAutoName.hook.ts          updateSessionNameInWorkJson()

Readers (both use identical mapping)
├─ Pulse Observability          localhost:31337 → observability.ts handleAlgorithmApi
└─ external admin daemon        localhost:4000  → server/src/algorithm-watcher.ts
```

**Display lanes:**
- Mode `starting` → Algorithm tab, phase strip (OBSERVE/THINK/PLAN/BUILD/EXECUTE/VERIFY/LEARN).
- Mode `native` → Native tab, no phase strip.

**Classifier:** `SessionAnalysis.hook.ts:ALGO_ACTION_RE` — narrow 8-verb regex (`implement|build|create|architect|design|migrate|deploy|refactor`). Everything else that passes the trivia filter (`POSITIVE_PRAISE_WORDS`, `SYSTEM_TEXT_PATTERNS`, `MIN_PROMPT_LENGTH=3`) is native. Do not broaden — see `feedback_state_monitoring_requires_starting_gate.md`.

**Staleness thresholds:** 5 min native, 10 min algorithm. Matched in both readers.

**Loud-fail:** `algorithm-watcher.ts` emits `console.error` on missing work.json at startup; `/api/algorithm` returns HTTP 503 with the resolved path. `EventLogger.hook.ts` logs exceptions via `console.error` so a silently-broken tracker shows up in session logs.

**Self-healing:** Both readers use `Math.max(updatedAt, lastToolActivity)` for the activity signal, so a fresh user prompt revives a stale session even if the tool-activity tracker is down.

## See Also

- `{{LIFEOS_DIR}}/DOCUMENTATION/LifeosSystemArchitecture.md` — Master LifeOS architecture reference
