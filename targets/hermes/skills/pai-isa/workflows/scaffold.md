---
name: scaffold
description: Generate an ISA (Intelligence Stack Architecture) document from a natural-language prompt at a specific tier
workflow_of: pai-isa
---

# Workflow: scaffold

## Inputs

- `prompt`: Natural-language description of the system/feature to scaffold
- `tier`: Target tier (0-3, default 0)

## Steps

### Step 1: Parse tier and prompt

1. Extract tier from arguments (default: 0). Validate `tier ∈ {0, 1, 2, 3}`.
2. Extract prompt text. Must be non-empty.

### Step 2: Generate tier-0 intent section

Use `delegate_task` to produce the Intent layer:

```json
{
  "type": "delegate_task",
  "agent": "pai-isa-scaffolder",
  "task": "From the prompt below, write a Tier-0 ISA Intent section. Output ONLY the YAML frontmatter (name, description, tier: 0) followed by sections: # Intent, # Stakeholders, # Success Criteria.\n\nPrompt: {prompt}",
  "context": {"tier": 0, "prompt": prompt}
}
```

### Step 3: Generate tier-1 architecture (if tier >= 1)

Use `delegate_task` with the tier-0 output as context:

```json
{
  "type": "delegate_task",
  "agent": "pai-isa-architect",
  "task": "Using the Intent below, expand this ISA to Tier 1. Add sections: # System Architecture, # Components, # Data Flow, # Interfaces. Be specific about component boundaries.\n\n{step2_output}",
  "context": {"tier": 1, "parent_sections": step2_output}
}
```

### Step 4: Generate tier-2 module design (if tier >= 2)

```json
{
  "type": "delegate_task",
  "agent": "pai-isa-designer",
  "task": "Using the Tier 1 architecture below, expand to Tier 2 with detailed module design. Add sections: # Module Specifications, # API Contracts, # Data Models, # Error Codes, # Configuration.\n\n{step3_output}",
  "context": {"tier": 2, "parent_sections": step3_output}
}
```

### Step 5: Generate tier-3 implementation plan (if tier >= 3)

```json
{
  "type": "delegate_task",
  "agent": "pai-isa-planner",
  "task": "Using the Tier 2 design below, expand to Tier 3 with a full implementation plan. Add sections: # File Manifest, # Implementation Order, # Test Plan, # Migration Notes.\n\n{step4_output}",
  "context": {"tier": 3, "parent_sections": step4_output}
}
```

### Step 6: Assemble and validate

1. Concatenate outputs from steps 2-5 in order.
2. Run `pai-isa check` on the assembled ISA.
3. If score < gate threshold, loop: identify gaps from the check output,
   use `delegate_task` to generate the missing sections, and re-check.
   Maximum 3 fill loops.

### Step 7: Write to disk

1. Derive name from prompt (first 40 chars, slugified).
2. Write ISA to `~/.pai/isa/ephemeral/{name}.isa.md`.
3. Register in ISA session index: `~/.pai/isa/index.yaml`.

## Output

- File path of the generated ISA
- Final completeness score
- List of sections generated per tier

## Error Recovery

- If any `delegate_task` call fails, retry once with a more explicit prompt.
- If ISA check score is below 0.3 after 3 fill loops, abort and report
  "ISA generation failed — prompt may be underspecified".
