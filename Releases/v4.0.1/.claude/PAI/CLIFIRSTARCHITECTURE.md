# CLI-First Architecture Pattern

**Status**: Active Standard
**Applies To**: All new PAI tools, skills, and systems
**Created**: 2025-11-15
**Philosophy**: Deterministic code execution > ad-hoc prompting

---

## Core Principle

**Build deterministic CLI tools first, then wrap them with AI prompting.**

### The Pattern

```
Requirements → CLI Tool → Prompting Layer
   (what)      (how)       (orchestration)
```

1. **Understand Requirements**: Document everything the tool needs to do
2. **Build Deterministic CLI**: Create command-line tool with explicit commands
3. **Wrap with Prompting**: AI orchestrates the CLI, doesn't replace it

---

## Why CLI-First?

### Old Way (Prompt-Driven)
```
User Request → AI generates code/actions ad-hoc → Inconsistent results
```

**Problems:**
- ❌ Inconsistent outputs (prompts drift, model variations)
- ❌ Hard to debug (what exactly happened?)
- ❌ Not reproducible (same request, different results)
- ❌ Difficult to test (prompts change, behavior changes)
- ❌ No version control (prompt changes don't track behavior)

### New Way (CLI-First)
```
User Request → AI uses deterministic CLI → Consistent results
```

**Advantages:**
- ✅ Consistent outputs (same command = same result)
- ✅ Easy to debug (inspect CLI command that was run)
- ✅ Reproducible (CLI commands are deterministic)
- ✅ Testable (test CLI directly, independently of AI)
- ✅ Version controlled (CLI changes are explicit code changes)

---

## The Three-Step Process

### Step 1: Understand Requirements

**Document everything the system needs to do:**

- What operations are needed?
- What data needs to be created/read/updated/deleted?
- What queries need to be supported?
- What outputs are required?
- What edge cases exist?

**Example (Evals System):**
```
Operations:
- Create new use case
- Add test case to use case
- Add golden output for test case
- Create new prompt version
- Run evaluation
- Query results (by model, by prompt version, by score)
- Compare two runs
- List all use cases
- Show use case details
- Delete old runs
```

### Step 2: Build Deterministic CLI

**Create command-line tool with explicit commands for every operation:**

```bash
# Structure: tool-name <command> <subcommand> [options]

# Create operations
evals use-case create --name newsletter-summary --description "..."
evals test-case add --use-case newsletter-summary --file test.json
evals golden add --use-case newsletter-summary --test-id 001 --file expected.md
evals prompt create --use-case newsletter-summary --version v1.0.0 --file prompt.txt

# Run operations
evals run --use-case newsletter-summary --model claude-3-5-sonnet --prompt v1.0.0
evals run --use-case newsletter-summary --all-models --prompt v1.0.0

# Query operations
evals query runs --use-case newsletter-summary --limit 10
evals query runs --model gpt-4o --score-min 0.8
evals query runs --since 2025-11-01

# Compare operations
evals compare runs --run-a <id> --run-b <id>
evals compare models --use-case newsletter-summary --prompt v1.0.0
evals compare prompts --use-case newsletter-summary --model claude-3-5-sonnet

# List operations
evals list use-cases
evals list test-cases --use-case newsletter-summary
evals list prompts --use-case newsletter-summary
evals list models
```

**Key Characteristics:**
- **Explicit**: Every operation has a named command
- **Consistent**: Follow standard CLI conventions (flags, options, subcommands)
- **Deterministic**: Same command always produces same result
- **Composable**: Commands can be chained or scripted
- **Discoverable**: `evals --help` shows all commands
- **Self-documenting**: `evals run --help` explains the command

### Step 3: Wrap with Prompting

**AI orchestrates the CLI based on user intent:**

```typescript
// User says: "Run evals for newsletter summary with Claude and GPT-4"

// AI interprets and executes deterministic CLI commands:
await bash('evals run --use-case newsletter-summary --model claude-3-5-sonnet');
await bash('evals run --use-case newsletter-summary --model gpt-4o');
await bash('evals compare models --use-case newsletter-summary');

// AI then summarizes results for user in structured format
```

**Prompting Layer Responsibilities:**
- Understand user intent
- Map intent to appropriate CLI commands
- Execute CLI commands in correct order
- Handle errors and retry logic
- Summarize results for user
- Ask clarifying questions when needed

**Prompting Layer Does NOT:**
- Replicate CLI functionality in ad-hoc code
- Generate solutions without using CLI
- Perform operations that should be CLI commands
- Bypass the CLI for "simple" operations

---

## Design Guidelines

### CLI Design Best Practices

**1. Command Structure**
```bash
# Good: Hierarchical, clear structure
tool command subcommand --flag value

# Examples:
evals use-case create --name foo
evals test-case add --use-case foo --file test.json
evals run --use-case foo --model claude-3-5-sonnet
```

**2. Output Formats**
```bash
# Human-readable by default
evals list use-cases

# JSON for scripting
evals list use-cases --json

# Specific fields for parsing
evals query runs --fields id,score,model
```

**3. Idempotency**
```bash
# Same command multiple times = same result
evals use-case create --name foo  # Creates
evals use-case create --name foo  # Already exists, no error

# Use --force to override
evals use-case create --name foo --force  # Recreates
```

**4. Validation**
```bash
# Validate before executing
evals run --use-case foo --dry-run

# Show what would happen
evals run --use-case foo --explain
```

**5. Error Handling**
```bash
# Clear error messages
$ evals run --use-case nonexistent
Error: Use case 'nonexistent' not found
Available use cases:
  - newsletter-summary
  - code-review
Run 'evals use-case create' to create a new use case.

# Exit codes
0 = success
1 = user error (wrong args, missing file)
2 = system error (database error, network error)
```

**6. Progressive Disclosure**
```bash
# Simple for common cases
evals run --use-case newsletter-summary

# Advanced options available
evals run --use-case newsletter-summary \
  --model claude-3-5-sonnet \
  --prompt v2.0.0 \
  --test-case 001 \
  --verbose \
  --output results.json
```

**7. Configuration Flags (Behavioral Control)**

**Inspired by indydevdan's variable-centric patterns.** CLI tools should expose configuration through flags that control execution behavior, enabling workflows to adapt without code changes.

```bash
# Execution mode flags
tool run --fast              # Quick mode (less thorough, faster)
tool run --thorough          # Comprehensive mode (slower, more complete)
tool run --dry-run           # Show what would happen without executing

# Output control flags
tool run --format json       # Machine-readable output
tool run --format markdown   # Human-readable output
tool run --quiet             # Minimal output
tool run --verbose           # Detailed logging

# Resource selection flags
tool run --model haiku       # Use fast/cheap model
tool run --model opus        # Use powerful/expensive model

# Post-processing flags
tool generate --thumbnail    # Generate additional thumbnail version
tool generate --remove-bg    # Remove background after generation
tool process --no-cache      # Bypass cache, force fresh execution
```

**Why Configuration Flags Matter:**
- **Workflow flexibility**: Same tool, different behaviors based on context
- **Natural language mapping**: "run this fast" → `--fast` flag
- **No code changes**: Behavioral variations through flags, not forks
- **Composable**: Combine flags for complex behaviors (`--fast --format json`)
- **Discoverable**: `--help` shows all configuration options

**Flag Design Principles:**
1. **Sensible defaults**: Tool works without flags for common case
2. **Explicit overrides**: Flags modify default behavior
3. **Boolean flags**: `--flag` enables, absence disables (no `--no-flag` needed)
4. **Value flags**: `--flag <value>` for choices (model, format, etc.)
5. **Combinable**: Flags should work together logically

### Workflow-to-Tool Integration

**Workflows should map user intent to CLI flags, exposing the tool's full flexibility.**

The gap in many systems: CLI tools have rich configuration options, but workflows hardcode a single invocation pattern. Instead, workflows should:

1. **Interpret user intent** → Map to appropriate flags
2. **Document flag options** → Show what configurations are available
3. **Use flag tables** → Clear mapping from intent to command

**Example: Art Generation Workflow**

```markdown
## Model Selection (based on user request)

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "fast", "quick" | `--model nano-banana` | Speed over quality |
| "high quality", "best" | `--model flux` | Maximum quality |
| (default) | `--model nano-banana-pro` | Balanced default |

## Post-Processing Options

| User Says | Flag | Effect |
|-----------|------|--------|
| "blog header" | `--thumbnail` | Creates both transparent + thumb versions |
| "transparent background" | `--remove-bg` | Removes background after generation |
| "with reference" | `--reference-image <path>` | Style guidance from image |

## Workflow Command Construction

Based on user request, construct the CLI command:

\`\`\`bash
bun run Generate.ts \
  --model [SELECTED_MODEL] \
  --prompt "[GENERATED_PROMPT]" \
  --size [SIZE] \
  --aspect-ratio [RATIO] \
  [--thumbnail if blog header] \
  [--remove-bg if transparency needed] \
  --output [PATH]
\`\`\`
```

**The Pattern:**
- Tool has comprehensive flags
- Workflow has intent→flag mapping tables
- User speaks naturally, workflow translates to precise CLI

### Prompting Layer Best Practices

**1. Always Use CLI**
```typescript
// Good: Use the CLI
await bash('evals run --use-case newsletter-summary');

// Bad: Replicate CLI functionality
const config = await readYaml('use-cases/newsletter-summary/config.yaml');
const tests = await loadTestCases(config);
for (const test of tests) {
  // ... manual implementation
}
```

**2. Map User Intent to Commands**
```typescript
// User: "Run evals for newsletter summary"
// → evals run --use-case newsletter-summary

// User: "Compare Claude vs GPT-4 on newsletter summaries"
// → evals compare models --use-case newsletter-summary

// User: "Show me recent eval runs"
// → evals query runs --limit 10

// User: "Create a new use case for blog post generation"
// → evals use-case create --name blog-post-generation
```

**3. Handle Errors Gracefully**
```typescript
const result = await bash('evals run --use-case foo');

if (result.exitCode !== 0) {
  // Parse error message
  // Suggest fix to user
  // Retry if appropriate
}
```

**4. Compose Commands**
```typescript
// User: "Run evals for all use cases and show me which ones are failing"

// Get all use cases
const useCases = await bash('evals list use-cases --json');

// Run evals for each
for (const uc of useCases) {
  await bash(`evals run --use-case ${uc.id}`);
}

// Query for failures
const failures = await bash('evals query runs --status failed --json');

// Present to user
```

---

## When to Apply This Pattern

### ✅ Apply CLI-First When:

1. **Repeated Operations**: Task will be performed multiple times
2. **Deterministic Results**: Same input should always produce same output
3. **Complex State**: Managing files, databases, configurations
4. **Query Requirements**: Need to search, filter, aggregate data
5. **Version Control**: Operations should be tracked and reproducible
6. **Testing Needs**: Want to test independently of AI
7. **User Flexibility**: Users might want to script or automate

**Examples:**
- Evaluation systems (evals)
- Content management (parser, blog posts)
- Infrastructure management (MCP profiles, dotfiles)
- Data processing (ETL pipelines, transformations)
- Project scaffolding (creating skills, commands)

### ❌ Don't Need CLI-First When:

1. **One-Off Operations**: Will only be done once or rarely
2. **Simple File Operations**: Just reading or writing a single file
3. **Pure Computation**: No state management or side effects
4. **Exploratory Analysis**: Ad-hoc investigation, not repeated

**Examples:**
- Reading a specific file once
- Quick data exploration
- One-time code refactoring
- Answering a question about existing code

---

## Migration Strategy

### For Existing PAI Systems

**Assess Current State:**
1. Identify systems using ad-hoc prompting
2. Evaluate if CLI-First would improve them
3. Prioritize high-value conversions

**Gradual Migration:**
1. Build CLI alongside existing prompting
2. Migrate one command at a time
3. Update prompting layer to use CLI
4. Deprecate ad-hoc implementations
5. Document and test

**Example: Newsletter Parser**
```bash
# Before: Ad-hoc prompting reads/parses/stores content
# After: CLI-First architecture

# Step 1: Build CLI
parser parse --url https://example.com --output content.json
parser store --file content.json --collection newsletters
parser query --collection newsletters --tag ai --limit 10

# Step 2: Update prompting to use CLI
# Instead of ad-hoc code, AI executes CLI commands
```

---

## Implementation Checklist

When building a new CLI-First system:

### Requirements Phase
- [ ] Document all required operations
- [ ] List all data entities and their relationships
- [ ] Define query requirements
- [ ] Identify edge cases and error scenarios
- [ ] Determine output formats needed

### CLI Development Phase
- [ ] Design command structure (hierarchical, consistent)
- [ ] Implement core commands (CRUD operations)
- [ ] Implement query commands (search, filter, aggregate)
- [ ] Add validation and error handling
- [ ] Support multiple output formats (human, JSON, CSV)
- [ ] Write CLI help documentation
- [ ] Test CLI independently of AI

### Storage Phase
- [ ] Choose storage strategy (files, database, hybrid)
- [ ] Implement file-based operations
- [ ] Add database layer if needed (for queries only)
- [ ] Ensure files remain source of truth
- [ ] Add data migration/rebuild capabilities

### Prompting Layer Phase
- [ ] Map common user intents to CLI commands
- [ ] Implement error handling and retry logic
- [ ] Add command composition for complex operations
- [ ] Create examples and documentation
- [ ] Test AI integration end-to-end

### Testing Phase
- [ ] Unit test CLI commands
- [ ] Integration test CLI workflows
- [ ] Test prompting layer with real user requests
- [ ] Verify deterministic behavior
- [ ] Check error handling

---

## Real-World Example: Evals System

### Step 1: Requirements
```
Operations needed:
- Create/manage use cases
- Add/manage test cases
- Add/manage golden outputs
- Create/manage prompt versions
- Run evaluations
- Query results (by model, prompt, score, date)
- Compare runs (models, prompts, versions)
```

### Step 2: CLI Design
```bash
# Use case management
evals use-case create --name <name> --description <desc>
evals use-case list
evals use-case show --name <name>
evals use-case delete --name <name>

# Test case management
evals test-case add --use-case <name> --id <id> --input <file>
evals test-case list --use-case <name>
evals test-case show --use-case <name> --id <id>

# Golden output management
evals golden add --use-case <name> --test-id <id> --file <file>
evals golden update --use-case <name> --test-id <id> --file <file>

# Prompt management
evals prompt create --use-case <name> --version <ver> --file <file>
evals prompt list --use-case <name>
evals prompt show --use-case <name> --version <ver>

# Run evaluations
evals run --use-case <name> [--model <model>] [--prompt <ver>]
evals run --use-case <name> --all-models
evals run --use-case <name> --all-prompts

# Query results
evals query runs --use-case <name> [--limit N]
evals query runs --model <model> [--score-min X]
evals query runs --since <date>

# Compare
evals compare runs --run-a <id> --run-b <id>
evals compare models --use-case <name> --prompt <ver>
evals compare prompts --use-case <name> --model <model>
```

### Step 3: Prompting Integration
```
User: "Run evals for newsletter summary with Claude and GPT-4, then compare them"

AI executes:
1. evals run --use-case newsletter-summary --model claude-3-5-sonnet
2. evals run --use-case newsletter-summary --model gpt-4o
3. evals compare models --use-case newsletter-summary
4. Summarize results in structured format

User sees:
- Run summaries (tests passed, scores)
- Model comparison (which performed better)
- Detailed results if requested
```

---

## Benefits Recap

**For Development:**
- Faster iteration (CLI can be tested independently)
- Better debugging (inspect exact commands)
- Easier testing (unit test CLI, integration test AI)
- Clear separation of concerns (CLI = logic, AI = orchestration)

**For Users:**
- Consistent results (deterministic CLI)
- Scriptable (can automate without AI)
- Discoverable (CLI help shows capabilities)
- Flexible (use via AI or direct CLI)

**For System:**
- Maintainable (changes to CLI are explicit)
- Evolvable (add commands without breaking AI layer)
- Reliable (CLI behavior doesn't drift)
- Composable (commands can be combined)

---

## Key Takeaway

**Build tools that work perfectly without AI, then add AI to make them easier to use.**

AI should orchestrate deterministic tools, not replace them with ad-hoc prompting.

---

## Related Documentation

- **Architecture**: `~/.claude/PAI/PAISYSTEMARCHITECTURE.md`

---

## Configuration Flags: Origin and Rationale

**Added:** 2025-12-08

The Configuration Flags pattern was added after analyzing indydevdan's "fork-repository-skill" approach, which uses variable blocks at the skill level to control behavior.

**Key insight from analysis:**
- Indydevdan's variables are powerful but belong at the **tool layer** (as CLI flags), not the skill layer
- PAI's Skill → Workflow → Tool hierarchy is architecturally superior
- Variables become CLI flags, maintaining CLI-First determinism
- Workflows map user intent to flags, exposing tool flexibility

**What we adopted:**
- Configuration flags for behavioral control
- Workflow-to-tool intent mapping tables
- Natural language → flag translation pattern

**What we didn't adopt:**
- Skill-level variables (skills remain intent-focused)
- IF-THEN conditional routing (implicit routing works fine)
- Feature flag toggles (separate workflows instead)

**The principle:** Tools are configurable via flags. Workflows interpret intent and construct flag-enriched commands. Skills define capability domains.

---

**This pattern is now standard for all new PAI systems.**
