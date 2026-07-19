---
workflow: create-cli
purpose: Generate complete, production-ready TypeScript CLI from requirements
---

# Create CLI Workflow

**Generate production-quality TypeScript command-line interfaces following llcli pattern and CLI-First Architecture.**

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the CreateCli workflow in the CreateCLI skill to generate new CLI"}' \
  > /dev/null 2>&1 &
```

Running the **CreateCli** workflow in the **CreateCLI** skill to generate new CLI...

---

## 🎯 PURPOSE

This workflow generates a complete, immediately usable TypeScript CLI tool with:
- Full type safety and error handling
- Comprehensive documentation (README + QUICKSTART)
- Clean architecture (following llcli pattern)
- Production-ready code
- Quality validation gates

---

## 📍 WHEN TO USE

Activate this workflow when user requests:
- "Create a CLI for [API/service/tool]"
- "Build a command-line interface"
- "Make a CLI that does X"
- "Generate a CLI tool"
- "I need something like llcli but for Y"

---

## 🔀 TIER DECISION TREE

**Use this deterministic decision tree to select complexity tier:**

```
START: User describes CLI requirements
│
├─ Does it need 10+ commands with grouping? ─ YES → Tier 2 (Commander.js)
│                                             NO  ↓
│
├─ Does it need plugin architecture? ──────── YES → Tier 2 (Commander.js)
│                                             NO  ↓
│
├─ Does it need subcommands (git-style)? ──── YES → Tier 2 (Commander.js)
│                                             NO  ↓
│
├─ Does it need complex nested options? ────── YES → Tier 2 (Commander.js)
│                                             NO  ↓
│
└─ Use Tier 1 (llcli-style) ← DEFAULT
   ↑
   └─ 80% of CLIs end up here
```

**Tier 1 Indicators (DEFAULT):**
- ✅ 2-10 simple commands
- ✅ API client wrapper
- ✅ Data transformer
- ✅ File processor
- ✅ Simple automation
- ✅ JSON output
- ✅ Fast development needed

**Tier 2 Indicators (ESCALATION):**
- ❌ 10+ commands needing organization
- ❌ Plugin/extension system
- ❌ Subcommands (convert json csv, convert csv json)
- ❌ Multiple output format engines
- ❌ Complex option combinations

**Rule of Thumb:** If user doesn't explicitly need Tier 2 features, use Tier 1.

---

## 📋 WORKFLOW STEPS

### Step 1: Gather Requirements

**Extract from user request:**
- CLI name (kebab-case, e.g., `ghcli`, `md2html`)
- Purpose (one-sentence description)
- Commands needed (list each command with arguments)
- API/service being wrapped (if applicable)
- Authentication method (API key, Bearer token, OAuth)
- Environment variables needed
- Output format (usually JSON)
- **Configuration flags needed** (behavioral variants - see Step 5a)

**Questions to ask user if unclear:**
- "What API or service does this wrap?"
- "What are the main commands you need?"
- "How should it authenticate?"
- "Where should the CLI be installed?" (personal bin, project-specific, etc.)

**Example extraction:**
```
User: "Create a CLI for the GitHub API"

Extracted:
- Name: ghcli
- Purpose: GitHub API Command-Line Interface
- Commands: repos (list), issues (create, list), search
- API: api.github.com
- Auth: Bearer token (GITHUB_TOKEN)
- Env vars: GITHUB_TOKEN
- Output: JSON
```

---

### Step 2: Determine Complexity Tier

**Apply decision tree from above.**

**For most requests → Tier 1**

Example decision:
```
User: "CLI for GitHub API with repos, issues, search commands"
→ 3 commands (< 10) ✓
→ No subcommands ✓
→ Simple arguments ✓
→ API wrapper ✓
= TIER 1
```

---

### Step 3: Generate TypeScript Interface Definitions

**Based on API responses/data structures:**

```typescript
// For API client CLIs
interface ApiResponse {
  data: {
    items: Item[];
  };
}

