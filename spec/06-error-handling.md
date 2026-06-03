# PAI v5.0 — Error Handling

## ER-01: Hook Failure [MEDIUM]
- **Symptom:** A lifecycle hook throws an exception or returns an error status
- **Handling:** The hook is skipped for the current event. An error entry is written to OBSERVABILITY. The main operation continues — hooks MUST NOT block the main execution flow unless they are security hooks.
- **Security hook exception:** ContainmentGuard, SecurityPipeline, and PromptGuard hooks CAN block the operation. If a security hook fails, the operation is denied with a descriptive message.
- **Recovery:** No automatic retry. Next event will trigger the hook again.

## ER-02: Voice Notification Failure [MEDIUM]
- **Symptom:** curl to localhost:31337/notify fails (server down, timeout, connection refused)
- **Handling:** The notification is silently dropped. The calling operation continues normally.
- **Recovery:** The notification curl is a fire-and-forget background process. No retry.
- **User impact:** User hears no voice notification but the work still completes.

## ER-03: ISA Scaffold Validation Failure [HIGH]
- **Symptom:** ISA fails CheckCompleteness at the required tier
- **Handling:** The system returns to OBSERVE phase with a list of missing/incomplete sections. The agent fills gaps and re-checks.
- **Prevention:** Scaffold workflow includes explicit anti-criteria check.

## ER-04: ISC Verification Failure [HIGH]
- **Symptom:** An ISC verification returns "fail"
- **Handling:** The ISC is marked as failed with evidence. The system either: (1) revises the ISA approach and re-executes, or (2) downgrades the feature scope and documents the gap.
- **Escalation:** If >20% of ISCs fail, the entire Algorithm run is flagged for human review.

## ER-05: Skill Not Found [MEDIUM]
- **Symptom:** Skill('Unknown', 'action') called — no skill matches the name
- **Handling:** Log error to execution log. Return error to caller. The calling operation SHOULD continue with a fallback approach.
- **Prevention:** Skills validate their dependencies at invocation time.

## ER-06: External API Timeout [MEDIUM]
- **Symptom:** External API (research, scraping, voice TTS) times out or returns an error
- **Handling:** Retry once with backoff. If still failing: (1) log the failure to OBSERVABILITY, (2) proceed with degraded functionality, (3) return partial results where possible.
- **Degradation matrix:** Research → return available results with "partial" flag. Scraping → return what was fetched. Voice → silent notification (desktop only), no TTS.

## ER-07: Model Provider Overload [LOW]
- **Symptom:** Model provider returns rate-limit errors or 5xx responses
- **Handling:** Exponential backoff (1s, 2s, 4s, 8s). After 4 retries, fail the current phase and return partial results.
- **User notification:** "Provider is rate-limited. Results may be incomplete."

## ER-08: Billing Key Exposure [CRITICAL]
- **Symptom:** An API key was detected in an environment variable during subprocess spawn
- **Handling:** The key is stripped before spawning. An alert is logged to OBSERVABILITY.
- **Prevention:** Three-layer stripping: process env, per-module before SDK calls, per-subprocess before spawn.

## ER-09: Containment Zone Violation [HIGH]
- **Symptom:** A PreToolUse hook detects a write to a zone the caller does not have permission to write to
- **Handling:** The write is blocked. An error message is returned: "Cannot write to [path]. This path is in [zone] and [caller] does not have write access."
- **Logging:** The violation is logged with source and target path.

## ER-10: Memory Path Not Found [MEDIUM]
- **Symptom:** Agent tries to read a memory path that doesn't exist
- **Handling:** Return empty state gracefully. The system should initialize the directory structure lazily on first write.

## ER-11: Session Registry Corruption [LOW]
- **Symptom:** MEMORY/STATE/work.json is unparseable (corrupted JSON)
- **Handling:** Initialize with empty registry. Archive corrupted file with `.corrupted-{timestamp}` suffix. Log the corruption to OBSERVABILITY.

## ER-12: Pulse Daemon Startup Failure [MEDIUM]
- **Symptom:** Pulse fails to start — port in use, module load failure, config parse error
- **Handling:** Log specific error. Exit with non-zero code. launchd/systemd will restart automatically (keep-alive: 30s throttle).
- **Graceful degradation:** Without Pulse: no voice, no dashboard, no hooks, no cron. Core Algorithm still works.

## ER-13: Cron Job Failure (Consecutive) [LOW]
- **Symptom:** A cron job returns non-zero exit 3 times consecutively
- **Handling:** The job is automatically paused. A notification is sent to configured targets: "Job [name] paused after 3 consecutive failures." Manual intervention required to resume.

## ER-14: Telegram Authentication Failure [MEDIUM]
- **Symptom:** A message arrives from an unauthorized chat ID
- **Handling:** Message is silently dropped. No response sent. No logging of message content (privacy).
- **Audit:** Anonymized record (timestamp + attempted auth only) written to audit log.

## ER-15: iMessage Database Lock [LOW]
- **Symptom:** SQLite chat.db returns "database is locked" on poll
- **Handling:** Skip this poll cycle (3s). On next cycle, retry. If persistent (>5 consecutive failures), log error and continue polling.

## ER-16: Knowledge Graph File Not Found [LOW]
- **Symptom:** A wikilink `[[Target Page]]` points to a file that doesn't exist
- **Handling:** The link is displayed as unresolved (TBD or pending). Backlink index still tracks them. Startup validation SHOULD flag orphaned links but MUST NOT fail.

## ER-17: Skill Description Mismatch [MEDIUM]
- **Symptom:** A skill is incorrectly invoked because its description matched a prompt it wasn't designed for
- **Handling:** The skill should detect the mismatch at workflow routing and return a clear "This skill is not appropriate for this request" message with suggestions for which skill to use instead.
- **Prevention:** Every skill description includes "NOT FOR" negative disambiguation.
