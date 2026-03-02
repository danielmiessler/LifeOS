# CLI Framework Comparison

**Comprehensive analysis of TypeScript CLI frameworks for informed tier selection**

---

## 🎯 Quick Recommendation Matrix

| Use Case | Framework | Why |
|----------|-----------|-----|
| **API Client** (2-10 commands) | Manual Parsing (Tier 1) | Zero deps, 300 lines, production-ready |
| **File Processor** (simple args) | Manual Parsing (Tier 1) | Fast development, type-safe, composable |
| **Multi-Tool** (10+ commands) | Commander.js (Tier 2) | Subcommands, auto-help, proven |
| **Plugin System** (extensible) | oclif (Tier 3) | Enterprise-grade, reference only |

**Rule:** Default to Manual → escalate to Commander → reference oclif only

---

## 📊 Framework Comparison Table

| Framework | Stars | Bundle Size | TypeScript | Best For | Tier |
|-----------|-------|-------------|------------|----------|----------|
| **Manual Parsing** | N/A | 0 KB | Native | Simple CLIs (llcli) | Tier 1 ⭐ DEFAULT |
| **Commander.js** | 25K+ | ~100 KB | Built-in | General CLIs | Tier 2 |
| **oclif** | 12K+ | 22+ MB | First-class | Enterprise plugins | Tier 3 (ref only) |
| **cleye** | N/A | Small | Schema inference | Modern TS CLIs | Alternative |
| **citty** | N/A | Moderate | Discriminated unions | Complex type safety | Alternative |
| **Yargs** | 30K+ | Larger | @types | Config-heavy | Not recommended |

---

## 1️⃣ TIER 1: Manual Parsing (llcli Pattern)

### Pattern

```typescript
#!/usr/bin/env bun

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    showHelp();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'today':
      await fetchToday();
      break;
    case 'date':
      if (!args[1]) {
        console.error('Error: date requires YYYY-MM-DD argument');
        process.exit(1);
      }
      await fetchDate(args[1]);
      break;
    case 'search':
      const keyword = args[1];
      const limitIdx = args.indexOf('--limit');
      const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 20;
      await fetchSearch(keyword, limit);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal:', error);
  process.exit(1);
});
```

### Pros
- ✅ Zero dependencies (no node_modules bloat)
- ✅ Complete control over parsing logic
- ✅ Type-safe with TypeScript interfaces
- ✅ 300-400 lines total (easy to understand)
- ✅ Fast development (no framework learning curve)
- ✅ Proven pattern (llcli is production-ready)
- ✅ Perfect for Bun runtime
- ✅ Deterministic behavior

### Cons
- ❌ Manual help text (but this ensures quality)
- ❌ Manual argument parsing (but simple)
- ❌ No built-in subcommand routing (use Tier 2 if needed)
- ❌ Repetitive for 20+ commands (escalate at that point)

### When to Use (DEFAULT)
- ✅ 2-10 commands
- ✅ API client wrappers
- ✅ Data transformers
- ✅ File processors
- ✅ Simple automation tools
- ✅ JSON output only
- ✅ Fast development priority

### Reference Implementation
**Location:** `~/.claude/Bin/llcli/llcli.ts` (327 lines)
**Commands:** today, date, search
**Pattern:** Exactly what this tier generates

---

## 2️⃣ TIER 2: Commander.js

### Pattern

```typescript
#!/usr/bin/env bun

import { Command } from 'commander';

const program = new Command();

program
  .name('mycli')
  .description('Production CLI tool')
  .version('1.0.0');

program
  .command('convert <format> <input>')
  .option('-o, --output <file>', 'output file')
  .option('--verbose', 'verbose logging')
  .action((format: string, input: string, options) => {
    console.log(`Converting ${input} to ${format}`);
    if (options.output) {
      console.log(`Output: ${options.output}`);
    }
  });

program
  .command('validate')
  .argument('<file>', 'file to validate')
  .option('--strict', 'strict mode')
  .action((file: string, options) => {
    console.log(`Validating ${file}`);
  });

program.parse();
```

