# Memory System

**The unified system memory - what happened, what we learned, what we're working on.**

**Version:** 7.0 (Projects-native architecture, 2026-01-12)
**Location:** `~/.claude/MEMORY/`

---

## Architecture

**Claude Code's `projects/` is the source of truth. Hooks capture domain-specific events directly. Harvesting tools extract learnings from session transcripts.**

```
User Request
    ↓
Claude Code projects/ (native transcript storage - 30-day retention)
    ↓
Hook Events trigger domain-specific captures:
    ├── AutoWorkCreation → WORK/
    ├── RatingCapture → LEARNING/SIGNALS/
    ├── WorkCompletionLearning → LEARNING/
    └── SecurityValidator → SECURITY/
    ↓
Harvesting (periodic):
    ├── SessionHarvester → LEARNING/ (extracts corrections, errors, insights)
    └── LearningPatternSynthesis → LEARNING/SYNTHESIS/ (aggregates ratings)
```

**Key insight:** Hooks write directly to specialized directories. There is no intermediate "firehose" layer - Claude Code's `projects/` serves that purpose natively.

---

## Directory Structure

```
~/.claude/MEMORY/
├── WORK/                   # PRIMARY work tracking
│   └── {work_id}/
│       ├── META.yaml       # Status, session, lineage
│       ├── ISC.json        # Ideal State Criteria (auto-captured by hooks)
│       ├── items/          # Individual work items
│       ├── agents/         # Sub-agent work
│       ├── research/       # Research findings
│       ├── scratch/        # Iterative artifacts (diagrams, prototypes, drafts)
│       ├── verification/   # Evidence
│       └── children/       # Nested work
├── LEARNING/               # Learnings (includes signals)
│   ├── SYSTEM/             # PAI/tooling learnings
│   │   └── YYYY-MM/
│   ├── ALGORITHM/          # Task execution learnings
│   │   └── YYYY-MM/
│   ├── FAILURES/           # Full context dumps for low ratings (1-3)
│   │   └── YYYY-MM/
│   │       └── {timestamp}_{8-word-description}/
│   │           ├── CONTEXT.md      # Human-readable analysis
│   │           ├── transcript.jsonl # Raw conversation
│   │           ├── sentiment.json  # Sentiment metadata
│   │           └── tool-calls.json # Tool invocations
│   ├── SYNTHESIS/          # Aggregated pattern analysis
│   │   └── YYYY-MM/
│   │       └── weekly-patterns.md
│   ├── REFLECTIONS/        # Algorithm performance reflections
│   │   └── algorithm-reflections.jsonl
│   └── SIGNALS/            # User satisfaction ratings
│       └── ratings.jsonl
├── RESEARCH/               # Agent output captures
│   └── YYYY-MM/
├── SECURITY/               # Security audit events
│   └── security-events.jsonl
├── STATE/                  # Operational state
│   ├── algorithms/         # Per-session algorithm state (phase, criteria, effort level)
│   ├── kitty-sessions/     # Per-session Kitty terminal env (listenOn, windowId)
│   ├── tab-titles/         # Per-window tab state (title, color, phase)
│   ├── session-names.json  # Auto-generated session names (from SessionAutoName hook)
│   ├── current-work.json
│   ├── format-streak.json
│   ├── algorithm-streak.json
│   ├── trending-cache.json
│   ├── progress/           # Multi-session project tracking
│   └── integrity/          # System health checks
├── PAISYSTEMUPDATES/         # Architecture change history
│   ├── index.json
│   ├── CHANGELOG.md
│   └── YYYY/MM/
└── README.md
```

---

## Directory Details

### Claude Code projects/ - Native Session Storage

**Location:** `~/.claude/projects/-Users-{username}--claude/`
*(Replace `{username}` with your system username, e.g., `-Users-john--claude`)*
**What populates it:** Claude Code automatically (every conversation)
**Content:** Complete session transcripts in JSONL format
**Format:** `{uuid}.jsonl` - one file per session
**Retention:** 30 days (Claude Code manages cleanup)
**Purpose:** Source of truth for all session data; harvesting tools read from here

This is the actual "firehose" - every message, tool call, and response. PAI leverages this native storage rather than duplicating it.

### WORK/ - Primary Work Tracking

**What populates it:**
- `AutoWorkCreation.hook.ts` on UserPromptSubmit (creates work dir)
- `WorkCompletionLearning.hook.ts` on Stop (updates work items)
- `SessionSummary.hook.ts` on SessionEnd (marks COMPLETED)

