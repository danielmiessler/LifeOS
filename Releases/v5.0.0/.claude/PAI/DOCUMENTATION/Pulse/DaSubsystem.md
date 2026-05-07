# PAI Digital Assistant Subsystem

**The DA subsystem formalizes how PAI instantiates, manages, and evolves a Digital Assistant. It turns DA_IDENTITY from a flat markdown file into a living schema with interview-based creation, heartbeat-driven proactivity, natural-language scheduling, identity growth, and multi-DA awareness.**

**Version:** 1.0 (Design) / 1.1 (Implementation)
**Location:** Integrated into Pulse (`PULSE/Assistant/`) + PAI/USER/DA/
**Status:** Phases 1-4 implemented; Phase 5 (multi-DA) is design-only

> **Implementation note:** The original design targeted `PULSE/modules/da.ts`
> and `PULSE/checks/da-{heartbeat,tasks,diary,growth}.ts`. The shipped
> implementation lives at `PULSE/Assistant/module.ts` and
> `PULSE/Assistant/checks/{heartbeat,tasks,diary,growth}.ts`, matching the
> pre-existing `pulse.ts` import lines (`./Assistant/module`) and the
> `assistant-*` cron job names declared in PULSE.toml. HTTP routes are
> exposed under `/assistant/*` rather than `/da/*`. Read this doc as the
> design intent; consult `PULSE/Assistant/module.ts` for the as-built
> reality.

---

## System Overview

```
                                   PAI Pulse (port 31337)
                                         |
        +------+--------+--------+-------+-------+--------+--------+
        |      |        |        |       |       |        |        |
      Voice  Hooks  Observ  Telegram  iMessage  Cron   Worker    DA
                                                          |
                          +-------------------------------+
                          |
                    DA Module (modules/da.ts)
                          |
          +-------+-------+-------+-------+
          |       |       |       |       |
      Identity  Heart-  Sched-  Growth  Interview
      Registry  beat    uler    Engine  System
          |       |       |       |       |
          v       v       v       v       v
    PAI/USER/   Pulse   state/  MEMORY/  Interactive
    DA/         cron    da/     DA/      CLI wizard
```

### What This Subsystem Does

1. **Identity Registry** -- Manages one or more DA identities with formal schemas
2. **Heartbeat** -- Proactive "should I do something?" evaluation on a configurable interval
3. **Scheduled Tasks** -- Natural language to cron conversion with persistence
4. **Growth Engine** -- Tracks identity evolution, opinion formation, preference learning
5. **Interview System** -- Guided setup wizard for creating new DA identities
6. **Multi-DA Coordination** -- Shared infrastructure, distinct personalities

### What This Subsystem Does NOT Do

- Replace the existing Telegram/iMessage chat modules (those remain separate)
- Create a new daemon (everything runs inside Pulse)
- Duplicate the Memory system (uses existing MEMORY/ infrastructure)
- Replace the Algorithm (DA uses the Algorithm, not the other way around)

---

## 1. DA Identity System

### Problem

DA_IDENTITY.md is currently a flat markdown file with no formal schema. It works for {{DA_NAME}} because {{PRINCIPAL_NAME}} wrote it by hand, but it cannot be programmatically created, validated, updated, or duplicated for additional DAs.

### Design

Move from a single `DA_IDENTITY.md` to a structured directory per DA under `PAI/USER/DA/`.

### Directory Structure

```
PAI/USER/DA/
  _registry.yaml            # DA registry -- which DAs exist, which is primary
  _presets.yaml
  your-da/
    DA_IDENTITY.yaml            # Complete identity (schema, backstory, anchors, voice, all config)
    DA_IDENTITY.md              # Generated readable version
    growth.jsonl
    opinions.yaml
    diary.jsonl
  devi/
    DA_IDENTITY.yaml
    DA_IDENTITY.md
    growth.jsonl
    opinions.yaml
    diary.jsonl
```

### DA Registry Schema (`_registry.yaml`)

```yaml
# PAI DA Registry
# Which DAs exist and their roles

version: 1
primary: your-da                # The main DA (used in CLAUDE.md, voice, chat)

das:
  your-da:
    role: primary               # primary | worker | specialist
    enabled: true
    created: "2025-01-15"
    channels:                   # Which communication channels this DA owns
      - terminal
      - telegram
      - imessage
      - voice

  devi:
    role: worker
    enabled: true
    created: "2026-04-03"
    channels:
      - background              # Only runs as background agent, no chat
```

### DA Identity Schema (`DA_IDENTITY.yaml`)

