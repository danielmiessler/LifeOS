# PAI v5.0 — Test Catalog

## TC-01: Algorithm Classification Tests [HIGH]

| ID | Test | Expected |
|----|------|----------|
| TC-01-01 | Input "What's the weather?" → Classification | MINIMAL mode, no effort tier |
| TC-01-02 | Input "Help me debug this error: ..." → Classification | NATIVE or ALGORITHM mode |
| TC-01-03 | Input "Build a web scraper for example.com" → Classification | ALGORITHM mode, E3 or higher |
| TC-01-04 | Phase sequence invariance | Phases always in order O→T→P→B→E→V→L |
| TC-01-05 | Loop mode — Algorithm wraps correctly | LEARN → OBSERVE transition preserves state |

## TC-02: ISA Scaffold Tests [HIGH]

| ID | Test | Expected |
|----|------|----------|
| TC-02-01 | Scaffold at tier E1 | Only Goal + Criteria sections populated |
| TC-02-02 | Scaffold at tier E3 | 8 sections populated, ≥32 ISCs |
| TC-02-03 | Scaffold at tier E5 | All 12 sections, ≥256 ISCs, Interview before BUILD |
| TC-02-04 | Anti-criteria check | At least 1 Anti: ISC present at all tiers |
| TC-02-05 | CheckCompleteness passes for valid ISA | Returns pass with section count + ISC count |
| TC-02-06 | CheckCompleteness fails for missing sections | Returns specific missing sections |
| TC-02-07 | Reconcile — deterministic merge | Same inputs → same merged ISA |
| TC-02-08 | Reconcile — conflicting changes | Latest timestamp wins for same ISC ID |

## TC-03: ISC Verification Tests [HIGH]

| ID | Test | Expected |
|----|------|----------|
| TC-03-01 | ISC pass — valid evidence | Status = pass, evidence recorded |
| TC-03-02 | ISC fail — invalid evidence | Status = fail, evidence recorded |
| TC-03-03 | ISC ID stability — no renumbering on edit | ID unchanged |
| TC-03-04 | ISC split — children created | ISC-7 → ISC-7.1, ISC-7.2 |
| TC-03-05 | ISC tombstone — dropped ISC | ID preserved with "superseded" status |
| TC-03-06 | All ISCs verified → phase complete | Algorithm advances to LEARN |
| TC-03-07 | Failed ISCs → re-execute | Algorithm returns to EXECUTE with revised ISA |

## TC-04: Skill System Tests [HIGH]

| ID | Test | Expected |
|----|------|----------|
| TC-04-01 | Skill invocation by name | Correct skill loaded |
| TC-04-02 | Workflow routing — exact match | Correct workflow file loaded |
| TC-04-03 | Workflow routing — no match | Fallback/default workflow used |
| TC-04-04 | Cross-skill invocation | Target skill executed, result returned |
| TC-04-05 | Skill customization loaded | Customization overrides skill defaults |
| TC-04-06 | Skill customization not found | Skill uses defaults |
| TC-04-07 | Voice notification fired on invoke | curl POST to /notify succeeds |
| TC-04-08 | Execution log appended | JSON line written to execution.jsonl |
| TC-04-09 | Skill description disambiguation | "NOT FOR" patterns prevent false invocation |

## TC-05: Memory System Tests [HIGH]

| ID | Test | Expected |
|----|------|----------|
| TC-05-01 | WORK/ task directory created on Algorithm start | `MEMORY/WORK/{slug}/` exists |
| TC-05-02 | ISA written to WORK/ | `MEMORY/WORK/{slug}/ISA.md` exists |
| TC-05-03 | ISA read from WORK/ | Content matches written content |
| TC-05-04 | KNOWLEDGE entity created | File exists in KNOWLEDGE/People|Companies|Ideas/ |
| TC-05-05 | KNOWLEDGE entity cross-referenced | Wikilink resolves to another entity |
| TC-05-06 | LEARNING pattern written | File exists in MEMORY/LEARNING/ |
| TC-05-07 | Memory survives restart | Files persist on disk |
| TC-05-08 | WORK/ is task-scoped | Two different tasks have different WORK/ directories |

## TC-06: Hook System Tests [HIGH]

