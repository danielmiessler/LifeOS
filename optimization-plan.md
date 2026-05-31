# Optimization Diagnosis & Plan

## Baseline Summary
- 95 files (93 .md, 2 .sh) across spec/, targets/, Releases/Pi/skills/
- ~12K lines, ~660KB, all text

## Findings by Priority

### P0 — Quick Wins (low effort, high consistency impact)

| ID | Issue | Files Affected | Fix |
|----|-------|---------------|-----|
| F1 | Version inconsistency | 23 files say 1.0.0, 16 say 5.0.0 | Standardize all to 5.0.0 |
| F2 | Author inconsistency | 16 say "PAI v5 Hermes Port", 15 say "PAI v5.0 → Hermes Port" | Standardize to "PAI v5.0 → Hermes Port" |
| F3 | Missing author field | 8 skills (council, research, delegation, etc.) | Add `author: PAI v5.0 → Hermes Port` |
| F4 | Trailing whitespace | 56 lines across codebase | Strip trailing whitespace |

### P1 — Moderate Impact (medium effort)

| ID | Issue | Files Affected | Fix |
|----|-------|---------------|-----|
| F5 | Broken cross-references | 4 skills reference non-existent or wrong-named skills | Fix related_skills to use actual skill names |
| F6 | Missing voice notification curl | 30 skills (most of utility + thinking bundle) | Add mandatory voice notification section |
| F7 | Missing gotchas section | 2 skills (pai-telos, pai-thinking) | Add gotchas section |
| F8 | Execution log path inconsistent | Some use different paths | Standardize to ~/.hermes/.../pai/MEMORY/... |

### P2 — Lower Impact

| ID | Issue | Files Affected | Fix |
|----|-------|---------------|-----|
| F9 | Spec files lack frontmatter | 13 spec files | Add YAML frontmatter with title, status |
| F10 | README files lack frontmatter | 5 README files | Add minimal frontmatter |

## Execution Order
1. F4 (trailing whitespace) — safest, no logic change
2. F1+F2+F3 (version/author) — pure frontmatter fix
3. F8 (execution log paths) — standardize
4. F7 (gotchas) — add missing
5. F5 (cross-references) — fix broken refs
6. F6 (voice notification) — add to 30 skills
7. F9+F10 (frontmatter on non-skills) — add if time

## Acceptance Criteria
- Test suite equivalent: `grep` sanity checks pass (no regressions introduced)
- Lint equivalent: no trailing whitespace, consistent frontmatter
- Cross-references resolve correctly