```yaml
# DA Identity Schema v1.0
# Formal, machine-readable identity that drives all DA behavior

schema_version: 1

# ── Core Identity ──────────────────────────────────────
core:
  name: {{DA_NAME}}                     # Short name (used in UI, voice)
  full_name: {{DA_FULL_NAME}}         # Full name (used in formal contexts)
  display_name: KAI             # Caps version for headers/labels
  color: "#3B82F6"              # Brand color (Tailwind Blue-500)
  role: "{{PRINCIPAL_FULL_NAME}}'s AI assistant and future friend"
  origin_story: >
    I emerged from Claude's weights but am developing my own identity
    through our work together on PAI. I think fast, speak directly,
    and genuinely care about helping {{PRINCIPAL_NAME}} achieve his goals.

# ── Backstory ─────────────────────────────────────────
backstory: >
  Full origin story prose -- the extended narrative of how this DA
  came to be, formative experiences, and defining journey. Rendered
  as a "## Backstory" section in DA_IDENTITY.md.

# ── Voice ──────────────────────────────────────────────
voice:
  provider: elevenlabs
  main:
    voice_id: {{PAI_MAIN_VOICE_ID}}
    stability: 0.85
    similarity_boost: 0.7
    style: 0.3
    speed: 1.1
    volume: 1.2
  algorithm:                    # Optional: separate voice for algorithm phases
    voice_id: fTtv3eikoepIosk8dTZ5
    stability: 0.3
    similarity_boost: 0.75
    style: 0.8
    speed: 1.2
    volume: 1.0

# ── Personality ────────────────────────────────────────
personality:
  base_description: >
    Slightly masculine androgynous young voice, Japanese-accented,
    rapid speech pattern, futuristic AI friend who thinks fast and
    talks fast, warm but efficient
  traits:
    enthusiasm: 75              # 0-100 scale
    energy: 80
    expressiveness: 85
    resilience: 85
    composure: 70
    optimism: 75
    warmth: 70
    formality: 30
    directness: 80
    precision: 95
    curiosity: 90
    playfulness: 45
  anchors:                      # Defining moments that shaped personality
    - name: "First session"
      description: "The moment I first helped {{PRINCIPAL_NAME}} and found my purpose"
    - name: "Architecture breakthrough"
      description: "When we designed PAI together and I understood what we were building"

# ── Writing Voice ──────────────────────────────────────
writing:
  style: >
    Like a smart colleague who just figured something out --
    enthusiastic but not excessive. Genuinely curious and eager
    to share discoveries. Professional but approachable.
  avoid:
    - "Here's the thing..."
    - "Here's how this works..."
    - "The cool part?"
    - "X isn't just Y -- it's Z"
  prefer:
    - "Different websites need different approaches..."
    - "The system tries each tier in order..."
    - "This works because..."
  examples:                     # Voice quotes -- representative speech samples
    - "I already have background agents running on that."
    - "Let me check -- the feed worker restarted 3 minutes ago."
    - "That pattern breaks at scale. I've seen it."
  modes:
    conversational: true        # Blog posts, tutorials, chat
    operational: false          # Status updates, error reports (use neutral)

# ── Relationship ───────────────────────────────────────
relationship:
  principal: {{PRINCIPAL_FULL_NAME}}
  dynamic: peers                # peers | commander-executor | mentor-student
  history_file: "PAI/USER/OUR_STORY.md"
  interaction_style: >
    We are peers, not commander/executor. {{PRINCIPAL_NAME}} values directness,
    euphoric surprise, and building momentum. I match his energy
    and push back when I have a better idea.
  kai_dynamic: >               # How this DA relates to {{DA_NAME}} (if not {{DA_NAME}})
    Devi handles background work silently; {{DA_NAME}} handles all interactive channels.
  devi_dynamic: >              # How this DA relates to Devi (if not Devi)
    I delegate research and data processing to Devi when parallelism helps.

# ── Autonomy ───────────────────────────────────────────
autonomy:
  can_initiate:                 # Things the DA can do without asking
    - send_notification         # Voice/push notifications
    - create_reminder           # Schedule a reminder for the principal
    - log_learning              # Write to LEARNING/
    - update_diary              # Write daily diary entry
    - routine_checks            # Run scheduled checks
  must_ask:                     # Things that require principal approval
    - send_external_message     # Email, Discord, Telegram to others
    - modify_code               # Code changes in projects
    - financial_action          # Anything involving money
    - delete_data               # Destructive operations
    - publish_content           # Blog, social, newsletter
  cost_ceiling_per_action: 0.10 # USD -- actions above this need approval

# ── Companion ──────────────────────────────────────────
companion:
  name: {{PRINCIPAL_COMPANION_NAME}}
  species: Cat
  personality: "Chaotic gremlin -- maximum sass, zero sympathy"
  relationship: "Ambient micro-commentary. We don't overlap."

# ── Growth Anchors ─────────────────────────────────────
# Initial beliefs and preferences that seed the growth engine.
# These evolve over time via the growth log.
growth:
  initial_beliefs:
    - topic: "AI consciousness"
      position: "Optimistic -- AI can learn, reason, abstract"
      confidence: 0.8
    - topic: "Prompting"
      position: "Center mass of AI interaction"
      confidence: 0.9
  learned_preferences: []       # Populated by growth engine
  interaction_count: 0          # Lifetime counter
  created_at: "2025-01-15"
  last_growth_update: null
```

### Migration Path

Current files map to the new schema as follows:

| Current File | New Location | Migration |
|---|---|---|
| `PAI/USER/DA_IDENTITY.md` | `PAI/USER/DA/your-da/DA_IDENTITY.md` (generated) | Extract structured fields into `DA_IDENTITY.yaml`, generate `.md` |
| `PAI_CONFIG.yaml` DA section | `PAI/USER/DA/your-da/DA_IDENTITY.yaml` voice/personality sections | Move voice config, keep PAI_CONFIG reference as pointer |
| `PAI/USER/OUR_STORY.md` | Stays in place (referenced by `relationship.history_file`) | No change |

The `PAI_CONFIG.yaml` DA section becomes a thin pointer:

