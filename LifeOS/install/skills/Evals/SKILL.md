---
name: Evals
version: 1.2.17
description: "AI agent evaluation framework with three grader types (code-based, model-based, human) and pass@k/pass^k scoring over agent transcripts, tool-call sequences, and multi-turn conversations; covers capability and regression evals. USE WHEN eval, evaluate, benchmark, regression test, compare models, create judge, test agent, pass@k, scenario simulation. NOT FOR scientific method framing (use Science)."
effort: high
context: fork
---

## Customization

**Before executing, check for user customizations at:**
`{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/Evals/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Evals skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Evals** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Evals - AI Agent Evaluation Framework

## What It Does

Evaluates AI agents — their transcripts, tool-call sequences, and multi-turn conversations, not just single outputs. Three grader types cover it: code-based for deterministic checks, model-based for nuanced quality rubrics, and human for the gold standard. Scores with pass@k (capability) and pass^k (consistency). Splits evals into capability suites (~70% target) and regression suites (~99% target), and plugs into Algorithm ISC rows as a verification method.

## The Problem

You can't tell if an agent got better or worse by eyeballing a few runs. A change that looks fine in one transcript may quietly regress on the next prompt, and a single run gives no statistical signal. Judging only the final output also misses how the agent got there — wrong tools, wrong order, lucky guess. This skill measures the whole workflow across repeated trials, so improvements and backsliding both show up as numbers you can gate on.

## How It Works

Agent evaluation system based on Anthropic's "Demystifying Evals for AI Agents" (Jan 2026). It evaluates agent *workflows* (transcripts, tool calls, multi-turn conversations), not just single outputs.

## When to Activate

- "run evals", "test this agent", "evaluate", "check quality", "benchmark"
- "regression test", "capability test"
- "run scenario", "multi-turn eval", "simulated user test"
- "create scenario", "simulate conversation"
- Compare agent behaviors across changes
- Validate agent workflows before deployment
- Verify ALGORITHM ISC rows
- Create new evaluation tasks from failures

---

## Core Concepts

### Three Grader Types

| Type | Strengths | Weaknesses | Use For |
|------|-----------|------------|---------|
| **Code-based** | Fast, cheap, deterministic, reproducible | Brittle, lacks nuance | Tests, state checks, tool verification |
| **Model-based** | Flexible, captures nuance, scalable | Non-deterministic, expensive | Quality rubrics, assertions, comparisons |
| **Human** | Gold standard, handles subjectivity | Expensive, slow | Calibration, spot checks, A/B testing |

### Evaluation Types

| Type | Pass Target | Purpose |
|------|-------------|---------|
| **Capability** | ~70% | Stretch goals, measuring improvement potential |
| **Regression** | ~99% | Quality gates, detecting backsliding |

### Key Metrics

- **pass@k**: Probability of at least 1 success in k trials (measures capability)
- **pass^k**: Probability all k trials succeed (measures consistency/reliability)

---

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| RunEval | Run eval, evaluate suite, run tests, benchmark | `Workflows/RunEval.md` |
| CompareModels | Compare models, model comparison, A/B test models | `Workflows/CompareModels.md` |
| ComparePrompts | Compare prompts, prompt comparison, test prompts | `Workflows/ComparePrompts.md` |
| CreateJudge | Create judge, model grader, evaluation judge | `Workflows/CreateJudge.md` |
| CreateUseCase | Create use case, new eval, test case, create suite | `Workflows/CreateUseCase.md` |
| RunScenario | Run scenario, multi-turn eval, simulated user test | `Workflows/RunScenario.md` |
| CreateScenario | Create scenario, new multi-turn eval, simulate conversation | `Workflows/CreateScenario.md` |
| ViewResults | View results, eval results, scores, pass rate | `Workflows/ViewResults.md` |

### CLI Quick Reference

| Trigger | Tool |
|---------|------|
| Run suite | `Tools/AlgorithmBridge.ts` |
| Log failure | `Tools/FailureToTask.ts log` |
| Convert failures | `Tools/FailureToTask.ts convert-all` |
| Create suite | `Tools/SuiteManager.ts create` |
| Check saturation | `Tools/SuiteManager.ts check-saturation` |
| Run scenario | `Tools/ScenarioRunner.ts --scenario <path>` |

---

## Quick Reference

### CLI Commands

```bash
# Run an eval suite
bun run ${LIFEOS_SKILL_DIR}/Tools/AlgorithmBridge.ts -s <suite>

# Log a failure for later conversion
bun run ${LIFEOS_SKILL_DIR}/Tools/FailureToTask.ts log "description" -c category -s severity

# Convert failures to test tasks
bun run ${LIFEOS_SKILL_DIR}/Tools/FailureToTask.ts convert-all

