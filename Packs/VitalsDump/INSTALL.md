# VitalsDump -- Installation Guide

Welcome to VitalsDump. This guide walks through system checks, credential setup, and verification.

---

## Phase 1: System Analysis

Run these checks to confirm your system is ready.

### Python 3

```bash
python3 --version
```

Required: Python 3.8 or later.

### pip

```bash
pip3 --version
```

Required: pip for installing Python packages.

### Required Python packages

```bash
python3 -c "import requests; print('requests:', requests.__version__)"
python3 -c "from garminconnect import Garmin; print('garminconnect: OK')"
```

If either fails, install them:

```bash
pip3 install requests garminconnect
```

### Output directory

```bash
ls -d "/mnt/g/My Drive/fleet-governor/vitals" 2>/dev/null || echo "Will be created on first run"
```

The output directory is created automatically on first run. If you use a different path, edit `VITALS_DIR` in `src/Tools/vitals-dump.py`.

---

## Phase 2: User Questions

### Oura Ring (optional but recommended)

1. Do you have an Oura Ring? If yes:
   - Go to [cloud.ouraring.com/personal-access-tokens](https://cloud.ouraring.com/personal-access-tokens)
   - Create a new Personal Access Token
   - Copy the token value

2. Set the token as an environment variable:
   ```bash
   export OURA_TOKEN="your-token-here"
   ```
   Or add it to your credentials file (see below).

### Garmin Connect (optional but recommended)

1. Do you have a Garmin device syncing to Garmin Connect? If yes:
   - Note your Garmin Connect email and password
   - First login will require MFA (check your email or authenticator app)

2. Set credentials as environment variables:
   ```bash
   export GARMIN_EMAIL="your@email.com"
   export GARMIN_PASSWORD="your-password"
   ```
   Or add them to your credentials file (see below).

### Credentials file (alternative to env vars)

Create or update `~/.claude/.credentials.json`:

```json
{
  "oura_token": "your-oura-token",
  "garmin_email": "your@email.com",
  "garmin_password": "your-password"
}
```

Protect the file:
```bash
chmod 600 ~/.claude/.credentials.json
```

---

## Phase 3: Installation

### Copy the pack

```bash
# Create the tool directory if it doesn't exist
mkdir -p ~/.claude/skills/VitalsDump/src/Tools
mkdir -p ~/.claude/skills/VitalsDump/src/Workflows

# Copy files
cp -r /path/to/VitalsDump/src/* ~/.claude/skills/VitalsDump/src/
cp /path/to/VitalsDump/README.md ~/.claude/skills/VitalsDump/
cp /path/to/VitalsDump/VERIFY.md ~/.claude/skills/VitalsDump/
```

### Install Python dependencies

```bash
pip3 install requests garminconnect
```

### Garmin session setup (if using Garmin)

Run the initial Garmin authentication to cache session tokens:

```bash
python3 -c "
from garminconnect import Garmin
import os
api = Garmin(os.environ['GARMIN_EMAIL'], os.environ['GARMIN_PASSWORD'])
api.login()
api.garth.dump('$HOME/.claude/.garmin_session')
print('Garmin session cached.')
"
```

This will prompt for MFA on first run. Subsequent runs use the cached session.

### Make the tool executable (optional)

```bash
chmod +x ~/.claude/skills/VitalsDump/src/Tools/vitals-dump.py
```

---

## Phase 4: Verification

Run the verification script:

```bash
# From the VitalsDump directory
python3 VERIFY.md  # No -- read VERIFY.md and run the checks manually, or:

# Quick smoke test
python3 src/Tools/vitals-dump.py --date 2026-03-01
```

If you see `OK: /path/to/2026-03-01.md` with a line count, the tool is working. Check the output file to confirm your wearable data appears correctly.

See [VERIFY.md](VERIFY.md) for the full verification checklist.
