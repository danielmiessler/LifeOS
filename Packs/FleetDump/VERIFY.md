# FleetDump -- Verification

Run these checks after installation to confirm everything works.

---

## File Checks

Verify all required files are in place:

```bash
echo "=== File Checks ==="
for f in \
  src/Tools/fleet-dump.py \
  src/SKILL.md \
  src/Workflows/Dump.md \
  src/Workflows/Review.md \
  README.md \
  INSTALL.md \
  VERIFY.md; do
  if [ -f "$f" ]; then
    echo "OK: $f"
  else
    echo "MISSING: $f"
  fi
done
```

---

## Python Import Checks

Verify Python dependencies are available:

```bash
echo "=== Python Import Checks ==="

python3 -c "import subprocess; print('OK: subprocess')" 2>/dev/null || echo "FAIL: subprocess"
python3 -c "import json; print('OK: json')" 2>/dev/null || echo "FAIL: json"
python3 -c "from pathlib import Path; print('OK: pathlib')" 2>/dev/null || echo "FAIL: pathlib"
python3 -c "from datetime import datetime; print('OK: datetime')" 2>/dev/null || echo "FAIL: datetime"
```

All of these are Python standard library modules and should always be available.

---

## Infrastructure Checks

Verify the tool can access its data sources:

```bash
echo "=== Infrastructure Checks ==="

# Git
git --version >/dev/null 2>&1 && echo "OK: git available" || echo "FAIL: git not found"

# PAI repo
if [ -d "/root/.claude/.git" ]; then
  echo "OK: PAI repo is a git repository"
else
  echo "WARN: PAI root is not a git repo (git activity section will be empty)"
fi

# GitHub CLI
if command -v gh >/dev/null 2>&1; then
  echo "OK: gh CLI available"
  gh auth status >/dev/null 2>&1 && echo "OK: gh authenticated" || echo "WARN: gh not authenticated (run: gh auth login)"
else
  echo "WARN: gh CLI not installed (GitHub activity section will be empty)"
fi

# Memory directory
if [ -d "/root/.claude/projects/-root--claude/memory" ]; then
  echo "OK: memory directory exists"
else
  echo "WARN: memory directory not found (memory changes section will be empty)"
fi

# Flinch log
if [ -f "/root/.claude/projects/-root--claude/memory/flinch-log.md" ]; then
  echo "OK: flinch log exists"
else
  echo "INFO: no flinch log found (flinch section will show 'no flinch log')"
fi
```

---

## Smoke Test

Run a test dump and verify output:

```bash
echo "=== Smoke Test ==="
python3 src/Tools/fleet-dump.py --date 2026-01-01
echo ""
echo "Check: does the output file exist and contain markdown sections?"
```

Expected output: `OK: /path/to/2026-01-01.md` followed by a line count. The file should contain sections for Session Estimate, Git Activity, GitHub Activity, Fleet Dispatches, Work Sessions, Memory Changes, Flinch Log Status, and Governor Questions.

---

## All Clear

If file checks pass, Python imports succeed, and git is available, FleetDump is ready to use.

```bash
echo "=== Verification Complete ==="
echo "Run: python3 src/Tools/fleet-dump.py"
echo "     python3 src/Tools/fleet-dump.py --yesterday"
echo "     python3 src/Tools/fleet-dump.py --date YYYY-MM-DD"
```
