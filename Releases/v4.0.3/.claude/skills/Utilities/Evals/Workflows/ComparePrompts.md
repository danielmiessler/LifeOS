# ComparePrompts Workflow

A/B test two prompt versions to determine which performs better.

**This workflow implements the Science Protocol for prompt experimentation.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ComparePrompts workflow in the Evals skill to A/B test prompts"}' \
  > /dev/null 2>&1 &
```

Running the **ComparePrompts** workflow in the **Evals** skill to A/B test prompts...

---

## Science Protocol Alignment

Before running any comparison, ensure you're following scientific rigor:

### Pre-Commitment (BEFORE running):
- [ ] Success criteria defined (what score/metric means "better"?)
- [ ] Pass threshold locked (what difference is meaningful?)
- [ ] Hypothesis is falsifiable (what result would DISPROVE it?)

### Falsifiability Check:
For every hypothesis, answer:
> *"What result would prove that Variant B is NOT better than Variant A?"*

**Example:**
- Hypothesis: "v1.1.0 improves accuracy due to source verification instructions"
- Falsifiable if: "v1.1.0 accuracy ≤ v1.0.0 accuracy, or difference < 5%"

If you cannot articulate what would disprove your hypothesis, **STOP** - you don't have a scientific hypothesis.

### Consider Three Variants:
A/B tests are good. A/B/C tests are often better.
- Reduces confirmation bias toward "the first alternative"
- Explores more of the solution space
- Reveals if there's a different direction entirely

---

## Prerequisites

- Existing use case with test cases
- Two (or more) prompt versions to compare
- Understanding of what "better" means for this use case
- **Falsifiable hypothesis with pre-committed success threshold**

## Execution

### Step 1: Identify Comparison (Science: Goal + Hypothesize)

Ask the user:
1. Which use case?
2. Which prompt versions? (consider 3+ variants)
3. What's the hypothesis? (Why might one be better?)
4. **What would DISPROVE this hypothesis?** ← Critical
5. Which metrics matter most?
6. What threshold defines "significantly better"?

### Step 2: Validate Both Prompts Exist

```bash
# Check prompts exist
ls ~/.claude/skills/Utilities/Evals/UseCases/<name>/prompts/

# Should see both versions:
# v1.0.0.md
# v1.1.0.md
```

### Step 3: Create Comparison Config

Create `~/.claude/skills/Utilities/Evals/UseCases/<name>/comparisons/<comparison-name>.yaml`:

```yaml
comparison:
  name: "v1.0.0 vs v1.1.0"
  hypothesis: |
    v1.1.0 should produce more accurate summaries due to
    added context about source verification.

  variants:
    a:
      name: "v1.0.0 (Baseline)"
      description: "Original prompt without source instructions"
      prompt: "prompts/v1.0.0.md"
    b:
      name: "v1.1.0 (Candidate)"
      description: "Added source verification instructions"
      prompt: "prompts/v1.1.0.md"

  # Use all test cases, or specify subset
  test_cases: all  # or ["001-basic", "002-edge", "003-hard"]

  # Judge configuration
  judges:
    - name: "Accuracy Judge"
      model: "claude-3-5-sonnet-20241022"
      focus: "accuracy"
    - name: "Style Judge"
      model: "gpt-4o"
      focus: "style"

  settings:
    position_swap: true      # Mitigate position bias
    num_runs: 1              # Runs per test case
    confidence_level: 0.95   # For statistical significance
    model: "claude-3-5-sonnet-20241022"  # Model to generate outputs
```

### Step 4: Run Comparison

**Option A: Via CLI**

```bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli-run.ts \
  --use-case <name> \
  --compare prompts/v1.0.0.md prompts/v1.1.0.md \
  --position-swap
```

**Option B: Via Web UI**

1. Open http://localhost:5173
2. Select use case
3. Click "Compare" tab
4. Select both prompt versions
5. Enable position swapping
6. Run comparison

### Step 5: Position Swapping Protocol

If `position_swap: true`:

For each test case:
1. **Run 1**: Variant A = "Option 1", Variant B = "Option 2"
2. **Run 2**: Variant B = "Option 1", Variant A = "Option 2"
3. Average scores to eliminate position bias

This addresses the known bias where LLMs favor the first option presented.

### Step 6: Collect Results

Results stored in:
- `Results/<use-case>/comparisons/<comparison-name>/<run-id>.json`

Results structure:
```json
{
  "comparison_name": "v1.0.0 vs v1.1.0",
  "run_id": "2024-01-15-143022",
  "variants": {
    "a": { "name": "v1.0.0", "wins": 5, "avg_score": 4.2 },
    "b": { "name": "v1.1.0", "wins": 7, "avg_score": 4.5 }
  },
  "per_test_case": [...],
  "statistical_significance": {
    "p_value": 0.03,
    "significant": true,
    "confidence_interval": [0.15, 0.45]
  }
}
```

### Step 7: Interpret Results

**Report Format:**

```markdown
## A/B Test Results: v1.0.0 vs v1.1.0

