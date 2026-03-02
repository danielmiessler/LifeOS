# Evals Best Practices

## LLM-as-Judge Design

1. **Reasoning before scoring**: Always require explanation first
2. **Use 1-5 scale**: Most reliable, avoid 0-100
3. **Different judge model**: Don't self-judge
4. **Position swapping**: Average A-first and B-first results
5. **Multi-judge panels**: 5-10 models, 7x cheaper than large single judge

---

## Creating Use Cases

1. **Start with golden example**: Use real, proven output as reference
2. **Define clear criteria**: Mix deterministic (60%) + AI-based (40%)
3. **Set pass threshold**: 75% is recommended baseline
4. **Version prompts**: Use semantic versioning
5. **Document thoroughly**: README should explain what you're testing

---

## Running Evaluations

1. **Run deterministic first**: Fast gate before expensive AI evals
2. **Use multiple test cases**: Minimum 5-10 for reliability
3. **Test edge cases**: Include difficult/ambiguous examples
4. **Track over time**: Run evals regularly for regression detection
5. **Report statistics**: Include SEM, confidence intervals

---

## Interpreting Results

1. **Look at individual scores**: Not just overall pass/fail
2. **Check failed scorers**: Understand why tests failed
3. **Compare to baseline**: Track improvement/regression
4. **Validate with human review**: AI judges aren't perfect
5. **Adjust weights**: Based on what matters most

---

## Statistical Rigor Requirements

- Report Standard Error of Mean (SEM)
- Confidence intervals (95% default)
- Statistical significance testing
- Pass/fail rates with thresholds