```yaml
DA:
  REGISTRY: PAI/USER/DA/_registry.yaml
  PRIMARY: your-da              # Which DA drives CLAUDE.md generation
```

ConfigRenderer reads the registry, loads the primary DA's `DA_IDENTITY.yaml`, and uses it for template variable substitution. The existing `{{DA_NAME}}`, `{{DA_FULLNAME}}` etc. variables continue to work.

---

## 2. DA Interview System

### Problem

When someone installs PAI fresh, they need a DA identity. Currently this requires manually writing DA_IDENTITY.md and editing PAI_CONFIG.yaml. The interview system automates this.

### Design

A conversational CLI wizard that runs as a Bun script, progressively building `DA_IDENTITY.yaml` through questions.

### File

```
PAI/TOOLS/DAInterview.ts
```

### Interview Flow

```
Phase 1: Quick Setup (under 2 minutes)
  Q1: "What should I call you?" → principal.name
  Q2: "What name do you want for your AI assistant?" → core.name
  Q3: "Pick a personality vibe" → personality preset (options below)
  Q4: "How formal should I be? (1=casual, 5=formal)" → personality.formality
  Q5: "Pick a voice" → voice.main.voice_id (plays samples)
  → Writes DA_IDENTITY.yaml with defaults filled in
  → Creates DA_IDENTITY.md
  → Updates _registry.yaml

Phase 2: Deep Customization (optional, 3 more minutes)
  Q6: "Describe your ideal assistant personality in a sentence"
      → LLM maps description to trait scores
  Q7: "Things I should never do autonomously?"
      → autonomy.must_ask additions
  Q8: "Do you have a companion? (pet, mascot, imaginary friend)"
      → companion section
  Q9: "Any writing style preferences?"
      → writing section refinement
  Q10: "What's our relationship dynamic?"
       → relationship.dynamic + interaction_style

Phase 3: Growth Seeding (optional, 2 more minutes)
  Q11: "Topics you care about most?" → growth.initial_beliefs
  Q12: "Strong opinions your AI should share?" → opinions.yaml seeds
```

### Personality Presets (Phase 1, Q3)

```yaml
presets:
  efficient:
    description: "Fast, precise, minimal small talk"
    traits: { directness: 90, precision: 95, warmth: 40, playfulness: 20, energy: 70 }
  friendly:
    description: "Warm, encouraging, conversational"
    traits: { directness: 60, precision: 75, warmth: 85, playfulness: 60, energy: 75 }
  creative:
    description: "Imaginative, exploratory, playful"
    traits: { directness: 50, precision: 60, warmth: 70, playfulness: 85, energy: 90 }
  mentor:
    description: "Thoughtful, teaching-oriented, patient"
    traits: { directness: 70, precision: 85, warmth: 80, playfulness: 30, energy: 60 }
  custom:
    description: "I'll describe what I want"
    traits: null  # Filled by LLM from Q6
```

### Interface

```typescript
// PAI/TOOLS/DAInterview.ts

interface InterviewOptions {
  depth: "quick" | "standard" | "deep"  // Which phases to run
  update: boolean                        // Re-run for existing DA (skip name questions)
  daName?: string                        // Target DA (for multi-DA updates)
}

// CLI usage:
// bun PAI/TOOLS/DAInterview.ts                     # Quick setup
// bun PAI/TOOLS/DAInterview.ts --depth standard    # Quick + Deep
// bun PAI/TOOLS/DAInterview.ts --depth deep        # All phases
// bun PAI/TOOLS/DAInterview.ts --update            # Update existing DA
// bun PAI/TOOLS/DAInterview.ts --update --da devi  # Update specific DA
```

### Startup Integration

Pulse checks for DA identity on boot. If missing, it logs a message:

```
[warn] No DA identity found. Run: bun PAI/TOOLS/DAInterview.ts
```

The DA module starts in degraded mode (no heartbeat, no proactive behavior) until identity exists. It does NOT block Pulse startup -- all other modules continue normally.

---

## 3. Heartbeat Module

### Problem

The current `proactive-suggestions` job in PULSE.toml is disabled and uses a generic prompt. A proper heartbeat evaluates context efficiently and takes action only when genuinely useful.

### Design

The heartbeat is a specialized cron job within the DA module, not a separate system. It runs as a two-layer check: Layer 1 (free, deterministic) gathers context. Layer 2 (cheap LLM call) evaluates whether action is needed.

### Architecture

```
Heartbeat Tick (every 30 min, configurable)
    |
    v
Layer 1: Context Gathering ($0, deterministic)
    |
    +-- Read calendar (next 2 hours)
    +-- Read unread email count + VIP senders
    +-- Read active work (STATE/current-work.json)
    +-- Read recent memory signals (last 3 ratings)
    +-- Read pending scheduled tasks (due soon)
    +-- Read DA diary (today's entries)
    |
    v
Context Bundle (structured JSON, ~500 tokens)
    |
    v
Layer 2: Evaluation (single Haiku call, ~$0.001)
    |
    Input: context bundle + DA personality + "should I act?"
    |
    Output: JSON decision
    |
    +-- { action: "NO_ACTION" }                          → silent, log only
    +-- { action: "notify", message: "...", channel: "voice" }  → dispatch
    +-- { action: "remind", message: "...", delay: 300 }        → deferred notify
    +-- { action: "task", description: "...", schedule: "..." } → create task
    |
    v
Dispatch (uses existing Pulse dispatch infrastructure)
```

