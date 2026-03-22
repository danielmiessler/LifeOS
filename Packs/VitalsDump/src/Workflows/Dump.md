# Workflow: Dump

Pull a daily biometric summary from Oura Ring and Garmin Connect.

## Steps

### 1. Determine the target date

- If the user says "today" or gives no date: use no flags (defaults to today)
- If the user says "yesterday": use `--yesterday`
- If the user specifies a date: use `--date YYYY-MM-DD`

### 2. Run the tool

```bash
python3 src/Tools/vitals-dump.py [flags]
```

Expected output: `OK: /path/to/YYYY-MM-DD.md` followed by a line count.

### 3. Read the output file

Read the generated markdown file to extract:

- **Oura section:** Sleep duration, efficiency, deep/REM/light breakdown, lowest HR, average HRV, readiness score, activity
- **Garmin section:** Steps, resting HR, sleep score, stress average, Body Battery (high/low/current), HRV status
- **Governor flags:** Any threshold warnings (low sleep, low HRV, depleted Body Battery, high stress, elevated resting HR)
- **Cross-reference table:** Signal combinations and their interpretations

### 4. Summarize findings

Present the user with:

1. **Headline:** One sentence on overall physical state (e.g., "Well-rested with strong HRV" or "Sleep-deprived with elevated stress")
2. **Key numbers:** The 3-5 most important metrics
3. **Flags:** Any governor warnings, with plain-language interpretation
4. **Recommendation:** Based on the data, what kind of work day makes sense (deep work, light tasks, recovery)

### 5. Cross-reference (if fleet-dump exists)

If a fleet-dump exists for the same date, note correlations:

- High commit count + low sleep = running on fumes
- Low HRV + weekend activity = regulation drift
- High readiness + moderate activity = green light for building

## Error Handling

- **No Oura token:** Tool runs but Oura section shows "(no Oura token configured)". Garmin data still works.
- **Garmin session expired:** Tool shows "(Garmin session expired)". Re-run Garmin authentication.
- **No data for date:** Sections show "(no data)". This is normal for future dates or dates before device setup.
- **Output directory doesn't exist:** Created automatically on first run.

## Output Location

Default: `/mnt/g/My Drive/fleet-governor/vitals/YYYY-MM-DD.md`

Configurable by editing `VITALS_DIR` in the tool source.
