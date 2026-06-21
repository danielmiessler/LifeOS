---
workflow: add-command
purpose: Add new command to existing CLI
---

# Add Command Workflow

**Extend existing CLI with new commands while maintaining code quality and consistency.**

---

## 🎯 PURPOSE

Add one or more commands to an existing CLI without breaking existing functionality.

---

## 📍 WHEN TO USE

- User requests: "Add [command] to [CLI]"
- "Extend [CLI] with [feature]"
- "My CLI needs to do [X] too"

---

## 📋 STEPS

### 1. Locate Existing CLI

```bash
# Find CLI location
ls -la ~/.claude/Bin/[cli-name]/
# or
ls -la ~/Projects/[project]/
```

### 2. Read Current Structure

```typescript
// Identify:
// - Existing commands (in switch statement)
// - Interface definitions
// - Help text structure
```

### 3. Add Interface (if needed)

```typescript
// Add response interface
interface NewCommandResponse {
  // ... based on API/data
}
```

### 4. Implement Command Function

```typescript
/**
 * [Command description]
 */
async function newCommand(
  arg: string,
  options: { flag?: boolean } = {}
): Promise<void> {
  const config = loadConfig();

  // Validation
  if (!arg) {
    console.error('Error: argument required');
    process.exit(1);
  }

  // Implementation
  const result = await fetchData(config, arg);

  // Output
  console.log(JSON.stringify(result, null, 2));
}
```

### 5. Add to Switch Statement

```typescript
switch (command) {
  // ... existing cases

  case 'newcommand':
    await newCommand(args[1], options);
    break;

  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
```

### 6. Update Help Text

```typescript
COMMANDS:
  existing-cmd                  Description
  newcommand <arg>              New command description   // ← Add
  help, --help, -h              Show help

EXAMPLES:
  # New command examples                                   // ← Add
  $ mycli newcommand value
  $ mycli newcommand value --flag
```

### 7. Update README

Add to command list and examples section.

### 8. Test

```bash
./cli.ts newcommand test-value
./cli.ts --help  # Verify new command listed
```

---

## ✅ QUALITY CHECKLIST

- [ ] Command function implemented
- [ ] Added to switch statement
- [ ] Help text updated
- [ ] README updated
- [ ] Tested and working
- [ ] Error handling added
- [ ] TypeScript compiles

---

**Example: Adding "search" to existing "list/create" CLI**

```typescript
// Before: list, create
// After: list, create, search ← new

async function search(keyword: string, limit: number = 20): Promise<void> {
  // Implementation
}

// Add to switch
case 'search':
  await search(args[1], parseLimit(args));
  break;
```
