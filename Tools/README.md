<p align="center">
  <img src="utilities-icon.png" alt="PAI Utilities" width="128">
</p>

# Utilities

> **FOR AI AGENTS:** This directory contains tools for maintaining PAI installations.

---

## Contents

### validate-protected.ts

**Security Validation**

Validates that PAI repository files don't contain sensitive data before committing. Used by the pre-commit hook automatically.

### BackupRestore.ts

**Backup and Restore**

Create and restore backups of PAI installations.

```bash
bun BackupRestore.ts backup                    # Create timestamped backup
bun BackupRestore.ts backup --name "pre-v3"    # Named backup
bun BackupRestore.ts list                      # List backups
bun BackupRestore.ts restore <backup-name>     # Restore
```

### PhaseGate.hook.ts

**Algorithm Gate Enforcement (Claude Code Hook)**

Watches PRD.md edits and warns when the AI transitions to THINK without an `ENVIRONMENT:` check or to BUILD without a `VALIDATE:` entry in `## Decisions`. Warning mode only — never blocks execution.

Register as a Claude Code PostToolUse hook:
```json
{ "matcher": "Write", "hooks": [{ "type": "command", "command": "~/.claude/Tools/PhaseGate.hook.ts" }] }
{ "matcher": "Edit",  "hooks": [{ "type": "command", "command": "~/.claude/Tools/PhaseGate.hook.ts" }] }
```

### ReflectionDigest.ts

**Reflection-to-Action Loop**

Reads `algorithm-reflections.jsonl`, clusters failure patterns, identifies missed capabilities, and generates ranked heuristic rules. Closes the gap between writing reflections and acting on them.

```bash
bun ReflectionDigest.ts            # Write digest to MEMORY/LEARNING/
bun ReflectionDigest.ts --dry-run  # Print without writing
```

Run every ~10 Algorithm sessions to keep the digest current.

---

## Quick Reference

| File | Purpose |
|------|---------|
| validate-protected.ts | Validate no sensitive data in commits |
| BackupRestore.ts | Backup and restore PAI installations |
| PhaseGate.hook.ts | Enforce VALIDATE and ENVIRONMENT gates via PRD check |
| ReflectionDigest.ts | Extract failure patterns from reflections into heuristics |

---

*Part of the [PAI (Personal AI Infrastructure)](https://github.com/danielmiessler/PAI) project.*
