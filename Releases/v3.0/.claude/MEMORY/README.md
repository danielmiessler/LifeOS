# MEMORY - Unified Memory System

**Version:** 7.0 (Projects-native architecture, 2026-01-12)

Full documentation: `~/.claude/skills/PAI/MEMORYSYSTEM.md`

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
    ├── ResponseCapture → WORK/, LEARNING/
    ├── RatingCapture → LEARNING/SIGNALS/
    ├── WorkCompletionLearning → LEARNING/
    ├── AgentOutputCapture → RESEARCH/
    └── SecurityValidator → SECURITY/
```

**Key insight:** Hooks write directly to specialized directories. There is no intermediate "firehose" layer - Claude Code's `projects/` serves that purpose natively.

---

## Directory Reference

| Directory | Purpose | Format | Access Pattern |
|-----------|---------|--------|----------------|
| **WORK/** | PRIMARY work tracking | Directories + YAML | Read/write per session |
| **LEARNING/** | Derived insights from experience | Markdown + JSONL | Read at session start |
| **RESEARCH/** | Agent output captures | Markdown | Write on agent completion |
| **SECURITY/** | Security audit events | JSONL | Write on security decisions |
| **STATE/** | Fast runtime data (caches, current state) | JSON | High-frequency read/write |
| **PAISYSTEMUPDATES/** | Architecture change history | Markdown | Manual, infrequent |

---

## Directory Details

### Claude Code projects/
**Native session storage.** Complete JSONL transcripts for every session. This is the actual "firehose" - every message, tool call, and response. PAI leverages this native storage rather than duplicating it. 30-day retention, managed by Claude Code.

### WORK/
**Primary work tracking system.** Each work unit gets a directory with META.yaml, items/, verification artifacts, and child work. Created on UserPromptSubmit, updated on Stop, marked COMPLETED on SessionEnd.

### LEARNING/
**Derived insights, not raw events.** Contains:
- `SYSTEM/` - Infrastructure/tooling learnings
- `ALGORITHM/` - Task execution learnings
- `SYNTHESIS/` - Aggregated pattern analysis (weekly/monthly reports)
- `SIGNALS/` - User satisfaction ratings (fast statusline queries)

### STATE/
**Fast real-time operational data.** Frequently read/written JSON files for runtime state. NOT durable knowledge - can be rebuilt from other sources.
- `current-work.json` - Active work directory pointer
- `algorithm-state.json` - Current execution phase
- `format-streak.json`, `algorithm-streak.json` - Performance metrics
- `trending-cache.json` - Cached analysis (TTL-based)
- `progress/` - Multi-session project tracking
- `integrity/` - System health checks

### SECURITY/
**Security decisions and audit trail.** Security-relevant events (blocks, confirmations, alerts).

### RESEARCH/
**Agent output captures.** Markdown files from spawned agents (researchers, architects, engineers).

### PAISYSTEMUPDATES/
**Architecture change history.** Canonical tracking of all system changes over time.

---

## Data Flow

```
User Prompt
    ↓
Claude Code → projects/{uuid}.jsonl (native transcript)
    ↓
AutoWorkCreation → WORK/ + STATE/current-work.json
    ↓
[Work happens - all captured in projects/]
    ↓
ResponseCapture → Updates WORK/items, optionally LEARNING/
    ↓
RatingCapture → LEARNING/SIGNALS/ (+ LEARNING/ if low rating)
    ↓
SessionSummary → WORK/ marked COMPLETED, STATE cleared

[Periodic harvesting]
    ↓
SessionHarvester → scans projects/ → writes LEARNING/
LearningPatternSynthesis → analyzes SIGNALS/ → writes SYNTHESIS/
```

---

## Quick Commands

```bash
# Current work
cat ~/.claude/MEMORY/STATE/current-work.json

# Recent work directories
ls -lt ~/.claude/MEMORY/WORK/ | head -5

# Recent ratings
tail ~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl

# View session transcripts
ls -lt ~/.claude/projects/-Users-yourname--claude/*.jsonl | head -5

# Check multi-session progress
ls ~/.claude/MEMORY/STATE/progress/
```