### Pros
- ✅ Auto-generated help (from command definitions)
- ✅ Subcommand routing built-in
- ✅ Fluent API (readable, chainable)
- ✅ TypeScript definitions included
- ✅ Large community (25K+ stars)
- ✅ Well-documented
- ✅ Option parsing automatic
- ✅ Lightweight (~100 KB, zero sub-dependencies)

### Cons
- ❌ Framework dependency (not zero-dep like Tier 1)
- ❌ Learning curve (need to understand API)
- ❌ Opinionated structure
- ❌ Overkill for simple CLIs (use Tier 1 instead)
- ❌ Bun may prefer zero-dep approach

### When to Use (ESCALATION)
- ❌ 10+ commands needing organization
- ❌ Subcommands (e.g., `cli convert json csv` vs `cli convert csv json`)
- ❌ Plugin architecture needed
- ❌ Complex option combinations
- ❌ Multiple output format engines
- ❌ Git-style command groups

### Example Use Case
```bash
# Data transformation CLI with subcommands
data-cli convert json csv input.json --output data.csv
data-cli convert csv json input.csv
data-cli validate schema data.json --strict
data-cli analyze stats data.csv
data-cli analyze trends data.csv --window 7d
```

**Pattern:** Commands naturally group into categories (convert, validate, analyze)

---

## 3️⃣ TIER 3: oclif (Reference Only)

### Pattern

```typescript
import { Command, Flags, Args } from '@oclif/core';

export default class Hello extends Command {
  static description = 'Say hello';

  static examples = [
    '<%= config.bin %> <%= command.id %> --name World',
  ];

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'name to greet',
      required: true,
    }),
    verbose: Flags.boolean({ char: 'v' }),
  };

  static args = {
    file: Args.string({ description: 'file to process' }),
  };

  async run() {
    const { flags, args } = await this.parse(Hello);
    this.log(`Hello ${flags.name}!`);
  }
}
```

### Pros
- ✅ Enterprise-grade plugin system
- ✅ Code generation (`oclif generate command`)
- ✅ Topics for hierarchical commands
- ✅ Auto-updates mechanism
- ✅ Multi-command CLIs (Heroku, Salesforce scale)
- ✅ Class-based commands (OOP style)
- ✅ ES modules + CommonJS compatible

### Cons
- ❌ Heavy bundle size (22+ MB)
- ❌ Steep learning curve
- ❌ Complex setup
- ❌ Overkill for 99% of CLIs
- ❌ Not aligned with PAI's minimal approach

### When to Reference (RARE)
- Enterprise plugin systems (Heroku CLI scale)
- 50+ commands with complex organization
- Auto-update mechanisms critical
- Multi-tenant CLI platforms

**Note:** This skill does NOT generate oclif CLIs. Documentation only for reference.

---

## 🔬 RESEARCH FINDINGS: Type-Safe Frameworks

### cleye (Schema-Driven Inference)

**Pattern:**
```typescript
import { cli } from 'cleye';

const argv = cli({
  name: 'mycli',
  flags: {
    noCache: {
      type: Boolean,
      description: 'Disable cache',
    },
    tsconfig: {
      type: String,
      description: 'Path to tsconfig',
    },
  },
  parameters: ['<script path>'],
});

// argv.flags.noCache → boolean
// argv.flags.tsconfig → string | undefined
// argv._.scriptPath → string | undefined
```

**Key Insight:** TypeScript infers full shape from flag definitions (zero manual typing)

**Use When:**
- Zero boilerplate preference
- Modern TypeScript CLI
- Full type inference needed

**Trade-off vs Tier 1:**
- + Type inference automatic
- - Framework dependency
- - Less control over parsing

---

### citty (Discriminated Unions)

**Pattern:**
```typescript
import { defineCommand, runMain } from 'citty';

const convert = defineCommand({
  meta: {
    name: 'convert',
    description: 'Convert files',
  },
  args: {
    format: {
      type: 'positional',
      description: 'Output format',
      required: true,
    },
    strict: {
      type: 'boolean',
      description: 'Strict mode',
    },
  },
  async run({ args }) {
    // args.format → string (required)
    // args.strict → boolean | undefined
    console.log(`Converting to ${args.format}`);
  },
});

runMain(convert);
```

**Key Insight:** Discriminated unions provide exhaustive type checking

