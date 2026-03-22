# Installing WorkCompletionLearning

Welcome to WorkCompletionLearning. This guide walks you through installing the SessionEnd hook that captures structured learning files from completed work sessions.

## Phase 1: System Analysis

Run these checks to confirm your environment is ready.

```bash
# Check that bun is installed (required runtime)
bun --version

# Check that ~/.claude exists
ls -d ~/.claude

# Check that MEMORY directories exist (or will be created)
ls ~/.claude/MEMORY 2>/dev/null || echo "MEMORY directory will be created during install"

# Check for existing hooks directory
ls ~/.claude/hooks 2>/dev/null || echo "hooks directory will be created during install"
```

**Requirements:**
- bun runtime (the hook uses `#!/usr/bin/env bun`)
- Write access to `~/.claude/`
- PAI directory structure (or willingness to create it)

## Phase 2: User Questions

Before installing, decide:

1. **Timezone:** What timezone should timestamps use? The hook reads from `principal.timezone` in your PAI settings. Default is UTC. Set this in your `settings.json` if you have one, or the hook will use UTC.

2. **PAI_DIR:** Is your PAI root at `~/.claude`? If not, set the `PAI_DIR` environment variable to your actual root.

3. **Hook ordering:** If you have other SessionEnd hooks (like SessionCleanup), WorkCompletionLearning should run before them. It captures state that cleanup hooks may clear.

## Phase 3: Installation

```bash
# Create required directories
mkdir -p ~/.claude/hooks/lib
mkdir -p ~/.claude/MEMORY/STATE
mkdir -p ~/.claude/MEMORY/WORK
mkdir -p ~/.claude/MEMORY/LEARNING/ALGORITHM
mkdir -p ~/.claude/MEMORY/LEARNING/SYSTEM

# Copy the hook
cp src/Tools/WorkCompletionLearning.hook.ts ~/.claude/hooks/WorkCompletionLearning.hook.ts

# Copy library dependencies
cp src/lib/learning-utils.ts ~/.claude/hooks/lib/learning-utils.ts
cp src/lib/time.ts ~/.claude/hooks/lib/time.ts

# Make the hook executable
chmod +x ~/.claude/hooks/WorkCompletionLearning.hook.ts
```

### Hook Registration

Add the hook to your Claude Code hooks configuration. In your `.claude/settings.json` (or project-level settings), add:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "command": "bun run ~/.claude/hooks/WorkCompletionLearning.hook.ts",
        "timeout": 10000
      }
    ]
  }
}
```

If you already have SessionEnd hooks, add this entry to the existing array. Place it before any cleanup hooks.

### Library Dependencies

The `time.ts` utility imports from `./identity`. If you do not have an identity module, create a minimal one:

```bash
cat > ~/.claude/hooks/lib/identity.ts << 'EOF'
export function getPrincipal(): { timezone?: string } {
  try {
    const fs = require('fs');
    const path = require('path');
    const settingsPath = path.join(process.env.HOME || '', '.claude', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    return settings.principal || {};
  } catch {
    return {};
  }
}
EOF
```

Or, if you already have a PAI identity module, ensure it exports `getPrincipal()` with a `timezone` field.

## Phase 4: Verification

Run the checks in [VERIFY.md](VERIFY.md) to confirm everything is installed correctly.
