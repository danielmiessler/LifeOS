# The Observability System

Single-source, multi-destination event pipeline for PAI tool activity, voice events, subagent lifecycle, and tool failures.

> **Infrastructure:** The observability HTTP server (`localhost:31337`) runs as a module inside the unified Pulse daemon (`${PAI_DIR}/PULSE/Observability/observability.ts`). There is no separate observability server process -- Pulse serves all local HTTP endpoints on port 31337.

## Architecture

```
JSONL Sources (local disk)          settings.json
  ├─ tool-activity.jsonl (100)   ──→  observability.targets[]
  ├─ tool-failures.jsonl (50)         ├─ { type: "cloudflare-kv", name: "production" }
  ├─ voice-events.jsonl (50)          ├─ { type: "http", name: "local", url: "..." }
  └─ subagent-events.jsonl (50)       └─ ... (0-N targets)
          │                                    │
          ▼                                    ▼
   collectEvents()  ───────────────→  pushEventsToTargets()
   (observability-transport.ts)       (fan-out to all targets)
          │                                    │
          ▼                                    ▼
   Pulse (Observability/observability.ts) CF KV (sync:events)
   localhost:31337                 └─→ Worker /api/events/recent
   └─→ /api/events/recent              └─→ admin.example.com
```

## Data Flow

1. **Emitters** — PostToolUse hooks write structured JSONL to `MEMORY/OBSERVABILITY/`
2. **Collection** — `collectEvents()` reads last N lines per source, merges, sorts newest-first, caps at 200
3. **Transport** — `pushEventsToTargets()` fans out to all configured targets in parallel
4. **Display** — Frontend polls `/api/events/recent` every 3s on both local and remote dashboards

## settings.json Configuration

The `observability` section in `${CLAUDE_CONFIG_DIR}/settings.json` controls where events are pushed:

```json
{
  "observability": {
    "targets": [
      {
        "type": "cloudflare-kv",
        "name": "production",
        "url": "https://admin.example.com"
      },
      {
        "type": "http",
        "name": "local",
        "url": "http://localhost:31337"
      }
    ],
    "server": {
      "port": 31337,
      "enabled": true
    }
  }
}
```

### Target Types

| Type            | Transport                                | Auth                                                                                                                                         | Use Case                                    |
| --------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `cloudflare-kv` | CF KV API PUT to namespace               | `CLOUDFLARE_API_TOKEN_WORKERS_EDIT` or `CLOUDFLARE_API_TOKEN` from `${CLAUDE_CONFIG_DIR}/.env` (tried in that order; env var wins over .env) | Production dashboards on Cloudflare Workers |
| `http`          | POST to `{url}/api/observability/events` | Optional `headers` field                                                                                                                     | Local dev server, other HTTP receivers      |

### Target Schema

```typescript
interface ObservabilityTarget {
  name: string; // Human label (e.g. "production", "local")
  type: "http" | "cloudflare-kv"; // Transport mechanism
  url?: string; // Base URL (required for http, optional for cloudflare-kv)
  headers?: Record<string, string>; // Optional headers for http targets
}
```

### Adding a New Target

Add an entry to `observability.targets[]` in settings.json. The transport module picks it up on next hook execution. No code changes needed.

Example — adding a staging environment:

```json
{
  "type": "http",
  "name": "staging",
  "url": "https://staging.example.com",
  "headers": { "Authorization": "Bearer ${STAGING_TOKEN}" }
}
```

## Event Sources

| Source          | JSONL Path                                   | Per-Source Count | Hook                                                                                                                                                                                                       |
| --------------- | -------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool activity   | `MEMORY/OBSERVABILITY/tool-activity.jsonl`   | 100              | `ToolActivityTracker.hook.ts` (PostToolUse, catch-all)                                                                                                                                                     |
| Tool failures   | `MEMORY/OBSERVABILITY/tool-failures.jsonl`   | 50               | `ToolFailureTracker.hook.ts` (PostToolUseFailure)                                                                                                                                                          |
| Voice events    | `MEMORY/VOICE/voice-events.jsonl`            | 50               | Voice notification server                                                                                                                                                                                  |
| Subagent events | `MEMORY/OBSERVABILITY/subagent-events.jsonl` | 50               | `AgentInvocation.hook.ts` (PreToolUse:Agent / PostToolUse:Agent)                                                                                                                                           |
| Agent watchdog  | stdout (Monitor notifications)               | —                | `Tools/AgentWatchdog.ts` via Monitor tool. Reads tool-activity.jsonl + subagent-starts.json; alerts on 90s silence with active agents. Auto-triggered by Pulse agent-guard hook on background agent spawn. |

