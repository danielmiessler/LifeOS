---
name: pai-evals
description: Evaluation framework with 3 grader types (code-based, model-based, human), pass@k/pass^k scoring, and ISA integration
version: 1.0.0
metadata:
  hermes_tags: [pai, evals, evaluation, scoring, grading, testing]
  related_skills: [pai-isa, pai-loop, pai-delegation]
  requires: [delegate_task, terminal, read_file, write_file, search_files, web_search]
---

# pai-evals — Evaluation Framework

## Overview

pai-evals is a structured evaluation framework for grading agent outputs,
code, and generated content. It supports 3 grader types with pass@k and
pass^k scoring, plus direct integration with pai-isa for compliance evaluation.

### The 3 Grader Types

| Type | Mechanism | Best For |
|------|-----------|----------|
| **Code-based** | `terminal` (compile, lint, test) + `patch` validation | Code correctness, style, tests |
| **Model-based** | `delegate_task` with rubric | Essays, plans, designs, reasoning |
| **Human** | Generates review form + output for manual grading | Subjective quality, UX, design |

### Scoring Methods

- **pass@k**: Out of k evaluations, how many passed? (deterministic)
- **pass^k**: Weighted pass — each evaluator casts a graded vote
  (0.0–1.0), result is mean × k weight. (continuous)

## When to Use

- Evaluating agent-generated code before merge
- Grading ISA completeness beyond the basic gate check
- Comparing multiple solutions to the same problem
- Benchmarking agent performance across iterations

## Workflow Routing

| Trigger | Description |
|---|---|
| `pai-evals grade code <path>` | Code-based grading: lint, type-check, test |
| `pai-evals grade model <content> --rubric <path>` | Model-based grading with rubric |
| `pai-evals grade human <content>` | Generate human review form |
| `pai-evals run <suite>` | Run an eval suite from `~/.pai/evals/suites/` |
| `pai-evals isa <isa-path>` | Evaluate ISA against all tiers |

## Procedure

### Step 1: Parse eval request

1. Identify evaluator type (code/model/human) and target.
2. If `--rubric` specified, load rubric file. If not, generate one.
3. If `--suite`, load suite config from `~/.pai/evals/suites/{suite}.yaml`.

### Step 2: Code-Based Grading

Code-based grading runs a multi-stage pipeline:

```python
# Stage 1: Syntax check
syntax_ok = terminal(command=f"python3 -m py_compile {path}", timeout=30).exit_code == 0

# Stage 2: Lint (if linter available)
lint_ok = terminal(command=f"pylint {path} --exit-zero --score=n", timeout=30).exit_code == 0

# Stage 3: Type check (if applicable)
types_ok = terminal(command=f"mypy {path} --ignore-missing-imports", timeout=30).exit_code == 0

# Stage 4: Test (if test file exists)
test_file = search_files(pattern=f"test_*{basename}", path=os.path.dirname(path), target="files")
if test_file:
    test_ok = terminal(command=f"pytest {test_file} -x -q", timeout=60).exit_code == 0
```

Score = weighted sum: syntax(0.2) + lint(0.2) + types(0.2) + tests(0.4).

### Step 3: Model-Based Grading

Use `delegate_task` with a detailed rubric:

