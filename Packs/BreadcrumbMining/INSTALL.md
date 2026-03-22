# BreadcrumbMining v1.0.0 - Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

### Welcome Message

```
"I'm installing BreadcrumbMining v1.0.0 — mine your AI conversation history for tagged insights.

This pack adds two tools:
- breadcrumb-mine: scan exported conversations for breakthrough moments
- breadcrumb-tag: capture insights in real time

No API keys required. Everything runs locally.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

```bash
CLAUDE_DIR="$HOME/.claude"

which bun && echo "OK bun found" || echo "ERROR bun not found - required"

if [ -d "$CLAUDE_DIR/skills/BreadcrumbMining" ]; then
  echo "WARNING Existing BreadcrumbMining skill found"
else
  echo "OK Clean install"
fi

# Check for existing breadcrumbs file
[ -f "$CLAUDE_DIR/breadcrumbs.md" ] && echo "INFO Existing breadcrumbs file found (will be preserved)" || echo "OK No existing breadcrumbs"
```

---

## Phase 2: User Questions

```
"Do you have AI conversation exports you'd like to mine?"

Options:
1. Yes — ChatGPT export (JSON files)
2. Yes — Claude sessions (JSONL)
3. Yes — Markdown/text conversation logs
4. Not yet — I'll set up exports later
```

---

## Phase 3: Installation

```bash
CLAUDE_DIR="$HOME/.claude"
PACK_SRC="<path-to-this-pack>/src"

mkdir -p "$CLAUDE_DIR/skills/BreadcrumbMining/Workflows"
mkdir -p "$CLAUDE_DIR/skills/BreadcrumbMining/Tools"

cp "$PACK_SRC/SKILL.md" "$CLAUDE_DIR/skills/BreadcrumbMining/"
cp "$PACK_SRC/Methodology.md" "$CLAUDE_DIR/skills/BreadcrumbMining/"
cp "$PACK_SRC/Tools/breadcrumb-mine.ts" "$CLAUDE_DIR/skills/BreadcrumbMining/Tools/"
cp "$PACK_SRC/Tools/breadcrumb-tag.ts" "$CLAUDE_DIR/skills/BreadcrumbMining/Tools/"
cp "$PACK_SRC/Workflows/Mine.md" "$CLAUDE_DIR/skills/BreadcrumbMining/Workflows/"
cp "$PACK_SRC/Workflows/Tag.md" "$CLAUDE_DIR/skills/BreadcrumbMining/Workflows/"
cp "$PACK_SRC/Workflows/Review.md" "$CLAUDE_DIR/skills/BreadcrumbMining/Workflows/"

chmod +x "$CLAUDE_DIR/skills/BreadcrumbMining/Tools/breadcrumb-mine.ts"
chmod +x "$CLAUDE_DIR/skills/BreadcrumbMining/Tools/breadcrumb-tag.ts"

# Optional: symlinks for CLI access
ln -sf "$CLAUDE_DIR/skills/BreadcrumbMining/Tools/breadcrumb-mine.ts" "$CLAUDE_DIR/tools/breadcrumb-mine"
ln -sf "$CLAUDE_DIR/skills/BreadcrumbMining/Tools/breadcrumb-tag.ts" "$CLAUDE_DIR/tools/breadcrumb-tag"
```

---

## Phase 4: Verification

Run `VERIFY.md` checklist.

---

## Phase 5: First Run (Optional)

If the user provided a conversation export path:

```bash
bun "$CLAUDE_DIR/skills/BreadcrumbMining/Tools/breadcrumb-mine.ts" \
  --dir <user-provided-path> \
  --out "$CLAUDE_DIR/breadcrumb-index.md" \
  --verbose
```

Show them the results. This is the moment they realize their conversations contain a goldmine.
