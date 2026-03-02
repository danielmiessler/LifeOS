# System-Evals - AI Evaluation Framework

**Tool Name**: `evals`
**Architecture**: CLI-First (deterministic code execution with AI orchestration)
**Storage**: File-based (source of truth) + SQLite (query optimization)
**Philosophy**: Build deterministic tools, wrap with prompting

---

## Overview

Evals is a comprehensive AI evaluation framework for testing both models and prompts across different use cases. It follows the CLI-First Architecture pattern: deterministic CLI commands wrapped with AI orchestration for consistency and reliability.

---

## Requirements

### Core Operations

1. **Use Case Management**
   - Create new use cases
   - List all use cases
   - Show use case details
   - Update use case configuration
   - Delete use cases

2. **Test Case Management**
   - Add test cases to use cases
   - List test cases for a use case
   - Show test case details
   - Update test cases
   - Delete test cases

3. **Golden Output Management**
   - Add golden outputs for test cases
   - Update golden outputs
   - Show golden output
   - Delete golden outputs

4. **Prompt Management**
   - Create new prompt version
   - List prompts for use case
   - Show prompt content
   - Update prompt
   - Delete prompt version

5. **Scorer Management**
   - List available scorers
   - Show scorer details
   - Test scorer on sample data

6. **Evaluation Execution**
   - Run evaluations for use case
   - Run with specific model
   - Run with specific prompt version
   - Run specific test case only
   - Run all models comparison
   - Run all prompts comparison

7. **Results Querying**
   - Query runs by use case
   - Query runs by model
   - Query runs by prompt version
   - Query runs by score range
   - Query runs by date range
   - Query runs by pass/fail status
   - Show run details
   - Show individual test results

8. **Comparison Operations**
   - Compare two specific runs
   - Compare models (same prompt)
   - Compare prompts (same model)
   - Compare across versions

9. **Data Management**
   - Rebuild SQLite database from files
   - Export results (JSON, CSV)
   - Clean old runs
   - Backup data

---

## Complete CLI Interface

### Global Options

```bash
--help, -h          Show help
--version, -v       Show version
--json              Output as JSON
--verbose           Verbose output
--quiet, -q         Minimal output
--config <path>     Custom config file
```

---

## Command Reference

### 1. Use Case Commands

#### `evals use-case create`
Create a new evaluation use case.

```bash
evals use-case create \
  --name <name> \
  --description <desc> \
  [--template <template-name>]

# Examples:
evals use-case create --name newsletter-summary --description "Evaluate newsletter summaries"
evals use-case create --name blog-post --template summarization
```

**Outputs**:
- Creates `use-cases/<name>/` directory
- Creates `config.yaml` with default structure
- Creates `prompts/`, `test-cases/`, `golden-outputs/` subdirectories
- Prints success message with next steps

#### `evals use-case list`
List all use cases.

```bash
evals use-case list [--json]

# Example output:
# newsletter-summary    Evaluate newsletter summaries (5 tests, 3 prompts)
# blog-post             Evaluate blog posts (3 tests, 2 prompts)
```

#### `evals use-case show`
Show detailed information about a use case.

```bash
evals use-case show --name <name> [--json]

# Example:
evals use-case show --name newsletter-summary

# Output:
# Use Case: newsletter-summary
# Description: Evaluate newsletter summaries
# Test Cases: 5
# Prompts: 3 versions (v1.0.0, v1.1.0, v2.0.0)
# Models: 2 (claude-3-5-sonnet, gpt-4o)
# Criteria: 7 scorers (3 deterministic, 4 AI-based)
# Last Run: 2025-11-15 14:30 (passed 4/5 tests, score: 0.85)
```

#### `evals use-case update`
Update use case configuration.

```bash
evals use-case update --name <name> --config <yaml-file>

# Example:
evals use-case update --name newsletter-summary --config new-config.yaml
```

#### `evals use-case delete`
Delete a use case.

```bash
evals use-case delete --name <name> [--force]

# Example:
evals use-case delete --name old-use-case --force
```

---

### 2. Test Case Commands

#### `evals test-case add`
Add a test case to a use case.

```bash
evals test-case add \
  --use-case <name> \
  --id <test-id> \
  --input <json-file> \
  [--golden <md-file>]

# Examples:
evals test-case add --use-case newsletter-summary --id 001 --input test-001.json
evals test-case add --use-case newsletter-summary --id 002 --input test-002.json --golden expected-002.md
```