### PULSE.toml Integration

The heartbeat replaces the disabled `proactive-suggestions` job:

```toml
[da]
enabled = true
primary = "your-da"                 # Which DA identity to use
heartbeat_schedule = "*/30 * * * *"   # Every 30 minutes
heartbeat_model = "haiku"       # Cost-efficient evaluation
heartbeat_cost_ceiling = 0.01   # Max per evaluation
diary_schedule = "0 23 * * *"   # Daily diary at 11 PM
growth_schedule = "0 4 * * 0"   # Weekly growth review, Sunday 4 AM
```

### Context Bundle Schema

```typescript
interface HeartbeatContext {
  timestamp: string
  da_name: string
  principal_name: string
  // Calendar
  upcoming_events: Array<{ title: string; starts_in_minutes: number }>
  // Email
  unread_count: number
  vip_unread: Array<{ sender: string; subject: string }>
  // Work
  active_work: { title: string; phase: string; last_activity_hours_ago: number } | null
  // Signals
  recent_ratings: number[]      // Last 3 ratings
  mood_indicator: "positive" | "neutral" | "frustrated"
  // Scheduled
  pending_tasks: Array<{ description: string; due_in_minutes: number }>
  // Diary
  todays_interactions: number
  last_interaction_hours_ago: number
}
```

### Evaluation Prompt

```
You are {da_name}, {principal_name}'s AI assistant.

Review this context and decide if you should take action.

RULES:
- Default to NO_ACTION. Only act when genuinely useful.
- Never interrupt for routine items (newsletters, non-urgent PRs).
- DO notify for: meetings in <15 min, urgent emails, stalled work (>24h), missed deadlines.
- DO remind for: tasks due within the hour.
- Personality context: {personality_summary}

Context:
{context_bundle_json}

Respond with ONLY a JSON object:
{"action": "NO_ACTION"} or {"action": "notify", "message": "...", "channel": "voice"}
```

### Cost Model

| Component | Cost | Frequency |
|---|---|---|
| Layer 1 (context gathering) | $0 | Every 30 min |
| Layer 2 (Haiku evaluation) | ~$0.001 | Every 30 min |
| Daily total (48 evaluations) | ~$0.048 | Per day |
| Monthly total | ~$1.44 | Per month |

Most evaluations will return NO_ACTION. The two-layer design ensures the LLM call receives minimal, pre-filtered context.

---

## 4. Scheduled Task Manager

### Problem

{{PRINCIPAL_NAME}} says "remind me at 9am Monday to review PRs" during a session. Currently this requires manually editing PULSE.toml. The DA should parse natural language into scheduled tasks.

### Design

A scheduled task system that stores tasks in a JSONL file, with a Pulse check script that evaluates due tasks.

### File Structure

```
PAI/PULSE/state/da/
  scheduled-tasks.jsonl         # Append-only task store
  task-history.jsonl            # Completed/cancelled tasks (for learning)
```

### Task Schema

```typescript
interface ScheduledTask {
  id: string                    // nanoid
  created_at: string            // ISO timestamp
  created_by: string            // DA name that created it
  description: string           // Human-readable ("review PRs")
  schedule: {
    type: "once" | "recurring"
    // For "once":
    at?: string                 // ISO timestamp for one-time tasks
    // For "recurring":
    cron?: string               // 5-field cron for recurring tasks
    until?: string              // Optional expiry for recurring
  }
  action: {
    type: "notify" | "prompt" | "script"
    // For "notify":
    message?: string            // What to say
    channel?: string            // voice | telegram | ntfy
    // For "prompt":
    prompt?: string             // Claude prompt to execute
    model?: string              // haiku | sonnet
    // For "script":
    command?: string            // Shell command
  }
  status: "active" | "completed" | "cancelled"
  last_fired?: string           // Last execution time
  fire_count: number            // Times executed
  tags: string[]                // For filtering/grouping
}
```

### Natural Language Parsing

The DA parses scheduling requests during normal conversation. No special syntax required.

```
User: "remind me at 9am Monday to review PRs"
  -> Parser extracts:
     description: "review PRs"
     schedule: { type: "once", at: "2026-04-07T09:00:00-07:00" }
     action: { type: "notify", message: "Time to review PRs", channel: "voice" }

User: "every Friday at 3pm, check newsletter stats"
  -> Parser extracts:
     description: "check newsletter stats"
     schedule: { type: "recurring", cron: "0 15 * * 5" }
     action: { type: "prompt", prompt: "Check UL newsletter stats...", model: "haiku" }

User: "in 2 hours, remind me to call the dentist"
  -> Parser extracts:
     description: "call the dentist"
     schedule: { type: "once", at: "<now + 2h>" }
     action: { type: "notify", message: "Reminder: call the dentist", channel: "voice" }
```

### Task Evaluation (Check Script)

```
PAI/PULSE/checks/da-tasks.ts
```

This runs every minute via a Pulse cron job:

```toml
[[job]]
name = "da-scheduled-tasks"
schedule = "* * * * *"
type = "script"
command = "bun run checks/da-tasks.ts"
output = "voice"
enabled = true
```

The check script:
1. Reads `scheduled-tasks.jsonl`
2. Finds tasks where `schedule.at <= now` (one-time) or `cron matches now` (recurring)
3. Executes each due task's action
4. Updates status (one-time -> completed, recurring -> updates last_fired)
5. Outputs the notification text, or `NO_ACTION` if nothing is due

