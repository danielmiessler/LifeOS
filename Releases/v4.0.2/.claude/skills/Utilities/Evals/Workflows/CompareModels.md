# CompareModels Workflow

Compare multiple models on the same prompt to determine the best performer.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the CompareModels workflow in the Evals skill to compare model performance"}' \
  > /dev/null 2>&1 &
```

Running the **CompareModels** workflow in the **Evals** skill to compare model performance...

---

## Prerequisites

- Existing use case with test cases and prompt
- API access to all models being compared
- Clear understanding of comparison criteria

## Execution

### Step 1: Identify Comparison

Ask the user:
1. Which use case?
2. Which models to compare? (Claude, GPT-4, Gemini, etc.)
3. What's the primary evaluation criterion?
4. Are there cost/latency constraints?

### Step 2: Update Use Case Config

Ensure models are listed in `config.yaml`:

```yaml
models:
  - claude-3-5-sonnet-20241022
  - claude-3-5-haiku-20241022
  - gpt-4o
  - gpt-4o-mini
  - gemini-1.5-pro
```

### Step 3: Create Model Comparison Config

Create `~/.claude/skills/Utilities/Evals/UseCases/<name>/model-comparisons/<comparison-name>.yaml`:

```yaml
model_comparison:
  name: "Claude vs GPT-4 vs Gemini"
  hypothesis: |
    Testing which model produces the best summaries for newsletter content.
    Expect Claude to excel at style, GPT-4 at accuracy.

  prompt: "prompts/v1.0.0.md"  # Same prompt for all models

  models:
    - id: "claude-3-5-sonnet-20241022"
      name: "Claude 3.5 Sonnet"
      provider: "anthropic"

    - id: "gpt-4o"
      name: "GPT-4o"
      provider: "openai"

    - id: "gemini-1.5-pro"
      name: "Gemini 1.5 Pro"
      provider: "google"

  # Test configuration
  test_cases: all

  # Evaluation settings
  judges:
    - name: "Primary Judge"
      model: "claude-3-5-sonnet-20241022"  # Consider using different judge
      criteria:
        - accuracy
        - style
        - format

  settings:
    runs_per_model: 1
    temperature: 0.7
    max_tokens: 2000

  # Cost tracking
  track_costs: true
  track_latency: true
```

### Step 4: Run Model Comparison

**Option A: CLI (Sequential)**

```bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli-run.ts \
  --use-case <name> \
  --models claude-3-5-sonnet-20241022,gpt-4o,gemini-1.5-pro
```

**Option B: CLI (Parallel)**

```bash
# Run each model in parallel for speed
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli-run.ts \
  --use-case <name> \
  --model claude-3-5-sonnet-20241022 &

bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli-run.ts \
  --use-case <name> \
  --model gpt-4o &

bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli-run.ts \
  --use-case <name> \
  --model gemini-1.5-pro &

wait
```

**Option C: Web UI**

1. Open http://localhost:5173
2. Select use case
3. Enable multiple models
4. Run evaluation
5. View side-by-side results

### Step 5: Collect Results

Results stored in:
- `Results/<use-case>/models/<run-id>/`
- `Results/<use-case>/models/<run-id>/comparison.json`

### Step 6: Generate Comparison Report

Use Report template:

```bash
bun run ~/.claude/Templates/Tools/RenderTemplate.ts \
  -t Evals/Report.hbs \
  -d Results/<use-case>/models/<run-id>/summary.yaml \
  -o Results/<use-case>/models/<run-id>/report.md
```

### Step 7: Analyze Results

**Multi-Model Summary Table:**

| Model | Pass Rate | Mean Score | Std Dev | Cost/1K | Latency |
|-------|-----------|------------|---------|---------|---------|
| Claude 3.5 Sonnet | 92% | 4.3 | 0.5 | $0.03 | 1.2s |
| GPT-4o | 88% | 4.1 | 0.6 | $0.05 | 1.8s |
| Gemini 1.5 Pro | 85% | 3.9 | 0.7 | $0.02 | 1.5s |
| Claude 3.5 Haiku | 78% | 3.7 | 0.8 | $0.01 | 0.5s |

**Per-Dimension Breakdown:**

| Model | Accuracy | Style | Format | Speed |
|-------|----------|-------|--------|-------|
| Claude 3.5 Sonnet | 4.5 | 4.6 | 4.0 | 1.2s |
| GPT-4o | 4.4 | 3.9 | 4.2 | 1.8s |
| Gemini 1.5 Pro | 4.2 | 3.8 | 3.8 | 1.5s |

### Step 8: Statistical Analysis

For each model pair, calculate:
- **p-value**: Statistical significance of difference
- **Effect size**: Magnitude of difference
- **Confidence intervals**: Range of true performance

```markdown
### Pairwise Comparisons

