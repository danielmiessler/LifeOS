# FleetDump -- Installation Guide

Welcome to FleetDump. This guide walks through system checks, configuration, and verification.

---

## Phase 1: System Analysis

Run these checks to confirm your system is ready.

### Python 3

```bash
python3 --version
```

Required: Python 3.8 or later.

### Git

```bash
git --version
```

Required: Git for local repository log collection.

### GitHub CLI (optional but recommended)

```bash
gh --version
gh auth status
```

Required for cross-repo GitHub activity monitoring. If `gh` is not installed or not authenticated, those sections will show "(no GitHub activity)" but the rest of the tool works fine.

### PAI directory

```bash
ls -d /root/.claude 2>/dev/null && echo "OK: PAI root exists" || echo "WARN: PAI root not found at /root/.claude"
```

The tool reads from your PAI installation directory. If your PAI root is elsewhere, update `PAI_ROOT` in the tool source.

### Output directory

```bash
ls -d "/mnt/g/My Drive/fleet-dumps" 2>/dev/null || echo "Will be created on first run"
```

The output directory is created automatically on first run.

---

## Phase 2: User Questions

### PAI root location

Where is your PAI installation? Default is `/root/.claude`. If yours is different, you'll need to edit `PAI_ROOT` in `src/Tools/fleet-dump.py`.

### GitHub repositories

Which repositories should FleetDump monitor? Edit the `GITHUB_REPOS` list in `src/Tools/fleet-dump.py`:

```python
GITHUB_REPOS = [
    "YourOrg/repo1",
    "YourOrg/repo2",
]
```

### Fleet dispatches

Do you use a fleet_messages repository for cross-AI communication? If yes, ensure it's accessible via `git clone`. If no, that section will show "(fleet_messages repo unavailable)" -- this is fine.

### Output location

Where should fleet dumps be written? Default is `/mnt/g/My Drive/fleet-dumps/`. Edit `DUMP_DIR` in the tool source if you want a different location.

---

## Phase 3: Installation

### Copy the pack

```bash
# Create the tool directory if it doesn't exist
mkdir -p ~/.claude/skills/FleetDump/src/Tools
mkdir -p ~/.claude/skills/FleetDump/src/Workflows

# Copy files
cp -r /path/to/FleetDump/src/* ~/.claude/skills/FleetDump/src/
cp /path/to/FleetDump/README.md ~/.claude/skills/FleetDump/
cp /path/to/FleetDump/VERIFY.md ~/.claude/skills/FleetDump/
```

### Authenticate GitHub CLI (if not already done)

```bash
gh auth login
```

Follow the prompts. This enables cross-repo activity monitoring.

### Make the tool executable (optional)

```bash
chmod +x ~/.claude/skills/FleetDump/src/Tools/fleet-dump.py
```

### Set up cron (optional)

For automated daily captures at 11:55 PM:

```bash
echo "55 23 * * * python3 ~/.claude/skills/FleetDump/src/Tools/fleet-dump.py" | crontab -
```

---

## Phase 4: Verification

Run the verification script:

```bash
# Quick smoke test
python3 src/Tools/fleet-dump.py --date 2026-03-01
```

If you see `OK: /path/to/2026-03-01.md` with a line count, the tool is working. Check the output file to confirm sections appear correctly.

See [VERIFY.md](VERIFY.md) for the full verification checklist.