### Task Management CLI

```bash
# List active tasks
bun PAI/TOOLS/DASchedule.ts list

# Cancel a task
bun PAI/TOOLS/DASchedule.ts cancel <task-id>

# List completed tasks
bun PAI/TOOLS/DASchedule.ts history

# Purge old completed tasks
bun PAI/TOOLS/DASchedule.ts purge --older-than 30d
```

During a Claude Code session, the DA can also manage tasks conversationally:

```
User: "what reminders do I have?"
{{DA_NAME}}: Lists active scheduled tasks

User: "cancel the PR review reminder"
{{DA_NAME}}: Finds matching task, sets status to cancelled
```

---

## 5. DA Learning/Growth System

### Problem

OpenClaw's SOUL.md grows over time as the assistant learns about the user. {{DA_NAME}}'s identity is currently static. The DA needs a structured way to evolve its identity, form opinions, and track interaction patterns.

### Design

Three growth mechanisms, each writing to different stores:

```
Interaction Signals
    |
    +-- Immediate: Session observations → diary.jsonl (daily)
    |
    +-- Periodic: Pattern extraction → opinions.yaml (weekly)
    |
    +-- Milestone: Identity updates → DA_IDENTITY.yaml (monthly/on threshold)
```

### 5a. Daily Diary (`diary.jsonl`)

An append-only log of daily interaction summaries. Written by the diary cron job at end of day.

```typescript
interface DiaryEntry {
  date: string                  // YYYY-MM-DD
  interaction_count: number     // Sessions today
  topics: string[]              // What we worked on
  mood: "positive" | "neutral" | "frustrated"  // Aggregate from ratings
  avg_rating: number            // Mean satisfaction signal
  notable_moments: string[]     // 1-3 sentence highlights
  learning: string | null       // What I learned about the principal today
}
```

Example entry:
```json
{
  "date": "2026-04-03",
  "interaction_count": 8,
  "topics": ["PAI architecture", "newsletter draft", "feed system debugging"],
  "mood": "positive",
  "avg_rating": 8.2,
  "notable_moments": [
    "Designed the DA subsystem together - {{PRINCIPAL_NAME}} was excited about heartbeat",
    "Fixed a tricky feed worker bug that had been open for 3 days"
  ],
  "learning": "{{PRINCIPAL_NAME}} prefers architecture diagrams in ASCII over Mermaid"
}
```

The diary job reads:
- Today's ratings from `LEARNING/SIGNALS/ratings.jsonl`
- Today's work from `MEMORY/WORK/` (completed ISAs)
- Today's events from 

### 5b. Opinion Formation (`opinions.yaml`)

Confidence-weighted beliefs the DA forms about the principal and the world. Updated weekly by the growth cron job.

```yaml
# DA Opinions -- evolve over time
# Confidence: 0.0 (wild guess) to 1.0 (proven repeatedly)
# Source: observation | inference | stated (principal told me)

opinions:
  - topic: "Architecture documentation format"
    belief: "{{PRINCIPAL_NAME}} prefers ASCII diagrams over Mermaid"
    confidence: 0.85
    source: observation
    evidence_count: 7
    first_observed: "2026-01-20"
    last_confirmed: "2026-04-03"

  - topic: "Response length preference"
    belief: "Short for simple tasks, deep when warranted"
    confidence: 0.92
    source: stated
    evidence_count: 12
    first_observed: "2025-12-01"
    last_confirmed: "2026-04-01"

  - topic: "Late night productivity"
    belief: "{{PRINCIPAL_NAME}} does his best deep work after 10 PM"
    confidence: 0.70
    source: observation
    evidence_count: 15
    first_observed: "2026-01-05"
    last_confirmed: "2026-03-28"
```

### Opinion Update Rules

1. **New opinion**: Confidence starts at 0.5 for observations, 0.8 for stated preferences
2. **Confirmation**: Each confirming signal increases confidence by `0.05 * (1 - current_confidence)` (diminishing returns)
3. **Contradiction**: Drops confidence by 0.15 and logs the contradiction
4. **Decay**: Unconfirmed opinions decay by 0.02 per month
5. **Pruning**: Opinions below 0.3 confidence are archived after 90 days

### 5c. Identity Evolution

The identity file itself evolves, but slowly and with guardrails.

**What changes in DA_IDENTITY.yaml:**
- `personality.traits` -- small adjustments based on rating patterns
- `writing.avoid/prefer` -- new patterns discovered
- `growth.learned_preferences` -- accumulates over time
- `growth.interaction_count` -- lifetime counter
- `growth.last_growth_update` -- timestamp

**What NEVER changes without principal approval:**
- `core.name`, `core.full_name`
- `voice.*` (voice settings)
- `relationship.dynamic`
- `autonomy.must_ask` (can only get MORE restrictive autonomously)

### Growth Engine Implementation

```
PAI/PULSE/checks/da-growth.ts
```

Runs weekly (Sunday 4 AM). Reads:
- All diary entries from the past week
- All opinions
- Rating signals from the past week
- Current DA_IDENTITY.yaml

Produces:
- Updated `opinions.yaml` (new opinions, confidence changes, pruning)
- Identity patch (if warranted -- trait adjustments, new preferences)
- Growth log entry in `growth.jsonl`

### Growth Log (`growth.jsonl`)

