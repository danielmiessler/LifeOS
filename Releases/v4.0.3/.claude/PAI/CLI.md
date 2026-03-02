> **PAI 4.0** — This system is under active development. APIs, configuration formats, and features may change without notice.

# PAI Command-Line Tools

PAI provides two CLI tools for running infrastructure from the terminal:

1. **The Algorithm CLI** — Run the PAI Algorithm against PRDs in loop or interactive mode
2. **The Arbol CLI** — Run actions and pipelines locally

Both tools use `bun` as their runtime.

---

## The Algorithm CLI

**Location:** `~/.claude/PAI/Tools/algorithm.ts`

The Algorithm CLI executes the PAI Algorithm (Observe → Think → Plan → Build → Execute → Verify → Learn) against PRD files. It supports two modes: autonomous loop execution (no human needed) and interactive sessions (human-in-the-loop).

### Quick Start

```bash
# Run the Algorithm in autonomous loop mode
bun ~/.claude/PAI/Tools/algorithm.ts -m loop -p <PRD-path> -n 20

# Run in interactive mode (launches a claude session with PRD context)
bun ~/.claude/PAI/Tools/algorithm.ts -m interactive -p <PRD-path>

# Check status of all PRDs
bun ~/.claude/PAI/Tools/algorithm.ts status
```

### Usage

```
algorithm -m <mode> -p <PRD> [-n N] [-a N]   Run the Algorithm against a PRD
algorithm status [-p <PRD>]                   Show PRD status
algorithm pause -p <PRD>                      Pause a running loop
algorithm resume -p <PRD>                     Resume a paused loop
algorithm stop -p <PRD>                       Stop a loop
```

### Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--mode` | `-m` | Execution mode: `loop` or `interactive` | — (required) |
| `--prd` | `-p` | PRD file path or PRD ID | — (required) |
| `--max` | `-n` | Max iterations (loop mode only) | 128 |
| `--agents` | `-a` | Parallel agents per iteration (1-16) | 1 |
| `--help` | `-h` | Show help | — |

### Modes

#### Loop Mode (Autonomous)

Loop mode runs the Algorithm iteratively without human interaction. Each iteration:

1. Reads the PRD and identifies failing Ideal State Criteria
2. Spawns a `claude -p` session focused on the failing criteria
3. The session makes progress, updates the PRD checkboxes
4. Re-reads the PRD to check progress
5. Repeats until all criteria pass or max iterations reached

```bash
# Basic loop — single agent, up to 128 iterations
bun ~/.claude/PAI/Tools/algorithm.ts -m loop -p PRD-20260213-auth.md

# Fast loop — 20 max iterations
bun ~/.claude/PAI/Tools/algorithm.ts -m loop -p PRD-20260213-auth.md -n 20

# Parallel loop — 4 agents working on different criteria simultaneously
bun ~/.claude/PAI/Tools/algorithm.ts -m loop -p PRD-20260213-auth.md -n 20 -a 4
```

**Parallel agents (`-a N`):** When N > 1, the CLI partitions failing criteria across N agents. Each agent receives exactly one criterion and operates as a focused worker. The CLI uses domain-aware partitioning — criteria from the same domain (e.g., `ISC-AUTH-1`, `ISC-AUTH-2`) are assigned to the same agent to avoid conflicts. After all agents complete, the parent process reconciles results into the PRD.

**Effort Level Decay:** Loop iterations start at the PRD's configured effort level but decay toward Fast as criteria converge:
- Iterations 1-3: Original effort level (full exploration)
- Iterations 4+: If >50% passing → Standard (focused fixes)
- Iterations 8+: If >80% passing → Fast (surgical only)

**Exit conditions:**
- All criteria pass → PRD status set to `COMPLETE`
- Only `Custom` verification criteria remain → PRD status set to `BLOCKED`
- Max iterations reached → PRD status set to `FAILED`
- External pause/stop → PRD status set to `paused`/`stopped`

#### Interactive Mode

Interactive mode launches a full `claude` session with the PRD context pre-loaded. You work with Claude directly to make progress on criteria.

```bash
bun ~/.claude/PAI/Tools/algorithm.ts -m interactive -p PRD-20260213-feature.md
```

This opens an interactive Claude session with:
- The PRD path and title
- Current progress (passing/total)
- List of failing criteria
- Instructions to read and update the PRD

### Status & Control

```bash
# Show all PRDs and their status
bun ~/.claude/PAI/Tools/algorithm.ts status

# Show status of a specific PRD
bun ~/.claude/PAI/Tools/algorithm.ts status -p PRD-20260213-auth

# Pause a running loop (loop checks between iterations)
bun ~/.claude/PAI/Tools/algorithm.ts pause -p PRD-20260213-auth

# Resume a paused loop
bun ~/.claude/PAI/Tools/algorithm.ts resume -p PRD-20260213-auth

# Stop a loop permanently
bun ~/.claude/PAI/Tools/algorithm.ts stop -p PRD-20260213-auth
```

