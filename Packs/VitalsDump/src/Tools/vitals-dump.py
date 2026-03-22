#!/usr/bin/env python3
"""
vitals-dump — Daily biometric summary for the external governor (Gemini).

Pulls vitals from Oura Ring (Cloud API v2) and Garmin Connect, writes a
dated markdown file to G: Drive for Gemmy to read alongside fleet-dumps.

Sources:
  1. Oura Cloud API v2 — sleep, readiness, HRV, resting HR, SpO2
  2. Garmin Connect — stress, Body Battery, sleep, HRV, HR, steps

Output: /mnt/g/My Drive/fleet-governor/vitals/YYYY-MM-DD.md

Credentials:
  Oura:   OURA_TOKEN env var or /root/.claude/.credentials.json → oura_token
  Garmin: GARMIN_EMAIL + GARMIN_PASSWORD env vars or .credentials.json → garmin_email, garmin_password

Usage:
  vitals-dump              — dump today's vitals
  vitals-dump --yesterday  — dump yesterday
  vitals-dump --date 2026-03-14  — specific date
"""

from __future__ import annotations
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from pathlib import Path

GDRIVE = Path("/mnt/g/My Drive")
VITALS_DIR = GDRIVE / "fleet-governor" / "vitals"
CREDS_FILE = Path("/root/.claude/.credentials.json")

# --- Credential loading ---

def load_creds() -> dict:
    """Load credentials from env vars or .credentials.json."""
    creds = {}

    # Try env vars first
    creds["oura_token"] = os.environ.get("OURA_TOKEN", "")
    creds["garmin_email"] = os.environ.get("GARMIN_EMAIL", "")
    creds["garmin_password"] = os.environ.get("GARMIN_PASSWORD", "")

    # Fall back to credentials file
    if CREDS_FILE.exists():
        try:
            data = json.loads(CREDS_FILE.read_text())
            if not creds["oura_token"]:
                creds["oura_token"] = data.get("oura_token", "")
            if not creds["garmin_email"]:
                creds["garmin_email"] = data.get("garmin_email", "")
            if not creds["garmin_password"]:
                creds["garmin_password"] = data.get("garmin_password", "")
        except (json.JSONDecodeError, OSError):
            pass

    return creds