**Content:** Work directories with metadata, items, verification artifacts
**Format:** `WORK/{work_id}/` with META.yaml, items/, verification/, etc.
**Purpose:** Track all discrete work units with lineage, verification, and feedback

**Work Directory Lifecycle:**
1. `UserPromptSubmit` → AutoWorkCreation creates work dir + first item
2. `Stop` → WorkCompletionLearning updates item with response summary + captures ISC
3. `SessionEnd` → SessionSummary marks work COMPLETED, clears state

**ISC.json - Ideal State Criteria Tracking:**

The `ISC.json` file captures the Ideal State Criteria from PAI Algorithm execution. This enables:
- Verification against defined success criteria
- Iteration when criteria are not fully satisfied
- Post-hoc analysis of requirements evolution

**Effort-Tiered Capture Depth:**

| Effort Level | What's Captured |
|--------------|-----------------|
| QUICK/TRIVIAL | Final satisfaction summary only |
| STANDARD | Initial criteria + final satisfaction |
| DEEP/COMPREHENSIVE | Full version history with every phase update |

**ISC Document Format (JSON):**
```json
{
  "workId": "20260118-...",
  "effortTier": "STANDARD",
  "current": {
    "criteria": ["Criterion 1", "Criterion 2"],
    "antiCriteria": ["Anti-criterion 1"],
    "phase": "BUILD",
    "timestamp": "2026-01-18T..."
  },
  "history": [
    {"version": 1, "phase": "OBSERVE", "criteria": [...], "anti_criteria": [...], "timestamp": "..."},
    {"version": 2, "phase": "THINK", "updates": [...], "timestamp": "..."}
  ],
  "satisfaction": {"satisfied": 3, "partial": 1, "failed": 0, "total": 4}
}
```

**Why JSON over JSONL:** ISC is bounded versioned state (<10KB), not an unbounded log. JSON with `current` + `history` explicitly models what verification tools need (current criteria) vs debugging needs (history).

**Parsing Source:** WorkCompletionLearning extracts ISC from algorithm output patterns:
- `✅ CRITERIA:` / `❌ ANTI-CRITERIA:` blocks → Initial criteria
- `♻︎ Updated the ISC…` blocks → Phase updates
- `📊 ISC Satisfaction:` → Final verification results

### LEARNING/ - Categorized Learnings

**What populates it:**
- `RatingCapture.hook.ts` (explicit ratings + implicit sentiment + low-rating learnings)
- `WorkCompletionLearning.hook.ts` (significant work session completions)
- `SessionHarvester.ts` (periodic extraction from projects/ transcripts)
- `LearningPatternSynthesis.ts` (aggregates ratings into pattern reports)

**Structure:**
- `LEARNING/SYSTEM/YYYY-MM/` - PAI/tooling learnings (infrastructure issues)
- `LEARNING/ALGORITHM/YYYY-MM/` - Task execution learnings (approach errors)
- `LEARNING/SYNTHESIS/YYYY-MM/` - Aggregated pattern analysis (weekly/monthly reports)
- `LEARNING/REFLECTIONS/algorithm-reflections.jsonl` - Algorithm performance reflections (Q1/Q2/Q3 from LEARN phase)
- `LEARNING/SIGNALS/ratings.jsonl` - All user satisfaction ratings

**Categorization logic:**
| Directory | When Used | Example Triggers |
|-----------|-----------|------------------|
| `SYSTEM/` | Tooling/infrastructure failures | hook crash, config error, deploy failure |
| `ALGORITHM/` | Task execution issues | wrong approach, over-engineered, missed the point |
| `FAILURES/` | Full context for low ratings (1-3) | severe frustration, repeated errors |
| `REFLECTIONS/` | Algorithm performance analysis | per-session 3-question reflection from LEARN phase |
| `SYNTHESIS/` | Pattern aggregation | weekly analysis, recurring issues |

### LEARNING/FAILURES/ - Full Context Failure Analysis

**What populates it:**
- `RatingCapture.hook.ts` via `FailureCapture.ts` (for ratings 1-3)
- Manual migration via `bun FailureCapture.ts --migrate`

**Content:** Complete context dumps for low-sentiment events
**Format:** `FAILURES/YYYY-MM/{timestamp}_{8-word-description}/`
**Purpose:** Enable retroactive learning system analysis by preserving full context

**Each failure directory contains:**
| File | Description |
|------|-------------|
| `CONTEXT.md` | Human-readable analysis with metadata, root cause notes |
| `transcript.jsonl` | Full raw conversation up to the failure point |
| `sentiment.json` | Sentiment analysis output (rating, confidence, detailed analysis) |
| `tool-calls.json` | Extracted tool calls with inputs and outputs |

