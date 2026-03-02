# Evals CLI Reference

## CLI-First Architecture

This skill follows the CLI-First Architecture pattern:

```
User Request -> AI orchestrates -> EvalServer CLI -> Deterministic results
```

---

## CLI Commands

### Use Case Management

```bash
# Create new use case
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts use-case create --name <name>

# List all use cases
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts use-case list

# Show use case details
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts use-case show <name>
```

### Test Case Management

```bash
# Add test case to use case
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts test-case add --use-case <name>

# List test cases for use case
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli.ts test-case list --use-case <name>
```

### Run Evaluations

```bash
# Run eval for use case (optional model specification)
bun run ~/.claude/skills/Utilities/Evals/EvalServer/cli-run.ts --use-case <name> [--model <model>]
```

---

## Web UI

Start the EvalServer for visual evaluation:

```bash
cd ~/.claude/skills/Utilities/Evals/EvalServer
bun run dev  # Starts on http://localhost:5173
```

**Features:**
- Real-time eval execution with streaming
- Visual test case management
- Results comparison dashboard
- Bi-directional file <-> UI sync

---

## Storage Strategy

### Files (Source of Truth)

```
~/.claude/skills/Utilities/Evals/
├── UseCases/
│   └── <name>/
│       ├── config.yaml         # Criteria, thresholds
│       ├── judge-config.yaml   # Judge template data
│       ├── rubric.yaml         # Rubric template data
│       ├── test-cases/         # Input/expected pairs
│       ├── golden-outputs/     # Reference standards
│       ├── prompts/            # Versioned prompts
│       └── README.md           # Use case documentation
├── Results/
│   └── <use-case>/
│       └── <run-id>/           # Per-run results
└── EvalServer/                 # Web UI + execution engine
```

### SQLite (Query Optimization)

- Database: `EvalServer/storage/evals.db`
- **Used ONLY for**: Fast queries, analytics, comparisons
- **Can be rebuilt** from files
