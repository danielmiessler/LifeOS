# PAI Pack Icon Workflow

**Generate 256x256 transparent PNG icons for PAI packs.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the CreatePAIPackIcon workflow in the Art skill to generate pack icons"}' \
  > /dev/null 2>&1 &
```

Running **CreatePAIPackIcon** in **Art**...

---

## Purpose

Create consistent, professional icons for PAI packs following the established visual identity.

**Use for:** New pack icons, icon refreshes, icon regeneration.

---

## Visual Specifications

### Required Specs

| Spec | Value |
|------|-------|
| **Dimensions** | 256x256 pixels |
| **Format** | PNG with transparency |
| **Background** | ACTUAL transparent (not checkerboard) |
| **Primary Color** | Electric blue #4a90d9 |
| **Accent Color** | Purple #8b5cf6 (10-15% max) |
| **Style** | Simple, flat, readable at 64x64 |

### Color Palette

```
Background:     Transparent (actual transparency, not pattern)
Primary:        Electric Blue #4a90d9 (dominant color)
Accent:         Purple #8b5cf6 (sparingly, 10-15% of design)
Optional Dark:  Dark #0a0a0f (for contrast elements if needed)
```

### Design Rules

1. **Simple geometry** - Icon must be readable at 64x64 pixels
2. **Conceptual** - Represent the pack's core function visually
3. **Consistent style** - Match existing PAI pack icons
4. **No text** - Icons should work without labels
5. **Centered** - Icon should be centered in the 256x256 canvas

---

## Workflow Steps

### Step 1: Understand Pack Purpose

Before generating, understand:
- What does this pack do?
- What visual metaphor represents it?
- How should it relate to other pack icons?

**Good icon concepts:**
- `pai-hook-system` → Hook shape, event trigger
- `pai-core-install` → Download/install arrow
- `pai-skill-system` → Brain/routing/capability
- `pai-agent-system` → Robot/assistant figure
- `pai-voice-system` → Sound wave/speaker

### Step 2: Construct Prompt

Build a prompt that specifies:
1. The visual concept
2. The style (simple flat icon)
3. The color palette
4. The size requirements

**Prompt template:**
```
[VISUAL CONCEPT representing {pack function}], simple flat icon design, 256x256 pixels.
COLOR PALETTE: Primary electric blue (#4a90d9), Accent purple (#8b5cf6) sparingly.
STYLE: Modern flat icon, simple enough to read at 64x64, no text, centered.
BACKGROUND: Dark (#0a0a0f) - will be removed for transparency.
```

### Step 3: Generate Icon

**Command:**
```bash
bun run ~/.claude/skills/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR_PROMPT]" \
  --size 1K \
  --aspect-ratio 1:1 \
  --remove-bg \
  --output ${PROJECTS_DIR}/PAI/Packs/icons/[PACK_NAME].png
```

**Flags explained:**
- `--model nano-banana-pro` - Best quality for icons
- `--size 1K` - Small file, fast generation
- `--aspect-ratio 1:1` - Square for icons
- `--remove-bg` - Creates actual transparency

### Step 4: Verify Output

Check the generated icon:
```bash
# Verify file exists and size
ls -la ${PROJECTS_DIR}/PAI/Packs/icons/[PACK_NAME].png

# Check dimensions (requires imagemagick)
file ${PROJECTS_DIR}/PAI/Packs/icons/[PACK_NAME].png
```

**Verification checklist:**
- [ ] File exists at correct location
- [ ] PNG format
- [ ] Approximately 256x256 dimensions
- [ ] Has transparency (no solid background)
- [ ] Uses blue/purple palette
- [ ] Readable at small size

---

## Examples

### Example 1: Hook System Pack

```bash
bun run ~/.claude/skills/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "A stylized hook or fishing hook shape representing event hooks in software, simple flat icon design, 256x256 pixels. COLOR PALETTE: Primary electric blue (#4a90d9), Accent purple (#8b5cf6) sparingly. STYLE: Modern flat icon, simple enough to read at 64x64, no text, centered. BACKGROUND: Dark (#0a0a0f)." \
  --size 1K \
  --aspect-ratio 1:1 \
  --remove-bg \
  --output ${PROJECTS_DIR}/PAI/Packs/icons/pai-hook-system.png
```

### Example 2: Core Install Pack

```bash
bun run ~/.claude/skills/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "A download arrow pointing into a foundation/base structure representing core installation, simple flat icon design, 256x256 pixels. COLOR PALETTE: Primary electric blue (#4a90d9), Accent purple (#8b5cf6) sparingly. STYLE: Modern flat icon, simple enough to read at 64x64, no text, centered. BACKGROUND: Dark (#0a0a0f)." \
  --size 1K \
  --aspect-ratio 1:1 \
  --remove-bg \
  --output ${PROJECTS_DIR}/PAI/Packs/icons/pai-core-install.png
```

### Example 3: Memory System Pack

```bash
bun run ~/.claude/skills/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "A brain with memory/data flowing in and out representing an AI memory system, simple flat icon design, 256x256 pixels. COLOR PALETTE: Primary electric blue (#4a90d9), Accent purple (#8b5cf6) sparingly. STYLE: Modern flat icon, simple enough to read at 64x64, no text, centered. BACKGROUND: Dark (#0a0a0f)." \
  --size 1K \
  --aspect-ratio 1:1 \
  --remove-bg \
  --output ${PROJECTS_DIR}/PAI/Packs/icons/pai-memory-system.png
```

---

## Output Location

All PAI pack icons go to:
```
${PROJECTS_DIR}/PAI/Packs/icons/[PACK_NAME].png
```

**Naming convention:** Match the pack directory name exactly.
- Pack: `Packs/pai-hook-system/`
- Icon: `Packs/icons/pai-hook-system.png`

---

## Regeneration

If an icon needs to be regenerated:

1. Delete the old icon
2. Run the generate command with updated prompt
3. Verify the new icon
4. Update README if icon changed significantly

---

## Validation Checklist

Before marking icon complete:

- [ ] **Exists** at `${PROJECTS_DIR}/PAI/Packs/icons/[PACK_NAME].png`
- [ ] **Format** is PNG with transparency
- [ ] **Size** approximately 256x256
- [ ] **Colors** use blue primary, purple accent
- [ ] **Readable** at 64x64 size
- [ ] **Conceptual** - represents pack function
- [ ] **Consistent** - matches other PAI icons in style

---

## Related Workflows

- `~/.claude/skills/_PAI/Workflows/CreateRelease.md` - Release workflow (may include icon generation)

*Note: Previously referenced CreatePack.md, ValidatePack.md, and PAIIntegrityCheck.md have been removed.*

---

**Last Updated:** 2026-01-10