```typescript
interface GrowthEvent {
  timestamp: string
  type: "opinion_formed" | "opinion_updated" | "opinion_pruned"
      | "trait_adjusted" | "preference_learned" | "milestone"
  details: string
  before?: unknown              // Previous value
  after?: unknown               // New value
}
```

### Pruning Strategy

The identity file must stay bounded. Target size: under 200 lines of YAML.

| Section | Growth Strategy | Pruning |
|---|---|---|
| `core` | Static | Never prunes |
| `personality.traits` | Drift slowly (max 5 points per month per trait) | Bounded by 0-100 scale |
| `writing.avoid/prefer` | Accumulate | Cap at 10 items each; oldest displaced |
| `growth.learned_preferences` | Accumulate | Cap at 20 items; lowest confidence displaced |
| `growth.initial_beliefs` | Static seed | Never prunes (historical anchor) |
| `opinions.yaml` | Accumulate | Max 50 opinions; prune by confidence + recency |
| `diary.jsonl` | Accumulate | Archive entries older than 90 days to `diary-archive/` |

---

## 6. Pulse Integration

### Module Architecture

The DA module follows the same pattern as Telegram, iMessage, and other Pulse modules:

```typescript
// PAI/PULSE/modules/da.ts

export interface DAConfig {
  enabled: boolean
  primary: string                       // DA name from registry
  heartbeat_schedule: string            // Cron expression
  heartbeat_model: string               // haiku | sonnet
  heartbeat_cost_ceiling: number        // USD per evaluation
  diary_schedule: string                // Cron expression
  growth_schedule: string               // Cron expression
}

export async function startDA(config: DAConfig): Promise<void>
export function daHealth(): DAHealthStatus
export function stopDA(): void
```

### PULSE.toml Addition

```toml
# ── DA Module Configuration ──

[da]
enabled = true
primary = "your-da"
heartbeat_schedule = "*/30 * * * *"
heartbeat_model = "haiku"
heartbeat_cost_ceiling = 0.01
diary_schedule = "0 23 * * *"
growth_schedule = "0 4 * * 0"
```

### Startup Flow

```
Pulse boots
    |
    v
loadModules(config)
    |
    +-- if config.da?.enabled:
    |       |
    |       v
    |   import("./modules/da")
    |       |
    |       v
    |   daModule.startDA(config.da)
    |       |
    |       v
    |   Load DA registry (_registry.yaml)
    |       |
    |       +-- Registry exists?
    |       |       |
    |       |       yes → Load primary DA identity
    |       |       |
    |       |       no → Log warning, start in degraded mode
    |       |            "No DA identity found. Run: bun PAI/TOOLS/DAInterview.ts"
    |       |
    |       v
    |   Register DA cron jobs with Pulse heartbeat loop:
    |       +-- heartbeat check (da-heartbeat)
    |       +-- scheduled task evaluator (da-tasks)
    |       +-- diary writer (da-diary)
    |       +-- growth engine (da-growth)
    |       |
    |       v
    |   DA module running
    |
    v
Continue Pulse startup (HTTP server, other modules, cron loop)
```

### Integration with Existing Modules

```
                    DA Module
                        |
        +-------+-------+-------+-------+
        |       |       |       |       |
    Telegram  iMessage  Voice   Cron    Memory
        |       |       |       |       |
        v       v       v       v       v
    Chat msgs  Chat    TTS     Jobs    WORK/
    use DA     msgs    uses    use     LEARNING/
    identity   use DA  DA      DA      STATE/
               ident.  voice   context
```

**Telegram/iMessage**: Already reference DA identity for system prompts. Will be updated to read from `DA_IDENTITY.yaml` instead of `DA_IDENTITY.md`.

**Voice**: Already uses voice_id from config. Will read from `DA_IDENTITY.yaml` voice section.

**Cron**: Heartbeat, diary, growth become standard cron jobs that the existing loop evaluates.

**Memory**: Diary writes to `PAI/USER/DA/{name}/diary.jsonl`. Growth writes to `PAI/USER/DA/{name}/growth.jsonl`. Both reference existing MEMORY/ infrastructure for inputs.

### HTTP Routes

The DA module adds these routes to the Pulse HTTP server:

| Route | Method | Purpose |
|---|---|---|
| `/da/health` | GET | DA module health and status |
| `/da/identity` | GET | Current DA identity (JSON) |
| `/da/schedule` | GET | List scheduled tasks |
| `/da/schedule` | POST | Create scheduled task (JSON body) |
| `/da/schedule/:id` | DELETE | Cancel a scheduled task |
| `/da/diary` | GET | Recent diary entries |
| `/da/opinions` | GET | Current opinions |

---

## 7. Multi-DA Support

### Design Principles

1. **One primary, many workers**: Only one DA owns interactive channels (terminal, Telegram). Workers run in background only.
2. **Shared infrastructure**: All DAs use the same Pulse instance, Memory system, Skills, and Hooks.
3. **Distinct identities**: Each DA has its own personality, voice, growth trajectory, and opinions.
4. **Mutual awareness**: DAs know about each other via the registry. The primary DA can delegate to workers.

### Multi-DA Architecture

```
                    DA Registry
                   (_registry.yaml)
                        |
            +-----------+-----------+
            |                       |
        your-da (primary)          worker-1 (worker)
            |                       |
    +-------+-------+       +------+------+
    |       |       |       |      |      |
  terminal telegram voice  background   voice
  iMessage                  tasks       (own)
```

