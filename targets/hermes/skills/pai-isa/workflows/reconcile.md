---
name: reconcile
description: Deterministic merge of an ephemeral ISA into a master ISA with field-by-field conflict resolution
workflow_of: pai-isa
---

# Workflow: reconcile

## Inputs

- `ephemeral_path`: Path to the ephemeral (working) ISA
- `master_path`: Path to the master ISA (will be overwritten)
- `dry_run`: If true, show diff only — do not write (default: false)
- `archive`: If true, archive ephemeral after successful merge (default: true)

## Steps

### Step 1: Read both ISAs

```python
ephemeral = read_file(path=ephemeral_path)
master = read_file(path=master_path)
```

Both files must be valid markdown with YAML frontmatter.
Parse frontmatter as YAML, body as sections.

### Step 2: Parse into section tree

Split both documents into a list of section nodes:

```
Section(name, level, content_lines, frontmatter, children)
```

- Level 1 = `# Title` (ISA sections like Intent, Architecture)
- Level 2 = `## Subsection` (sub-sections)
- Level 3+ = deeper subheadings

Use the heading hierarchy to build a tree. Non-heading content between
headings belongs to the nearest ancestor heading.

### Step 3: Deterministic merge algorithm

```
merged = shallow_copy(master_frontmatter)
merged_sections = []
seen_ephemeral_sections = set()

for each section S in ephemeral.sections (depth-first):
    seen_ephemeral_sections.add(S.name)
    M = find_section_by_name(master.sections, S.name)
    if M is None:
        # Section exists in ephemeral but not master → append
        merged_sections.append(S)
    else:
        # Section exists in both → field-by-field merge
        merged_sections.append(merge_section(M, S))

for each section M in master.sections (depth-first):
    if M.name not in seen_ephemeral_sections:
        # Section exists in master but not ephemeral → preserve
        merged_sections.append(M)
```

### Step 4: Field-by-field section merge

```
function merge_section(master_sec, ephem_sec):
    merged = Section(name=master_sec.name, level=master_sec.level)
    # Frontmatter: ephemeral wins on conflict keys
    merged.frontmatter = {**master_sec.frontmatter, **ephem_sec.frontmatter}
    # Content lines: if ephem_sec has content, use it; else keep master
    merged.content_lines = ephem_sec.content_lines if ephem_sec.content_lines.strip() else master_sec.content_lines
    # Children: recursive merge
    merged.children = reconcile_children(master_sec.children, ephem_sec.children)
    return merged
```

### Step 5: Assemble output

1. Write merged YAML frontmatter.
2. Append `merged_at: {timestamp}` to frontmatter.
3. Append `reconciled_from: {ephemeral_path}` to frontmatter.
4. Write all sections in order with proper heading levels.
5. If `dry_run` is true, output diff to stdout and abort.

### Step 6: Write master

If not dry_run:

1. `write_file(path=master_path, content=merged_output)`.
2. If `archive` is true:
   - Read ephemeral.
   - Prepend frontmatter with `archived_at: {timestamp}`.
   - Write to `~/.pai/isa/archive/{ephemeral_name}.{timestamp}.isa.md`.
   - Delete original ephemeral.

### Step 7: Update index

Append to `~/.pai/isa/index.yaml`:

```yaml
- operation: reconcile
  timestamp: {iso_timestamp}
  ephemeral: {ephemeral_path}
  master: {master_path}
  sections_added: {N}
  sections_updated: {N}
  sections_preserved: {N}
```

## Output

- `merged_path`: Path to the updated master ISA
- `archive_path`: Path to archived ephemeral (or null if not archived)
- `stats`: `{added: N, updated: N, preserved: N}`

## Determinism Guarantee

Given the same ephemeral and master files, the output is always identical.
No LLM calls are made during the merge. The algorithm is pure-text:
parse, compare, merge, serialize. This means reconciliation is idempotent.

## Error Recovery

- If either file is unparseable (no frontmatter, no sections), abort with
  "Unparseable ISA: {path}". Manual fix required.
- If master is locked (check `~/.pai/isa/master/.lock`), abort with
  "Master ISA locked by another reconcile". Wait for lock to clear.
- If the merge produces an empty document, keep master unchanged and
  report "Merge produced empty output — master preserved".
