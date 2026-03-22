# VoiceFidelity v1.0.0 - Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through installation:

1. **AskUserQuestion** - For user decisions and confirmations
2. **Bash/Read/Write** - For actual installation
3. **VERIFY.md** - For final validation

### Welcome Message

Before starting, greet the user:
```
"I'm installing VoiceFidelity v1.0.0 — voice fidelity scoring and indexical grounding detection.

This pack adds three CLI tools:
- voice-extract: build a voice profile from your writing
- voice-score: score any document against your profile
- prufrock: 10-layer indexical grounding audit

No API keys required. Everything runs locally.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

### 1.1 Run These Commands

```bash
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

# Check for bun runtime
which bun && echo "OK bun found" || echo "ERROR bun not found - required for tools"

# Check for existing VoiceFidelity skill
if [ -d "$CLAUDE_DIR/skills/VoiceFidelity" ]; then
  echo "WARNING Existing VoiceFidelity skill found"
  ls -la "$CLAUDE_DIR/skills/VoiceFidelity/"
else
  echo "OK No existing VoiceFidelity skill (clean install)"
fi

# Check for existing voice tools
for tool in voice-extract voice-score prufrock; do
  if [ -f "$CLAUDE_DIR/tools/$tool" ]; then
    echo "WARNING Existing $tool found at $CLAUDE_DIR/tools/$tool"
  fi
done

# Check for existing voice profile
if [ -f "$CLAUDE_DIR/tools/voice-profile.json" ]; then
  echo "INFO Existing voice profile found (will be preserved)"
fi
```

### 1.2 Assess Results

- **bun missing:** Install bun first: `curl -fsSL https://bun.sh/install | bash`
- **Existing tools:** Ask user if they want to overwrite or keep existing versions
- **Existing profile:** Preserve — this is the user's voice data

---

## Phase 2: User Questions

### 2.1 Ask Installation Preferences

```
"Where should the VoiceFidelity tools be installed?"

Options:
1. Skills directory only (~/.claude/skills/VoiceFidelity/) — tools run from skill directory
2. Skills + Tools symlinks (~/.claude/tools/) — tools also accessible as standalone CLI commands
3. Custom location
```

**Recommendation:** Option 2 (skills + symlinks) for convenience.

### 2.2 Ask About Voice Profile

```
"Do you have an existing writing corpus you'd like to extract a voice profile from?"

Options:
1. Yes — I'll point you to the directory after installation
2. No — I'll set one up later
3. I already have a voice-profile.json
```

---

## Phase 3: Backup

If any existing VoiceFidelity files are found:

```bash
BACKUP_DIR="$CLAUDE_DIR/backups/voicefidelity-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing skill
[ -d "$CLAUDE_DIR/skills/VoiceFidelity" ] && cp -r "$CLAUDE_DIR/skills/VoiceFidelity" "$BACKUP_DIR/"

# Backup existing tools (but NOT the profile)
for tool in voice-extract voice-score prufrock; do
  [ -f "$CLAUDE_DIR/tools/$tool" ] && cp "$CLAUDE_DIR/tools/$tool" "$BACKUP_DIR/"
done

echo "Backup saved to: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory

```bash
mkdir -p "$CLAUDE_DIR/skills/VoiceFidelity/Workflows"
mkdir -p "$CLAUDE_DIR/skills/VoiceFidelity/Tools"
```

### 4.2 Copy Skill Files

Copy from this pack's `src/` directory:

```bash
PACK_SRC="<path-to-this-pack>/src"

# Core skill definition
cp "$PACK_SRC/SKILL.md" "$CLAUDE_DIR/skills/VoiceFidelity/"

# Framework and reference docs
cp "$PACK_SRC/IndexicalGroundingFramework.md" "$CLAUDE_DIR/skills/VoiceFidelity/"
cp "$PACK_SRC/VoiceCardTemplate.md" "$CLAUDE_DIR/skills/VoiceFidelity/"

# Tools
cp "$PACK_SRC/Tools/voice-extract.ts" "$CLAUDE_DIR/skills/VoiceFidelity/Tools/"
cp "$PACK_SRC/Tools/voice-score.ts" "$CLAUDE_DIR/skills/VoiceFidelity/Tools/"
cp "$PACK_SRC/Tools/prufrock.ts" "$CLAUDE_DIR/skills/VoiceFidelity/Tools/"

# Workflows
cp "$PACK_SRC/Workflows/Extract.md" "$CLAUDE_DIR/skills/VoiceFidelity/Workflows/"
cp "$PACK_SRC/Workflows/Score.md" "$CLAUDE_DIR/skills/VoiceFidelity/Workflows/"
cp "$PACK_SRC/Workflows/Audit.md" "$CLAUDE_DIR/skills/VoiceFidelity/Workflows/"

# Make tools executable
chmod +x "$CLAUDE_DIR/skills/VoiceFidelity/Tools/voice-extract.ts"
chmod +x "$CLAUDE_DIR/skills/VoiceFidelity/Tools/voice-score.ts"
chmod +x "$CLAUDE_DIR/skills/VoiceFidelity/Tools/prufrock.ts"
```

### 4.3 Create Tool Symlinks (if Option 2)

```bash
ln -sf "$CLAUDE_DIR/skills/VoiceFidelity/Tools/voice-extract.ts" "$CLAUDE_DIR/tools/voice-extract"
ln -sf "$CLAUDE_DIR/skills/VoiceFidelity/Tools/voice-score.ts" "$CLAUDE_DIR/tools/voice-score"
ln -sf "$CLAUDE_DIR/skills/VoiceFidelity/Tools/prufrock.ts" "$CLAUDE_DIR/tools/prufrock"
```

### 4.4 Update Default Profile Path

The voice-score tool defaults to `~/.claude/tools/voice-profile.json`. If the user already has a profile there, no action needed. If not, inform them they need to run voice-extract first.

---

## Phase 5: Verification

Run `VERIFY.md` checklist and report results.

---

## Phase 6: First Run (Optional)

If the user provided a corpus path in Phase 2:

```bash
bun "$CLAUDE_DIR/skills/VoiceFidelity/Tools/voice-extract.ts" \
  --corpus <user-provided-path> \
  --out "$CLAUDE_DIR/tools/voice-profile.json" \
  --verbose
```

Then run a test score against one of their documents:

```bash
bun "$CLAUDE_DIR/skills/VoiceFidelity/Tools/voice-score.ts" <one-of-their-docs> --verbose
```

Show them the results. This is the "aha" moment.
