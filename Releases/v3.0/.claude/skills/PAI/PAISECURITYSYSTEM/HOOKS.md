# SecurityValidator Hook Documentation

**How the security validation hook works**

---

## Overview

`SecurityValidator.hook.ts` is a PreToolUse hook that validates Bash commands and file operations against security patterns before execution. It prevents catastrophic operations while allowing normal development work.

---

## Trigger

- **Event:** PreToolUse
- **Matchers:** Bash, Edit, Write, Read

---

## Input

The hook receives JSON via stdin:

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "rm -rf /some/path"
  },
  "session_id": "abc-123-uuid"
}
```

For file operations:
```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.txt",
    "content": "..."
  },
  "session_id": "abc-123-uuid"
}
```

---

## Output

The hook communicates decisions via exit codes and stdout:

| Exit Code | Stdout | Result |
|-----------|--------|--------|
| 0 | `{"continue": true}` | Allow operation |
| 0 | `{"decision": "ask", "message": "..."}` | Prompt user for confirmation |
| 2 | (any) | Hard block - operation prevented |

---

## Pattern Loading

The hook loads patterns in this order:

1. **USER patterns** (primary): `skills/PAI/USER/PAISECURITYSYSTEM/patterns.yaml`
2. **SYSTEM patterns** (fallback): `skills/PAI/PAISECURITYSYSTEM/patterns.example.yaml`
3. **Fail-open**: If neither exists, allow all operations

This cascading approach ensures:
- Users can customize their own security rules
- New installations work with sensible defaults
- Missing configuration doesn't block work

---

## Pattern Matching

### Bash Commands

```yaml
bash:
  blocked:   # Hard block (exit 2)
    - pattern: "rm -rf /"
      reason: "Filesystem destruction"

  confirm:   # User prompt (exit 0 + JSON)
    - pattern: "git push --force"
      reason: "Force push can lose commits"

  alert:     # Log only
    - pattern: "curl.*\\|.*sh"
      reason: "Piping curl to shell"
```

Patterns are evaluated as regular expressions (case-insensitive).

### Path Protection

```yaml
paths:
  zeroAccess:    # Complete denial
    - "~/.ssh/id_*"

  readOnly:      # Can read, not write
    - "/etc/**"

  confirmWrite:  # Writing needs confirmation
    - "**/.env"

  noDelete:      # Cannot delete
    - ".git/**"
```

Path patterns use glob syntax:
- `*` matches any characters except `/`
- `**` matches any characters including `/`
- `~` expands to home directory

---

## Execution Flow

```
1. Parse stdin JSON
2. Load patterns (USER → SYSTEM → empty)
3. Determine tool type (Bash vs file operation)
4. For Bash: Check command against bash patterns
5. For files: Check path against path patterns
6. Log security event (all decisions)
7. Return decision (exit code + JSON)
```

---

## Security Event Logging

All decisions are logged as individual files: `MEMORY/SECURITY/YYYY/MM/security-{summary}-{timestamp}.jsonl`

Each event gets a descriptive filename (e.g., `security-block-filesystem-destruction-20260114-143052.jsonl`).

```json
{
  "timestamp": "2026-01-14T12:00:00.000Z",
  "session_id": "abc-123",
  "event_type": "block",
  "tool": "Bash",
  "category": "bash_command",
  "target": "rm -rf /",
  "pattern_matched": "rm -rf /",
  "reason": "Filesystem destruction",
  "action_taken": "blocked"
}
```

---

## Configuration

Enable the hook in `settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "command": "${PAI_DIR}/hooks/SecurityValidator.hook.ts"
        }]
      },
      {
        "matcher": "Edit",
        "hooks": [{
          "command": "${PAI_DIR}/hooks/SecurityValidator.hook.ts"
        }]
      },
      {
        "matcher": "Write",
        "hooks": [{
          "command": "${PAI_DIR}/hooks/SecurityValidator.hook.ts"
        }]
      },
      {
        "matcher": "Read",
        "hooks": [{
          "command": "${PAI_DIR}/hooks/SecurityValidator.hook.ts"
        }]
      }
    ]
  }
}
```

---

## Error Handling

The hook is designed to fail-open for usability:

| Error | Behavior |
|-------|----------|
| Missing patterns.yaml | Allow all operations |
| YAML parse error | Log warning, allow operation |
| Invalid pattern regex | Try literal match |
| Logging failure | Silent (doesn't block) |

---

## Performance

- **Blocking:** Yes (must complete before tool executes)
- **Typical execution:** <10ms
- **Design:** Fast path for safe operations, pattern matching only when needed
- **Caching:** Patterns are cached after first load

---

## Testing

Test the hook directly:

```bash
# Test a blocked command
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"},"session_id":"test"}' | \
  bun ~/.claude/hooks/SecurityValidator.hook.ts
# Should exit 2 (blocked)

# Test an allowed command
echo '{"tool_name":"Bash","tool_input":{"command":"ls -la"},"session_id":"test"}' | \
  bun ~/.claude/hooks/SecurityValidator.hook.ts
# Should output {"continue": true} and exit 0

# Test a confirm command
echo '{"tool_name":"Bash","tool_input":{"command":"git push --force"},"session_id":"test"}' | \
  bun ~/.claude/hooks/SecurityValidator.hook.ts
# Should output {"decision": "ask", ...} and exit 0
```

---

## Customization

To add custom patterns:

1. Create `skills/PAI/USER/PAISECURITYSYSTEM/patterns.yaml` (copy from `skills/PAI/PAISECURITYSYSTEM/patterns.example.yaml`)
2. Add patterns to appropriate sections
3. Patterns are loaded on next hook invocation (restart session)

Example custom pattern:
```yaml
bash:
  blocked:
    - pattern: "npm publish"
      reason: "Accidental package publish"
```
