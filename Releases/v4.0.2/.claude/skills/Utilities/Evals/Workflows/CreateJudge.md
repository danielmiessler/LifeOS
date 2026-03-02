# CreateJudge Workflow

Create a custom LLM-as-Judge using templates.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the CreateJudge workflow in the Evals skill to create LLM judge"}' \
  > /dev/null 2>&1 &
```

Running the **CreateJudge** workflow in the **Evals** skill to create LLM judge...

---

## Prerequisites

- Use case exists or being created
- Clear evaluation criteria defined
- Understanding of what "good" looks like

## Execution

### Step 1: Gather Requirements

Ask the user:
1. What are you evaluating? (content type, task)
2. What criteria matter? (accuracy, style, format, etc.)
3. What scale? (1-5 recommended, binary for pass/fail)
4. Should we require reasoning? (yes - 13% accuracy improvement)

### Step 2: Create Judge Config

Create `~/.claude/skills/Utilities/Evals/UseCases/<name>/judge-config.yaml`:

```yaml
judge:
  name: <Descriptive Name> Judge
  focus: <accuracy | style | completeness | custom>
  scale:
    type: 1-5  # Recommended, or "binary"
  criteria:
    - name: <Criterion 1>
      description: <What this measures>
      weight: 0.4  # Weights should sum to 1.0
    - name: <Criterion 2>
      description: <What this measures>
      weight: 0.3
    - name: <Criterion 3>
      description: <What this measures>
      weight: 0.3
  reasoning_required: true  # Always true for accuracy
  position_swap: false  # True for A/B comparisons
context:
  task_description: |
    <Describe the original task the output was meant to complete>
  golden_output: |
    <Optional: Reference "perfect" output for comparison>
output:
  format: json  # or "structured"
```

### Step 3: Render Judge Prompt

```bash
bun run ~/.claude/Templates/Tools/RenderTemplate.ts \
  -t Evals/Judge.hbs \
  -d ~/.claude/skills/Utilities/Evals/UseCases/<name>/judge-config.yaml \
  -o ~/.claude/skills/Utilities/Evals/UseCases/<name>/judge-prompt.md \
  --preview
```

### Step 4: Review Generated Prompt

Check the rendered `judge-prompt.md`:
- Does it capture all criteria?
- Is the scoring scale clear?
- Does it require reasoning before scoring?
- Is the output format specified?

### Step 5: Integrate with Use Case

Update `config.yaml` to use the custom judge:

```yaml
criteria:
  ai_based:
    - scorer: "custom-judge"
      weight: 0.40
      params:
        prompt_file: "judge-prompt.md"
        judge_model: "claude-3-5-sonnet-20241022"
```

### Step 6: Test the Judge

Run a single test case to verify:

```bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli-run.ts \
  --use-case <name> \
  --test-id <single-test> \
  --verbose
```

Review:
- Does the judge produce valid JSON?
- Is the reasoning coherent?
- Are scores in expected range?
- Does it fail gracefully on edge cases?

## Best Practices

### Criteria Design

- **3-5 criteria max**: More becomes hard to calibrate
- **Clear, non-overlapping**: Each criterion measures something distinct
- **Weighted by importance**: Sum to 1.0
- **Specific indicators**: Describe what high/low scores look like

### Reasoning First

Always require reasoning before scoring:
```yaml
reasoning_required: true
```

This improves accuracy by 13%+ (research-backed).

### Scale Selection

| Scale | When to Use |
|-------|-------------|
| 1-5 | Most reliable, nuanced evaluation |
| Binary | Simple pass/fail, threshold-based |
| 1-3 | When finer gradations aren't meaningful |

Avoid 0-100 scales (poor calibration).

### Position Swapping (A/B Tests)

For comparisons, use position swapping:
```yaml
position_swap: true
```

Run twice with swapped positions, average results.

## Examples

### Accuracy Judge

```yaml
judge:
  name: Factual Accuracy Judge
  focus: accuracy
  scale:
    type: 1-5
  criteria:
    - name: Factual Correctness
      description: All claims match source material
      weight: 0.5
    - name: Completeness
      description: Covers all key points from source
      weight: 0.3
    - name: No Hallucinations
      description: No invented or fabricated information
      weight: 0.2
  reasoning_required: true
```

### Style Judge

```yaml
judge:
  name: Voice Authenticity Judge
  focus: style
  scale:
    type: 1-5
  criteria:
    - name: Tone Match
      description: Matches target author's casual, conversational style
      weight: 0.4
    - name: Word Choice
      description: Uses vocabulary consistent with target voice
      weight: 0.3
    - name: Personality
      description: Captures author's unique perspective
      weight: 0.3
  reasoning_required: true
```

## Done

Custom judge created and integrated. Run eval to test.