| ID | Test | Expected |
|----|------|----------|
| TC-06-01 | SessionStart hook fires | Hook handler executes |
| TC-06-02 | PreToolUse hook fires before tool call | Hook output available before tool executes |
| TC-06-03 | PostToolUse hook fires after tool call | Hook sees tool output |
| TC-06-04 | PreCompact hook fires before compaction | State saved before compaction |
| TC-06-05 | Stop hook fires on session end | Cleanup executed |
| TC-06-06 | Security hook blocks operation | Operation denied with reason |
| TC-06-07 | Non-security hook failure doesn't block | Main operation continues |
| TC-06-08 | Hook idempotency check | Same inputs → same side effects |

## TC-07: Containment Zone Tests [HIGH]

| ID | Test | Expected |
|----|------|----------|
| TC-07-01 | Z1 write to Z6 blocked | Operation denied |
| TC-07-02 | Z6 write to Z6 allowed | Operation proceeds |
| TC-07-03 | Zone policy correctly loaded | All zones have correct paths |
| TC-07-04 | Cross-zone write logs violation | Audit log entry created |

## TC-08: Security Release Tests [HIGH]

| ID | Test | Expected |
|----|------|----------|
| TC-08-01 | API key in release artifact detected | Gate G1 fails |
| TC-08-02 | PII in release artifact detected | Gate G4 fails |
| TC-08-03 | Clean release passes all gates | All gates pass |
| TC-08-04 | Two-stage — stage → review → publish | Never auto-chains |

## TC-09: Pulse Dashboard Tests [MEDIUM]

| ID | Test | Expected |
|----|------|----------|
| TC-09-01 | Health endpoint returns OK | 200 + status:ok |
| TC-09-02 | Voice notification endpoint | 200 + notified:true |
| TC-09-03 | Wiki search returns results | 200 + results array |
| TC-09-04 | Performance endpoint returns data | 200 + metrics |

## TC-10: Cron Job Tests [MEDIUM]

| ID | Test | Expected |
|----|------|----------|
| TC-10-01 | Job scheduled at X:00 runs at X:00 | Executed |
| TC-10-02 | Job output dispatched to voice target | /notify called |
| TC-10-03 | Sentinel output suppresses dispatch | No dispatch |
| TC-10-04 | Consecutive failure pause | Paused after 3 failures |
| TC-10-05 | Job execution logged | Entry in state.json |

## TC-11: DA Identity Tests [MEDIUM]

| ID | Test | Expected |
|----|------|----------|
| TC-11-01 | DA identity loaded at session start | Name, voice, personality available |
| TC-11-02 | User identity loaded at session start | Name, role, goals available |
| TC-11-03 | Telos influences task output | Task approach aligns with stated goals |

## TC-12: External Channel Tests [MEDIUM]

| ID | Test | Expected |
|----|------|----------|
| TC-12-01 | Authorized Telegram user → response | Message processed and responded to |
| TC-12-02 | Unauthorized Telegram user → silent | Message dropped |
| TC-12-03 | Telegram message >4096 chars → split | Multiple messages sent |
| TC-12-04 | Concurrent Telegram messages → sequential | Second gets "still processing" |

## TC-13: Error Recovery Tests [MEDIUM]

| ID | Test | Expected |
|----|------|----------|
| TC-13-01 | Hook failure → main operation continues | Operation completes |
| TC-13-02 | Voice TTS failure → silent notification | No TTS, operation continues |
| TC-13-03 | Skill not found → graceful fallback | Error logged, caller continues |
| TC-13-04 | External API timeout → retry → degrade | Partial results returned |
| TC-13-05 | Session registry corruption → reinit | Empty registry + archived corruption |

## TC-14: Performance Tests [MEDIUM]

| ID | Test | Expected |
|----|------|----------|
| TC-14-01 | Algorithm OBSERVE phase < 30s | Fast classification + ISA scaffold |
| TC-14-02 | Hook execution < 50ms total per event | 37 hooks < 50ms overhead |
| TC-14-03 | Knowledge search < 2s (1K pages) | ripgrep-level performance |
| TC-14-04 | Pulse cron loop < 100ms overhead | Sleep time dominates |

## TC-15: Cross-Vendor Audit Tests [MEDIUM]

| ID | Test | Expected |
|----|------|----------|
| TC-15-01 | E4 task audited by second provider | Audit record created |
| TC-15-02 | E5 task audited by second provider | Audit record created |
| TC-15-03 | E2 task NOT audited | No cross-vendor call made |
| TC-15-04 | Audit finds issue → revision | ISA revised per findings |