**Input JSON Structure**:
```json
{
  "id": "001-tech-article",
  "description": "Tech news article summary",
  "category": "tech",
  "difficulty": "medium",
  "input": {
    "article": "Full article text...",
    "style": "casual",
    "target_length": "3-5 sentences"
  },
  "metadata": {
    "tags": ["ai", "tech", "news"]
  }
}
```

#### `evals test-case list`
List test cases for a use case.

```bash
evals test-case list --use-case <name> [--json]

# Example:
evals test-case list --use-case newsletter-summary

# Output:
# 001-tech-article     Tech news article summary (medium)
# 002-long-form        Long-form content summary (hard)
# 003-edge-case        Edge case testing (easy)
```

#### `evals test-case show`
Show test case details.

```bash
evals test-case show --use-case <name> --id <test-id> [--json]

# Example:
evals test-case show --use-case newsletter-summary --id 001
```

#### `evals test-case update`
Update a test case.

```bash
evals test-case update \
  --use-case <name> \
  --id <test-id> \
  --input <json-file>

# Example:
evals test-case update --use-case newsletter-summary --id 001 --input updated-001.json
```

#### `evals test-case delete`
Delete a test case.

```bash
evals test-case delete --use-case <name> --id <test-id> [--force]
```

---

### 3. Golden Output Commands

#### `evals golden add`
Add a golden (expected) output for a test case.

```bash
evals golden add \
  --use-case <name> \
  --test-id <test-id> \
  --file <md-file>

# Example:
evals golden add --use-case newsletter-summary --test-id 001 --file expected-001.md
```

#### `evals golden update`
Update a golden output.

```bash
evals golden update \
  --use-case <name> \
  --test-id <test-id> \
  --file <md-file>

# Example:
evals golden update --use-case newsletter-summary --test-id 001 --file new-expected-001.md
```

#### `evals golden show`
Show golden output content.

```bash
evals golden show --use-case <name> --test-id <test-id>

# Example:
evals golden show --use-case newsletter-summary --test-id 001
```

#### `evals golden delete`
Delete a golden output.

```bash
evals golden delete --use-case <name> --test-id <test-id> [--force]
```

---

### 4. Prompt Commands

#### `evals prompt create`
Create a new prompt version.

```bash
evals prompt create \
  --use-case <name> \
  --version <version> \
  --file <txt-file> \
  [--description <desc>]

# Examples:
evals prompt create --use-case newsletter-summary --version v1.0.0 --file prompt.txt
evals prompt create --use-case newsletter-summary --version v1.1.0 --file prompt-v1.1.txt --description "Added tone guidance"
```

**Version Format**: Semantic versioning (v1.0.0, v1.1.0, v2.0.0)

#### `evals prompt list`
List prompts for a use case.

```bash
evals prompt list --use-case <name> [--json]

# Example:
evals prompt list --use-case newsletter-summary

# Output:
# v1.0.0    Initial prompt (2025-11-01)
# v1.1.0    Added tone guidance (2025-11-08)
# v2.0.0    Restructured for clarity (2025-11-15)
```

#### `evals prompt show`
Show prompt content.

```bash
evals prompt show --use-case <name> --version <version>

# Example:
evals prompt show --use-case newsletter-summary --version v1.0.0
```

#### `evals prompt update`
Update a prompt version.

```bash
evals prompt update \
  --use-case <name> \
  --version <version> \
  --file <txt-file>

# Example:
evals prompt update --use-case newsletter-summary --version v1.0.0 --file updated-prompt.txt
```

#### `evals prompt delete`
Delete a prompt version.

```bash
evals prompt delete --use-case <name> --version <version> [--force]
```

---

### 5. Scorer Commands

#### `evals scorer list`
List all available scorers.

```bash
evals scorer list [--type <deterministic|ai-based|custom>] [--json]

# Example output:
# DETERMINISTIC:
#   sentence-counter      Count sentences in output
#   word-counter          Count words in output
#   link-counter          Count links in output
#   format-validator      Validate output format
#
# AI-BASED:
#   llm-judge            LLM-as-judge evaluation
#   semantic-similarity  Semantic similarity to expected
#   style-matcher        Match writing style
#
# CUSTOM:
#   newsletter-tone      Newsletter-specific tone evaluation
```

#### `evals scorer show`
Show scorer details and configuration.

```bash
evals scorer show --name <scorer-name> [--json]

# Example:
evals scorer show --name sentence-counter

# Output:
# Scorer: sentence-counter
# Type: deterministic
# Description: Count sentences in output
# Parameters:
#   min (number): Minimum sentence count
#   max (number): Maximum sentence count
# Example:
#   evals run --use-case foo --scorer sentence-counter --params '{"min":3,"max":5}'
```

