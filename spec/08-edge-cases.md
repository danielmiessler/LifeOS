# PAI v5.0 — Edge Cases

## EC-01: Empty User Prompt [HIGH]
- **Behavior:** Mode classifier receives empty or whitespace-only prompt
- **Expected handling:** Route to minimal mode with "Please provide a task description" response
- **Source evidence:** Not explicitly handled in source — relies on model behavior

## EC-02: First-Run / Cold Start [HIGH]
- **Behavior:** System installed but no MEMORY/ or USER/ files exist yet
- **Expected handling:** (1) Initialize USER directory structure, (2) Run Interview workflow to populate identity, TELOS, preferences, (3) Create empty MEMORY/ compartments, (4) Present "Welcome — let's set up your DA" flow
- **Source evidence:** Installer script and Interview skill handle this

## EC-03: Concurrent Algorithm Runs [MEDIUM]
- **Behavior:** User initiates a new task while a previous Algorithm run is active
- **Expected handling:** Each Algorithm run gets its own WORK/{slug} directory. Session registry tracks active runs. The agent handles context switching between runs.
- **Source evidence:** Session registry at MEMORY/STATE/work.json tracks active sessions

## EC-04: Large Task >256 ISCs [MEDIUM]
- **Behavior:** A task at E5 requires 256+ ISCs, making the ISA document very large
- **Expected handling:** The ISA is split into manageable sections. The agent may use the ephemeral feature file pattern to work on subsets independently.
- **Source evidence:** ISA skill's ephemeral feature file pattern

## EC-05: Network Outage During Algorithm Execution [MEDIUM]
- **Behavior:** AI provider API becomes unavailable mid-Execution
- **Expected handling:** Retry with backoff (4 attempts). If still failing, (1) save current ISA state, (2) mark session as "interrupted," (3) resume from last completed phase when network returns.
- **Source evidence:** Not explicitly handled — relies on model provider SDK retry logic

## EC-06: ISA Stale During Long Sessions [MEDIUM]
- **Behavior:** A long Algorithm run (hours) has an ISA that becomes outdated as the work evolves
- **Expected handling:** The ISA is continuously updated. The changelog records all changes. When LEARN phase runs, the reconciliation process checks for drift between the ephemeral working state and the master ISA.
- **Source evidence:** ISA Reconcile workflow handles deterministic merge

## EC-07: Hook Race Condition [LOW]
- **Behavior:** Two hooks registered for the same lifecycle event execute in an unpredictable order
- **Expected handling:** Hooks are ordered by priority. If priority is equal, execution order is non-deterministic and hooks MUST be idempotent.
- **Source evidence:** Hook idempotency requirement (BR-13)

## EC-08: Pronunciation Rule Conflicts [LOW]
- **Behavior:** User has set two pronunciation rules that conflict (e.g., one says "read" → "reed", another says "read" → "red")
- **Expected handling:** Last rule in the file wins. The system should log a warning but continue.
- **Source evidence:** Pronunciation rules are compiled to a regex-to-replacement map, last match wins

## EC-09: Memory Tier Exhaustion [LOW]
- **Behavior:** WORK/ directory accumulates thousands of task directories over months of use
- **Expected handling:** The agent should periodically archive old tasks. The filesystem search (ripgrep) handles large directories efficiently — performance degradation is not expected. No explicit archive mechanism.

## EC-10: Telegram Message >4096 Characters [MEDIUM]
- **Behavior:** DA response exceeds Telegram's 4096-char message limit
- **Expected handling:** Response is split into multiple messages, each ≤4096 chars. Split happens at natural boundaries (paragraphs, sentences).
- **Source evidence:** Telegram module splits long responses

## EC-11: Multiple Simultaneous Messages on Telegram [MEDIUM]
- **Behavior:** User sends two messages before the first one is processed
- **Expected handling:** Second message gets "Still processing the previous request..." response. Messages are processed sequentially.
- **Source evidence:** Telegram module processes one message at a time; concurrent messages get the "Still processing" reply

## EC-12: iMessage Poll Race Condition [LOW]
- **Behavior:** iMessage poll reads a message that was just sent by the DA itself (echo loop)
- **Expected handling:** The iMessage module tracks the cursor (last processed row ID). Messages sent by the DA are not re-processed because the cursor has already advanced past them.
- **Source evidence:** cursor.json tracking in iMessage module

## EC-13: Pulse Port Conflict [LOW]
- **Behavior:** Port 31337 is already in use when Pulse starts
- **Expected handling:** Pulse exits with EADDRINUSE error. Launchd/systemd retries after 30s. User should check for another Pulse instance or configure a different port via PULSE_PORT.
- **Source evidence:** Bun.serve throws on port conflict

## EC-14: Cron Job Output Overflow [LOW]
- **Behavior:** A cron script produces >10KB output
- **Expected handling:** Output is truncated. Sentinels are checked against the first N characters. Full output is written to the job's log file.
- **Source evidence:** Job execution truncates large output

## EC-15: Cross-Vendor Audit Bias [LOW]
- **Behavior:** The cross-vendor auditor model agrees with the primary model on incorrect outputs (confirmation bias)
- **Expected handling:** The audit explicitly calls out assumptions and blind spots. This is a recognized limitation — the audit adds value through different provider behavior, not guaranteed correctness.
- **Source evidence:** Cross-vendor audit uses a different AI provider to reduce correlated failures

## EC-16: DA Identity Reset [LOW]
- **Behavior:** User runs installation again, overwriting ~/.claude/ directory
- **Expected handling:** Installer auto-backups existing ~/.claude/ to ~/.claude.backup-{TIMESTAMP}. User can restore from backup.
- **Source evidence:** Installer script auto-backup behavior specified in README

## EC-17: Hooks Volume / Performance [LOW]
- **Behavior:** With 37+ hooks, each PreToolUse event triggers all of them, slowing down every tool call
- **Expected handling:** Hooks are lightweight and synchronous. The overhead of running 37 hooks per tool call should be <50ms total. If performance degrades, hooks should be optimized or made conditional.
- **Source evidence:** Not explicitly addressed — relies on hook implementations being lightweight

## EC-18: Missing Thinking Capability [MEDIUM]
- **Behavior:** The Algorithm attempts to invoke a thinking capability that is not installed or not available
- **Expected handling:** The capability is skipped with a log entry. The Algorithm continues with available capabilities. Features requiring the missing capability are flagged as "needs review."
- **Source evidence:** The Algorithm references a closed list of 19+ capabilities

## EC-19: ISA Frontmatter Corruption [LOW]
- **Behavior:** An ISA file has corrupted or missing YAML frontmatter
- **Expected handling:** Attempt to reconstruct frontmatter from file content and path. If unrecoverable, generate minimal frontmatter from environment and flag for manual review.
- **Source evidence:** Not explicitly handled — relies on atomic writes to prevent corruption

## EC-20: Script CWD Not a Task [LOW]
- **Behavior:** Agent is invoked from a directory that is not a known project and has no active ISA
- **Expected handling:** Use current directory as the context. If no task ISA exists, skip Algorithm and use standard processing. The user can create an ISA later with `Skill("ISA", "scaffold from prompt")`.
