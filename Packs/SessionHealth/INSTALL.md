# Installing SessionHealth

Welcome to SessionHealth — a watchdog that monitors session age and turn count to prevent context degradation.

This guide walks you through installation in four phases.

---

## Phase 1: System Analysis

Verify your environment supports the pack.

```bash
# Check that Claude Code is available
which claude && echo "Claude Code: OK" || echo "Claude Code: NOT FOUND"

# Check that bun is available (required for the hook)
which bun && echo "Bun runtime: OK" || echo "Bun runtime: NOT FOUND — install from https://bun.sh"

# Check that the skills directory exists (or can be created)
ls ~/.claude/skills/ 2>/dev/null && echo "Skills directory: OK" || echo "Skills directory: will be created"

# Check that the hooks directory exists (or can be created)
ls ~/.claude/hooks/ 2>/dev/null && echo "Hooks directory: OK" || echo "Hooks directory: will be created"
```

**Requirements:**
- Claude Code CLI installed and working
- `bun` runtime (required — the hook is a TypeScript file executed by bun)
- `~/.claude/` directory exists

---

## Phase 2: User Questions

Before installing, decide:

1. **What are your warning thresholds?**
   Defaults: 8 hours / 12 hours for session age, 500 / 800 for turn count.
   If these don't match your work patterns, edit the constants at the top of `SessionHealthCheck.hook.ts` before installing.

2. **Do you have a session-start timestamp writer?**
   SessionHealth reads `/tmp/pai-session-start.txt` to calculate session age. Something needs to write a Unix timestamp (milliseconds) to that file when a session starts. If you don't have one, the hook will still track turn counts — it just won't know session age.

   To create a minimal session-start writer, add this to your session startup:
   ```bash
   echo $(date +%s%3N) > /tmp/pai-session-start.txt
   ```

---

## Phase 3: Installation

Run these commands from the pack's root directory (where this INSTALL.md lives):

```bash
# Create the skill directory
mkdir -p ~/.claude/skills/SessionHealth/Tools
mkdir -p ~/.claude/skills/SessionHealth/Workflows

# Copy skill definition
cp src/SKILL.md ~/.claude/skills/SessionHealth/SKILL.md

# Copy the watchdog hook
cp src/Tools/SessionHealthCheck.hook.ts ~/.claude/skills/SessionHealth/Tools/SessionHealthCheck.hook.ts

# Copy the workflow
cp src/Workflows/Monitor.md ~/.claude/skills/SessionHealth/Workflows/Monitor.md

# Install the hook for automatic execution
mkdir -p ~/.claude/hooks
cp src/Tools/SessionHealthCheck.hook.ts ~/.claude/hooks/SessionHealthCheck.hook.ts
chmod +x ~/.claude/hooks/SessionHealthCheck.hook.ts
```

**Verify the files are in place:**

```bash
ls -la ~/.claude/skills/SessionHealth/
ls -la ~/.claude/skills/SessionHealth/Tools/
ls -la ~/.claude/skills/SessionHealth/Workflows/
ls -la ~/.claude/hooks/SessionHealthCheck.hook.ts
```

---

## Phase 4: Verification

Run the verification checks in [VERIFY.md](VERIFY.md) to confirm everything is working.

---

## Uninstall

To remove the pack:

```bash
rm -rf ~/.claude/skills/SessionHealth/
rm -f ~/.claude/hooks/SessionHealthCheck.hook.ts
rm -f /tmp/pai-session-start.txt
rm -f /tmp/pai-session-turns.json
```