interface Item {
  id: string;
  name: string;
  created_at: string;
  // ... fields from API docs
}

interface Config {
  apiKey: string;
  baseUrl: string;
  // ... configuration fields
}
```

**For file processing CLIs:**
```typescript
interface ProcessResult {
  input: string;
  output: string;
  status: 'success' | 'error';
  error?: string;
}

interface Config {
  outputDir: string;
  format: string;
}
```

---

### Step 4: Generate Configuration Section

**Pattern from llcli:**

```typescript
// ============================================================================
// Configuration
// ============================================================================

const DEFAULTS = {
  baseUrl: '{{API_BASE_URL}}',
  limit: 20,
  {{ADDITIONAL_DEFAULTS}}
} as const;

/**
 * Load configuration from environment
 */
function loadConfig(): Config {
  const configRoot = process.env.LIFEOS_HOME
    ?? process.env.CLAUDE_CONFIG_DIR
    ?? (process.env.LIFEOS_DIR ? dirname(process.env.LIFEOS_DIR) : join(homedir(), '.claude'));
  const envPath = join(configRoot, '.env');

  try {
    const envContent = readFileSync(envPath, 'utf-8');
    const apiKey = envContent
      .split('\n')
      .find(line => line.startsWith('{{ENV_VAR_NAME}}='))
      ?.split('=')[1]
      ?.trim();

    if (!apiKey) {
      console.error(`Error: {{ENV_VAR_NAME}} not found in ${envPath}`);
      process.exit(1);
    }

    return {
      apiKey,
      baseUrl: DEFAULTS.baseUrl,
      {{ADDITIONAL_CONFIG}}
    };
  } catch (error) {
    console.error(`Error: Cannot read ${envPath}`);
    console.error(`Make sure {{ENV_VAR_NAME}} is set in ${envPath}`);
    process.exit(1);
  }
}
```

---

### Step 5a: Design Configuration Flags (REQUIRED)

**Every CLI should expose behavioral configuration via flags, not hardcoded values.**

This enables workflows and users to adapt CLI behavior without code changes.

**Standard Flag Categories:**

| Category | Examples | Purpose |
|----------|----------|---------|
| **Mode flags** | `--fast`, `--thorough`, `--dry-run` | Execution behavior |
| **Output flags** | `--format json`, `--quiet`, `--verbose` | Output control |
| **Resource flags** | `--model haiku`, `--model opus` | Model/resource selection |
| **Post-process flags** | `--thumbnail`, `--remove-bg` | Additional processing |

**Design Checklist:**
1. What execution modes does this CLI need? (fast vs thorough, dry-run)
2. What output formats are useful? (json, table, quiet, verbose)
3. Are there resource/model selections? (cheap vs expensive, fast vs accurate)
4. Are there optional post-processing steps?

**Example flag design for an API CLI:**
```typescript
// Mode flags
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const quiet = args.includes('--quiet');

// Resource flags
const modelIdx = args.indexOf('--model');
const model = modelIdx !== -1 ? args[modelIdx + 1] : 'default';

// Output flags
const formatIdx = args.indexOf('--format');
const format = formatIdx !== -1 ? args[formatIdx + 1] : 'json';
```

**Flag Design Principles:**
1. **Sensible defaults**: CLI works without flags for common case
2. **Explicit overrides**: Flags modify default behavior
3. **Boolean flags**: `--flag` enables (no `--no-flag` needed)
4. **Value flags**: `--flag <value>` for choices
5. **Composable**: Flags should combine logically

**Reference:** `$LIFEOS_DIR/DOCUMENTATION/Tools/CliFirstArchitecture.md` (Configuration Flags section)

---

### Step 5: Generate Command Functions

**One function per command (incorporating configuration flags from Step 5a):**

```typescript
// ============================================================================
// CLI Commands
// ============================================================================

/**
 * {{COMMAND_DESCRIPTION}}
 */