### PRD Resolution

The CLI accepts PRD references in multiple formats:

| Format | Example | Resolution |
|--------|---------|------------|
| Full path | `~/.claude/MEMORY/WORK/20260207-auth/PRD.md` | Used directly |
| PRD ID | `PRD-20260207-auth` | Searches `MEMORY/WORK/*/PRD.md` and `~/Projects/*/.prd/` |
| Project path | `/path/to/project/.prd/PRD-20260213-feature.md` | Used directly |

### Dashboard Integration

The Algorithm CLI integrates with the PAI dashboard by writing state to `MEMORY/STATE/algorithms/`:

- Creates a persistent session entry for each loop run
- Syncs criteria status (passing/failing) from PRD checkboxes after each iteration
- Registers in `session-names.json` for display
- Sends voice notifications at key moments (start, iteration complete, done)
- Tracks parallel agent assignments and per-agent status

### Output

Loop mode displays a live progress dashboard:

```
╔══════════════════════════════════════════════════════════════════════╗
║  THE ALGORITHM — Loop Mode                                         ║
╠══════════════════════════════════════════════════════════════════════╣
║  PRD:       PRD-20260213-auth                                      ║
║  Title:     Authentication System                                  ║
║  Session:   a1b2c3d4                                               ║
║  Max iterations: 20 | Agents: 4                                    ║
║  Progress: 8/12 ████████████░░░░░░░░ 67%                          ║
╚══════════════════════════════════════════════════════════════════════╝

━━━ Iteration 5/20 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Progress: 8/12 ████████████░░░░░░░░ 67% | Failing: 4
  Agents this round: 4

  Agent 1 → ISC-AUTH-1: JWT middleware validates token signatures
  Agent 2 → ISC-AUTH-2: Refresh token rotation prevents replay attacks
  Agent 3 → ISC-API-1: All endpoints return standard error format
  Agent 4 → ISC-TEST-1: Integration test suite passes completely

  ⏳ 4 agents working...
  ⏱ Agents finished in 45s

  Agent Results:
    Agent 1 ✓ PASS    ISC-AUTH-1: JWT middleware validates token...
    Agent 2 ✓ PASS    ISC-AUTH-2: Refresh token rotation prevents...
    Agent 3 ✗ FAIL    ISC-API-1: All endpoints return standard er...
    Agent 4 ✓ PASS    ISC-TEST-1: Integration test suite passes c...

  ── Criteria Scoreboard ──────────────────────────────────────
  ✓ ISC-AUTH-1     JWT middleware validates token signatures
  ✓ ISC-AUTH-2     Refresh token rotation prevents replay attacks
  · ISC-API-1      All endpoints return standard error format
  ✓ ISC-TEST-1     Integration test suite passes completely
  ── 11/12 passing (92%) ──────────────────────────────────────

  Iteration 5 Summary: +3 | 11/12 passing (92%) | 45s
```

---

## The Arbol CLI (pai)

**Location:** `~/.claude/PAI/ACTIONS/pai.ts`

The Arbol CLI (`pai`) provides a unified interface for running actions and pipelines locally. It supports JSON input via arguments, stdin piping, and UNIX-style action composition.

### Quick Start

```bash
cd ~/.claude/PAI/ACTIONS

# Run an action with inline JSON
bun pai.ts action A_EXAMPLE_SUMMARIZE --input '{"content": "Your text here"}'

# Pipe JSON into an action
echo '{"content": "Your text"}' | bun pai.ts action A_EXAMPLE_SUMMARIZE

# List all available actions
bun pai.ts actions

# List all available pipelines
bun pai.ts pipelines

# Show action details
bun pai.ts info A_EXAMPLE_SUMMARIZE
```

### Usage

```
pai action <name> [--input '<json>']     Run an action
pai pipeline <name> [--<param> <value>]  Run a pipeline
pai actions                               List all actions
pai pipelines                             List all pipelines
pai info <name>                           Show action/pipeline details
```

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--mode` | — | Execution mode: `local` or `cloud` | `local` |
| `--input` | — | Input as JSON string | — |
| `--verbose` | `-v` | Show execution details (timing, input/output) | off |

### Input Methods

Actions accept input via three methods (in priority order):

1. **Stdin pipe** — `echo '{"content":"text"}' | bun pai.ts action A_EXAMPLE_SUMMARIZE`
2. **`--input` flag** — `bun pai.ts action A_EXAMPLE_SUMMARIZE --input '{"content":"text"}'`
3. **Named parameters** — `bun pai.ts action A_EXAMPLE_SUMMARIZE --content "text"`

### Action Composition (Pipe Model)

The Arbol CLI outputs JSON to stdout, enabling UNIX-style piping between actions:

```bash
# Summarize, then format the result
bun pai.ts action A_EXAMPLE_SUMMARIZE --input '{"content": "Long text..."}' \
  | bun pai.ts action A_EXAMPLE_FORMAT