**Directory naming:** `YYYY-MM-DD-HHMMSS_eight-word-description-from-inference`
- Timestamp in PST
- 8-word description generated by fast inference to capture failure essence

**Rating thresholds:**
| Rating | Capture Level |
|--------|--------------|
| 1 | Full failure capture + learning file |
| 2 | Full failure capture + learning file |
| 3 | Full failure capture + learning file |
| 4-5 | Learning file only (if warranted) |
| 6-10 | No capture (positive/neutral) |

**Why this exists:** When significant frustration occurs (1-3), a brief summary isn't enough. Full context enables:
1. Root cause identification - what sequence led to the failure?
2. Pattern detection - do similar failures share characteristics?
3. Systemic improvement - what changes would prevent this class of failure?

### RESEARCH/ - Agent Outputs

**What populates it:** Agent tasks write directly to this directory
**Content:** Agent completion outputs (researchers, architects, engineers, etc.)
**Format:** `RESEARCH/YYYY-MM/YYYY-MM-DD-HHMMSS_AGENT-type_description.md`
**Purpose:** Archive of all spawned agent work

### SECURITY/ - Security Events

**What populates it:** `SecurityValidator.hook.ts` on tool validation
**Content:** Security audit events (blocks, confirmations, alerts)
**Format:** `SECURITY/security-events.jsonl`
**Purpose:** Security decision audit trail

### STATE/ - Fast Runtime Data

**What populates it:** Various tools and hooks
**Content:** High-frequency read/write JSON files for runtime state
**Key Property:** Ephemeral - can be rebuilt from RAW or other sources. Optimized for speed, not permanence.

**Key contents:**
- `algorithms/` - Per-session algorithm state files (`{sessionId}.json` — phase, criteria, effort level, active flag)
- `kitty-sessions/` - Per-session Kitty terminal env (`{sessionId}.json` — listenOn, windowId for tab control and voice gating)
- `tab-titles/` - Per-window tab state (`{windowId}.json` — title, color, phase for daemon recovery)
- `session-names.json` - Auto-generated session names from SessionAutoName hook
- `current-work.json` - Active work directory pointer
- `format-streak.json`, `algorithm-streak.json` - Performance metrics
- `progress/` - Multi-session project tracking
- `integrity/` - System health check results

This is mutable state that changes during execution - not historical records. If deleted, system recovers gracefully.

### PAISYSTEMUPDATES/ - Change History

**What populates it:** Manual via CreateUpdate.ts tool
**Content:** Canonical tracking of all system changes
**Purpose:** Track architectural decisions and system changes over time

---

## Hook Integration

| Hook | Trigger | Writes To |
|------|---------|-----------|
| AutoWorkCreation.hook.ts | UserPromptSubmit | WORK/, STATE/current-work.json |
| WorkCompletionLearning.hook.ts | Stop | WORK/items, LEARNING/ (significant work) |
| SessionSummary.hook.ts | SessionEnd | WORK/META.yaml (status), clears STATE |
| RatingCapture.hook.ts | UserPromptSubmit | LEARNING/SIGNALS/, LEARNING/, FAILURES/ (1-3) |
| SecurityValidator.hook.ts | PreToolUse | SECURITY/ |

## Harvesting Tools

| Tool | Purpose | Reads From | Writes To |
|------|---------|------------|-----------|
| SessionHarvester.ts | Extract learnings from transcripts | projects/ | LEARNING/ |
| LearningPatternSynthesis.ts | Aggregate ratings into patterns | LEARNING/SIGNALS/ | LEARNING/SYNTHESIS/ |
| FailureCapture.ts | Full context dumps for low ratings | projects/, SIGNALS/ | LEARNING/FAILURES/ |
| ActivityParser.ts | Parse recent file changes | projects/ | (analysis only) |

---

## Data Flow

```
User Request
    ↓
Claude Code → projects/{uuid}.jsonl (native transcript)
    ↓
AutoWorkCreation → WORK/{id}/ + STATE/current-work.json
    ↓
[Work happens - all tool calls captured in projects/]
    ↓
WorkCompletionLearning → Updates WORK/items
    ↓
RatingCapture → LEARNING/SIGNALS/ + LEARNING/
    ↓
WorkCompletionLearning → LEARNING/ (for significant work)
    ↓
SessionSummary → WORK/META.yaml (COMPLETED), clears STATE/current-work.json

[Periodic harvesting]
    ↓
SessionHarvester → scans projects/ → writes LEARNING/
LearningPatternSynthesis → analyzes SIGNALS/ → writes SYNTHESIS/
```