async function {{commandName}}(
  {{ARGUMENTS}}: string,
  options: { limit?: number } = {}
): Promise<void> {
  const config = loadConfig();

  // Validate inputs
  if (!{{ARGUMENTS}} || {{ARGUMENTS}}.trim() === '') {
    console.error('Error: {{ARGUMENT_NAME}} is required');
    process.exit(1);
  }

  // Build request
  const params = {
    {{PARAM_MAPPING}},
    limit: options.limit?.toString() ?? DEFAULTS.limit.toString(),
  };

  // Make API call
  const data = await {{fetchFunction}}(config, params);

  // Output JSON
  console.log(JSON.stringify(data, null, 2));
}
```

**Repeat for each command.**

---

### Step 6: Generate Help Documentation

**Comprehensive help text following llcli pattern:**

```typescript
// ============================================================================
// Help Documentation
// ============================================================================

function showHelp(): void {
  console.log(`
{{CLI_NAME}} - {{CLI_DESCRIPTION}}
${'='.repeat(CLI_NAME.length + CLI_DESCRIPTION.length + 3)}

A clean, deterministic CLI for {{PURPOSE}}.

USAGE:
  {{CLI_NAME}} <command> [options]

COMMANDS:
  {{COMMAND_LIST}}
  help, --help, -h               Show this help message
  version, --version, -v         Show version information

OPTIONS:
  {{OPTIONS_LIST}}

EXAMPLES:
  {{EXAMPLE_LIST}}

OUTPUT:
  All commands return JSON to stdout
  Errors and messages go to stderr
  Exit code 0 on success, 1 on error

CONFIGURATION:
  {{CONFIGURATION_DETAILS}}

RESPONSE FORMAT:
  {{JSON_STRUCTURE_EXAMPLE}}

PHILOSOPHY:
  {{CLI_NAME}} follows CLI-First Architecture:
  - Deterministic: Same input → Same output
  - Clean: Single responsibility ({{PURPOSE}} only)
  - Composable: JSON output pipes to jq, grep, etc.
  - Documented: Full help and examples
  - Testable: Predictable behavior

For more information, see $LIFEOS_DIR/TOOLS/{{CLI_NAME}}/README.md

Version: 1.0.0
`);
}

