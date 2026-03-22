# Installing LandingProcedure

Welcome to LandingProcedure — a safe exit protocol for deep work sessions.

This guide walks you through installation in four phases.

---

## Phase 1: System Analysis

Verify your environment supports the pack.

```bash
# Check that Claude Code is available
which claude && echo "Claude Code: OK" || echo "Claude Code: NOT FOUND"

# Check that the skills directory exists (or can be created)
ls ~/.claude/skills/ 2>/dev/null && echo "Skills directory: OK" || echo "Skills directory: will be created"

# Check that bun is available (needed for the hook)
which bun && echo "Bun runtime: OK" || echo "Bun runtime: NOT FOUND — install from https://bun.sh"
```

**Requirements:**
- Claude Code CLI installed and working
- `bun` runtime (for the hook file)
- `~/.claude/` directory exists

---

## Phase 2: User Questions

Before installing, decide:

1. **Where do you want the skill installed?**
   Default: `~/.claude/skills/LandingProcedure/`
   If you use a different skills directory, adjust the paths below.

2. **Do you want the hook installed?**
   The hook file (`LandingProcedure.hook.ts`) can be copied to `~/.claude/hooks/` for automatic detection. If you prefer to invoke the landing procedure manually (by asking your AI to run it), you can skip the hook installation.

---

## Phase 3: Installation

Run these commands from the pack's root directory (where this INSTALL.md lives):

```bash
# Create the skill directory
mkdir -p ~/.claude/skills/LandingProcedure/Tools
mkdir -p ~/.claude/skills/LandingProcedure/Workflows

# Copy skill definition
cp src/SKILL.md ~/.claude/skills/LandingProcedure/SKILL.md

# Copy the landing procedure tool
cp src/Tools/LandingProcedure.hook.ts ~/.claude/skills/LandingProcedure/Tools/LandingProcedure.hook.ts

# Copy the workflow
cp src/Workflows/Land.md ~/.claude/skills/LandingProcedure/Workflows/Land.md

# (Optional) Copy hook to hooks directory for auto-detection
mkdir -p ~/.claude/hooks
cp src/Tools/LandingProcedure.hook.ts ~/.claude/hooks/LandingProcedure.hook.ts
```

**Verify the files are in place:**

```bash
ls -la ~/.claude/skills/LandingProcedure/
ls -la ~/.claude/skills/LandingProcedure/Tools/
ls -la ~/.claude/skills/LandingProcedure/Workflows/
```

---

## Phase 4: Verification

Run the verification checks in [VERIFY.md](VERIFY.md) to confirm everything is working.

---

## Uninstall

To remove the pack:

```bash
rm -rf ~/.claude/skills/LandingProcedure/
rm -f ~/.claude/hooks/LandingProcedure.hook.ts
```
