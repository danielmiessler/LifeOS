# Confirm — Installation Guide

**For AI agents installing this pack into a user's PAI infrastructure.**

---

## AI Agent Instructions

Use Claude Code's native tools (`AskUserQuestion`, `TodoWrite`, `Bash`, `Read`, `Write`) to walk the user through this wizard.

### Welcome Message

```
"I'm installing the Confirm skill from the PAI v5.0.0 release.

Confirm asks the user a yes/no via inline-keyboard buttons on @<DA>_bot and returns their tap. Built on the Pulse Telegram callback bridge. Useful as an approval gate before any irreversible step.

Let me check your system and install."
```

---

## Phase 1: System Analysis

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/Confirm"
HELPER="$CLAUDE_DIR/PAI/TOOLS/TelegramCallbacks.ts"
PULSE_TG="$CLAUDE_DIR/PAI/PULSE/modules/telegram.ts"

if [ -d "$SKILL_DIR" ]; then
  echo "EXISTING Confirm skill found at $SKILL_DIR — will back up before install"
else
  echo "Clean install — no existing Confirm skill"
fi

# Prerequisite checks — bridge + helper must already be present
[ -f "$HELPER" ] || echo "MISSING $HELPER (install PAI v5.0.0+ first)"
grep -q 'callback_query:data' "$PULSE_TG" 2>/dev/null \
  || echo "MISSING bridge handler in $PULSE_TG (Pulse needs callback bridge — PAI v5.0.0+)"
```

If either prerequisite is missing, stop and tell the user to update PAI first.

---

## Phase 2: Confirm with User

Ask the user (use `AskUserQuestion`):

- **Question:** "Install the Confirm skill?"
- **Options:**
  - "Install" — proceed
  - "Skip" — abort

If the user picks Skip, stop and exit cleanly.

---

## Phase 3: Backup

```bash
if [ -d "$SKILL_DIR" ]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  cp -R "$SKILL_DIR" "$SKILL_DIR.backup-$TS"
  echo "Backup at $SKILL_DIR.backup-$TS"
fi
```

---

## Phase 4: Install

Copy the contents of `src/` into `$SKILL_DIR/`:

```bash
mkdir -p "$SKILL_DIR/Workflows" "$SKILL_DIR/Tools"
cp -R src/SKILL.md "$SKILL_DIR/SKILL.md"
cp -R src/Workflows/* "$SKILL_DIR/Workflows/"
cp -R src/Tools/* "$SKILL_DIR/Tools/"
```

---

## Phase 5: Verify

Run the steps in `VERIFY.md` and report the results. Restart Pulse if it isn't already running with the bridge handler.

---

## After installation

Tell the user:

- The skill is invoked via `/confirm "<question>"` or `bun run ~/.claude/skills/Confirm/Tools/Ask.ts "<question>"`.
- Test bot recommended for first-time verification (don't paste production token into anything experimental).
- Skill returns `approve` / `reject` / `defer` (or whatever choices were configured) plus the raw `callback_data` for downstream logic.
