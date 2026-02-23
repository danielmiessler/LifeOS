---
workflow: TestIdea
mode: single-run
---

# Test Idea Against World Threat Models

Test any idea, strategy, investment, brand, or concept against all 11 persistent world models
to assess viability across time horizons.

## When to Use

- User says "test this idea," "how will this hold up," "test my strategy," "stress test this"
- User provides an idea/strategy/investment and wants temporal viability analysis
- User wants to understand when an idea breaks or thrives

## Prerequisites

- World models must exist at `~/.claude/MEMORY/RESEARCH/WorldModels/`
- If models don't exist, prompt user to run UpdateModels workflow first

## Tier Detection

Detect from user prompt:
- **"fast"** or **"quick"** → Fast tier
- **"deep"** or **"thorough"** or **"comprehensive"** → Deep tier
- **No modifier** → Standard tier (default)

## Workflow Steps

### Step 0: Validate Models Exist

```
Check ~/.claude/MEMORY/RESEARCH/WorldModels/ for all 11 model files.
If any missing: "World models incomplete. Run 'update world models' first."
If models older than 30 days: warn user but proceed.
```

### Step 1: Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Testing your idea against all eleven world threat models at TIER tier", "voice_id": "YOUR_VOICE_ID_HERE"}'
```

### Step 2: Extract and Decompose the Idea

Before hitting it with world models, decompose the idea:

1. **State the idea** in 1-2 sentences
2. **Identify core assumptions** the idea relies on (market conditions, technology state, cultural norms, regulatory environment, competitive landscape)
3. **Identify success dependencies** — what must remain true for this to work?

For **Standard and Deep tiers:** Invoke FirstPrinciples skill to classify assumptions:
- Hard constraints (physics, demographics, math)
- Soft constraints (policy, regulation, cultural norms)
- Assumptions (unvalidated beliefs the idea depends on)

### Step 3: Run Against World Models

Read all 11 model files from `~/.claude/MEMORY/RESEARCH/WorldModels/`.

#### Fast Tier (~2 min)
Single-agent analysis:
1. Read all 11 models sequentially
2. For each horizon, generate: Verdict (🟢/🟡/🔴) + 2-3 bullet points
3. Write Executive Verdict
4. Output using abbreviated format from OutputFormat.md

#### Standard Tier (~10 min)
Parallel agent analysis:
1. Spawn up to 11 parallel agents (Task tool, `run_in_background: true`)
2. Each agent:
   - Reads ONE world model document
   - Analyzes the idea against that specific horizon
   - Tests each assumption against the horizon's conditions
   - Returns: Verdict, Key Factors, Analysis, Assumptions Tested
3. After all agents return, invoke **RedTeam skill** with:
   - Prompt: "Attack this idea across all time horizons. Here are the per-horizon analyses: {results}"
   - Extract adversarial findings per horizon
4. Synthesize Cross-Horizon Synthesis section
5. Output using full format from OutputFormat.md

#### Deep Tier (up to 1 hr)
Full capability invocation:
1. **FirstPrinciples** (if not already run): Full deconstruct → challenge → reconstruct cycle on the idea
2. **Research update check**: For each horizon, run quick Research check for any new developments that affect this specific idea
3. **Parallel horizon analysis**: Same as Standard but with deeper prompts and longer analysis per horizon
4. **RedTeam** (32 agents): Full adversarial analysis of the idea across all horizons
5. **Council**: Multi-agent debate on the idea's long-term viability
   - Prompt: "Debate the viability of {idea} across time horizons from 6 months to 50 years. Consider: {per-horizon results}"
   - Extract Council Deliberation section
6. Synthesize all findings
7. Output using complete format from OutputFormat.md (all sections)

### Step 4: Format Output

Use the template in `OutputFormat.md` (loaded from skill root). Ensure:
- Each horizon is clearly separated with its own section header
- Verdicts use consistent emoji indicators
- Confidence levels reflect model confidence × analysis certainty
- Adversarial findings attribute to specific horizon contexts

### Step 5: Voice Summary

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Analysis complete. SUMMARY_OF_EXECUTIVE_VERDICT", "voice_id": "YOUR_VOICE_ID_HERE"}'
```

## Output Format

See `OutputFormat.md` in the skill root directory.

## Integration Points

| Skill | Tier | Purpose |
|-------|------|---------|
| **FirstPrinciples** | Standard, Deep | Decompose idea assumptions before testing |
| **RedTeam** | Standard, Deep | Adversarial attack on idea across horizons |
| **Council** | Deep only | Multi-perspective debate on viability |
| **Research** | Deep only | Quick refresh of horizon-relevant current events |

## Error Handling

- If a parallel agent fails: continue with remaining agents, note missing horizon in output
- If a skill invocation fails: degrade gracefully (e.g., skip Council section, note in footer)
- If models are stale (>90 days): prominently warn in header, recommend update
