# VitalsDump -- Verification

Run these checks after installation to confirm everything works.

---

## File Checks

Verify all required files are in place:

```bash
echo "=== File Checks ==="
for f in \
  src/Tools/vitals-dump.py \
  src/SKILL.md \
  src/Workflows/Dump.md \
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

python3 -c "import json; print('OK: json')" 2>/dev/null || echo "FAIL: json"
python3 -c "import urllib.request; print('OK: urllib')" 2>/dev/null || echo "FAIL: urllib"
python3 -c "import requests; print('OK: requests')" 2>/dev/null || echo "FAIL: requests (run: pip3 install requests)"
python3 -c "from garminconnect import Garmin; print('OK: garminconnect')" 2>/dev/null || echo "FAIL: garminconnect (run: pip3 install garminconnect)"
```

---

## Credential Checks

Verify credentials are configured:

```bash
echo "=== Credential Checks ==="

# Oura
if [ -n "$OURA_TOKEN" ]; then
  echo "OK: OURA_TOKEN set via env var"
else
  python3 -c "
import json
from pathlib import Path
creds = json.loads(Path('$HOME/.claude/.credentials.json').read_text())
if creds.get('oura_token'):
    print('OK: oura_token found in credentials file')
else:
    print('WARN: no Oura token configured (Oura data will be skipped)')
" 2>/dev/null || echo "WARN: no Oura token configured (Oura data will be skipped)"
fi

# Garmin
if [ -n "$GARMIN_EMAIL" ] && [ -n "$GARMIN_PASSWORD" ]; then
  echo "OK: GARMIN_EMAIL and GARMIN_PASSWORD set via env vars"
else
  python3 -c "
import json
from pathlib import Path
creds = json.loads(Path('$HOME/.claude/.credentials.json').read_text())
if creds.get('garmin_email') and creds.get('garmin_password'):
    print('OK: Garmin credentials found in credentials file')
else:
    print('WARN: no Garmin credentials configured (Garmin data will be skipped)')
" 2>/dev/null || echo "WARN: no Garmin credentials configured (Garmin data will be skipped)"
fi

# Garmin session cache
if [ -d "$HOME/.claude/.garmin_session" ]; then
  echo "OK: Garmin session cache exists"
else
  echo "WARN: no Garmin session cache (first run will require MFA)"
fi
```

---

## Smoke Test

Run a test dump and verify output:

```bash
echo "=== Smoke Test ==="
python3 src/Tools/vitals-dump.py --date 2026-01-01
echo ""
echo "Check: does the output file exist and contain markdown sections?"
```

Expected output: `OK: /path/to/2026-01-01.md` followed by a line count. The file should contain `## Oura Ring`, `## Garmin`, `## Governor Flags`, and `## Cross-Reference` sections even if no data is available for that date.

---

## All Clear

If all file checks pass, Python imports succeed, and at least one credential source is configured, VitalsDump is ready to use.

```bash
echo "=== Verification Complete ==="
echo "Run: python3 src/Tools/vitals-dump.py"
echo "     python3 src/Tools/vitals-dump.py --yesterday"
echo "     python3 src/Tools/vitals-dump.py --date YYYY-MM-DD"
```
