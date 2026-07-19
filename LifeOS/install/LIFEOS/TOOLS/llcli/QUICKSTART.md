# llcli Quick Start

**The 30-second guide to using llcli**

## Installation

Already done! Located at: `{{LIFEOS_DIR}}/TOOLS/llcli/`

## Usage

```bash
# Get help
"${LIFEOS_DIR}/TOOLS/llcli/llcli.ts" --help

# Today's recordings
"${LIFEOS_DIR}/TOOLS/llcli/llcli.ts" today

# Specific date
"${LIFEOS_DIR}/TOOLS/llcli/llcli.ts" date 2025-11-17

# Search
"${LIFEOS_DIR}/TOOLS/llcli/llcli.ts" search "consulting"

# With custom limit
"${LIFEOS_DIR}/TOOLS/llcli/llcli.ts" today --limit 50
```

## Piping to jq

```bash
# Just titles
"${LIFEOS_DIR}/TOOLS/llcli/llcli.ts" today | jq -r '.data.lifelogs[].title'

# Count recordings
"${LIFEOS_DIR}/TOOLS/llcli/llcli.ts" date 2025-11-17 | jq '.data.lifelogs | length'

# Long recordings (>30 min)
"${LIFEOS_DIR}/TOOLS/llcli/llcli.ts" today | jq '.data.lifelogs[] | select(
  ((.endTime | fromdateiso8601) - (.startTime | fromdateiso8601)) > 1800
)'
```

## Configuration

API key already configured in `{{LIFEOS_ROOT}}/.env`:
```bash
LIMITLESS_API_KEY=your_key
```

## Full Documentation

See: `{{LIFEOS_DIR}}/TOOLS/llcli/README.md`
