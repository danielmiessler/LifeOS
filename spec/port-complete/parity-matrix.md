# PAI v5.0 → Target Parity Matrix

## Spec Item → Source → Target Coverage

| Spec ID | Description | Source (PAI v5.0) | Hermes | Pi-mono | OpenCode | Status |
|---------|-------------|--------------------|--------|---------|----------|--------|
| FR-01 | Algorithm 7-phase loop | ALGORITHM/v6.3.0.md | ✅ pai-algorithm skill | ✅ SYSTEM.md + pai-core | ✅ SYSTEM.md | PASS |
| FR-02 | Effort tier classification | ALGORITHM/v6.3.0.md | ✅ pai-algorithm skill | ✅ pai-core (tier-gated ISA) | ✅ SYSTEM.md | PASS |
| FR-03 | Mode classification | PAI_SYSTEM_PROMPT.md | ✅ pai-algorithm skill | ✅ AGENTS.md | ✅ SYSTEM.md | PASS |
| FR-04 | ISA scaffolding | ISA/SKILL.md | ✅ pai-isa skill | ✅ pai-core (isa_scaffold) | ✅ ISA.md | PASS |
| FR-05 | Criteria-driven verification | ISA/SKILL.md | ✅ pai-isa skill | ✅ pai-core (CheckCompleteness) | ✅ SYSTEM.md | PASS |
| FR-06 | Skill routing | 45 skills in .claude/skills/ | ⚠️ 5 core skills ported | ⚠️ 9 existing + upgrades | ❌ No skill system | PARTIAL |
| FR-07 | Skill customization | USER/SKILLCUSTOMIZATIONS/ | ✅ Documented in skills | ❌ Not ported | ❌ N/A | PARTIAL |
| FR-08 | Voice notification | PULSE/voice.ts | ❌ No voice pipeline | ❌ Not ported | ❌ Not ported | MISSING |
| FR-09 | Life Dashboard | PULSE/observability | ❌ No dashboard | ❌ Not ported | ❌ Not ported | MISSING |
| FR-10 | Memory persistence | PAI/MEMORY/ | ✅ pai/MEMORY/ structure | ✅ memory/ directory | ✅ MEMORY/README.md | PASS |
| FR-11 | Knowledge graph | KNOWLEDGE/ entities | ✅ pai-knowledge skill | ✅ memory/ structure | ✅ MEMORY/README.md | PASS |
| FR-12 | Hook lifecycle | 37 hooks in .claude/hooks/ | ❌ No hook system | ❌ No hook system | ❌ N/A | MISSING |
| FR-13 | Containment zones | hooks/lib/containment-zones.ts | ❌ Not ported | ❌ Not ported | ❌ Not ported | MISSING |
| FR-14 | Secure release | .pai-protected.json | ❌ Not ported | ❌ Not ported | ❌ Not ported | MISSING |
| FR-15 | Agent composition | agents/ (18 agents) | ❌ Not ported | ❌ Not ported | ❌ Not ported | MISSING |
| FR-16 | Delegation | skills/Delegation/ | ⚠️ Hermes `delegate_task` | ❌ Not ported | ❌ N/A | PARTIAL |
| FR-17 | DA identity | USER/DA_IDENTITY.md | ✅ USER/DA_IDENTITY.md | ✅ AGENTS.md | ✅ SYSTEM.md | PASS |
| FR-18 | User identity | USER/PRINCIPAL_IDENTITY.md | ✅ USER/PRINCIPAL_IDENTITY.md | ❌ Not ported | ✅ SYSTEM.md | PASS |
| FR-19 | Telos management | USER/TELOS/ | ✅ pai-telos skill + TELOS/ dir | ✅ memory/ALGORITHM.md | ✅ SYSTEM.md | PASS |
| FR-20 | Self-improvement loop | LEARNING/ + hooks | ⚠️ LEARNING/ dir created | ❌ Not ported | ❌ Not ported | PARTIAL |
| FR-21 | Voice pipeline | PULSE/voice.ts | ❌ Not ported | ❌ Not ported | ❌ Not ported | MISSING |
| FR-22 | Cron scheduling | PULSE cron loop | ✅ Hermes cronjob tool | ❌ Not ported | ❌ N/A | PASS |
| FR-23 | Observability telemetry | OBSERVABILITY/ | ⚠️ OBSERVABILITY/ dir created | ❌ Not ported | ❌ Not ported | PARTIAL |
| FR-24 | External channel | Telegram/iMessage modules | ❌ Not ported | ❌ Not ported | ❌ Not ported | MISSING |
| FR-25 | Wiki API | PULSE/wiki.ts | ❌ Not ported | ❌ Not ported | ❌ Not ported | MISSING |
| FR-26 | Project-bound memory | MEMORY/PROJECT/ | ⚠️ PROJECT/ dir created | ❌ Not ported | ❌ Not ported | PARTIAL |
| FR-27 | ISA reconciliation | ISA/Reconcile workflow | ✅ pai-isa skill | ✅ pai-core (isa_reconcile) | ✅ ISA.md | PASS |
| FR-28 | Changelog discipline | ISA skill | ✅ pai-isa skill | ✅ pai-core (changelog_append) | ✅ ISA.md | PASS |
| FR-29 | Thinking capabilities | 19 named capabilities | ✅ pai-thinking skill | ✅ SYSTEM.md lists all 19 | ✅ thinking.md | PASS |
| FR-30 | Execution log audit | MEMORY/SKILLS/execution.jsonl | ✅ Documented in all skills | ✅ pai-core (execution_log) | ✅ MEMORY/README.md | PASS |
| FR-31 | Billing protection | PULSE billing guard | ❌ Not ported | ❌ Not ported | ❌ Not ported | MISSING |
| FR-32 | Cross-vendor audit | ALGORITHM E4/E5 spec | ✅ Documented in pai-algorithm | ❌ Not ported | ✅ SYSTEM.md | PARTIAL |
| FR-33 | Notification rate limit | PULSE config | ❌ Not ported | ❌ Not ported | ❌ Not ported | MISSING |
| FR-34 | Syslog capture | PULSE/syslog | ❌ Not ported | ❌ Not ported | ❌ Not ported | MISSING |
| FR-35 | Pronunciation rules | USER/pronunciations.json | ❌ Not ported | ❌ Not ported | ❌ Not ported | MISSING |
| FR-36 | Secret rotation | PULSE config | ❌ Not ported | ❌ Not ported | ❌ Not ported | MISSING |

## Summary

| Target | Total Spec Items | PASS | PARTIAL | MISSING | Coverage |
|--------|-----------------|------|---------|---------|----------|
| **Hermes Agent** | 36 | 12 | 6 | 18 | 50% |
| **Pi-mono Agent** | 36 | 8 | 3 | 25 | 30% |
| **OpenCode** | 36 | 6 | 0 | 30 | 17% |

## Notes

- **Hermes Agent** has the best coverage because its native skill system, memory, and cron tools map directly to PAI concepts. Core methodology (Algorithm, ISA, thinking capabilities, Telos) is fully ported. Infrastructure features (Pulse, hooks, voice, containment, agents) are MISSING as they require runtime support Hermes doesn't provide.
- **Pi-mono Agent** has solid coverage of core methodology through its existing extension system. The upgrade added ISA tools and full Algorithm v6.3.0 spec.
- **OpenCode** coverage is context-only — no skill system, no hooks, no daemon. The SYSTEM.md file acts as the agent's instructions.
