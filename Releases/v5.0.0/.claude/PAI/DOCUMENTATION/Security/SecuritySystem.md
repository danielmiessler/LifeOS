# PAI Security System v4.0 — Inspector Pipeline

Defense-in-depth via a composable inspector pipeline. Inspired by Block Goose's ToolInspector architecture.

> Constitutional security rules (external content = READ-ONLY, STOP and REPORT) are in the system prompt (`PAI/PAI_SYSTEM_PROMPT.md`). This file documents the security ARCHITECTURE.

---

## Architecture

Four hooks, one pipeline, five inspectors (four active, one disabled).

```
                    ┌─────────────────────────────────┐
 PreToolUse ───────►│  SecurityPipeline.hook.ts        │
                    │  ┌───────────────────────────┐  │
                    │  │ InspectorPipeline          │  │
                    │  │  1. PatternInspector (100)  │  │──► deny (exit 2)
                    │  │  2. EgressInspector  (90)   │  │──► require_approval (ask)
                    │  │  3. RulesInspector   (50)   │  │──► alert (log + allow)
                    │  │     (DISABLED — empty rules) │  │
                    │  └───────────────────────────┘  │──► allow (silent)
                    └─────────────────────────────────┘

 PostToolUse ──────► ContentScanner.hook.ts
                     InjectionInspector scans tool output
                     Advisory only — injects warning, cannot block

 PermissionRequest ► SmartApprover.hook.ts
                     Trusted workspace → auto-approve
                     Read operations → auto-approve
                     Write operations → user decides

 UserPromptSubmit ─► PromptGuard.hook.ts
                     PromptInspector scans user prompts
                     Heuristic-only (no LLM) — can block
```

### Inspector Pipeline Pattern

Every inspector implements:
```typescript
interface Inspector {
  name: string;
  priority: number;  // Higher = runs first
  inspect(ctx: InspectionContext): InspectionResult;
}
```

Results: `allow` | `deny` | `require_approval` | `alert`

Pipeline runs inspectors in priority order. Short-circuits on first `deny`. Accumulates `require_approval` (returns highest-priority). Returns `allow` only if all inspectors allow. Inspector errors are logged and skipped.

---

## Inspectors

### PatternInspector (priority 100)
Pattern-based command and path validation using `patterns.yaml`.

**Bash commands:** trusted → blocked → confirm → alert → allow
**File paths:** zeroAccess → alertAccess → confirmAccess → readOnly → confirmWrite → noDelete → allow

Fails closed if patterns.yaml is missing or corrupt.

### EgressInspector (priority 90)
Monitors outbound data in Bash commands.

- **Deny:** Credential patterns (`sk_live_`, `sk-ant-`, etc.) combined with outbound tools
- **Deny:** Pipe to shell (`| sh`, `| bash`, `| zsh`)
- **Alert:** HTTP POST, netcat, env dumps, inline interpreters

### RulesInspector (priority 50) — DISABLED
Previously evaluated tool calls against natural language rules in `SECURITY_RULES.md` via Haiku LLM call (~3s per unique tool call). All rules have been migrated to deterministic inspectors (PatternInspector, EgressInspector, PromptInspector). SECURITY_RULES.md is now empty, which auto-disables RulesInspector at zero cost. The inspector code remains in the pipeline for future use if custom LLM-evaluated rules are needed.

### PromptInspector (priority 95)
Scans user prompts for injection, exfiltration, evasion, and security disable attempts.

- **Injection:** instruction overrides, role reassignment, system impersonation
- **Exfiltration:** two-phase detection — sensitive data reference + outbound intent (both must match)
- **Evasion:** base64 decode, hex-encoded payloads
- **Security disable:** attempts to disable hooks, logging, monitoring
- Returns `deny` for block-severity patterns, `alert` for warn-severity
- Heuristic-only — no LLM inference (fast, deterministic, no cost)

### InjectionInspector (priority 80)
Scans tool output for prompt injection patterns.

- Instruction overrides, system impersonation, hidden instructions, urgency manipulation
- Returns `require_approval` (PostToolUse cannot block — advisory only)

---

## SmartApprover (PermissionRequest)

Three-tier permission model:

1. **Trusted workspace** (fast path, no LLM): `~/.claude/`, `~/Projects/`, `~/LocalProjects/` → auto-approve
2. **Read operations**: `ls`, `cat`, `git status`, `rg`, etc. → auto-approve
3. **Write operations**: everything else → user decides

Caches classification decisions per session.

---

## Hook Wiring (settings.json)