```json
{
  "type": "delegate_task",
  "agent": "pai-evaluator",
  "task": "Grade the following submission against the provided rubric. Score each criterion 0.0–1.0. Provide justification for each score.\n\nRubric:\n{rubric_content}\n\nSubmission:\n{submission_content}\n\nOutput format:\n```json\n{{\n  \"scores\": [{{\"criterion\": \"...\", \"score\": 0.X, \"justification\": \"...\"}}],\n  \"overall\": 0.X,\n  \"summary\": \"...\"\n}}\n```",
  "context": {"type": "model_grade", "rubric": rubric_content}
}
```

For pass@k: run the grading k times with different reasoning seeds (via
`delegate_task`), then count passes. pass@k = passed/k.
For pass^k: run k evaluations, average scores. pass^k = mean_score.

### Step 4: Human Grading

Generate a review form:

```json
{
  "type": "delegate_task",
  "agent": "pai-evals-form-generator",
  "task": "Generate a human review form for evaluating the following content. Include:\n1. Instructions for the reviewer\n2. 5-10 Likert-scale questions (1-5)\n3. Open-ended questions for qualitative feedback\n4. Checklist of things to verify\n\nContent to review:\n{submission_content}\n\nContext:\n{context}"
}
```

Write form to `~/.pai/evals/reviews/{slug}.review.md`. The user fills it
in manually, then runs `pai-evals submit-review <path>` to register scores.

### Step 5: ISA Integration

Evaluate a submission against an ISA:

```json
{
  "type": "delegate_task",
  "agent": "pai-evals-isa-grader",
  "task": "Evaluate the following implementation against its ISA specification. For each requirement in the ISA, check if it's satisfied:\n- FULLY: requirement met with evidence\n- PARTIALLY: some aspects met, some missing\n- NOT: requirement not addressed\n\nISA:\n{isa_content}\n\nImplementation:\n{implementation_content}\n\nOutput compliance score and gap analysis.",
  "context": {"type": "isa_eval"}
}
```

### Step 6: Record results

Write eval results to `~/.pai/evals/results/{slug}.eval.yaml`:

```yaml
eval:
  id: eval_{timestamp}
  type: code  # or model, human, isa
  target: {path or description}
  timestamp: {iso_timestamp}
  grader: {grader_name}
  scores:
    syntax: 1.0  # for code evals
    lint: 0.8
    types: 0.0  # no type checker
    tests: 0.75
  overall: 0.6375
  pass_k: 2/3
  pass_k_weighted: 0.71
  artifacts:
    - ~/.pai/evals/reports/{slug}.report.md
```

## Voice Notification

```bash
curl -s -X POST https://api.nousresearch.com/hermes/voice \
  -H "Content-Type: application/json" \
  -d '{"type":"pai-evals","message":"Code evaluation complete: auth middleware","overall":0.82,"pass_k":"3/4","status":"ok"}'
```

## Execution Log Pattern

```
[2026-05-30 15:00:01] pai-evals grade code src/middleware/auth.py
[2026-05-30 15:00:02] → stage 1: syntax check — pass
[2026-05-30 15:00:03] → stage 2: lint — 8.4/10 (2 warnings)
[2026-05-30 15:00:04] → stage 3: type check — pass (no mypy)
[2026-05-30 15:00:05] → stage 4: tests — 5/6 pass (1 flaky)
[2026-05-30 15:00:06] ✓ overall: 0.82 — pass@4: 3/4
[2026-05-30 15:05:01] pai-evals grade model "design doc for auth" --rubric ~/.pai/evals/rubrics/design-review.yaml
[2026-05-30 15:05:02] → model grading with 3 evaluators (pass^3)
[2026-05-30 15:05:12] ← evaluator 1: 0.85
[2026-05-30 15:05:14] ← evaluator 2: 0.72
[2026-05-30 15:05:16] ← evaluator 3: 0.91
[2026-05-30 15:05:16] ✓ pass^3: mean=0.827
```

## Gotchas

- **Flaky tests**: Code-based evaluation may fail due to flaky tests.
  Run code evals 3 times and take median if `--mode flaky-tolerant`.
- **Rubric quality**: Model-based grading is only as good as the rubric.
  A weak rubric produces noisy scores. Use `pai-evals validate-rubric`
  to check rubric completeness before grading.
- **Human review bottleneck**: Human evals are async — the system generates
  the form, the user fills it. Results are not available until submitted.
- **ISA grading scope**: ISA grading checks implementation against requirements,
  not code quality. Always pair ISA evaluation with a code-based eval for
  full coverage.
- **Cost**: Model-based grading with pass^k (k=10+) can be expensive in
  tokens. Use pass@3 or pass@5 for most cases, pass@10+ only for critical
  evaluations.
