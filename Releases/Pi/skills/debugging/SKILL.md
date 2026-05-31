---
name: debugging
description: Structured debugging and root cause analysis. Problem isolation, hypothesis testing, binary search, log analysis, reproduction strategies, RCA patterns. USE WHEN debug, fix, error, bug, issue, crash, failure, malfunction, defect, troubleshoot, root cause, diagnose, problem isolation.
metadata:
  author: pai
  version: 1.0.0
---

# Debugging — Root Cause Analysis

## Structured Process

1. **Reproduce** — Get a reliable reproducer (steps, input, conditions)
2. **Isolate** — Find minimal case. Binary search (halve the system).
3. **Hypothesize** — List possible causes. Rank by likelihood.
4. **Test** — One hypothesis at a time. Change only one variable.
5. **Confirm** — Verify root cause. Fix should eliminate the bug.
6. **Prevent** — Add tests, guards, or monitoring to prevent recurrence.

## Isolation Techniques

| Technique | When |
|-----------|------|
| Binary search | Large input space |
| Divide and conquer | Modular system |
| Delta debugging | Complex configuration |
| Log tracing | Distributed system |
| Watchpoints | State mutation issues |
| Minimal repro | User-reported bugs |

## RCA Patterns

- **Off-by-one**: Check boundary conditions
- **Race condition**: Look for shared state without synchronization
- **Null/undefined**: Trace initialization paths
- **Type confusion**: Verify runtime types match expectations
- **Resource leak**: Track allocation/deallocation pairs
- **Configuration drift**: Compare actual vs expected settings

## Verification

After applying a fix:
1. The original reproducer no longer triggers the bug
2. Existing tests still pass
3. Edge cases around the fix work correctly
4. The fix doesn't introduce new failure modes