Per-source counts match between `Pulse/Observability/observability.ts` (local) and `observability-transport.ts` (KV push) to ensure identical data on all destinations.

## Event Format

All events conform to the `PAIEvent` interface:

```typescript
interface PAIEvent {
  timestamp: string; // ISO-8601 with timezone
  session_id: string; // Claude Code session ID
  source: string; // "tool-activity" | "tool-failure" | "voice" | "subagent"
  type: string; // Event type (e.g. "tool_use", "voice_start", "subagent_start")
  [key: string]: unknown; // Additional fields per source
}
```

## Push Timing

| Trigger           | What Gets Pushed                            | Latency                      |
| ----------------- | ------------------------------------------- | ---------------------------- |
| Every tool call   | Events (via ToolActivityTracker async hook) | ~200ms (JSONL read + KV PUT) |
| Session start/end | Events + work state (via KVSync hook)       | ~500ms                       |
| ISA write/edit    | Work state only (via ISASync hook)          | ~300ms                       |

## Key Files

| File                                                        | Role                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `${CLAUDE_CONFIG_DIR}/hooks/lib/observability-transport.ts` | `collectEvents()` + `pushEventsToTargets()` — the core pipeline                       |
| `${CLAUDE_CONFIG_DIR}/hooks/lib/identity.ts`                | `ObservabilityTarget` type + `getObservabilityConfig()` — reads settings.json         |
| `${CLAUDE_CONFIG_DIR}/hooks/ToolActivityTracker.hook.ts`    | PostToolUse catch-all — writes JSONL + triggers KV push                               |
| `${CLAUDE_CONFIG_DIR}/hooks/KVSync.hook.ts`                 | SessionEnd — batch pushes events + state to all targets                               |
| `${PAI_DIR}/PULSE/Observability/observability.ts`           | Observability module inside unified Pulse daemon — serves events from JSONL at :31337 |
| `${PAI_DIR}/PULSE/Observability/`                           | Next.js static dashboard — polls `/api/events/recent`                                 |
| `${CLAUDE_CONFIG_DIR}/settings.json → observability`        | Target configuration — add/remove destinations here                                   |

## Dashboard Locations

| Destination     | URL                                      | Data Source                                            |
| --------------- | ---------------------------------------- | ------------------------------------------------------ |
| PAI Observatory | `localhost:31337/agents` → Actions tab   | Local JSONL via Pulse `Observability/observability.ts` |
| ULAdmin         | `admin.example.com/agents` → Actions tab | CF KV `sync:events` via Worker `/api/events/recent`    |

## Observatory Dashboard

The PAI Observatory is the local observability UI -- a Next.js 15.5 static export served by Pulse on `localhost:31337`.

### Project Layout

| Item               | Value                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Source             | `${PAI_DIR}/PULSE/Observability/`                                                                                                  |
| Build command      | `cd ${PAI_DIR}/PULSE/Observability && bun run build` (outputs to `out/`)                                                           |
| Serving mechanism  | Direct: `${PAI_DIR}/PULSE/Observability/out` (configured in PULSE.toml `dashboard_dir`)                                            |
| URL                | `http://localhost:31337/` (served by Pulse observability module)                                                                   |
| Process management | Pulse runs under launchd (`com.pai.pulse`) with auto-restart. **Always** use `launchctl stop/start com.pai.pulse` -- never `kill`. |

### Dashboard Pages

| Page      | URL                 | Purpose                                                      |
| --------- | ------------------- | ------------------------------------------------------------ |
| Agents    | `/agents` (default) | Work dashboard -- iterations, optimize, ideate, loops        |
| Knowledge | `/knowledge`        | Knowledge archive browser                                    |
| Security  | `/security`         | Security system management -- patterns, rules, events, hooks |
| Ladder    | `/ladder`           | Improvement ladder tracking                                  |
| Novelty   | `/novelty`          | Novelty detection dashboard                                  |

### Security Page (`/security`)

The security page provides full management of the PAI security system through four tabs:

