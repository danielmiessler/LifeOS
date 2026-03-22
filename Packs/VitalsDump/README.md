---
name: VitalsDump
pack-id: northwoodssentinel-vitalsdump-v1.0.0
version: 1.0.0
author: NorthwoodsSentinel
description: Pull daily biometric summaries from Oura Ring and Garmin Connect into structured markdown for AI consumption
type: skill
purpose-type:
  - health-tracking
  - biometric-integration
  - cognitive-correlation
platform: claude-code
dependencies: []
keywords:
  - oura
  - garmin
  - biometrics
  - hrv
  - sleep
  - body-battery
  - vitals
  - health
  - wearables
---

# VitalsDump

> Your AI should know what your body knows. Connect wearable data to your AI workflow so cognitive output has physiological context.

## The Problem

Your cognitive output varies day to day but you don't know why. Was yesterday's mediocre work session because of bad sleep? Did that creative breakthrough happen on a day with high HRV? Without connecting body data to work data, you're optimizing blindly.

Biometric dashboards exist but they live in phone apps, disconnected from your AI workflow. You context-switch between Oura, Garmin, and your work environment. Your AI has no idea whether you slept four hours or eight, whether your stress is spiking or your Body Battery is depleted. It gives you the same kind of advice regardless of your physical state.

## The Solution

VitalsDump pulls daily biometric summaries from Oura Ring (Cloud API v2) and Garmin Connect, then writes a dated markdown file your AI can read. Sleep score, deep sleep duration, HRV, resting heart rate, readiness, Body Battery, stress, SpO2 -- all in one structured document.

It also generates governor flags: automatic warnings when vitals cross thresholds that correlate with degraded cognitive performance. Low sleep, depleted Body Battery, elevated resting heart rate -- the tool tells you (and your AI) when the body is sending signals the mind wants to ignore.

## Installation

See [INSTALL.md](INSTALL.md) for guided setup.

## What's Included

| File | Purpose |
|------|---------|
| `src/Tools/vitals-dump.py` | Python CLI that pulls from Oura and Garmin APIs |
| `src/SKILL.md` | AI routing skill with USE WHEN triggers |
| `src/Workflows/Dump.md` | Step-by-step workflow for daily vitals capture |
| `INSTALL.md` | Guided installation with system checks |
| `VERIFY.md` | Post-install verification script |

## What Makes This Different

Most biometric tools are dashboards. VitalsDump is a bridge -- it takes data locked in wearable APIs and delivers it as structured text your AI can reason about. The governor flags aren't generic health advice; they're calibrated to cognitive performance thresholds. Under 6 hours of sleep isn't just "bad for you" -- it's a signal that today's deep work session should be shorter or skipped entirely.

The cross-reference table at the bottom of each report connects body signals to work patterns. Low HRV plus a weekend commit streak isn't just two data points -- it's regulation drift, and the tool names it.

## Invocation Scenarios

| Scenario | Command |
|----------|---------|
| Dump today's vitals | `python3 vitals-dump.py` |
| Dump yesterday's vitals | `python3 vitals-dump.py --yesterday` |
| Dump a specific date | `python3 vitals-dump.py --date 2026-03-14` |
| AI checks your state before deep work | "Check my vitals before we start" |
| Correlate a bad session with body data | "Pull yesterday's vitals -- I want to see why that session was rough" |

## Example Usage

```bash
# Today's vitals
python3 src/Tools/vitals-dump.py

# Yesterday
python3 src/Tools/vitals-dump.py --yesterday

# Specific date
python3 src/Tools/vitals-dump.py --date 2026-03-14
```

Output lands as a dated markdown file (e.g., `2026-03-14.md`) with sections for Oura data, Garmin data, governor flags, and a cross-reference interpretation table.

## Configuration

VitalsDump needs credentials for one or both wearable platforms:

**Oura Ring:**
- Get a Personal Access Token from [cloud.ouraring.com/personal-access-tokens](https://cloud.ouraring.com/personal-access-tokens)
- Set as `OURA_TOKEN` environment variable, or add `"oura_token"` to your credentials file

**Garmin Connect:**
- Use your Garmin Connect email and password
- Set as `GARMIN_EMAIL` and `GARMIN_PASSWORD` environment variables, or add to credentials file
- First login requires MFA; subsequent logins use cached session tokens

**Credentials file format** (`~/.claude/.credentials.json`):
```json
{
  "oura_token": "your-oura-token",
  "garmin_email": "your@email.com",
  "garmin_password": "your-password"
}
```

**Output directory:** Configurable by editing `VITALS_DIR` in the script. Defaults to `{G: Drive}/fleet-governor/vitals/`.

## Origin

Built as part of FlowLabs cognitive session recording. First used to correlate a 5-hour flow session with Garmin heart rate data -- discovered that deep sleep cratered 59% the night after an intense flow session. Flow has a physiological invoice. The tool exists because you can't optimize what you can't see, and you can't see your body's signals from inside a terminal.

## Works Well With

- **FleetDump** -- pair vitals with fleet activity for behavioral + biometric correlation
- Any AI governor or oversight system that reads structured markdown
- Daily standup workflows that incorporate physical readiness
- Personal dashboards that track cognitive performance over time

## Changelog

### 1.0.0
- Initial release
- Oura Cloud API v2 integration (sleep, readiness, activity, HRV)
- Garmin Connect integration (steps, HR, sleep, stress, Body Battery, HRV)
- Governor flags with cognitive performance thresholds
- Cross-reference interpretation table
- Session token caching for Garmin (avoids repeated MFA)
