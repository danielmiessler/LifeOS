---
workflow: upgrade-tier
purpose: Migrate CLI from Tier 1 (manual) to Tier 2 (Commander.js)
---

# Upgrade Tier Workflow

**Migrate from manual parsing to Commander.js when CLI grows complex.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the UpgradeTier workflow in the CreateCLI skill to upgrade CLI tier"}' \
  > /dev/null 2>&1 &
```

Running the **UpgradeTier** workflow in the **CreateCLI** skill to upgrade CLI tier...

---

## 🎯 PURPOSE

Convert Tier 1 CLI (llcli-style) to Tier 2 (Commander.js) when complexity demands it.

---

## 📍 WHEN TO USE

**Indicators to upgrade:**
- 15+ commands (switch statement unwieldy)
- Need subcommands (git-style: `cli convert json csv`)
- Plugin architecture needed
- Complex option combinations
- Multiple output formats

**Rule:** Don't upgrade prematurely. Tier 1 handles 10-15 commands fine.

---

## 📋 MIGRATION STEPS

### 1. Install Commander.js

```bash
cd ~/.claude/Bin/[cli-name]/
bun add commander
```

### 2. Create Commander Structure

```typescript
#!/usr/bin/env bun

import { Command } from 'commander';

const program = new Command();

program
  .name('[cli-name]')
  .description('[description from old CLI]')
  .version('2.0.0'); // Bump major version
```

### 3. Convert Commands

**Before (Tier 1):**
```typescript
async function fetchData(arg: string, limit: number): Promise<void> {
  // ...
}

switch (command) {
  case 'fetch':
    await fetchData(args[1], limit);
    break;
}
```

**After (Tier 2):**
```typescript
program
  .command('fetch <arg>')
  .option('-l, --limit <number>', 'limit results', '20')
  .description('Fetch data')
  .action(async (arg: string, options) => {
    const limit = parseInt(options.limit, 10);
    await fetchData(arg, limit);
  });
```

### 4. Preserve Help Quality

Don't let auto-generated help be worse than manual help.

```typescript
program
  .command('fetch <query>')
  .description('Search and fetch data')
  .option('-l, --limit <n>', 'max results', '20')
  .addHelpText('after', `
Examples:
  $ ${program.name()} fetch "keyword" --limit 50
  $ ${program.name()} fetch "api query"

Output: JSON to stdout
`);
```

### 5. Test All Commands

```bash
./cli.ts --help
./cli.ts fetch test
./cli.ts [each-command]
```

### 6. Update Documentation

```markdown
# Breaking Changes (v2.0.0)

Now uses Commander.js for better command organization.

**Migration:**
- All commands work the same
- Help text improved
- Added subcommand support

No API changes - drop-in replacement.
```

---

## 🔄 BEFORE/AFTER COMPARISON

### Before (Tier 1)
```typescript
// Manual parsing, ~350 lines
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  switch (command) {
    case 'fetch': /* ... */
    case 'create': /* ... */
    // ... 15 more cases
  }
}
```

### After (Tier 2)
```typescript
// Commander.js, ~250 lines (cleaner)
program
  .command('fetch <query>').action(fetchCommand)
  .command('create <name>').action(createCommand);
  // ... 15 more commands

program.parse();
```

---

## ✅ CHECKLIST

- [ ] Commander.js installed
- [ ] All commands converted
- [ ] Help text quality maintained
- [ ] All tests pass
- [ ] README updated (breaking changes)
- [ ] Version bumped to 2.0.0
- [ ] Users notified if published

---

**Note:** Most CLIs NEVER need this upgrade. Tier 1 is production-ready indefinitely.
