# Evals as Science

**Evals IS the scientific method applied to prompt engineering.**

This isn't metaphor - Evals embodies the Science Protocol directly:

| Science Phase | Evals Implementation |
|---------------|---------------------|
| **Goal** | Define use case success criteria, pass threshold |
| **Observe** | Baseline prompt performance measurement |
| **Hypothesize** | "Variant X will outperform baseline because..." |
| **Experiment** | Run eval suite with control + treatment prompts |
| **Measure** | Scores, SEM, confidence intervals |
| **Analyze** | Compare variants, determine statistical significance |
| **Iterate** | Refine prompt, run again, or declare success |

---

## Scientific Rigor in Evals

### Falsifiability (Non-Negotiable)

Every hypothesis MUST be falsifiable. When comparing prompts, ask:
- *"What result would DISPROVE that variant X is better?"*
- If you can't answer this, your evaluation is not scientific.

### Pre-Commitment (Define Before You Run)

- Success criteria are defined BEFORE seeing results
- Pass thresholds are locked when use case is created
- No moving goalposts after data is collected

### Plurality (Three-Variant Minimum Recommended)

- Don't just A/B test - consider A/B/C
- Multiple hypotheses = better exploration of solution space
- Reduces confirmation bias toward the first alternative

### Confirmation Bias Countermeasures

- Position swapping mitigates positional bias
- Different judge model prevents self-serving evaluation
- Multi-judge panels reduce individual model quirks
- Statistical significance required to declare winner

---

## When to Invoke Full Science Protocol

Most eval work runs implicitly as Science. Invoke explicit Science workflows when:
- You've been iterating for 3+ cycles without improvement (paradigm check)
- Results are confusing or contradictory (need structured analysis)
- Stakes are high enough to warrant formal documentation
- The question is "should we be testing something else entirely?"