| Event | Hook | Behavior |
|-------|------|----------|
| PreToolUse (Bash, Write, Edit, MultiEdit) | `SecurityPipeline.hook.ts` | Pipeline: deny=exit(2), approval=ask, alert=log |
| PreToolUse (Skill) | Pulse HTTP `/hooks/skill-guard` | Fail-open |
| PreToolUse (Agent) | Pulse HTTP `/hooks/agent-guard` | Fail-open |
| PostToolUse (WebFetch, WebSearch) | `ContentScanner.hook.ts` | Advisory injection warning |
| PermissionRequest (Write\|Edit\|MultiEdit\|Bash) | `SmartApprover.hook.ts` | Auto-approve trusted/read, ask for write |
| UserPromptSubmit | `PromptGuard.hook.ts` | PromptInspector: injection, exfiltration, evasion |
| ConfigChange | `ConfigAudit.hook.ts` | Logs settings.json changes |

---

## File Map

### Hook Entry Points (`~/.claude/hooks/`)
| File | Event | Purpose |
|------|-------|---------|
| `SecurityPipeline.hook.ts` | PreToolUse | Runs inspector pipeline |
| `ContentScanner.hook.ts` | PostToolUse | Injection scanning |
| `SmartApprover.hook.ts` | PermissionRequest | Smart permission decisions |
| `PromptGuard.hook.ts` | UserPromptSubmit | PromptInspector — prompt security |

### Pipeline Core (`~/.claude/hooks/security/`)
| File | Purpose |
|------|---------|
| `types.ts` | InspectionResult, Inspector interface, SecurityEvent |
| `pipeline.ts` | InspectorPipeline orchestrator |
| `logger.ts` | Unified security event logging |

### Inspectors (`~/.claude/hooks/security/inspectors/`)
| File | Priority | Purpose |
|------|----------|---------|
| `PatternInspector.ts` | 100 | Pattern-based command/path validation |
| `PromptInspector.ts` | 95 | User prompt injection/exfiltration/evasion |
| `EgressInspector.ts` | 90 | Outbound data monitoring |
| `InjectionInspector.ts` | 80 | Tool output injection detection |
| `RulesInspector.ts` | 50 | User-written security rules via LLM (DISABLED — empty rules) |

### Policy Files (`~/.claude/PAI/USER/SECURITY/`)
| File | Purpose |
|------|---------|
| `PATTERNS.yaml` | Block/alert patterns and path protection tiers |
| `SECURITY_RULES.md` | User-written natural language BLOCK/ALLOW rules |
| `permission-cache.yaml` | SmartApprover cached classification decisions |

---

## Observatory Dashboard

The security page at `http://localhost:31337/security` provides a visual interface for managing the security system.

**Tabs:**
- **Policy** — Edit PATTERNS.yaml: blocked/alert/trusted commands, path protection tiers, security rules preview, injection defense patterns, PromptGuard categories
- **Rules** — Edit SECURITY_RULES.md: full textarea editor with save button
- **Events** — Recent security events from `MEMORY/SECURITY/YYYY/MM/`
- **Hooks** — Hook health status with expandable descriptions

**Architecture visual** at the top shows the inspector pipeline flow, other hooks (ContentScanner, SmartApprover, PromptGuard), and file paths with edit buttons.

**Deployment:**
```bash
cd ~/.claude/PAI/PULSE/Observability && bun run build
launchctl stop com.pai.pulse && launchctl start com.pai.pulse
# Then Cmd+Shift+R in browser
```

Pulse serves the dashboard from `Pulse/Observability/out` (configured in PULSE.toml).
Do NOT use `kill` to restart Pulse — launchd auto-restarts it with stale code. Always use `launchctl stop/start`.

---

## Policy Control

{{PRINCIPAL_NAME}} is the ONLY entity that can modify security policy. All security files are `readOnly`.

| What | File | Effect |
|------|------|--------|
| Command block/alert patterns | `patterns.yaml` → `bash.blocked/alert` | Immediate |
| File path protections | `patterns.yaml` → `paths.*` | Immediate |
| Natural language rules | `SECURITY_RULES.md` | Immediate (cached per session) |
| AI behavioral rules | `PAI_SYSTEM_PROMPT.md` | Next session |
| Hook wiring | `settings.json` → `hooks` | Immediate |

---

## Audit Trail

All security events log to `MEMORY/SECURITY/YYYY/MM/` with descriptive filenames:
- `security-block-*` — denied operations
- `security-confirm-*` — prompted operations
- `security-alert-*` — logged but allowed
- `prompt-guard-*` — UserPromptSubmit scan results

The `MEMORY/SECURITY/**` path is `readOnly` — the AI can create new logs but cannot modify existing ones.

---

## Limitations

| Limitation | Why |
|------------|-----|
| Bash can bypass file-tool path controls | `cat`, `echo >` via Bash are not subject to path-tier enforcement for Read/Write tools |
| PostToolUse cannot block | Content is already in conversation; scanner can only warn |
| Multi-step attacks invisible | Pipeline checks one tool call at a time |
| Pattern matching is incomplete | Regex cannot cover all shell obfuscation |
| RulesInspector adds latency | ~1-2s per unique tool call when SECURITY_RULES.md exists |
| SmartApprover heuristic-only | Read/write classification is pattern-based, not LLM-based |
| MCP tool gaps | `mcp__*` wildcard doesn't match plugin-sourced tools |