| Tab        | Function                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Policy** | Edit `PATTERNS.yaml` -- blocked/alert/trusted commands, path protection tiers                                             |
| **Rules**  | Edit `SECURITY_RULES.md` -- natural language BLOCK/ALLOW rules, currently disabled (saved via `POST /api/security/rules`) |
| **Events** | Recent security events from `MEMORY/SECURITY/YYYY/MM/`                                                                    |
| **Hooks**  | Hook health status with expandable descriptions                                                                           |

Additional features:

- **Architecture visual** -- Inspector pipeline flow diagram displayed at top of page
- **Injection defense** -- Shows InjectionInspector patterns and PromptInspector categories (injection, exfiltration, evasion, security_disable)
- **Live editing** -- All changes write directly to disk and take effect on next tool call

### API Reference (all served by Pulse on `localhost:31337`)

All endpoints served by the Pulse daemon's observability module (`Observability/observability.ts`) unless noted.

**Core Observability**

| Endpoint                           | Method | Purpose                                      | Source        |
| ---------------------------------- | ------ | -------------------------------------------- | ------------- |
| `/health`                          | GET    | Pulse daemon health check                    | `pulse.ts`    |
| `/api/observability/state`         | GET    | Current session state (ISA, phase, progress) | observability |
| `/api/observability/state`         | POST   | Push session state from hooks                | observability |
| `/api/observability/events`        | GET    | Raw event data                               | observability |
| `/api/observability/events`        | POST   | Push events from hooks                       | observability |
| `/api/events/recent`               | GET    | Merged recent events across all sources      | observability |
| `/api/observability/voice-events`  | GET    | Voice event log                              | observability |
| `/api/observability/tool-failures` | GET    | Tool failure log                             | observability |

**Algorithm & Sessions**

| Endpoint         | Method | Purpose                                                   | Source        |
| ---------------- | ------ | --------------------------------------------------------- | ------------- |
| `/api/algorithm` | GET    | Work sessions — ISA metadata, ISC progress, phase history | observability |
| `/api/agents`    | GET    | Subagent events — start/stop/duration from JSONL          | observability |
| `/api/novelty`   | GET    | Learning signals, ratings, failure patterns               | observability |
| `/api/ladder`    | GET    | Improvement pipeline data                                 | observability |

**Security**

| Endpoint                     | Method | Purpose                                                                                 | Source        |
| ---------------------------- | ------ | --------------------------------------------------------------------------------------- | ------------- |
| `/api/security`              | GET    | Combined: PATTERNS.yaml + SECURITY_RULES.md + events + hooks + PromptInspector patterns | observability |
| `/api/security/patterns`     | POST   | Mutate PATTERNS.yaml (add/remove/edit patterns and paths)                               | observability |
| `/api/security/rules`        | POST   | Save SECURITY_RULES.md content                                                          | observability |
| `/api/security/hooks-detail` | GET    | Hook descriptions, events, blocking capability                                          | observability |

**Knowledge**

| Endpoint                       | Method | Purpose                                      | Source        |
| ------------------------------ | ------ | -------------------------------------------- | ------------- |
| `/api/knowledge`               | GET    | Knowledge archive — domains, notes, MOC data | observability |
| `/api/knowledge/:domain/:slug` | GET    | Individual knowledge note content            | observability |
| `/api/knowledge/:domain/:slug` | PUT    | Update knowledge note                        | observability |

**Wiki (PAI system docs + knowledge browser)**

| Endpoint           | Method | Purpose                                | Source            |
| ------------------ | ------ | -------------------------------------- | ----------------- |
| `/api/wiki`        | GET    | System doc index                       | `modules/wiki.ts` |
| `/api/wiki/search` | GET    | Full-text search across system docs    | `modules/wiki.ts` |
| `/api/wiki/graph`  | GET    | Knowledge graph data for visualization | `modules/wiki.ts` |

**DA (Digital Assistant)**

| Endpoint                        | Method | Purpose                                           | Source                |
| ------------------------------- | ------ | ------------------------------------------------- | --------------------- |
| `/assistant/health`             | GET    | DA subsystem health                               | `Assistant/module.ts` |
| `/assistant/identity`           | GET    | Current DA identity summary                       | `Assistant/module.ts` |
| `/assistant/personality`        | GET    | DA personality traits                             | `Assistant/module.ts` |
| `/assistant/personality/traits` | PATCH  | Update personality traits                         | `Assistant/module.ts` |
| `/assistant/avatar`             | GET    | DA avatar image                                   | `Assistant/module.ts` |
| `/assistant/tasks`              | GET    | Unified task view (DA + Pulse cron + CC triggers) | `Assistant/module.ts` |
| `/assistant/tasks`              | POST   | Create DA scheduled task                          | `Assistant/module.ts` |
| `/assistant/tasks/:id`          | DELETE | Cancel DA task                                    | `Assistant/module.ts` |
| `/assistant/diary`              | GET    | Recent diary entries                              | `Assistant/module.ts` |
| `/assistant/opinions`           | GET    | Current DA opinions                               | `Assistant/module.ts` |

