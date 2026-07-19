# DailyBrief Workflow

Run the master daily civic digest for the principal's hometown. Calls every fetcher, writes `latest.json`, summarizes the top items in chat.

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running DailyBrief in LocalIntelligence"}' \
  > /dev/null 2>&1 &
```

Running **DailyBrief** in **LocalIntelligence**...

## Procedure

1. Resolve hometown via `Tools/Hometown.ts`. If absent, surface a setup-help message and exit.
2. Run `bun run "${LIFEOS_ROOT}/skills/LocalIntelligence/Tools/Refresh.ts"` — orchestrator runs all eight fetchers via `Promise.allSettled`.
3. Read the resulting `{{LIFEOS_DIR}}/MEMORY/DATA/LocalIntelligence/latest.json`.
4. Summarize top 3 items per category, with date and source link.
5. Surface any `meta.errors` entries — name the failing source, do not hide it.

## Intent-to-Flag Mapping

| User says | Flag | Effect |
|-----------|------|--------|
| "refresh", "now", "latest" | `--force` | Re-run even if today's digest exists |
| "summary only" | `--summary` | Skip orchestrator, read existing latest.json |
| "json only" | `--json` | Emit raw JSON, no chat summary |

```bash
bun run "${LIFEOS_ROOT}/skills/LocalIntelligence/Tools/Refresh.ts" [--force] [--summary] [--json]
```

## Output

- File: `{{LIFEOS_DIR}}/MEMORY/DATA/LocalIntelligence/<YYYY-MM-DD>_<city>_<state>_digest.json`
- Symlink: `{{LIFEOS_DIR}}/MEMORY/DATA/LocalIntelligence/latest.json`
- Chat: top-3 items per section + `meta.errors` listed if any.
