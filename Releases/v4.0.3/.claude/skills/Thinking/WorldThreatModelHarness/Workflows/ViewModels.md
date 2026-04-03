---
workflow: ViewModels
mode: single-run
---

# View World Models

Read and display the current state of world threat models.

## When to Use

- User says "view world models," "show models," "current models," "model status"
- User wants to understand what's in the current models
- User wants to check model freshness before running TestIdea

## Workflow Steps

### Step 1: Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Checking current world model state", "voice_id": "fTtv3eikoepIosk8dTZ5"}'
```

### Step 2: Read INDEX

Read `~/.claude/MEMORY/RESEARCH/WorldModels/INDEX.md`.
If it doesn't exist: "No world models found. Run 'update world models' to create them."

### Step 3: Determine View Scope

**Overview** (default — no specific horizon mentioned):
- Display the INDEX table with all horizons, dates, versions, confidence
- For each model, show 2-3 sentence Executive Summary excerpt
- Flag any models older than 30 days as stale

**Single Horizon** (user says "show me the 5-year model"):
- Read and display the full model document for that horizon
- Include all sections

**Comparison** (user says "compare near-term vs long-term"):
- Side-by-side key themes from selected horizons
- Highlight where short-term and long-term trends conflict

### Step 4: Staleness Check

For each model, compare `last_updated` to today:
- **< 7 days**: 🟢 Fresh
- **7-30 days**: 🟡 Current
- **30-90 days**: 🟠 Aging — recommend refresh
- **> 90 days**: 🔴 Stale — strongly recommend update

### Step 5: Output

```markdown
# 🌍 World Threat Model Status

| Horizon | Last Updated | Version | Confidence | Freshness |
|---------|-------------|---------|------------|-----------|
| 6 months | YYYY-MM-DD | N | HIGH | 🟢 Fresh |
| 1 year | YYYY-MM-DD | N | MEDIUM | 🟡 Current |
| ... | ... | ... | ... | ... |

## Summaries

### 6-Month Horizon
{2-3 sentence executive summary excerpt}

### 1-Year Horizon
{2-3 sentence executive summary excerpt}

...

## Recommendations
- {Any models needing refresh}
- {Any notable changes since last update}
```

## Integration Points

None — this is a read-only workflow.