**Use When:**
- Complex command trees
- Type safety critical
- Argument validation needed

**Trade-off vs Tier 1:**
- + Advanced type safety
- - Framework abstraction
- - Additional dependency

---

## 📈 DECISION CRITERIA

### Choose Manual Parsing (Tier 1) If:
- [ ] CLI has 2-10 simple commands
- [ ] Commands take basic arguments (strings, numbers, flags)
- [ ] Output is JSON only
- [ ] No subcommand grouping needed
- [ ] Zero dependencies preferred
- [ ] Fast development critical
- [ ] Following llcli pattern

**→ 80% of CLIs should use Tier 1**

---

### Choose Commander.js (Tier 2) If:
- [ ] CLI has 10+ commands needing organization
- [ ] Subcommands required (git-style: `cli category command`)
- [ ] Complex nested options
- [ ] Plugin architecture planned
- [ ] Multiple output formats (JSON, table, CSV)
- [ ] Auto-generated help essential

**→ 15% of CLIs need Tier 2**

---

### Reference oclif (Tier 3) If:
- [ ] Enterprise plugin system (Heroku/Salesforce scale)
- [ ] 50+ commands with topics
- [ ] Auto-update mechanism
- [ ] Multi-tenant platform

**→ 5% of CLIs (NOT generated by this skill)**

---

## 🎯 llcli Pattern Analysis

### Why Manual Parsing Works

**llcli demonstrates:**
1. **327 lines total** - Complete CLI with docs
2. **Zero dependencies** - No node_modules needed
3. **Type-safe** - Full TypeScript interfaces
4. **Production-ready** - Error handling, help, validation
5. **Composable** - JSON output pipes everywhere
6. **Documented** - README explains philosophy

**Key Insight:** For API wrappers and simple tools, manual parsing is SUPERIOR to frameworks because:
- Complete control over behavior
- No framework magic to debug
- Easier to understand and modify
- Faster to develop (no API to learn)
- Deterministic (no framework updates breaking things)

### When llcli Pattern Breaks Down

**Indicators to escalate:**
- 15+ commands making switch statement unwieldy
- Need for subcommand grouping (convert json csv vs convert csv json)
- Plugin/extension system required
- Complex option validation across commands

**At that point → Tier 2 (Commander.js)**

---

## 💡 Best Practices

### 1. **Start Tier 1, Escalate When Proven**
Don't guess complexity. Build simple first.

### 2. **Frameworks Are Not Free**
Every dependency is debt. Justify it.

### 3. **Type Safety > Frameworks**
Manual parsing with TypeScript beats framework without types.

### 4. **Help Text Quality Matters**
Auto-generated help is convenient but often poor quality. Manual help (like llcli) is better.

### 5. **Composability > Features**
JSON output + pipes > built-in table rendering.

### 6. **Test Immediately**
Run `--help` before declaring framework choice successful.

### 7. **Read Real Code**
Study llcli, not just framework docs.

### 8. **Benchmark Size**
Check dist/ folder size. Tier 1 CLIs are <100 KB.

---

## 📚 Additional Research

### Yargs (NOT Recommended for PAI)

**Why not recommended:**
- Larger bundle size than Commander
- Less TypeScript-friendly
- Verbose syntax
- Async typing issues

**Use Commander.js instead if escalating from Tier 1.**

---

### Ink (NOT Recommended for General CLIs)

**Why not recommended:**
- React-based (massive overhead)
- Interactive UIs (not deterministic)
- Large bundle size
- Overkill for data processing

**Use for:** Dashboard UIs, dev servers with live updates

**Not for:** API clients, file processors, automation

---

## ✅ Final Recommendation

**For PAI createcli skill:**

1. **Default:** Tier 1 (Manual Parsing / llcli pattern)
2. **Escalation:** Tier 2 (Commander.js) when decision tree indicates
3. **Reference:** Tier 3 (oclif) for documentation only

**Philosophy:** The best framework is no framework until proven otherwise.

---

**Sources:**
- llcli production implementation (~/.claude/Bin/llcli/)
- Commander.js 12.x documentation
- oclif core documentation
- Perplexity research (32 sub-queries on CLI frameworks)
- Codex research (tsx, vite, next, bun CLI analysis)
