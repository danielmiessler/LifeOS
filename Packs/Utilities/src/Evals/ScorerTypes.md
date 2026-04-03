# Evaluation Scorer Types

## Deterministic Scorers (60% weight recommended)

| Scorer | Speed | Use Case |
|--------|-------|----------|
| `sentence-counter` | <5ms | Format validation, length requirements |
| `word-counter` | <5ms | Conciseness, length limits |
| `link-counter` | <10ms | Attribution, reference validation |
| `format-validator` | <10ms | Structure, required sections |
| `voice-validator` | <10ms | Forbidden words, style requirements |
| `string-match` | <5ms | Exact substring matching |
| `length-validator` | <5ms | Character count bounds |
| `json-schema` | <20ms | JSON structure validation |

---

## AI-Based Scorers (40% weight recommended)

| Scorer | Speed | Use Case |
|--------|-------|----------|
| `llm-judge-accuracy` | ~2s | Factual accuracy, core takeaways |
| `llm-judge-style` | ~2s | Voice authenticity, tone |
| `link-attribution-judge` | ~2s | Author identification, citation quality |

---

## Configuration Example

```yaml
criteria:
  deterministic:
    - scorer: "sentence-counter"
      weight: 0.10
      params:
        min: 2
        max: 3
    - scorer: "voice-validator"
      weight: 0.10
      params:
        forbidden_words: ["unveils", "plummeted"]
        check_contractions: true

  ai_based:
    - scorer: "llm-judge-accuracy"
      weight: 0.15
      params:
        judge_model: "claude-3-5-sonnet-20241022"
        reasoning_first: true
        scale: "1-5"

pass_threshold: 0.75
```

---

## Best Practices for Scorer Selection

1. **Run deterministic first**: Fast gate before expensive AI evals
2. **Balance weights**: 60% deterministic / 40% AI-based recommended
3. **Use appropriate scale**: 1-5 most reliable for AI judges
4. **Require reasoning first**: 13%+ accuracy improvement
