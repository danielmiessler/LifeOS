# PAI v5.0 — API Contracts

## AC-01: Life Dashboard (Pulse) Routes [HIGH]

All routes served on a single local HTTP server (port 31337 default, configurable).

### Health
- GET `/api/pulse/health` → `{ status: "ok", uptime, version, modules, startTime }`
- GET `/healthz` → `{ status: "ok" }`

### Notification / Voice
- POST `/notify` → Body: `{ message: string, emotion?: string, voice_settings?: object }` → Response: `{ notified: true }`
- POST `/notify/personality` → Body: `{ message: string, personality?: string }`
- POST `/voice` → Body: `{ message: string, voice_id?: string, voice_settings?: object }`
- GET `/voice/health` → `{ ok: boolean, elevenlabs_quota?: object }`

### Hook Endpoints
- POST `/hooks/skill-guard` → Body: `{ skill: string }` → Response: `{ allowed: boolean, reason?: string }`
- POST `/hooks/agent-guard` → Body: `{ agent: object, mode: string }` → Response: `{ allowed: boolean, warning?: string, context?: object }`

### Wiki / Knowledge
- GET `/api/wiki/{category}/{slug}` → Full page content as markdown
- GET `/api/wiki/search?q={query}` → `{ results: [{ title, slug, snippet, score }] }`
- GET `/api/wiki/backlinks/{slug}` → `{ backlinks: [{ source, title }] }`
- GET `/api/wiki/categories` → `{ categories: string[] }`
- PUT `/api/wiki/{category}/{slug}` → Body: markdown content → `{ saved: true, slug }`

### Performance
- GET `/api/performance/cost` → Session cost data
- GET `/api/performance/failures` → Tool failure data
- GET `/api/performance/summary` → Aggregate performance metrics
- GET `/api/performance/anthropic-cost` → Subscription vs API billing snapshots

### Observability Dashboard (Next.js)
- GET `/` → Life Dashboard root
- GET `/dashboard/*` → Dashboard pages
- GET `/api/*` → Observability API routes
- `/_next/*` → Static Next.js assets

### Syslog
- UDP socket (port 5514) — syslog receiver (not HTTP)
- GET `/api/syslog/tail?n=50` → Last N syslog entries

### Assistant
- `/assistant/*` — DA module routes

## AC-02: Semantic Contracts [HIGH]

### Mode Classification Contract
- Input: user request (unstructured text)
- Output: `{ mode: "MINIMAL"|"NATIVE"|"ALGORITHM", effort: "E1"|"E2"|"E3"|"E4"|"E5", reasoning: string }`
- The classifier MUST reason, not regex-match

### ISA Scaffold Contract
- Input: user prompt + effort tier
- Output: complete ISA document with 12-slot structure (tier-gated)
- Content MUST be technology-agnostic at this level

### ISC Verification Contract
- Input: ISC description + current system state
- Output: `{ isc_id: string, status: "pass"|"fail", evidence: string }`
- Evidence MUST be concrete (file content, command output, API response, screenshot path)

### Skill Invocation Contract
- Input: skill name + action string (natural language)
- Output: result of workflow execution
- The action string is matched against the skill's Workflow Routing Table

### Cross-Vendor Audit Contract
- Input: completed ISA + verification evidence (for E4/E5)
- Output: `{ audit_status: "pass"|"fail"|"needs_revision", findings: [{ severity, description, recommendation }] }`

### Voice Notification Contract
- Input: `{ message: string, emotion?: string }`
- Output: audio play (TTS) + optional desktop notification
- Non-blocking (fire-and-forget). Error in TTS does NOT fail the calling operation.

## AC-03: External Messaging Contracts [MEDIUM]

### Telegram Inbound
- Input: Telegram message (text or command)
- Processing: (1) authenticate sender → (2) sanitize → (3) injection scan → (4) load conversation state → (5) classify mode → (6) execute → (7) stream response back via editMessageText
- Response: Telegram message (text, ≤4096 chars per segment)

### iMessage Inbound
- Input: iMessage (polled from SQLite chat.db every 3s)
- Processing: Same as Telegram, but using AppleScript/osascript for output

## AC-04: Cron Job Dispatch Contracts [MEDIUM]

Job output is dispatched to configured targets. Target types:
- `voice`: POST `localhost:31337/notify`
- `telegram`: POST to Telegram Bot API
- `ntfy`: POST to ntfy.sh topic
- `email`: spawn email CLI subprocess
- `log`: no-op, console.log only

Output matching sentinel strings suppresses dispatch.
