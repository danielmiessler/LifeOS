---
name: check-completeness
description: Score an ISA document against its tier-specific completeness gate
workflow_of: pai-isa
---

# Workflow: check-completeness

## Inputs

- `isa_path`: Path to the ISA markdown file
- `gate_override`: Optional override for the tier gate threshold (0.0–1.0)

## Steps

### Step 1: Read and parse ISA

1. `read_file(path=isa_path)` — get full ISA content.
2. Extract `tier` from YAML frontmatter or first `# Tier N` heading.
3. Load gate thresholds from `~/.pai/isa/gates.yaml` (default if missing).

### Step 2: Map tier to required sections

| Tier | Required Sections | Weight |
|------|------------------|--------|
| 0 | Intent, Stakeholders, Success Criteria | 1.0 |
| 1 | + System Architecture, Components, Data Flow, Interfaces | 0.85 |
| 2 | + Module Specifications, API Contracts, Data Models, Error Codes, Configuration | 0.70 |
| 3 | + File Manifest, Implementation Order, Test Plan, Migration Notes | 0.55 |

Higher-tier sections have lower weight because more sections are checked.

### Step 3: Score each required section

For each required section at the detected tier:

1. Search for the heading `# {Section}` in the ISA content.
2. If found, measure depth:
   - Has sub-sections? +0.3
   - Has code blocks or tables? +0.3
   - Has cross-references to other sections? +0.2
   - Content length > 3 lines? +0.2
   - Score is sum, capped at 1.0 per section.
3. If not found, section score = 0.0.

### Step 4: Compute aggregate score

```
score = Σ(section_score × section_weight) / Σ(section_weight)
```

Tiers above the detected tier are ignored (not penalized).
Tiers below the detected tier are still checked — their sections are
required regardless. This ensures a Tier 2 ISA still has Tier 0 and 1 sections.

### Step 5: Compare against gate

```yaml
gate_threshold = gates[tier]  # e.g., gates[2] = 0.85
pass = score >= gate_threshold
```

If `gate_override` is provided, use it instead.

### Step 6: Generate report

Use `delegate_task` to produce a human-readable report:

```json
{
  "type": "delegate_task",
  "agent": "pai-isa-checker",
  "task": "Write a completeness report for the following ISA scorecard. Include: overall score, pass/fail, list of missing or weak sections, and specific recommendations for each gap.\n\nTier: {tier}\nScore: {score}/{gate_threshold}\nSection scores: {section_scores_json}",
  "context": {"tier": tier, "score": score, "gate": gate_threshold, "sections": section_scores}
}
```

### Step 7: Cache result

Write scorecard to `~/.pai/isa/checks/{filename}.score.yaml`:

```yaml
isa: {isa_path}
timestamp: {iso_timestamp}
tier: {tier}
score: {score}
gate: {gate_threshold}
pass: {pass}
missing_sections: [list]
weak_sections: [list]
```

## Output

- `pass`: boolean
- `score`: float 0.0–1.0
- `gate`: float (threshold used)
- `missing_sections`: array of section names not found
- `weak_sections`: array of section names found but under-scored
- `report`: markdown string with detailed findings

## Error Recovery

- If ISA has no detectable tier, assume Tier 0 (strictest gate = 0.5).
- If gate file is missing, use built-in defaults.
- If `read_file` fails, report "ISA not found at {path}" and return score 0.
