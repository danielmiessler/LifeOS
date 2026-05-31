---
name: upgrade
description: Self-assessment, upgrade planning, and migration patterns. Capability evaluation, gap analysis, version comparison, migration strategy, breaking change management, rollback planning, and upgrade readiness checks. USE WHEN upgrade, update, migrate, version upgrade, self-assessment, capability review, migration plan, breaking changes.
metadata:
  author: pai
  version: 1.0.0
---

# Upgrade — Self-Assessment & Migration

## Self-Assessment

1. **Inventory current state** — What exists, versions, configurations
2. **Evaluate each component** — Working? Optimal? Deprecated?
3. **Identify gaps** — Missing capabilities, performance issues, tech debt
4. **Prioritize** — Impact vs. effort matrix
5. **Plan upgrades** — Sequence, dependencies, risks

## Upgrade Process

1. **Read release notes** — Breaking changes, new features, deprecations
2. **Test in isolation** — Sandbox or dev environment first
3. **Validate compatibility** — Dependencies, configs, data formats
4. **Backup** — Full backup before any change
5. **Execute** — Apply upgrade per plan
6. **Verify** — Smoke tests, integration tests, rollback test
7. **Rollback plan** — Ready to revert if verification fails

## Migration Patterns

| Pattern | When | Risk |
|---------|------|------|
| Blue-green | Zero-downtime | Low |
| Canary | Gradual rollout | Low |
| Big bang | Simple systems | High |
| Strangler fig | Incremental replacement | Medium |
| Parallel run | Data migration | Medium |

## Breaking Change Handling

1. Identify all consumers of changed interface
2. Notify owners before cutover
3. Use feature flags for gradual enablement
4. Support old and new versions during transition
5. Monitor error rates after cutover
