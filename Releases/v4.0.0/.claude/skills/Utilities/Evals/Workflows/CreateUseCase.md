# CreateUseCase Workflow

Create a new evaluation use case with test cases and scoring criteria.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the CreateUseCase workflow in the Evals skill to create eval use case"}' \
  > /dev/null 2>&1 &
```

Running the **CreateUseCase** workflow in the **Evals** skill to create eval use case...

---

## Prerequisites

- Clear understanding of what you're evaluating
- Example inputs and expected outputs
- Quality criteria defined

## Execution

### Step 1: Gather Requirements

Ask the user:
1. What is this use case evaluating? (prompt, model, task)
2. What does "good" output look like?
3. What specific criteria matter? (accuracy, format, style, etc.)
4. Do you have example inputs and outputs?

### Step 2: Create Use Case Directory

```bash
mkdir -p ~/.claude/skills/Utilities/Evals/UseCases/<name>/{test-cases,golden-outputs,prompts}
```

### Step 3: Create Config File

Create `~/.claude/skills/Utilities/Evals/UseCases/<name>/config.yaml`:

```yaml
name: <use_case_name>
description: |
  <What this use case evaluates and why>

version: "1.0.0"

# What we're testing
target:
  type: prompt  # or "model", "agent"
  path: prompts/v1.0.0.md  # relative path

# Scoring criteria
criteria:
  deterministic:
    - scorer: "sentence-counter"
      weight: 0.10
      params:
        min: 2
        max: 5
    - scorer: "format-validator"
      weight: 0.10
      params:
        required_sections: ["summary", "analysis"]
    - scorer: "voice-validator"
      weight: 0.10
      params:
        forbidden_words: ["unveils", "plummeted", "groundbreaking"]
        check_contractions: true

  ai_based:
    - scorer: "llm-judge-accuracy"
      weight: 0.35
      params:
        judge_model: "claude-3-5-sonnet-20241022"
        reasoning_first: true
        scale: "1-5"
    - scorer: "llm-judge-style"
      weight: 0.35
      params:
        judge_model: "claude-3-5-sonnet-20241022"
        reasoning_first: true
        scale: "1-5"

# Pass/fail threshold
pass_threshold: 0.75

# Models to evaluate against
models:
  - claude-3-5-sonnet-20241022
  - claude-3-5-haiku-20241022
  - gpt-4o
```

### Step 4: Create Initial Prompt Version

Create `~/.claude/skills/Utilities/Evals/UseCases/<name>/prompts/v1.0.0.md`:

```markdown
# <Task Name> Prompt v1.0.0

## System Context

<System prompt or context>

## Task Instructions

<Specific instructions for the task>

## Output Format

<Expected output format specification>

## Examples (Optional)

<Few-shot examples if applicable>
```

### Step 5: Create Test Cases

Create test cases in `~/.claude/skills/Utilities/Evals/UseCases/<name>/test-cases/`:

Each test case is a YAML file:

```yaml
# test-cases/001-basic.yaml
id: "001-basic"
name: "Basic functionality test"
description: "Tests standard use case"
priority: high

input:
  content: |
    <The input content to test>
  variables:
    key: value

expected:
  format: "structured"  # or "freeform"
  contains:
    - "expected phrase 1"
    - "expected phrase 2"
  excludes:
    - "unwanted phrase"
  length:
    min_words: 50
    max_words: 200

golden_output: "../golden-outputs/001-basic.md"  # Optional reference
```

**Recommended Test Case Distribution:**
- 2-3 **Easy** cases (standard inputs, clear expectations)
- 3-4 **Medium** cases (typical edge cases)
- 2-3 **Hard** cases (ambiguous inputs, tricky scenarios)

### Step 6: Create Golden Outputs (Optional)

If you have reference "perfect" outputs, add them:

```bash
# golden-outputs/001-basic.md
<The ideal output for test case 001>
```

Golden outputs serve as:
- Reference for AI judges
- Baseline for comparison
- Documentation of expected behavior

### Step 7: Create README

Create `~/.claude/skills/Utilities/Evals/UseCases/<name>/README.md`:

```markdown
# <Use Case Name>

## Purpose

<What this use case evaluates and why it matters>

## Target

<What's being tested - prompt, model, agent>

## Quality Criteria

### Deterministic (60%)
- **Sentence Count** (10%): 2-5 sentences per summary
- **Format** (10%): Required sections present
- **Voice** (10%): Matches target style

### AI-Based (40%)
- **Accuracy** (35%): Factual correctness
- **Style** (35%): Voice authenticity

## Test Cases

| ID | Name | Priority | Description |
|----|------|----------|-------------|
| 001 | Basic | High | Standard input |
| 002 | Edge | Medium | Edge case handling |
| ... | ... | ... | ... |

## Running Evaluations

\`\`\`bash
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli-run.ts --use-case <name>
\`\`\`

## Version History

- v1.0.0: Initial version
```

### Step 8: Validate Use Case

```bash
# Check structure
ls -la ~/.claude/skills/Utilities/Evals/UseCases/<name>/

# Validate config
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts use-case show <name>
```

### Step 9: Run Initial Eval

```bash
# Run first evaluation to verify setup
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli-run.ts \
  --use-case <name> \
  --test-id 001-basic \
  --verbose
```

Review:
- Does the scorer configuration work?
- Are test cases properly formatted?
- Do AI judges produce valid output?

## Best Practices

### Test Case Design

1. **Cover the distribution**: Easy, medium, and hard cases
2. **Include edge cases**: Empty inputs, very long inputs, malformed data
3. **Version inputs**: Track which test cases apply to which prompt versions
4. **Document failures**: When tests fail, understand why before fixing

### Criteria Weights

| Pattern | Deterministic | AI-Based |
|---------|---------------|----------|
| Format-critical | 60-70% | 30-40% |
| Quality-critical | 30-40% | 60-70% |
| Balanced | 50% | 50% |

### Prompt Versioning

Use semantic versioning:
- **v1.0.0 → v1.0.1**: Bug fix, minor wording change
- **v1.0.0 → v1.1.0**: New feature, added section
- **v1.0.0 → v2.0.0**: Major rewrite, breaking changes

## Directory Structure

```
UseCases/<name>/
├── config.yaml          # Scoring configuration
├── README.md            # Documentation
├── test-cases/          # Test case definitions
│   ├── 001-basic.yaml
│   ├── 002-edge.yaml
│   └── ...
├── golden-outputs/      # Reference outputs (optional)
│   ├── 001-basic.md
│   └── ...
└── prompts/             # Versioned prompts
    ├── v1.0.0.md
    └── v1.1.0.md
```

## Done

Use case created and validated. Ready to run evaluations.
