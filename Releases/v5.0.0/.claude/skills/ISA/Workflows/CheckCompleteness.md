# CheckCompleteness Workflow

Score an existing ISA against the tier completeness gate and return a structured pass/fail + gap report. Drives the hard tier gate at all tiers.

## When to invoke

- Algorithm at end of OBSERVE: confirm the scaffolded ISA meets tier requirements.
- Algorithm at start of VERIFY: confirm the ISA is still complete after any structural changes.
- User directly: `Skill("ISA", "check completeness of <isa-path> at tier <tier>")`
- Internal call from Scaffold or Interview workflows.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| isa_path | yes | Path to the ISA to score |
| tier | yes | The completeness bar to score against (E1 / E2 / E3 / E4 / E5) |
| strict | no | Default true. If false, downgrade hard fails to soft warnings. |

## Output

```yaml
status: pass | fail
tier: E4
required_sections:
  Problem: present
  Vision: present
  Out of Scope: missing
  Principles: thin       # ≤ 1 sentence
  Constraints: present
  Goal: present
  Criteria: present
  Test Strategy: present
  Features: present
  Decisions: present
  Changelog: missing
  Verification: empty    # acceptable until VERIFY phase
gaps:
  - section: Out of Scope
    severity: hard
    reason: required at E4, missing entirely
  - section: Principles
    severity: hard
    reason: thin — only one bullet
  - section: Changelog
    severity: hard
    reason: required at E4, missing entirely
isc_quality:
  total: 24
  tier_floor: 128
  under_floor: true
  granularity_violations: 0
  anti_criteria_count: 2
  antecedent_present: true
  id_stability_violations: 0
```

## Procedure

### Step 2 — Read the ISA

Load `isa_path`. Parse frontmatter and section headers.

### Step 3 — Look up tier requirements

| Tier | Required Sections |
|------|-------------------|
| E1 | Goal, Criteria |
| E2 | Problem, Goal, Criteria, Test Strategy |
| E3 | Problem, Vision, Out of Scope, Constraints, Goal, Criteria, Features, Test Strategy |
| E4 | All twelve sections |
| E5 | All twelve sections + Interview workflow ran before BUILD |

Project ISA (`<project>/ISA.md`) — bump tier to max(declared-tier, E3).

### Step 4 — Classify each required section

For each required section:

| Classification | Test |
|----------------|------|
| `present` | Section header exists and body is ≥ 2 sentences (or ≥ 3 bullets) |
| `thin` | Section header exists but body is ≤ 1 sentence (or ≤ 2 bullets) |
| `missing` | Section header doesn't exist |
| `empty` | Section header exists, body is whitespace only — only acceptable for `Verification` before VERIFY phase |

### Step 5 — Audit ISC quality

Walk every ISC in `## Criteria`:

- **Granularity** — every ISC names a single binary tool probe (or has one inferable from its phrasing). Compound "and/with" criteria fail.
- **Tier floor** — at E2+, total ISC count meets the floor (E2 ≥16, E3 ≥32, E4 ≥128, E5 ≥256). Soft fail if under.
- **Anti-criteria** — at least one ISC has the `Anti:` prefix.
- **Antecedent** — when the goal is experiential, at least one ISC has the `Antecedent:` prefix.
- **ID stability** — every ISC has a unique sequential ID. No collisions, no gaps from renumbering. Tombstones (e.g., `ISC-7: [DROPPED — see Decisions 2026-04-15]`) are valid.

### Step 6 — Compose the report

Emit the structured YAML output above. Set `status: pass` only when zero hard severity gaps. `strict: false` downgrades hard severity to warnings (used during interview when the user is mid-stream).

### Step 7 — Block phase: complete on hard gaps

When invoked from VERIFY-phase doctrine, hard gaps block the `phase: complete` transition. The Algorithm must fill the gaps before declaring done.

## Severity table

| Gap | Severity at E1 | E2 | E3 | E4 | E5 |
|-----|----------------|----|----|----|----|
| Goal missing | hard | hard | hard | hard | hard |
| Criteria missing | hard | hard | hard | hard | hard |
| Problem missing | — | hard | hard | hard | hard |
| Test Strategy missing | — | hard | hard | hard | hard |
| Vision missing | — | — | hard | hard | hard |
| Out of Scope missing | — | — | hard | hard | hard |
| Constraints missing | — | — | hard | hard | hard |
| Features missing | — | — | hard | hard | hard |
| Principles missing | — | — | — | hard | hard |
| Decisions missing | — | — | — | hard | hard |
| Changelog missing | — | — | — | hard | hard |
| Interview not run pre-BUILD | — | — | — | — | hard |
| Anti-criteria count = 0 | hard | hard | hard | hard | hard |
| Antecedent missing (experiential) | hard | hard | hard | hard | hard |
| ID-stability violation | hard | hard | hard | hard | hard |
| ISC count under tier floor | — | soft | soft | soft | soft |
| Granularity violation | hard | hard | hard | hard | hard |

## Failure modes

- **Frontmatter missing or malformed:** abort with explicit error. The frontmatter is non-negotiable.
- **Project ISA scored at task tier:** override to max(tier, E3). Report the override in the output.
- **ISC body parsing fails:** treat as zero ISCs and surface the parse error.