# Manage suites
bun run ${LIFEOS_SKILL_DIR}/Tools/SuiteManager.ts create <name> -t capability -d "description"
bun run ${LIFEOS_SKILL_DIR}/Tools/SuiteManager.ts list
bun run ${LIFEOS_SKILL_DIR}/Tools/SuiteManager.ts check-saturation <name>
bun run ${LIFEOS_SKILL_DIR}/Tools/SuiteManager.ts graduate <name>
```

### ALGORITHM Integration

Evals is a verification method for THE ALGORITHM ISC rows:

```bash
# Run eval and update ISC row
bun run ${LIFEOS_SKILL_DIR}/Tools/AlgorithmBridge.ts -s regression-core -r 3 -u
```

ISC rows can specify eval verification:
```
| # | What Ideal Looks Like | Verify |
|---|----------------------|--------|
| 1 | Auth bypass fixed | eval:auth-security |
| 2 | Tests all pass | eval:regression |
```

---

## Available Graders

### Code-Based (Fast, Deterministic)

| Grader | Use Case |
|--------|----------|
| `string_match` | Exact substring matching |
| `regex_match` | Pattern matching |
| `binary_tests` | Run test files |
| `static_analysis` | Lint, type-check, security scan |
| `state_check` | Verify system state after execution |
| `tool_calls` | Verify specific tools were called |

### Model-Based (Nuanced)

| Grader | Use Case |
|--------|----------|
| `llm_rubric` | Score against detailed rubric |
| `natural_language_assert` | Check assertions are true |
| `pairwise_comparison` | Compare to reference with position swap |

---

## Domain Patterns

Pre-configured grader stacks for common agent types:

| Domain | Primary Graders |
|--------|-----------------|
| `coding` | binary_tests + static_analysis + tool_calls + llm_rubric |
| `conversational` | llm_rubric + natural_language_assert + state_check |
| `research` | llm_rubric + natural_language_assert + tool_calls |
| `computer_use` | state_check + tool_calls + llm_rubric |

See `Data/DomainPatterns.yaml` for full configurations.

---

## Task Schema (YAML)

```yaml
task:
  id: "fix-auth-bypass_1"
  description: "Fix authentication bypass when password is empty"
  type: regression  # or capability
  domain: coding

  graders:
    - type: binary_tests
      required: [test_empty_pw.py]
      weight: 0.30

    - type: tool_calls
      weight: 0.20
      params:
        sequence: [read_file, edit_file, run_tests]

    - type: llm_rubric
      weight: 0.50
      params:
        rubric: prompts/security_review.md

  trials: 3
  pass_threshold: 0.75
```

---

## Resource Index

| Resource | Purpose |
|----------|---------|
| `Types/index.ts` | Core type definitions |
| `Graders/CodeBased/` | Deterministic graders |
| `Graders/ModelBased/` | LLM-powered graders |
| `Tools/TranscriptCapture.ts` | Capture agent trajectories |
| `Tools/TrialRunner.ts` | Multi-trial execution with pass@k |
| `Tools/SuiteManager.ts` | Suite management and saturation |
| `Tools/FailureToTask.ts` | Convert failures to test tasks |
| `Tools/AlgorithmBridge.ts` | ALGORITHM integration |
| `Tools/ScenarioRunner.ts` | Multi-turn scenario runner (langwatch/scenario) |
| `Tools/LifeosAgentAdapter.ts` | Wraps LifeOS Inference.ts as scenario AgentAdapter |
| `Tools/ScenarioToTranscript.ts` | Scenario result → Evals Transcript/Trial/GraderResult |
| `Scenarios/` | Authored multi-turn scenarios (`.scenario.ts`) |
| `Data/DomainPatterns.yaml` | Domain-specific grader configs |

---

## Key Principles (from Anthropic)

1. **Start with 20-50 real failures** - Don't overthink, capture what actually broke
2. **Unambiguous tasks** - Two experts should reach identical verdicts
3. **Balanced problem sets** - Test both "should do" AND "should NOT do"
4. **Grade outputs, not paths** - Don't penalize valid creative solutions
5. **Calibrate LLM judges** - Against human expert judgment
6. **Check transcripts regularly** - Verify graders work correctly
7. **Monitor saturation** - Graduate to regression when hitting 95%+
8. **Build infrastructure early** - Evals shape how quickly you can adopt new models

---

## Related

- **ALGORITHM**: Evals is a verification method
- **Science**: Evals implements scientific method
- **Browser**: For visual verification graders

## Gotchas

- **Choose the right grader type:** Code-based for deterministic checks (fast, cheap). Model-based for nuanced quality (flexible, expensive). Human for calibration (gold standard, slow).
- **pass@k scoring requires multiple runs.** A single run doesn't give statistical significance. Default to pass@3 minimum.
- **Transcript capture must be enabled BEFORE the test run.** Can't retroactively capture transcripts.
- **Eval results go to the current work directory** — not a global location. Tie evals to the work item.
- **Don't evaluate skills with trivial prompts.** Simple one-liners may not trigger skill usage. Test prompts must be substantive.

## Examples

**Example 1: Compare two prompts**
```
User: "evaluate which prompt produces better summaries"
→ Creates eval suite with 3+ test cases
→ Runs both prompts against test cases
→ Model-based grader scores quality
→ Reports pass@k and comparative analysis
```

**Example 2: Regression test a skill change**
```
User: "run evals on the Research skill after the update"
→ Uses existing test fixtures for Research
→ Before/after comparison
→ Reports any quality regressions
```

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Evals","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