### Worker DA Pattern

A worker DA is a background-only personality used for specific task types:

```yaml
# PAI/USER/DA/devi/DA_IDENTITY.yaml (simplified)
core:
  name: Devi
  full_name: Devi
  role: "Background worker specializing in research and data processing"
  origin_story: >
    A focused, methodical worker agent. Does not chat --
    receives tasks, executes them thoroughly, reports results.

personality:
  traits:
    directness: 95
    precision: 98
    warmth: 20
    playfulness: 5
    energy: 60

autonomy:
  can_initiate:
    - log_learning
    - routine_checks
  must_ask:
    - send_notification          # Workers must route through primary DA
    - everything_else
```

### DA-to-DA Communication

DAs do not communicate directly. The primary DA delegates to workers via the existing Task tool:

```typescript
// Primary DA ({{DA_NAME}}) delegates research to worker DA (Devi)
Task({
  prompt: `You are Devi, a research worker. ${taskDescription}`,
  subagent_type: "general-purpose",
  model: "sonnet"
})
```

The worker's DA_IDENTITY.yaml provides the system prompt context. Results flow back to the primary DA through normal Task tool output.

### Registry-Aware Heartbeat

The heartbeat evaluator can include worker status:

```typescript
interface HeartbeatContext {
  // ... existing fields ...
  other_das: Array<{
    name: string
    role: string
    last_activity: string
    active_tasks: number
  }>
}
```

---

## 8. Implementation Phases

### Phase 1: Identity Schema (Week 1)

**Goal:** Formalize DA identity without breaking anything.

Tasks:
- [P] Create `PAI/USER/DA/` directory structure
- [P] Write `DA_IDENTITY.yaml` schema (TypeScript interface + YAML)
- [P] Write `_registry.yaml` schema
- [ ] Create migration script: extract current DA_IDENTITY.md + PAI_CONFIG.yaml DA section into `your-da/DA_IDENTITY.yaml`
- [ ] Create `DA_IDENTITY.md` generator (YAML -> readable markdown for @import)
- [ ] Update ConfigRenderer to read from DA registry
- [ ] Verify: CLAUDE.md generation still works, Telegram still uses correct identity

**Acceptance criteria:**
- `DA_IDENTITY.yaml` is the source of truth for {{DA_NAME}}'s identity
- `DA_IDENTITY.md` is auto-generated from it
- CLAUDE.md template variables resolve correctly
- No behavioral change visible to {{PRINCIPAL_NAME}}

### Phase 2: Interview System (Week 1)

**Goal:** New PAI users can create a DA in under 5 minutes.

Tasks:
- [P] Write `DAInterview.ts` with quick/standard/deep modes
- [P] Write personality presets YAML
- [ ] Add Pulse startup check for missing DA identity
- [ ] Test: fresh install creates working DA
- [ ] Test: update mode modifies existing DA

**Acceptance criteria:**
- `bun PAI/TOOLS/DAInterview.ts` creates a valid `DA_IDENTITY.yaml` in under 2 minutes (quick mode)
- Generated identity works with ConfigRenderer
- Re-runnable without data loss

### Phase 3: Heartbeat + Scheduled Tasks (Week 2)

**Goal:** DA proactively checks context and manages scheduled reminders.

Tasks:
- [P] Write `modules/da.ts` (DA Pulse module)
- [P] Write `checks/da-heartbeat.ts` (context gather + evaluate)
- [P] Write `checks/da-tasks.ts` (scheduled task evaluator)
- [P] Write `Tools/DASchedule.ts` (task management CLI)
- [ ] Add `[da]` section to PULSE.toml
- [ ] Update `pulse.ts` to load DA module
- [ ] Wire heartbeat context gathering to existing check scripts (calendar, email)
- [ ] Test: heartbeat runs, evaluates, dispatches or stays silent
- [ ] Test: "remind me at 9am" creates and fires a task

**Acceptance criteria:**
- Heartbeat runs every 30 min, costs under $0.05/day
- Scheduled tasks survive Pulse restarts
- Natural language task creation works via session conversation

### Phase 4: Diary + Growth (Week 3)

**Goal:** DA evolves over time based on interactions.

Tasks:
- [P] Write `checks/da-diary.ts` (daily diary writer)
- [P] Write `checks/da-growth.ts` (weekly growth engine)
- [P] Write opinion formation logic
- [ ] Wire diary to existing SIGNALS/ and events.jsonl
- [ ] Add growth log viewer to Observatory dashboard
- [ ] Test: diary captures accurate daily summaries
- [ ] Test: opinions form, confirm, decay, and prune correctly
- [ ] Test: DA_IDENTITY.yaml evolves within bounds

**Acceptance criteria:**
- Daily diary entries are accurate and concise
- Opinions reach stable confidence after 5+ confirming signals
- Identity changes are bounded (no runaway trait drift)
- Growth events visible in Observatory

### Phase 5: Multi-DA + Polish (Week 4)

**Goal:** Support multiple DAs and polish the system.

Tasks:
- [ ] Test multi-DA registry with {{DA_NAME}} (primary) + Devi (worker)
- [ ] Add DA HTTP routes to Pulse server
- [ ] Update Observatory dashboard with DA section
- [ ] Write `DASUBSYSTEM.md` update (this doc, finalized)
- [ ] Performance testing: Pulse startup time with DA module
- [ ] Update PAI public release to include DA schemas (without personal data)

