---
name: automation
description: Recurring job patterns and automation workflows. Cron-equivalent scheduling, polling patterns, event-driven triggers, idempotency, error notification, and state management. USE WHEN automate, cron, schedule, periodic, recurring, poll, batch job, scheduled task, trigger, workflow automation.
metadata:
  author: pai
  version: 1.0.0
---

# Automation — Recurring Jobs

## Job Patterns

| Pattern | Use Case | Trigger |
|---------|----------|---------|
| **Cron** | Fixed schedule (hourly, daily) | Time-based |
| **Poll** | Check for changes | Interval + diff detection |
| **Event** | React to signals | Webhook, topic, stream |
| **Chain** | Sequential processing | Previous job completion |
| **Idempotent** | Safe re-runs | Any trigger (run multiple times) |

## Scheduling Rules

- **Cron expression**: minute hour day month weekday
- **Polling interval**: Never less than 60s between checks
- **Timeout**: Each job must define a max duration
- **Retry**: 3 attempts with exponential backoff (1s, 4s, 16s)
- **Dead letter**: After 3 failures, notify and stop

## State Management

Store job state (last run, cursor, checkpoint) for:
- **Resumability**: Continue from where it left off
- **Idempotency**: Skip already-processed items
- **Monitoring**: Track success/failure rates

## Design Principles

1. **Idempotency first** — Running the same job twice produces the same outcome
2. **Fail fast** — Validate inputs before starting work
3. **Observable** — Log start, progress, and completion
4. **Isolated** — Jobs don't interfere with each other
