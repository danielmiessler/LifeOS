# PAI Skill - Component-Based Architecture

## Overview

The PAI skill is the heart of PAI - it defines The Algorithm and all core system behaviors. As of v2.4, SKILL.md is **dynamically generated** from modular components to enable easier maintenance and updates.

## Architecture

```
PAI/
  SKILL.md                 # ⚠️ GENERATED - do not edit directly
  Components/              # 📝 SOURCE OF TRUTH - edit these
    00-frontmatter.md
    10-pai-intro.md
    20-algorithm-core.md
    30-capabilities.md
    35-failure-modes.md
    40-isc-tracker.md
    50-capabilities-matrix.md
    60-mcs.md
    70-configuration.md
    80-context-loading.md
    90-exceptions.md
    95-takeaways.md
  Tools/
    RebuildPAI.ts          # Assembler
```

## Making Changes

### To update SKILL.md:

1. **Edit component files** in `Components/` directory
2. **Auto-rebuild** happens automatically at session end via `StopOrchestrator.hook.ts`
   - No manual build needed in most cases
   - SKILL.md rebuilt if any component is newer
3. **Manual build** (if needed):
   ```bash
   bun ~/.claude/skills/PAI/Tools/RebuildPAI.ts
   ```
4. **Verify output:**
   ```bash
   wc -l SKILL.md  # Should be ~584 lines
   ```

### Component Naming Convention

- **Numeric prefix** (00, 10, 20...): Explicit ordering
- **Room for insertions**: Can add 05, 15, 22 etc.
- **Descriptive name**: Lowercase-kebab-case

### Adding New Components

1. Create new file with appropriate numeric prefix
2. Add content following existing component patterns
3. Run RebuildPAI.ts
4. Verify SKILL.md assembled correctly

## Components Reference

| File | Lines | Content |
|------|-------|---------|
| `00-frontmatter.md` | 9 | YAML metadata + generated file header |
| `10-pai-intro.md` | 4 | Intro to PAI |
| `20-the-algorithm.md` | 493 | The Algorithm: execution, formats, ISC, MCS |
| `30-workflow-routing.md` | 27 | Configuration, exceptions, takeaways |
| `40-documentation-routing.md` | 51 | Context loading, doc routing, project routing |

**Total: 584 lines**

## Build Process

The builder (`Tools/RebuildPAI.ts`):
1. Reads all `.md` files from `Components/`
2. Sorts by numeric prefix (00 → 95)
3. Concatenates in order
4. Writes to `SKILL.md`

## Why This Architecture?

| Benefit | Description |
|---------|-------------|
| **Modularity** | Edit Algorithm without touching Context Loading |
| **Clarity** | Each component has single responsibility |
| **Maintainability** | Smaller files easier to update |
| **Extensibility** | Add new sections with numeric prefix |
| **Version Control** | Cleaner diffs on component changes |

## Auto-Build (Implemented)

**SKILL.md automatically rebuilds on session end** via `StopOrchestrator.hook.ts`:
- Handler: `hooks/handlers/RebuildSkill.ts`
- Trigger: Every Stop event (after each response)
- Behavior: Checks component timestamps, rebuilds if any are newer
- No manual intervention needed - edit components freely

This ensures SKILL.md is always current when sessions end.

## Verification

After building, verify:
- Line count matches expected (~581)
- Frontmatter has YAML + generated header
- All sections present in order
- No duplicate content
- Proper spacing between sections