#### `evals scorer test`
Test a scorer on sample data.

```bash
evals scorer test \
  --name <scorer-name> \
  --output <text-file> \
  --expected <expected-file> \
  [--params <json>]

# Example:
evals scorer test --name sentence-counter --output sample.txt --params '{"min":3,"max":5}'

# Output:
# Scorer: sentence-counter
# Score: 1.0
# Pass: true
# Details:
#   Measured: 4 sentences
#   Expected: 3-5 sentences
#   Explanation: Found 4 sentences (expected 3-5)
```

---

### 6. Run Commands

#### `evals run`
Run evaluations.

```bash
evals run \
  --use-case <name> \
  [--model <model-id>] \
  [--prompt <version>] \
  [--test-case <test-id>] \
  [--all-models] \
  [--all-prompts] \
  [--dry-run] \
  [--verbose]

# Examples:
# Run with default model and latest prompt
evals run --use-case newsletter-summary

# Run with specific model and prompt
evals run --use-case newsletter-summary --model claude-3-5-sonnet --prompt v1.0.0

# Run specific test case only
evals run --use-case newsletter-summary --test-case 001

# Run all models with same prompt
evals run --use-case newsletter-summary --all-models --prompt v1.0.0

# Run all prompts with same model
evals run --use-case newsletter-summary --all-prompts --model gpt-4o

# Dry run (show what would be tested)
evals run --use-case newsletter-summary --dry-run
```

**Output**:
```
Running evaluation: newsletter-summary
Model: claude-3-5-sonnet-20241022
Prompt: v1.0.0
Test Cases: 5

Test 001-tech-article............... PASS (score: 0.92)
Test 002-long-form.................. PASS (score: 0.85)
Test 003-edge-case.................. FAIL (score: 0.65)
Test 004-technical.................. PASS (score: 0.88)
Test 005-casual..................... PASS (score: 0.91)

Results:
  Total: 5
  Passed: 4 (80%)
  Failed: 1 (20%)
  Avg Score: 0.84
  Run ID: 2025-11-15_143022_claude-3-5-sonnet_v1.0.0

Saved to: results/newsletter-summary/2025-11-15_143022_claude-3-5-sonnet_v1.0.0/
```

---

### 7. Query Commands

#### `evals query runs`
Query evaluation runs.

```bash
evals query runs \
  [--use-case <name>] \
  [--model <model-id>] \
  [--prompt <version>] \
  [--score-min <float>] \
  [--score-max <float>] \
  [--status <completed|failed|running>] \
  [--since <date>] \
  [--until <date>] \
  [--limit <n>] \
  [--offset <n>] \
  [--sort <field>] \
  [--json]

# Examples:
# Recent runs for use case
evals query runs --use-case newsletter-summary --limit 10

# Runs with score above threshold
evals query runs --score-min 0.8

# Runs for specific model
evals query runs --model claude-3-5-sonnet

# Runs in date range
evals query runs --since 2025-11-01 --until 2025-11-15

# Failed runs
evals query runs --status failed

# Combined filters
evals query runs --use-case newsletter-summary --model gpt-4o --score-min 0.75 --limit 5
```

**Output**:
```
Found 3 runs:

2025-11-15 14:30  newsletter-summary  claude-3-5-sonnet  v1.0.0  0.85  4/5 passed
2025-11-15 12:15  newsletter-summary  gpt-4o             v1.0.0  0.82  4/5 passed
2025-11-14 16:45  newsletter-summary  claude-3-5-sonnet  v1.1.0  0.88  5/5 passed
```

#### `evals query results`
Query individual test results.

```bash
evals query results \
  --run-id <run-id> \
  [--test-case <test-id>] \
  [--passed|--failed] \
  [--scorer <scorer-name>] \
  [--json]

# Examples:
# All results for a run
evals query results --run-id 2025-11-15_143022_claude-3-5-sonnet_v1.0.0

# Only failed tests
evals query results --run-id 2025-11-15_143022_claude-3-5-sonnet_v1.0.0 --failed

# Specific test case
evals query results --run-id 2025-11-15_143022_claude-3-5-sonnet_v1.0.0 --test-case 001

# Results for specific scorer
evals query results --run-id 2025-11-15_143022_claude-3-5-sonnet_v1.0.0 --scorer llm-judge
```

---

### 8. Compare Commands

#### `evals compare runs`
Compare two specific runs.

