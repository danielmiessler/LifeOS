# Confirm — Verification

> **For AI agents:** Complete this checklist after installation. All file checks must pass before declaring the pack installed.

---

## File Verification

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/Confirm"

[ -d "$SKILL_DIR" ]                       && echo "OK directory exists"     || echo "MISSING directory"
[ -f "$SKILL_DIR/SKILL.md" ]              && echo "OK SKILL.md present"     || echo "MISSING SKILL.md"
[ -f "$SKILL_DIR/Workflows/Ask.md" ]      && echo "OK workflow Ask.md"      || echo "MISSING Ask workflow"
[ -f "$SKILL_DIR/Tools/Ask.ts" ]          && echo "OK Tools/Ask.ts"         || echo "MISSING Ask tool"
```

## Bridge Verification

```bash
HELPER="$CLAUDE_DIR/PAI/TOOLS/TelegramCallbacks.ts"
PULSE_TG="$CLAUDE_DIR/PAI/PULSE/modules/telegram.ts"

[ -f "$HELPER" ]                          && echo "OK helper present"       || echo "MISSING helper"
grep -q 'callback_query:data' "$PULSE_TG" && echo "OK bridge handler"       || echo "MISSING bridge handler"
[ -f "$CLAUDE_DIR/PAI/PULSE/state/telegram/callbacks.jsonl" ] \
                                          && echo "OK JSONL exists"         || echo "INFO no callbacks yet"
```

## Round-trip Verification (manual)

1. Ensure `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ALLOWED_USERS` are set in `~/.claude/.env`.
2. Run a 30-second confirm against your bot:
   ```bash
   bun run "$SKILL_DIR/Tools/Ask.ts" "Bridge round-trip OK?" --timeout-ms 30000
   ```
3. On your phone: tap one of the buttons.
4. The CLI should print the chosen action (e.g. `approve`) and exit 0.

If step 4 times out without you tapping, the bridge is fine but the test was — try again.
If step 4 times out *after* you tapped, check that Pulse is running and that `callbacks.jsonl` got a new entry.
