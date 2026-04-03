---
workflow: UpdateModels
mode: loop-compatible
---

# Update World Models

Refresh or create world model documents using deep research and user-provided analysis.

## When to Use

- User says "update world models," "refresh models," "new analysis for models"
- User provides new information/analysis to incorporate into models
- Models are stale (>30 days since last update)
- Initial model population (no models exist yet)

## Prerequisites

- Model template at `~/.claude/skills/WorldThreatModelHarness/ModelTemplate.md`
- Research skill available for web research

## Workflow Steps

### Step 0: Check Existing State

```
Read ~/.claude/MEMORY/RESEARCH/WorldModels/INDEX.md (if exists)
Inventory which models exist and their last_updated dates
Determine: full creation vs. targeted update
```

### Step 1: Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Updating world threat models. This will take several minutes as I research current state for each time horizon.", "voice_id": "fTtv3eikoepIosk8dTZ5"}'
```

### Step 2: Determine Update Scope

**Full Creation** (no models exist or user says "rebuild all"):
- Create all 11 models from scratch
- Use parallel research agents for efficiency

**Targeted Update** (models exist, user provides new analysis OR routine refresh):
- If user provided analysis: incorporate into relevant horizons
- If routine refresh: research what's changed since last_updated date
- Update only affected models

**Single Horizon** (user specifies "update the 5-year model"):
- Research and update only the specified horizon

### Step 3: Research Current State

For each model being created or updated:

1. **Invoke Research skill** (Standard or Extensive mode depending on scope):
   - Query: "Current global state and projections for {HORIZON} timeframe: geopolitics, AI/technology trajectory, economics, society, environment, security. Focus on developments since {last_updated or 'baseline'}."
   - For near-term (6mo-3yr): Focus on current events, immediate trends, specific forecasts
   - For mid-term (5yr-10yr): Focus on trend trajectories, structural shifts, emerging patterns
   - For long-term (15yr-50yr): Focus on megatrends, demographic forces, technological paradigm shifts

2. **If user provided analysis**: Integrate user's insights as primary source, research as supporting

3. **Parallel execution**: When creating multiple models, spawn parallel agents:
   - Near-term batch: 6mo, 1yr, 2yr, 3yr (4 agents)
   - Mid-term batch: 5yr, 7yr, 10yr (3 agents)
   - Long-term batch: 15yr, 20yr, 30yr, 50yr (4 agents)
   - Each agent uses Research skill for its specific horizon

### Step 4: Write Model Documents

For each model, following `ModelTemplate.md`:

1. Write frontmatter (horizon, last_updated: today, version: increment, confidence level)
2. Write all 9 required sections with minimum word counts
3. Ensure hedging language for predictions
4. Include specific data points, named entities, cited reasoning
5. Write Wildcards section with probability estimates

Save to: `~/.claude/MEMORY/RESEARCH/WorldModels/{horizon}.md`

### Step 5: Update INDEX

Write/update `~/.claude/MEMORY/RESEARCH/WorldModels/INDEX.md`:

```markdown
# World Threat Models — Index

Last full update: {date}

| Horizon | File | Last Updated | Version | Confidence |
|---------|------|-------------|---------|------------|
| 6 months | 6-month.md | YYYY-MM-DD | N | high/med/low |
| 1 year | 1-year.md | YYYY-MM-DD | N | high/med/low |
| ... | ... | ... | ... | ... |

## Update History

- YYYY-MM-DD: {what was updated and why}
```

### Step 6: Voice Completion

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "World models updated. N horizons refreshed with current research.", "voice_id": "fTtv3eikoepIosk8dTZ5"}'
```

## Agent Prompt Template (for parallel model creation)

When spawning agents for model creation, use this prompt structure:

```
CONTEXT: You are creating a world threat model for the {HORIZON} time horizon.
The current date is {TODAY}. This model will be used to test ideas, strategies,
and investments against projected future world states.

TASK: Write a comprehensive world model document following this template:
{INSERT ModelTemplate.md CONTENT}

REQUIREMENTS:
- Minimum 4,000 words across all sections
- Use hedging language for predictions ("likely," "projected," "if trends continue")
- Be specific: name countries, companies, technologies, cite numbers where possible
- Near-term models: heavier on current data extrapolation
- Long-term models: focus on structural forces and megatrends
- Include at least 4 wildcards with probability estimates
- Rate your overall confidence and explain why

RESEARCH: Use WebSearch to find current data, forecasts, and analysis relevant to
this {HORIZON} timeframe across all sections (geopolitics, technology, economics,
society, environment, security).

SLA: Complete within 5 minutes.

OUTPUT: Write the complete model document in markdown format following the template exactly.
Include the frontmatter with horizon, last_updated, version: 1, and confidence rating.
```

## Integration Points

| Skill | Purpose |
|-------|---------|
| **Research** | Primary data gathering for model content |
| **WebSearch** | Current events and projections |

## State Management (Loop Compatibility)

- Models on disk are the state
- Step 0 reads existing state to determine what needs updating
- Each model is independently updatable
- INDEX.md tracks aggregate state