**Voice & Notifications**

| Endpoint              | Method | Purpose                              | Source     |
| --------------------- | ------ | ------------------------------------ | ---------- |
| `/notify`             | POST   | Send TTS notification via ElevenLabs | `pulse.ts` |
| `/notify/personality` | POST   | Personality-aware notification       | `pulse.ts` |
| `/voice`              | GET    | Voice status                         | `pulse.ts` |

**Hook Validation**

| Endpoint             | Method | Purpose                                          | Source             |
| -------------------- | ------ | ------------------------------------------------ | ------------------ |
| `/hooks/skill-guard` | POST   | Validate Skill tool calls (PreToolUse HTTP hook) | `modules/hooks.ts` |
| `/hooks/agent-guard` | POST   | Validate Agent tool calls (PreToolUse HTTP hook) | `modules/hooks.ts` |

**Stubs (reserved, not yet implemented)**

| Endpoint             | Method   | Purpose           |
| -------------------- | -------- | ----------------- |
| `/api/loops`         | GET      | Loop system index |
| `/api/loops/control` | GET/POST | Loop control      |
| `/api/loops/start`   | POST     | Start a loop      |

### Deployment Checklist

1. Edit source in `${PAI_DIR}/PULSE/Observability/src/`
2. Build: `cd ${PAI_DIR}/PULSE/Observability && bun run build`
3. Restart Pulse: `launchctl stop com.pai.pulse && launchctl start com.pai.pulse`
4. Hard refresh browser: Cmd+Shift+R

## Session State Tracking

Distinct from the event pipeline above, session state (active sessions, phase, progress, criteria, ratings) flows through a single canonical file. Both the Pulse dashboard and the ULAdmin `/agents` page read the same file so they never drift.

**Canonical source:** `$PAI_DIR/MEMORY/STATE/work.json`

```
Writers (atomic read-modify-write via isa-utils.ts:writeRegistry)
├─ SessionAnalysis.hook.ts      UserPromptSubmit → upsertSession (native or starting)
├─ ToolActivityTracker.hook.ts  PostToolUse → bumpLastToolActivity (30s debounced)
├─ ISASync.hook.ts              syncToWorkJson() → promote native entry to full ISA session
└─ ISAAutoName.hook.ts          updateSessionNameInWorkJson()

Readers (both use identical mapping)
├─ Pulse Observability          localhost:31337 → observability.ts handleAlgorithmApi
└─ ULAdmin daemon               localhost:4000  → server/src/algorithm-watcher.ts
```

**Display lanes:**

- Mode `starting` → Algorithm tab, phase strip (OBSERVE/THINK/PLAN/BUILD/EXECUTE/VERIFY/LEARN).
- Mode `native` → Native tab, no phase strip.

**Classifier:** `SessionAnalysis.hook.ts:ALGO_ACTION_RE` — narrow 8-verb regex (`implement|build|create|architect|design|migrate|deploy|refactor`). Everything else that passes the trivia filter (`POSITIVE_PRAISE_WORDS`, `SYSTEM_TEXT_PATTERNS`, `MIN_PROMPT_LENGTH=3`) is native. Do not broaden — see `feedback_state_monitoring_requires_starting_gate.md`.

**Staleness thresholds:** 5 min native, 10 min algorithm. Matched in both readers.

**Loud-fail:** `algorithm-watcher.ts` emits `console.error` on missing work.json at startup; `/api/algorithm` returns HTTP 503 with the resolved path. `ToolActivityTracker.hook.ts` logs exceptions via `console.error` so a silently-broken tracker shows up in session logs.

**Self-healing:** Both readers use `Math.max(updatedAt, lastToolActivity)` for the activity signal, so a fresh user prompt revives a stale session even if the tool-activity tracker is down.

## See Also

- `${PAI_DIR}/DOCUMENTATION/PAISystemArchitecture.md` — Master PAI architecture reference