```bash
evals compare runs --run-a <run-id> --run-b <run-id> [--json]

# Example:
evals compare runs \
  --run-a 2025-11-15_143022_claude-3-5-sonnet_v1.0.0 \
  --run-b 2025-11-15_153045_gpt-4o_v1.0.0

# Output:
# Comparing Runs:
#   Run A: claude-3-5-sonnet v1.0.0 (score: 0.85, 4/5 passed)
#   Run B: gpt-4o v1.0.0 (score: 0.82, 4/5 passed)
#
# Test-by-Test Comparison:
#   001-tech-article:    Run A: 0.92 ✓  Run B: 0.88 ✓  (Δ +0.04)
#   002-long-form:       Run A: 0.85 ✓  Run B: 0.79 ✓  (Δ +0.06)
#   003-edge-case:       Run A: 0.65 ✗  Run B: 0.72 ✓  (Δ -0.07)
#   004-technical:       Run A: 0.88 ✓  Run B: 0.85 ✓  (Δ +0.03)
#   005-casual:          Run A: 0.91 ✓  Run B: 0.86 ✓  (Δ +0.05)
#
# Summary:
#   Run A won on 4/5 tests
#   Avg score difference: +0.03 in favor of Run A
```

#### `evals compare models`
Compare models on same prompt.

```bash
evals compare models \
  --use-case <name> \
  --prompt <version> \
  [--models <model1,model2,...>] \
  [--json]

# Example:
evals compare models --use-case newsletter-summary --prompt v1.0.0

# Automatically finds most recent run for each model

# Output:
# Comparing Models on newsletter-summary (prompt v1.0.0):
#
#   claude-3-5-sonnet:  0.85  4/5 passed  (2025-11-15 14:30)
#   gpt-4o:             0.82  4/5 passed  (2025-11-15 15:30)
#   o1-preview:         0.79  3/5 passed  (2025-11-15 16:30)
#
# Winner: claude-3-5-sonnet (Δ +0.03 vs 2nd place)
```

#### `evals compare prompts`
Compare prompts on same model.

```bash
evals compare prompts \
  --use-case <name> \
  --model <model-id> \
  [--versions <v1,v2,...>] \
  [--json]

# Example:
evals compare prompts --use-case newsletter-summary --model claude-3-5-sonnet

# Output:
# Comparing Prompts on newsletter-summary (model claude-3-5-sonnet):
#
#   v1.0.0:  0.82  3/5 passed  (2025-11-01)
#   v1.1.0:  0.85  4/5 passed  (2025-11-08)
#   v2.0.0:  0.91  5/5 passed  (2025-11-15)
#
# Best: v2.0.0 (Δ +0.09 vs baseline v1.0.0)
# Progression: +0.03 (v1.0.0→v1.1.0), +0.06 (v1.1.0→v2.0.0)
```

---

### 9. Data Commands

#### `evals db rebuild`
Rebuild SQLite database from files.

```bash
evals db rebuild [--force] [--verbose]

# Example:
evals db rebuild --force

# Output:
# Rebuilding database from files...
# Scanning use-cases/...
# Found 3 use cases
# Found 42 test results
# Indexed 42 runs
# Database rebuilt successfully
```

#### `evals export`
Export results to various formats.

```bash
evals export \
  --run-id <run-id> \
  --format <json|csv|md> \
  --output <file>

# Examples:
evals export --run-id 2025-11-15_143022_claude-3-5-sonnet_v1.0.0 --format json --output results.json
evals export --run-id 2025-11-15_143022_claude-3-5-sonnet_v1.0.0 --format csv --output results.csv
evals export --run-id 2025-11-15_143022_claude-3-5-sonnet_v1.0.0 --format md --output results.md
```

#### `evals clean`
Clean old runs.

```bash
evals clean \
  [--older-than <days>] \
  [--keep <n>] \
  [--use-case <name>] \
  [--dry-run]

# Examples:
# Delete runs older than 30 days
evals clean --older-than 30

# Keep only last 10 runs per use case
evals clean --keep 10

# Clean specific use case
evals clean --use-case newsletter-summary --older-than 60

# Show what would be deleted (don't actually delete)
evals clean --older-than 30 --dry-run
```

#### `evals backup`
Backup all data.

```bash
evals backup --output <backup-file>

# Example:
evals backup --output evals-backup-2025-11-15.tar.gz

# Creates tarball of:
# - use-cases/ directory
# - results/ directory
# - evals.db SQLite file
```

---

## File Structure