### Summary

| Metric | v1.0.0 (A) | v1.1.0 (B) |
|--------|------------|------------|
| Win Rate | 42% | 58% |
| Avg Score | 4.2 | 4.5 |
| Std Dev | 0.8 | 0.6 |

### Statistical Significance

- **p-value**: 0.03
- **Significant at 95%**: Yes
- **Confidence Interval**: [0.15, 0.45]

### Per-Dimension Breakdown

| Dimension | A Wins | B Wins | Tie |
|-----------|--------|--------|-----|
| Accuracy | 3 | 7 | 2 |
| Style | 5 | 4 | 3 |
| Format | 6 | 6 | 0 |

### Conclusion

**Winner**: v1.1.0 (Candidate)
**Confidence**: High (p < 0.05)
**Recommendation**: Deploy v1.1.0 to production
```

### Step 8: Make Decision

Based on results:

| Outcome | Action |
|---------|--------|
| B significantly better | Deploy B, archive A |
| A significantly better | Keep A, iterate on B |
| No significant difference | Keep simpler prompt, or gather more data |
| Mixed results (A wins some, B wins others) | Consider hybrid approach |

### Step 9: Document Decision

Update use case README with comparison results:

```markdown
## Comparison History

### v1.0.0 vs v1.1.0 (2024-01-15)

**Hypothesis**: v1.1.0 improves accuracy with source verification.

**Result**: v1.1.0 significantly better (p=0.03)
- Accuracy: +15%
- Style: No change
- Format: No change

**Decision**: Deployed v1.1.0 as new baseline.
```

## Best Practices

### Sample Size

- **Minimum**: 10 test cases (statistically weak)
- **Recommended**: 20-30 test cases (good power)
- **Ideal**: 50+ test cases (high confidence)

### Position Swapping

**Always enable** for pairwise comparisons. Research shows LLMs have strong position bias (prefer first option).

### Judge Selection

Use **different model** than the one generating outputs:
- If testing Claude prompts → Use GPT-4o as judge
- If testing GPT prompts → Use Claude as judge

This prevents self-serving bias.

### Statistical Significance

| p-value | Interpretation |
|---------|----------------|
| < 0.01 | Strong evidence |
| 0.01-0.05 | Moderate evidence |
| 0.05-0.10 | Weak evidence |
| > 0.10 | Not significant |

Don't deploy based on weak evidence unless the improvement is large.

## Common Patterns

### Testing Instruction Changes

```yaml
hypothesis: "More explicit formatting instructions improve structure"
variants:
  a: { prompt: "v1.0.0.md" }  # Implicit formatting
  b: { prompt: "v1.1.0.md" }  # Explicit section headers
focus: "format"
```

### Testing Few-Shot Examples

```yaml
hypothesis: "Adding 2 examples improves accuracy"
variants:
  a: { prompt: "v1.0.0.md" }  # Zero-shot
  b: { prompt: "v1.1.0.md" }  # Two-shot
focus: "accuracy"
```

### Testing Persona/Role Changes

```yaml
hypothesis: "Expert persona produces more detailed analysis"
variants:
  a: { prompt: "v1.0.0.md" }  # Generic assistant
  b: { prompt: "v1.1.0.md" }  # Domain expert persona
focus: "depth"
```

## Render Comparison Template

For detailed comparison setup, use the Comparison template:

```bash
bun run ~/.claude/Templates/Tools/RenderTemplate.ts \
  -t Evals/Comparison.hbs \
  -d ~/.claude/skills/Utilities/Evals/UseCases/<name>/comparisons/<name>.yaml \
  -o ~/.claude/skills/Utilities/Evals/UseCases/<name>/comparisons/<name>-setup.md \
  --preview
```

## Paradigm Check (When Iterations Stall)

If you've run 3+ comparisons without meaningful improvement, STOP and ask:

**Are we testing the right thing?**

| Signal | Question to Ask |
|--------|-----------------|
| All variants score similarly | Is the metric actually measuring what matters? |
| Scores are high but output feels wrong | Is there a dimension we're not measuring? |
| Improvements don't compound | Is the base prompt fundamentally limited? |
| Test cases all behave the same | Do we need more diverse/challenging cases? |

**Paradigm Shift Indicators:**
- The eval criteria might be wrong (measuring the wrong thing)
- The test cases might be too easy or too homogeneous
- The entire approach might need rethinking (different architecture)

When stuck, invoke explicit Science workflow: `Science/Workflows/StructuredInvestigation.md`

This forces stepping back from the eval loop to question the frame itself.

---

## Done

Comparison completed. Results documented. Decision made.
