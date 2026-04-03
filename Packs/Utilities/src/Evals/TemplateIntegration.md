# Template Integration

## Available Templates

```
~/.claude/Templates/Evals/
├── Judge.hbs       # Configurable LLM-as-Judge prompts
├── Rubric.hbs      # Evaluation criteria definitions
├── TestCase.hbs    # Test case specifications
├── Comparison.hbs  # A/B testing templates
└── Report.hbs      # Statistical result reports
```

---

## Creating Custom Judges

Use the JUDGE template for custom evaluation:

```bash
bun run ~/.claude/Templates/Tools/RenderTemplate.ts \
  -t Evals/Judge.hbs \
  -d ~/.claude/skills/Utilities/Evals/UseCases/<name>/judge-config.yaml \
  -o ~/.claude/skills/Utilities/Evals/UseCases/<name>/judge-prompt.md
```

### Judge Config Example

```yaml
judge:
  name: Content Quality Judge
  focus: accuracy
  scale:
    type: 1-5
  criteria:
    - name: Factual Accuracy
      description: Information matches source material
      weight: 0.4
    - name: Completeness
      description: Covers all key points
      weight: 0.3
    - name: Clarity
      description: Easy to understand
      weight: 0.3
  reasoning_required: true
  position_swap: true
output:
  format: json
```

---

## Creating Rubrics

Use the RUBRIC template for scoring criteria:

```bash
bun run ~/.claude/Templates/Tools/RenderTemplate.ts \
  -t Evals/Rubric.hbs \
  -d ~/.claude/skills/Utilities/Evals/UseCases/<name>/rubric.yaml \
  -o ~/.claude/skills/Utilities/Evals/UseCases/<name>/rubric.md
```

---

## LLM-as-Judge Best Practices

1. **Reasoning before scoring**: Always require explanation first
2. **Use 1-5 scale**: Most reliable, avoid 0-100
3. **Different judge model**: Don't self-judge
4. **Position swapping**: Average A-first and B-first results
5. **Multi-judge panels**: 5-10 models, 7x cheaper than large single judge