---

## Quick Reference

### Check current work
```bash
cat ~/.claude/MEMORY/STATE/current-work.json
ls ~/.claude/MEMORY/WORK/ | tail -5
```

### Check ratings
```bash
tail ~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl
```

### View session transcripts
```bash
# List recent sessions (newest first)
# Replace {username} with your system username
ls -lt ~/.claude/projects/-Users-{username}--claude/*.jsonl | head -5

# View last session events
tail ~/.claude/projects/-Users-{username}--claude/$(ls -t ~/.claude/projects/-Users-{username}--claude/*.jsonl | head -1) | jq .
```

### Check learnings
```bash
ls ~/.claude/MEMORY/LEARNING/SYSTEM/
ls ~/.claude/MEMORY/LEARNING/ALGORITHM/
ls ~/.claude/MEMORY/LEARNING/SYNTHESIS/
```

### Check failures
```bash
# List recent failure captures
ls -lt ~/.claude/MEMORY/LEARNING/FAILURES/$(date +%Y-%m)/ 2>/dev/null | head -10

# View a specific failure
cat ~/.claude/MEMORY/LEARNING/FAILURES/2026-01/*/CONTEXT.md | head -100

# Migrate historical low ratings to FAILURES
bun run ~/.claude/skills/PAI/Tools/FailureCapture.ts --migrate
```

### Check multi-session progress
```bash
ls ~/.claude/MEMORY/STATE/progress/
```

### Run harvesting tools
```bash
# Harvest learnings from recent sessions
bun run ~/.claude/skills/PAI/Tools/SessionHarvester.ts --recent 10

# Generate pattern synthesis
bun run ~/.claude/skills/PAI/Tools/LearningPatternSynthesis.ts --week
```

---

## Migration History

**2026-01-17:** v7.1 - Full Context Failure Analysis
- Added LEARNING/FAILURES/ directory for comprehensive failure captures
- Created FailureCapture.ts tool for generating context dumps
- Updated RatingCapture.hook.ts to create failure captures for ratings 1-3
- Each failure gets its own directory with transcript, sentiment, tool-calls, and context
- Directory names use 8-word descriptions generated by fast inference
- Added migration capability via `bun FailureCapture.ts --migrate`

**2026-01-12:** v7.0 - Projects-native architecture
- Eliminated RAW/ directory entirely - Claude Code's `projects/` is the source of truth
- Removed EventLogger.hook.ts (was duplicating what projects/ already captures)
- Created SessionHarvester.ts to extract learnings from projects/ transcripts
- Created WorkCompletionLearning.hook.ts for session-end learning capture
- Created LearningPatternSynthesis.ts for rating pattern aggregation
- Added LEARNING/SYNTHESIS/ for pattern reports
- Updated ActivityParser.ts to use projects/ as data source
- Removed archive functionality from pai.ts (Claude Code handles 30-day cleanup)

**2026-01-11:** v6.1 - Removed RECOVERY system
- Deleted RECOVERY/ directory (5GB of redundant snapshots)
- Removed RecoveryJournal.hook.ts, recovery-engine.ts, snapshot-manager.ts
- Git provides all necessary rollback capability

**2026-01-11:** v6.0 - Major consolidation
- WORK is now the PRIMARY work tracking system (not SESSIONS)
- Deleted SESSIONS/ directory entirely
- Merged SIGNALS/ into LEARNING/SIGNALS/
- Merged PROGRESS/ into STATE/progress/
- Merged integrity-checks/ into STATE/integrity/
- Fixed AutoWorkCreation hook (prompt vs user_prompt field)
- Updated all hooks to use correct paths

**2026-01-10:** v5.0 - Documentation consolidation
- Consolidated WORKSYSTEM.md into MEMORYSYSTEM.md

**2026-01-09:** v4.0 - Major restructure
- Moved BACKUPS to `~/.claude/BACKUPS/` (outside MEMORY)
- Renamed RAW-OUTPUTS to RAW
- All directories now ALL CAPS

**2026-01-05:** v1.0 - Unified Memory System migration
- Previous: `~/.claude/history/`, `~/.claude/context/`, `~/.claude/progress/`
- Current: `~/.claude/MEMORY/`
- Files migrated: 8,415+

---

## Related Documentation

- **Hook System:** `THEHOOKSYSTEM.md`
- **Architecture:** `PAISYSTEMARCHITECTURE.md`
