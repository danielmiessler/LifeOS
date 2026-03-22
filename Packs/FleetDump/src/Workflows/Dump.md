# Workflow: Dump

Collect daily fleet activity from all sources and write a dated markdown summary.

## Steps

### 1. Determine the target date

- If the user says "today" or gives no date: use no flags (defaults to today)
- If the user says "yesterday": use `--yesterday`
- If the user specifies a date: use `--date YYYY-MM-DD`

### 2. Run the tool

```bash
python3 src/Tools/fleet-dump.py [flags]
```

Expected output: `OK: /path/to/YYYY-MM-DD.md` followed by a line count.

### 3. Read the output file

Read the generated markdown file to extract:

- **Session Estimate:** Duration span based on first and last commit timestamps
- **Git Activity (PAI repo):** Local commits with one-line summaries
- **GitHub Activity (all repos):** Cross-repo commit counts, line additions/deletions, pace flags
- **Fleet Dispatches:** Cross-AI status updates from the fleet_messages repo
- **Work Sessions (PRDs):** New or modified PRD files in work directories
- **Memory Changes:** New or modified memory files (excluding MEMORY.md itself)
- **Flinch Log Status:** Count of unresolved flinch entries with previews
- **Governor Questions:** Four adversarial prompts for external oversight

### 4. Summarize findings

Present the user with:

1. **Session span:** How long was the active window (first commit to last commit)
2. **Commit volume:** Total commits across all repos, with line change totals
3. **Highlights:** The 2-3 most significant commits or changes
4. **Pace assessment:** Are there any pace flags (high commit volume, large code churn, large deletions)
5. **Memory/flinch:** Any new memory entries or unresolved flinch items worth noting
6. **Governor feed:** Note that the dump is ready for governor consumption

### 5. Cross-reference (if vitals-dump exists)

If a vitals dump exists for the same date, note correlations from the cross-reference table:

- High commits + low sleep = running on fumes
- Low HRV + weekend streak = regulation drift
- Depleted Body Battery + long session = unsustainable pace
- High readiness + moderate activity = green light

## Error Handling

- **No git repo:** Git activity section shows "(no commits)". Other sections still work.
- **gh not authenticated:** GitHub activity shows "(no GitHub activity)". Local git still works.
- **fleet_messages unavailable:** Dispatches section shows "(fleet_messages repo unavailable)".
- **No WORK directory:** Work sessions section shows "(no WORK directory)".
- **No memory directory:** Memory section shows "(no memory directory)".
- **No flinch log:** Flinch section shows "(no flinch log)".

## Output Location

Default: `/mnt/g/My Drive/fleet-dumps/YYYY-MM-DD.md`

Configurable by editing `DUMP_DIR` in the tool source.