function showVersion(): void {
  console.log('{{CLI_NAME}} version 1.0.0');
}
```

---

### Step 7: Generate Main Entry Point

**Argument parsing and command routing:**

```typescript
// ============================================================================
// Main CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Handle help/version
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }

  if (args[0] === 'version' || args[0] === '--version' || args[0] === '-v') {
    showVersion();
    return;
  }

  const command = args[0];

  // Parse common options (e.g., --limit)
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 && args[limitIndex + 1]
    ? parseInt(args[limitIndex + 1], 10)
    : undefined;

  if (limitIndex !== -1 && (isNaN(limit!) || limit! <= 0)) {
    console.error('Error: --limit must be a positive number');
    process.exit(1);
  }

  // Route to commands
  switch (command) {
    {{COMMAND_CASES}}

    default:
      console.error(`Error: Unknown command '${command}'`);
      console.error('Run "{{CLI_NAME}} --help" for usage information');
      process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

---

### Step 8: Generate Documentation Files

**README.md structure (following llcli):**

```markdown
# {{CLI_NAME}} - {{CLI_DESCRIPTION}}

**Version:** 1.0.0
**Last Updated:** {{TODAY_DATE}}

---

## Overview

{{CLI_NAME}} is a clean, deterministic command-line interface for {{PURPOSE}}. It provides simple access to {{SERVICE}} with a focus on reliability, composability, and documentation.

### Philosophy

{{CLI_NAME}} follows **CLI-First Architecture**:

1. **Deterministic** - Same input always produces same output
2. **Clean** - Single responsibility
3. **Composable** - JSON output pipes to jq, grep, other tools
4. **Documented** - Comprehensive help and examples
5. **Testable** - Predictable, verifiable behavior

---

## Installation

[Setup instructions]

---

## Usage

[Command documentation]

---

## Examples

[Real-world examples with jq, grep, etc.]

---

## Configuration

[Environment variables, defaults]

---

## API Reference

[API endpoint documentation]

---

## Philosophy

### Why This CLI Exists

[Explain the problem it solves]

### Design Principles

[Key decisions and why]

---

[Additional sections: Troubleshooting, Integration, Best Practices]
```

**QUICKSTART.md:**
```markdown
# {{CLI_NAME}} Quick Start

**The 30-second guide to using {{CLI_NAME}}**

## Installation

[Quick setup]

## Usage

[3-5 most common commands]

## Piping to jq

[Common jq patterns]

## Configuration

[Minimal config info]

## Full Documentation

See: $LIFEOS_DIR/TOOLS/{{CLI_NAME}}/README.md
```

---

### Step 9: Generate Supporting Files

**package.json:**
```json
{
  "name": "{{CLI_NAME}}",
  "version": "1.0.0",
  "description": "{{CLI_DESCRIPTION}}",
  "type": "module",
  "bin": {
    "{{CLI_NAME}}": "./{{CLI_NAME}}.ts"
  },
  "scripts": {
    "help": "bun run {{CLI_NAME}}.ts --help"
  },
  "keywords": [{{KEYWORDS}}],
  "author": "",
  "license": "MIT",
  "dependencies": {}
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["*.ts"],
  "exclude": ["node_modules"]
}
```

**.env.example:**
```bash
# {{CLI_NAME}} Configuration
{{ENV_VAR_NAME}}=your_{{TOKEN_TYPE}}_here
```

---

### Step 10: Validate and Report

**Quality Gates:**
1. ✅ TypeScript compiles without errors
2. ✅ All commands work with test inputs
3. ✅ Help text displays correctly
4. ✅ README is comprehensive
5. ✅ File permissions set (chmod +x)

**Validation Commands:**
```bash
cd $LIFEOS_DIR/TOOLS/{{CLI_NAME}}/
chmod +x {{CLI_NAME}}.ts
./{{CLI_NAME}}.ts --help
./{{CLI_NAME}}.ts --version
```

**Report to user:**
```
✅ CLI Created: $LIFEOS_DIR/TOOLS/{{CLI_NAME}}/

Files generated:
- {{CLI_NAME}}.ts ({{LINE_COUNT}} lines)
- package.json
- tsconfig.json
- .env.example
- README.md
- QUICKSTART.md

Next steps:
1. Configure: Add {{ENV_VAR_NAME}} to the LifeOS config root's `.env`
2. Test: ./{{CLI_NAME}}.ts --help
3. Use: ./{{CLI_NAME}}.ts {{EXAMPLE_COMMAND}}

Documentation: $LIFEOS_DIR/TOOLS/{{CLI_NAME}}/README.md
```

---

## 📤 OUTPUT EXAMPLE

**User Request:**
"Create a CLI for the Notion API to list databases and create pages"

**Generated Output:**
```
✅ CLI Created: $LIFEOS_DIR/TOOLS/notioncli/

Files generated:
- notioncli.ts (342 lines)
- package.json
- tsconfig.json
- .env.example (NOTION_API_KEY)
- README.md (with philosophy and examples)
- QUICKSTART.md

Commands available:
- notioncli databases                    # List all databases
- notioncli pages create <db-id>         # Create page in database
- notioncli search <query>               # Search workspace
- notioncli --help                       # Show full help

Next steps:
1. Add `NOTION_API_KEY=your_key` to the LifeOS config root's `.env`
2. Test: notioncli databases
3. Read: $LIFEOS_DIR/TOOLS/notioncli/README.md

The CLI follows llcli pattern with type safety, error handling,
and comprehensive documentation.
```

---

## 🔗 RELATED WORKFLOWS

**After creating CLI:**
- `add-command.md` - Add more commands to existing CLI
- `add-testing.md` - Generate test suite
- `setup-distribution.md` - Setup npm publishing or binary distribution

**Escalation:**
- `upgrade-tier.md` - Migrate from Tier 1 → Tier 2 if CLI grows complex

---

## 📖 REAL-WORLD EXAMPLES

### Example 1: API Client

**Request:** "CLI for Stripe API"

**Decision:** Tier 1 (API wrapper, simple commands)

**Generated Commands:**
```bash
stripecli customers list
stripecli customers create --email user@example.com
stripecli payments list --customer cus_123
stripecli balance
```

---

### Example 2: File Processor

**Request:** "CLI to convert markdown to various formats"

**Decision:** Tier 1 (file I/O, simple transformations)

**Generated Commands:**
```bash
md-convert html input.md output.html
md-convert pdf input.md output.pdf
md-convert extract-links input.md
md-convert stats input.md
```

---

### Example 3: Database Tool

**Request:** "CLI for database migrations with rollback, status, and generate commands"

**Decision:** Tier 2 (complex workflow, subcommands)

**Generated Commands:**
```bash
db-migrate up                    # Run pending migrations
db-migrate down --steps 1        # Rollback
db-migrate status                # Show migration status
db-migrate create --name users   # Generate new migration
```

---

## ✅ BEST PRACTICES

### 1. **Default to Tier 1**
Start simple. 80% of CLIs don't need a framework.

### 2. **Complete Documentation**
README explains "why" not just "how". Include philosophy section.

### 3. **Type Safety First**
All interfaces, strict mode, no `any` types.

### 4. **Deterministic Output**
JSON to stdout, errors to stderr. Consistent every time.

### 5. **Error Context**
Don't just say "Error". Explain what failed and how to fix it.

### 6. **Examples in Help**
Show real usage examples, not just flag descriptions.

### 7. **Test Immediately**
Run `--help` and version command before reporting success.

### 8. **Follow llcli Pattern**
Use proven structure from $LIFEOS_DIR/TOOLS/llcli/ as reference.

---

## 🐛 TROUBLESHOOTING

**"Should I use Tier 1 or Tier 2?"**
→ Follow decision tree. If uncertain, use Tier 1. You can upgrade later.

**"User wants 15 commands"**
→ Tier 1 can handle this if commands are simple. Use Tier 2 only if they need grouping/subcommands.

**"CLI needs both JSON and table output"**
→ Tier 2 (multiple output engines). Tier 1 is JSON-only.

**"User didn't specify commands"**
→ Ask: "What are the main commands you need?"

**"Don't know API structure"**
→ Ask: "Do you have API documentation? What does a typical response look like?"

---

## 📊 QUALITY CHECKLIST

Before reporting CLI as complete, verify:

### Core Functionality
- [ ] TypeScript compiles (run bun check)
- [ ] File permissions set (chmod +x)
- [ ] --help displays correctly
- [ ] --version shows version
- [ ] All commands in help are implemented

### Configuration Flags Standard
- [ ] Configuration exposed via flags, not hardcoded
- [ ] Mode flags present where applicable (--fast, --thorough, --dry-run)
- [ ] Output flags present (--format, --quiet, --verbose)
- [ ] Resource flags present if applicable (--model, etc.)
- [ ] Sensible defaults work without flags
- [ ] Flags documented in --help output

### Documentation & Output
- [ ] README has philosophy section
- [ ] QUICKSTART has common examples
- [ ] .env.example lists all required vars
- [ ] Error messages are actionable
- [ ] Exit codes correct (0 = success, 1 = error)
- [ ] JSON output valid (test with `| jq empty`)
- [ ] Configuration loaded from expected location
- [ ] CLI name is kebab-case
- [ ] Follows llcli structure pattern

### Workflow Integration
- [ ] If this CLI will be called by workflows, document the intent-to-flag mapping pattern
- [ ] Flag names match standard conventions (see CliFirstArchitecture.md)

---

**This workflow generates production-ready CLIs that work immediately, following the proven llcli pattern and CLI-First Architecture principles.**