```
~/.claude/skills/evals/
├── PROJECT.md                    # This file
├── SKILL.md                      # Skill definition
│
├── cli/                          # CLI implementation
│   ├── index.ts                  # Main entry point
│   ├── commands/
│   │   ├── use-case.ts          # Use case commands
│   │   ├── test-case.ts         # Test case commands
│   │   ├── golden.ts            # Golden output commands
│   │   ├── prompt.ts            # Prompt commands
│   │   ├── scorer.ts            # Scorer commands
│   │   ├── run.ts               # Run commands
│   │   ├── query.ts             # Query commands
│   │   ├── compare.ts           # Compare commands
│   │   └── data.ts              # Data management commands
│   └── lib/
│       ├── storage.ts           # File + DB storage
│       ├── runner.ts            # Evaluation runner
│       ├── output.ts            # Output formatting
│       └── validation.ts        # Input validation
│
├── scorers/                      # Scorer implementations
│   ├── index.ts
│   ├── base.ts
│   ├── deterministic/
│   │   ├── sentence-counter.ts
│   │   ├── word-counter.ts
│   │   ├── link-counter.ts
│   │   └── format-validator.ts
│   ├── ai-based/
│   │   ├── llm-judge.ts
│   │   ├── semantic-similarity.ts
│   │   └── style-matcher.ts
│   └── custom/
│       └── newsletter-tone.ts
│
├── use-cases/                    # Evaluation use cases
│   ├── newsletter-summary/
│   │   ├── config.yaml
│   │   ├── prompts/
│   │   │   ├── v1.0.0.txt
│   │   │   └── v1.1.0.txt
│   │   ├── test-cases/
│   │   │   ├── 001-tech-article.json
│   │   │   └── 002-long-form.json
│   │   └── golden-outputs/
│   │       ├── 001-expected.md
│   │       └── 002-expected.md
│   └── [other-use-cases]/
│
├── results/                      # Evaluation results (Git-ignored)
│   └── newsletter-summary/
│       └── 2025-11-15_143022_claude-3-5-sonnet_v1.0.0/
│           ├── run.json
│           ├── summary.json
│           └── tests/
│               ├── 001-tech-article.json
│               └── 002-long-form.json
│
├── storage/
│   ├── evals.db                 # SQLite database (query cache)
│   └── schema.sql               # Database schema
│
├── types/                        # TypeScript types
│   ├── use-case.ts
│   ├── scorer.ts
│   ├── result.ts
│   └── config.ts
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## Storage Strategy

### Files (Source of Truth)
- Use case configs: `use-cases/<name>/config.yaml`
- Test cases: `use-cases/<name>/test-cases/*.json`
- Golden outputs: `use-cases/<name>/golden-outputs/*.md`
- Prompts: `use-cases/<name>/prompts/*.txt`
- Results: `results/<use-case>/<run-id>/`

### SQLite (Query Optimization)
- Tables: `eval_runs`, `test_results`, `scorer_results`
- Used ONLY for fast queries and analytics
- Can be rebuilt from files: `evals db rebuild`
- Enables complex queries without scanning JSON files

---

## Implementation Phases

### Phase 1: Core CLI (Week 1)
- [ ] CLI framework setup (Commander.js)
- [ ] Use case commands (create, list, show)
- [ ] Test case commands (add, list, show)
- [ ] Golden output commands (add, show)
- [ ] Prompt commands (create, list, show)
- [ ] File storage implementation
- [ ] SQLite schema and basic queries

### Phase 2: Scorers & Runners (Week 2)
- [ ] Base scorer interface
- [ ] Deterministic scorers (4 types)
- [ ] AI-based scorers (LLM-judge, semantic similarity)
- [ ] Scorer pipeline
- [ ] Run command implementation
- [ ] Results storage (files + DB)

### Phase 3: Query & Compare (Week 3)
- [ ] Query commands (runs, results)
- [ ] Compare commands (runs, models, prompts)
- [ ] Advanced SQLite queries
- [ ] Output formatters (human, JSON, CSV)

### Phase 4: Data Management (Week 4)
- [ ] DB rebuild command
- [ ] Export commands
- [ ] Clean command
- [ ] Backup command
- [ ] Validation and error handling

---

## Next Steps

1. Implement core CLI framework with Commander.js
2. Build use case management commands
3. Implement file-based storage layer
4. Set up SQLite database with schema
5. Create deterministic scorers
6. Build evaluation runner
7. Implement query and compare commands

---

**This design follows CLI-First Architecture: deterministic tools wrapped with AI orchestration.**