def get_date() -> str:
    if "--yesterday" in sys.argv:
        return (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    if "--date" in sys.argv:
        idx = sys.argv.index("--date")
        if idx + 1 < len(sys.argv):
            return sys.argv[idx + 1]
    return datetime.now().strftime("%Y-%m-%d")


# --- Oura API v2 ---

def oura_api(endpoint: str, token: str, params: dict | None = None) -> dict | list | None:
    """Call Oura Cloud API v2."""
    base = "https://api.ouraring.com/v2/usercollection"
    url = f"{base}/{endpoint}"
    if params:
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        url += f"?{qs}"

    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except (urllib.error.URLError, json.JSONDecodeError, OSError) as e:
        return {"error": str(e)}


def oura_vitals(date: str, token: str) -> str:
    """Fetch Oura sleep, readiness, HRV for a date."""
    if not token:
        return "(no Oura token configured)"

    sections = []

    # Sleep
    sleep = oura_api("sleep", token, {"start_date": date, "end_date": date})
    if sleep and "data" in sleep and sleep["data"]:
        s = sleep["data"][-1]  # Most recent sleep period
        total_min = s.get("total_sleep_duration", 0) // 60
        deep_min = s.get("deep_sleep_duration", 0) // 60
        rem_min = s.get("rem_sleep_duration", 0) // 60
        light_min = s.get("light_sleep_duration", 0) // 60
        awake_min = s.get("awake_time", 0) // 60
        efficiency = s.get("efficiency", 0)
        hr_lowest = s.get("lowest_heart_rate", "—")
        hrv_avg = s.get("average_hrv", "—")

        sections.append(f"**Sleep:** {total_min // 60}h {total_min % 60}m total | efficiency {efficiency}%")
        sections.append(f"  Deep: {deep_min}m | REM: {rem_min}m | Light: {light_min}m | Awake: {awake_min}m")
        sections.append(f"  Lowest HR: {hr_lowest} bpm | Avg HRV: {hrv_avg} ms")
    elif sleep and "error" in sleep:
        sections.append(f"**Sleep:** (error: {sleep['error']})")
    else:
        sections.append("**Sleep:** (no data)")

    # Daily readiness
    readiness = oura_api("daily_readiness", token, {"start_date": date, "end_date": date})
    if readiness and "data" in readiness and readiness["data"]:
        r = readiness["data"][-1]
        score = r.get("score", "—")
        temp_dev = r.get("temperature_deviation", "—")
        contrib = r.get("contributors", {})
        resting_hr = contrib.get("resting_heart_rate", "—")
        hrv_balance = contrib.get("hrv_balance", "—")
        recovery = contrib.get("recovery_index", "—")

        sections.append(f"**Readiness:** {score}/100")
        sections.append(f"  Resting HR contrib: {resting_hr} | HRV balance: {hrv_balance} | Recovery: {recovery}")
        if temp_dev and temp_dev != "—":
            sections.append(f"  Temp deviation: {temp_dev}°C")
    else:
        sections.append("**Readiness:** (no data)")

    # Daily activity
    activity = oura_api("daily_activity", token, {"start_date": date, "end_date": date})
    if activity and "data" in activity and activity["data"]:
        a = activity["data"][-1]
        steps = a.get("steps", "—")
        cal = a.get("active_calories", "—")
        sections.append(f"**Activity:** {steps} steps | {cal} active cal")
    else:
        sections.append("**Activity:** (no data)")

    return "\n".join(sections)


# --- Garmin Connect ---

def garmin_vitals(date: str, email: str, password: str) -> str:
    """Fetch Garmin stress, Body Battery, sleep, HR, steps."""
    if not email or not password:
        return "(no Garmin credentials configured)"

    try:
        from garminconnect import Garmin
    except ImportError:
        return "(garminconnect not installed — run: pip3 install garminconnect)"

    try:
        # Session token caching via garth
        token_dir = Path("/root/.claude/.garmin_session")
        token_dir.mkdir(exist_ok=True)

        api = Garmin(email, password)
        # Try loading saved garth session first (avoids MFA)
        try:
            api.garth.load(str(token_dir))
            api.login(str(token_dir))
        except Exception:
            # Saved session expired or doesn't exist — need interactive login
            return "(Garmin session expired — run: python3 /root/.claude/tools/garmin-auth)"

    except Exception as e:
        return f"(Garmin login failed: {e})"

    sections = []
    dt = datetime.strptime(date, "%Y-%m-%d").date()

    # Steps
    try:
        steps_data = api.get_steps_data(dt.isoformat())
        if steps_data:
            total_steps = sum(s.get("steps", 0) for s in steps_data if isinstance(s, dict))
            sections.append(f"**Steps:** {total_steps:,}")
    except Exception:
        sections.append("**Steps:** (unavailable)")

    # Heart rate
    try:
        hr_data = api.get_heart_rates(dt.isoformat())
        if hr_data:
            resting = hr_data.get("restingHeartRate", "—")
            min_hr = hr_data.get("minHeartRate", "—")
            max_hr = hr_data.get("maxHeartRate", "—")
            sections.append(f"**Heart Rate:** resting {resting} bpm | min {min_hr} | max {max_hr}")
    except Exception:
        sections.append("**Heart Rate:** (unavailable)")

    # Sleep
    try:
        sleep_data = api.get_sleep_data(dt.isoformat())
        if sleep_data and "dailySleepDTO" in sleep_data:
            sd = sleep_data["dailySleepDTO"]
            duration_sec = sd.get("sleepTimeSeconds", 0) or 0
            duration_min = duration_sec // 60
            deep_sec = sd.get("deepSleepSeconds", 0) or 0
            light_sec = sd.get("lightSleepSeconds", 0) or 0
            rem_sec = sd.get("remSleepSeconds", 0) or 0
            awake_sec = sd.get("awakeSleepSeconds", 0) or 0
            score = sd.get("sleepScores", {}).get("overall", {}).get("value", "—")

            sections.append(f"**Sleep:** {duration_min // 60}h {duration_min % 60}m | score {score}")
            sections.append(f"  Deep: {deep_sec // 60}m | Light: {light_sec // 60}m | REM: {rem_sec // 60}m | Awake: {awake_sec // 60}m")
    except Exception:
        sections.append("**Sleep:** (unavailable)")

    # Stress
    try:
        stress_data = api.get_stress_data(dt.isoformat())
        if stress_data:
            avg_stress = stress_data.get("overallStressLevel", "—")
            rest_stress = stress_data.get("restStressDuration", 0) or 0
            high_stress = stress_data.get("highStressDuration", 0) or 0
            sections.append(f"**Stress:** avg {avg_stress} | rest {rest_stress // 60}m | high {high_stress // 60}m")
    except Exception:
        sections.append("**Stress:** (unavailable)")

    # Body Battery
    try:
        bb_data = api.get_body_battery(dt.isoformat())
        if bb_data and isinstance(bb_data, list) and len(bb_data) > 0:
            # Find highest and lowest
            levels = [b.get("bodyBatteryLevel", 0) for b in bb_data if isinstance(b, dict) and "bodyBatteryLevel" in b]
            if levels:
                sections.append(f"**Body Battery:** high {max(levels)} | low {min(levels)} | current {levels[-1]}")
    except Exception:
        sections.append("**Body Battery:** (unavailable)")

    # HRV
    try:
        hrv_data = api.get_hrv_data(dt.isoformat())
        if hrv_data:
            weekly_avg = hrv_data.get("weeklyAvg", "—")
            last_night = hrv_data.get("lastNightAvg", "—")
            status = hrv_data.get("status", "—")
            sections.append(f"**HRV:** last night {last_night} ms | weekly avg {weekly_avg} ms | status: {status}")
    except Exception:
        sections.append("**HRV:** (unavailable)")

    return "\n".join(sections) if sections else "(no Garmin data)"


# --- Governor flags ---

def vitals_flags(oura_text: str, garmin_text: str) -> str:
    """Generate governor-relevant flags from vitals."""
    flags = []

    # Parse sleep duration from either source
    for text in [oura_text, garmin_text]:
        if "Sleep:" in text:
            # Look for "Xh Ym" pattern
            import re
            match = re.search(r"(\d+)h\s+(\d+)m total", text)
            if not match:
                match = re.search(r"(\d+)h\s+(\d+)m", text)
            if match:
                hours = int(match.group(1))
                mins = int(match.group(2))
                total = hours * 60 + mins
                if total < 360:  # < 6 hours
                    flags.append(f"⚠️ LOW SLEEP: {hours}h {mins}m — under 6-hour threshold")
                elif total < 420:  # < 7 hours
                    flags.append(f"⚡ MARGINAL SLEEP: {hours}h {mins}m — under 7-hour target")
                break  # Only flag from one source

    # Parse HRV
    import re
    hrv_match = re.search(r"Avg HRV:\s*(\d+)", oura_text)
    if hrv_match:
        hrv = int(hrv_match.group(1))
        if hrv < 20:
            flags.append(f"⚠️ LOW HRV: {hrv} ms — significant recovery deficit")
        elif hrv < 30:
            flags.append(f"⚡ BELOW-AVERAGE HRV: {hrv} ms — monitor trend")

    # Parse readiness score
    readiness_match = re.search(r"Readiness:\s*(\d+)/100", oura_text)
    if readiness_match:
        score = int(readiness_match.group(1))
        if score < 60:
            flags.append(f"⚠️ LOW READINESS: {score}/100 — consider rest day")
        elif score < 70:
            flags.append(f"⚡ MARGINAL READINESS: {score}/100 — light day recommended")

    # Parse Body Battery
    bb_match = re.search(r"Body Battery:.*?current\s+(\d+)", garmin_text)
    if bb_match:
        bb = int(bb_match.group(1))
        if bb < 20:
            flags.append(f"⚠️ DEPLETED BODY BATTERY: {bb} — stop and recover")
        elif bb < 40:
            flags.append(f"⚡ LOW BODY BATTERY: {bb} — pace yourself")

    # Parse stress
    stress_match = re.search(r"Stress:.*?avg\s+(\d+)", garmin_text)
    if stress_match:
        stress = int(stress_match.group(1))
        if stress > 50:
            flags.append(f"⚠️ HIGH STRESS: avg {stress} — elevated baseline")

    # Parse resting HR from Garmin
    rhr_match = re.search(r"resting\s+(\d+)\s+bpm", garmin_text)
    if rhr_match:
        rhr = int(rhr_match.group(1))
        if rhr > 70:
            flags.append(f"⚡ ELEVATED RESTING HR: {rhr} bpm — possible fatigue or stress")

    return "\n".join(flags) if flags else "(all vitals within normal range)"


# --- Build report ---

def build_report(date: str) -> str:
    creds = load_creds()

    oura_text = oura_vitals(date, creds["oura_token"])
    garmin_text = garmin_vitals(date, creds["garmin_email"], creds["garmin_password"])
    flags = vitals_flags(oura_text, garmin_text)

    lines = []
    lines.append(f"# Vitals — {date}")
    lines.append(f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*")
    lines.append("*For: Gemini (External Governor)*")
    lines.append("")
    lines.append("---")
    lines.append("")

    lines.append("## Oura Ring")
    lines.append(oura_text)
    lines.append("")

    lines.append("## Garmin")
    lines.append(garmin_text)
    lines.append("")

    lines.append("## Governor Flags")
    lines.append(flags)
    lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## Cross-Reference")
    lines.append(f"Pair with `fleet-dumps/{date}.md` for behavioral + biometric correlation.")
    lines.append("")
    lines.append("| Signal Combo | Interpretation |")
    lines.append("|---|---|")
    lines.append("| Low sleep + high commits | Pattern running on fumes |")
    lines.append("| Low HRV + weekend streak | Regulation drift — escalate |")
    lines.append("| Depleted Body Battery + 8hr session | Unsustainable pace |")
    lines.append("| High readiness + moderate activity | Green light — building day |")
    lines.append("| Low readiness + low activity | Recovery working as intended |")

    return "\n".join(lines)


def main():
    date = get_date()
    VITALS_DIR.mkdir(parents=True, exist_ok=True)
    report = build_report(date)
    out = VITALS_DIR / f"{date}.md"
    out.write_text(report)
    print(f"OK: {out}")
    print(f"    {len(report.splitlines())} lines")


if __name__ == "__main__":
    main()