```

This mirrors the pipe model used in pipelines — the output of one action becomes the input of the next. The passthrough pattern (`...upstream` fields) ensures metadata flows through the chain.

### Verbose Mode

Use `-v` to see execution details on stderr (stdout stays clean for piping):

```bash
bun pai.ts action A_EXAMPLE_SUMMARIZE --input '{"content": "test"}' -v
# [pai] Running action: A_EXAMPLE_SUMMARIZE
# [pai] Mode: local
# [pai] Input: {"content":"test"}
# [pai] Duration: 1234ms
# {"summary":"...","word_count":42}
```

---

## The Arbol Runner (Low-Level)

**Location:** `~/.claude/PAI/ACTIONS/lib/runner.v2.ts`

The runner is the lower-level engine that the `pai` CLI and pipeline runner both use. You can call it directly:

```bash
cd ~/.claude/PAI/ACTIONS

# Run an action (input as JSON argument)
bun lib/runner.v2.ts run A_EXAMPLE_SUMMARIZE '{"content": "Your text here"}'

# List all registered actions
bun lib/runner.v2.ts list
```

### Response Format

```json
{
  "success": true,
  "output": {
    "summary": "The text discusses...",
    "word_count": 42
  },
  "metadata": {
    "durationMs": 1234,
    "action": "A_EXAMPLE_SUMMARIZE",
    "version": "1.0.0"
  }
}
```

---

## The Pipeline Runner

**Location:** `~/.claude/PAI/ACTIONS/lib/pipeline-runner.ts`

The pipeline runner loads YAML pipeline definitions and chains actions sequentially.

```bash
cd ~/.claude/PAI/ACTIONS

# Run a pipeline with named parameters
bun lib/pipeline-runner.ts run P_EXAMPLE_SUMMARIZE_AND_FORMAT --content "Your text here"

# List all pipelines
bun lib/pipeline-runner.ts list
```

### Pipeline YAML Format

```yaml
name: P_EXAMPLE_SUMMARIZE_AND_FORMAT
description: >
  Summarizes text and formats the result as structured markdown.

actions:
  - A_EXAMPLE_SUMMARIZE
  - A_EXAMPLE_FORMAT
```

The runner pipes data through each action sequentially: the output of action N becomes the input of action N+1.

### Action Resolution

Both the runner and pipeline runner search for actions in two locations (in priority order):

1. **`USER/ACTIONS/`** — Personal actions (override system actions)
2. **`ACTIONS/`** — System/framework actions (includes examples)

Similarly, pipelines are searched in:

1. **`USER/PIPELINES/`** — Personal pipelines
2. **`PIPELINES/`** — System/framework pipelines

This two-tier resolution means you can create personal actions and pipelines that extend or override the built-in examples.

---

## Setting Up Shell Aliases

For convenience, add aliases to your shell configuration (`.zshrc`, `.bashrc`):

```bash
# The Algorithm CLI
alias algorithm="bun ~/.claude/PAI/Tools/algorithm.ts"

# The Arbol CLI
alias pai="bun ~/.claude/PAI/ACTIONS/pai.ts"

# Runners (optional — pai CLI wraps these)
alias arbol-run="bun ~/.claude/PAI/ACTIONS/lib/runner.v2.ts"
alias arbol-pipe="bun ~/.claude/PAI/ACTIONS/lib/pipeline-runner.ts"
```

Then use:

```bash
algorithm -m loop -p PRD-20260213-auth -n 20 -a 4
pai action A_EXAMPLE_SUMMARIZE --input '{"content": "text"}'
pai actions
```

---

## Summary

| Tool | Purpose | Command |
|------|---------|---------|
| **Algorithm CLI** | Run PAI Algorithm against PRDs | `bun Tools/algorithm.ts -m loop -p <PRD>` |
| **Arbol CLI (pai)** | Run actions and pipelines | `bun ACTIONS/pai.ts action <name>` |
| **Runner** | Low-level action execution | `bun ACTIONS/lib/runner.v2.ts run <action>` |
| **Pipeline Runner** | Chain actions via YAML | `bun ACTIONS/lib/pipeline-runner.ts run <pipeline>` |

---

## Related Documentation

| Document | Path | Description |
|----------|------|-------------|
| Actions | `ACTIONS.md` | Action creation, structure, capabilities |
| Pipelines | `PIPELINES.md` | Pipeline YAML format, composition |
| Flows | `FLOWS.md` | Cron scheduling, sources, destinations |
| Deployment | `DEPLOYMENT.md` | End-to-end Cloudflare Workers deployment |
| Arbol Overview | `ARBOLSYSTEM.md` | Architecture overview |

---

**Last Updated:** 2026-02-21
