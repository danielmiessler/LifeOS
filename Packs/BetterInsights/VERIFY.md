# BetterInsights - Post-Install Verification

Run these checks after installation to confirm everything works.

## Check 1: Files Exist

```bash
echo "=== Checking files ==="
[ -f "$HOME/.claude/skills/BetterInsights/SKILL.md" ] && echo "OK SKILL.md" || echo "FAIL SKILL.md missing"
[ -f "$HOME/.claude/skills/BetterInsights/full_insights.py" ] && echo "OK full_insights.py" || echo "FAIL full_insights.py missing"
```

## Check 2: Python Works

```bash
echo "=== Checking Python ==="
python3 "$HOME/.claude/skills/BetterInsights/full_insights.py" --json --no-open 2>&1 | tail -5
```

Expected: Should print session counts and save JSON to `~/.claude/usage-data/full-insights-data.json`.

## Check 3: JSON Output Valid

```bash
echo "=== Checking JSON output ==="
python3 -c "import json; json.load(open('$HOME/.claude/usage-data/full-insights-data.json')); print('OK Valid JSON')" 2>&1
```

## Check 4: Skill Visible

The skill should appear in Claude Code's skill list as `BetterInsights`. Start a new Claude Code session and check if `/better-insights` is available.

## Success Criteria

All checks should show "OK". If Check 2 shows session data, the installation is complete.

Report to user:
```
"BetterInsights installed successfully. Run /better-insights in any Claude Code
session to generate your usage report. It will open an HTML report comparing
your real usage vs what /insights reports."
```