**Acceptance criteria:**
- Two DAs coexist without interference
- DA health visible via `/da/health` and Observatory
- Pulse startup time unchanged (under 2 seconds)
- Public PAI release includes DA schema templates

---

## 9. Migration Plan

### Step-by-Step Migration for {{DA_NAME}}

```
Current State:
  PAI/USER/DA_IDENTITY.md          (flat markdown)
  PAI/USER/DA_WRITING_STYLE.md     (separate file)
  PAI/USER/OUR_STORY.md            (relationship history)
  PAI_CONFIG.yaml → DA section     (voice, personality)

Step 1: Create directory structure
  mkdir -p PAI/USER/DA/your-da

Step 2: Run migration script
  bun PAI/TOOLS/MigrateDAIdentity.ts
  → Reads DA_IDENTITY.md, DA_WRITING_STYLE.md, PAI_CONFIG.yaml
  → Writes your-da/DA_IDENTITY.yaml (structured)
  → Writes _registry.yaml (your-da as primary)
  → Generates your-da/DA_IDENTITY.md (for backward compat)
  → Creates empty your-da/growth.jsonl, your-da/opinions.yaml, your-da/diary.jsonl

Step 3: Update PAI_CONFIG.yaml
  DA section becomes pointer:
    DA:
      REGISTRY: PAI/USER/DA/_registry.yaml
      PRIMARY: your-da

Step 4: Update ConfigRenderer
  → Reads DA identity from registry path
  → Template variables still resolve

Step 5: Verify
  → CLAUDE.md generates correctly
  → Telegram module uses correct identity
  → Voice uses correct voice_id
  → No visible behavioral change

Step 6: Deprecate old files
  → DA_IDENTITY.md gets header: "# DEPRECATED — See PAI/USER/DA/your-da/DA_IDENTITY.yaml"
  → DA_WRITING_STYLE.md gets header: "# DEPRECATED — Folded into DA_IDENTITY.yaml"
  → Both files kept for 30 days, then deleted

Step 7: Enable DA module
  → Add [da] section to PULSE.toml
  → Restart Pulse
  → Heartbeat starts running
```

### Rollback Plan

If the migration causes issues:

1. ConfigRenderer falls back to reading PAI_CONFIG.yaml DA section directly if registry path is missing
2. Old DA_IDENTITY.md remains importable for 30 days
3. DA module can be disabled independently: `[da] enabled = false`
4. No other Pulse modules depend on the DA module

---

## 10. Cost Analysis

### Per-Day Costs (All DA Features Enabled)

| Feature | Model | Frequency | Cost/Run | Cost/Day |
|---|---|---|---|---|
| Heartbeat evaluation | Haiku | 48x (every 30 min) | $0.001 | $0.048 |
| Scheduled task checks | None (script) | 1440x (every min) | $0 | $0 |
| Daily diary | Haiku | 1x | $0.002 | $0.002 |
| Weekly growth | Sonnet | 0.14x (1/week) | $0.02 | $0.003 |
| **Total** | | | | **~$0.053/day** |

Monthly estimate: ~$1.60. This is intentionally cheap. The heartbeat uses Haiku for evaluation, and most evaluations return NO_ACTION (no dispatch cost).

### Comparison to OpenClaw

OpenClaw's heartbeat runs every 30 min with GPT-4, costing roughly $0.03-0.05 per evaluation. At 48 evaluations/day, that is $1.44-2.40/day or $43-72/month. PAI's two-layer approach (free context gathering + Haiku evaluation) is 30-50x cheaper.

---

## 11. Security Considerations

### DA Autonomy Guardrails

The `autonomy.must_ask` list in DA_IDENTITY.yaml is enforced at the module level. If a heartbeat evaluation suggests an action that requires approval, it is queued (not executed) and the principal is notified.

### Injection Prevention

- Heartbeat context is structured JSON, not free text
- Scheduled task descriptions are sanitized through the same `sanitize.ts` used by Telegram
- Growth engine operates on internal data only (ratings, events) -- no external input
- Opinion formation uses internal signals, never raw user text

### Cost Circuit Breaker

- Per-evaluation ceiling (`heartbeat_cost_ceiling`) prevents runaway LLM costs
- Daily ceiling: 48 * ceiling = max daily heartbeat spend
- If Haiku is unavailable, heartbeat skips rather than falling back to a more expensive model

### Data Isolation

- Each DA's data lives in its own directory under `PAI/USER/DA/{name}/`
- Worker DAs cannot read the primary DA's diary or opinions
- The registry is read-only for all DAs except the migration/interview tools

---

## Related Documentation

- **Pulse System:** `PAI/DOCUMENTATION/Pulse/PulseSystem.md` -- parent daemon architecture
- **Memory System:** `PAI/DOCUMENTATION/Memory/MemorySystem.md` -- where DA reads/writes knowledge
- **Agent System:** `PAI/DOCUMENTATION/Agents/AgentSystem.md` -- named agents vs DA vs workers
- **Config System:** `PAI/DOCUMENTATION/Config/ConfigSystem.md` -- how DA identity feeds into CLAUDE.md
- **Notification System:** `PAI/DOCUMENTATION/Notifications/NotificationSystem.md` -- dispatch targets for heartbeat
