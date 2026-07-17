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
  Principles: present
  Constraints: present
  Dependencies: absent     # conditional — required only when cross-ISA links exist
  Goal: present
  Criteria: present
  Bridge Criteria: absent  # conditional — required only when cross-ISA links exist
  Test Strategy: present
  Features: present
  Decisions: present
  Changelog: missing
  Verification: empty    # acceptable until VERIFY phase
gaps:
  - section: Out of Scope
    severity: hard
    reason: required at E4, missing entirely
  - section: Changelog
    severity: hard
    reason: required at E4, missing entirely
isc_quality:
  total: 24
  coverage_gaps: 0             # Vision/Goal subsystems with no container criterion
  granularity_violations: 0
  anti_criteria_count: 2
  antecedent_present: true
  test_strategy_orphans: 0     # leaf ISCs with no Test Strategy row naming a probe
  id_stability_violations: 0
```

## Procedure

### Step 1 — Voice notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the CheckCompleteness workflow in the ISA skill"}' \
  > /dev/null 2>&1 &
```

### Step 2 — Read the ISA

Load `isa_path`. Parse frontmatter and section headers.

### Step 3 — Look up tier requirements

| Tier | Required Sections |
|------|-------------------|
| E1 | Goal, Criteria |
| E2 | Problem, Goal, Criteria, Test Strategy |
| E3 | Problem, Vision, Out of Scope, Constraints, Goal, Criteria, Features, Test Strategy |
| E4 | All fourteen sections (empty sections never appear — Dependencies/Bridge Criteria only when cross-ISA links exist) |
| E5 | All fourteen sections (same conditional rule) + Interview workflow ran before BUILD |

Project ISA (`<project>/ISA.md`) — bump tier to max(declared-tier, E3).

### Step 4 — Classify each required section

For each required section:

| Classification | Test |
|----------------|------|
| `present` | Section header exists and body has content — length is not graded; a one-sentence section can be exactly right |
| `missing` | Section header doesn't exist |
| `empty` | Section header exists, body is whitespace only — only acceptable for `Verification` before VERIFY phase |

### Step 5 — Audit ISC quality

Walk every ISC in `## Criteria`:

- **Granularity** — every ISC names a single binary tool probe (or has one inferable from its phrasing). Compound "and/with" criteria fail.
- **Coverage (v7.0.0 — replaces the deleted numeric count floors)** — every subsystem named in Vision/Goal has a container criterion decomposed until each leaf is one binary tool probe; never split to hit a number. A subsystem with no container criterion is a coverage gap.
- **Anti-criteria (HARD fail at E2+)** — at least one ISC has the `Anti:` prefix. Empirically ignored in ~80% of pre-v7 ISAs because nothing enforced it; this check is the teeth.
- **Test Strategy coverage (HARD fail at E2+)** — every leaf ISC has a `## Test Strategy` row naming its probe. Orphan leaves fail (E1 has no Test Strategy section, so exempt).
- **Antecedent** — when the goal is experiential, at least one ISC has the `Antecedent:` prefix.
- **ID stability** — every ISC has a unique sequential ID. No collisions, no gaps from renumbering. Tombstones (e.g., `ISC-7: [DROPPED — see Decisions 2026-04-15]`) are valid.
- **Anchoring (NEW v6.4.0)** — when frontmatter `principal_stated_goal:` is set, every ISC must have an `anchors_to` value in Test Strategy (either `literal` or `derived: <sub-claim>`). Orphan ISCs (no traceable anchor) are a hard failure.

### Step 5a — Goal-Signal Mismatch Check (NEW v6.4.0)

**Backwards-compat guard:** this check fires ONLY when the ISA frontmatter explicitly contains a `principal_stated_goal` key (any value, including empty string or `null`). ISAs scaffolded under Algorithm v6.3.0 and earlier — which never carry this key — are not subject to the check. The presence of the key is the v6.4.0+ marker.

If invoked during OBSERVE-end or VERIFY AND the ISA is v6.4.0+ scaffolded:

- If `principal_stated_goal_signal:` in the ISA frontmatter is set (the four-signal detector fired at scaffold) AND `principal_stated_goal:` is empty/null → hard failure: "literal capture missed — the detector fired but Scaffold did not preserve the literal." (Formerly checked the retired classifier's `GOAL_SIGNAL` line; now an ISA-internal consistency check between the recorded signal and the recorded literal.)
- If `principal_stated_goal:` is set to a non-null string but the string is < 6 tokens or fails the minimum-content rule → hard failure: "literal violates minimum-content rule — should have been `null`."

### Step 5b — Artifact-Presence Check (NEW v6.4.0 — Cato 2026-05-11 lesson)

**Backwards-compat guard:** this check fires ONLY when the ISA frontmatter explicitly contains a `principal_stated_goal` key (any value). v6.3.0-era ISAs without the key are not subject to the check, preserving their existing close path.

At E4+ AND v6.4.0+ scaffolded, for every ISC marked `[x]` in `## Criteria` that claims a named design surface (e.g., "the proposal includes X", "the design names Y", "a table appears"), scan the ISA body for that surface textually:

- If the surface is asserted complete by an `[x]` but no textual evidence appears in the ISA body → hard failure: "ISC claims surface that does not exist in artifact (system-of-record violation)."
- The ISA artifact must contain its own design surface, not reference ephemeral chat context. The system-of-record identity (one of the five) requires this.

### Legacy frontmatter (v6.x ceremony keys) — inert, never graded

The v6.5.0–v6.7.0 density/divergence/acknowledgment frontmatter keys were deleted in Algorithm v7.0.0 — they checked whether ceremony was recorded, not ISA quality. Hundreds of archived ISAs still carry them: their presence is **never** a failure, their values are **never** validated. Do not invert the deleted checks. The only ambiguity-check keys graded on v7.0.0+ ISAs are `context_sufficient` and `interview_invoked`.

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
| Anti-criteria count = 0 (≥1 `Anti:` ISC required) | soft | hard | hard | hard | hard |
| Leaf ISC without a Test Strategy row naming its probe | — | hard | hard | hard | hard |
| Antecedent missing (experiential) | hard | hard | hard | hard | hard |
| ID-stability violation | hard | hard | hard | hard | hard |
| Coverage gap (Vision/Goal subsystem with no container criterion; Goal-only at E2) | — | soft | hard | hard | hard |
| Granularity violation | hard | hard | hard | hard | hard |
| Anchoring violation (orphan ISC, v6.4.0+ ISAs only) | hard | hard | hard | hard | hard |
| Goal-signal mismatch (classifier vs ISA, v6.4.0+ ISAs only) | hard | hard | hard | hard | hard |
| Artifact-presence violation (v6.4.0+ ISAs only, E4+) | — | — | — | hard | hard |
| `context_sufficient` missing (v7.0.0+ scaffolds only; ISAs carrying legacy v6.x ceremony keys predate v7 and are exempt; E1 inline ISAs exempt) | — | hard | hard | hard | hard |

## Failure modes

- **Frontmatter missing or malformed:** abort with explicit error. The frontmatter is non-negotiable.
- **Project ISA scored at task tier:** override to max(tier, E3). Report the override in the output.
- **ISC body parsing fails:** treat as zero ISCs and surface the parse error.