| Comparison | Winner | p-value | Significant? |
|------------|--------|---------|--------------|
| Claude vs GPT-4o | Claude | 0.04 | Yes |
| Claude vs Gemini | Claude | 0.01 | Yes |
| GPT-4o vs Gemini | GPT-4o | 0.12 | No |
```

### Step 9: Make Recommendation

Consider trade-offs:

| Factor | Weight | Best Model |
|--------|--------|------------|
| Quality | 50% | Claude 3.5 Sonnet |
| Cost | 25% | Claude 3.5 Haiku |
| Latency | 25% | Claude 3.5 Haiku |

**Decision Matrix:**

```markdown
## Recommendation

**Primary Use**: Claude 3.5 Sonnet
- Best quality (4.3 mean score)
- 92% pass rate
- Acceptable cost ($0.03/1K tokens)

**Budget Option**: Claude 3.5 Haiku
- Good quality (3.7 mean score)
- 78% pass rate
- Lowest cost ($0.01/1K tokens)
- Fastest (0.5s latency)

**Fallback**: GPT-4o
- Similar quality to Claude
- Higher cost
- Use when Claude unavailable
```

### Step 10: Document Results

Update use case README:

```markdown
## Model Comparison History

### Claude vs GPT-4 vs Gemini (2024-01-15)

**Purpose**: Determine best model for newsletter summaries.

**Results**:
1. Claude 3.5 Sonnet - 92% pass rate, 4.3 mean score
2. GPT-4o - 88% pass rate, 4.1 mean score
3. Gemini 1.5 Pro - 85% pass rate, 3.9 mean score

**Decision**:
- Production: Claude 3.5 Sonnet
- Budget fallback: Claude 3.5 Haiku
```

## Best Practices

### Fair Comparison

1. **Same prompt** for all models
2. **Same temperature** (default 0.7)
3. **Same max_tokens** limit
4. **Multiple runs** to account for variance

### Judge Selection

**Problem**: Using Claude to judge Claude may be biased.

**Solutions**:
1. Use ensemble of judges (Claude + GPT-4)
2. Average across different judge models
3. Weight non-self-judgments higher

### Cost-Quality Trade-offs

Use this framework:

| Scenario | Recommended |
|----------|-------------|
| Quality-critical, cost flexible | Best performing model |
| Quality-critical, cost-sensitive | Best quality-per-dollar |
| Latency-critical | Fastest with acceptable quality |
| High volume | Cheapest with acceptable quality |

### Model Selection Matrix

| Use Case | Recommended Model | Why |
|----------|-------------------|-----|
| Newsletter summaries | Claude 3.5 Sonnet | Best style |
| Data extraction | GPT-4o | Structured output strength |
| Fast classification | Claude 3.5 Haiku | Speed + cost |
| Complex reasoning | Claude 3.5 Sonnet | Reasoning quality |
| Multimodal | GPT-4o or Gemini | Vision capabilities |

## Output Template

```markdown
# Model Comparison Report: <Use Case>

## Executive Summary

**Best Overall**: <Model Name>
**Best Value**: <Model Name>
**Fastest**: <Model Name>

## Detailed Results

### Performance Metrics

[Table of metrics]

### Statistical Analysis

[Pairwise comparisons with p-values]

### Cost Analysis

[Cost per 1K tokens, total run cost]

### Latency Analysis

[Average response time, p95 latency]

## Recommendation

[Final recommendation with rationale]

## Raw Data

[Link to full results JSON]
```

## Done

Model comparison completed. Best model identified. Decision documented.
