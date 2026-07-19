# llcli - Limitless.ai API Command-Line Interface

**Version:** 1.0.0
**Author:** {{PRINCIPAL_FULL_NAME}}
**Last Updated:** 2025-11-17

---

## Overview

`llcli` is a clean, deterministic command-line interface for the Limitless.ai API. It provides simple access to pendant recordings with a focus on reliability, composability, and documentation.

### Philosophy

`llcli` follows {{DA_NAME}}'s **CLI-First Architecture**:

1. **Deterministic** - Same input always produces same output
2. **Clean** - Single responsibility (API calls only)
3. **Composable** - JSON output pipes to jq, grep, other tools
4. **Documented** - Comprehensive help and examples
5. **Testable** - Predictable, verifiable behavior

This tool replaces ad-hoc bash scripts with a maintainable, version-controlled interface.

---

## Installation

### Prerequisites

- Bun runtime installed
- Limitless.ai API key

### Setup

1. **Install the CLI:**
   ```bash
   cd $LIFEOS_DIR/TOOLS/llcli
   chmod +x llcli.ts
   ```

2. **Add to PATH (optional):**
   ```bash
   # Add to ~/.zshrc or ~/.bashrc
   export PATH="$LIFEOS_DIR/TOOLS/llcli:$PATH"
   ```

3. **Configure API Key:**

   Add to `$LIFEOS_ROOT/.env`:
   ```bash
   LIMITLESS_API_KEY=your_api_key_here
   ```

4. **Verify Installation:**
   ```bash
   $LIFEOS_DIR/TOOLS/llcli/llcli.ts --help
   ```

---

## Usage

### Command Structure

```bash
llcli <command> [arguments] [options]
```

### Commands

#### 1. Today's Recordings

Fetch recordings from today (Pacific Time):

```bash
llcli today
```

With custom limit:
```bash
llcli today --limit 50
```

#### 2. Specific Date

Fetch recordings for a specific date:

```bash
llcli date 2025-11-17
```

With custom limit:
```bash
llcli date 2025-11-14 --limit 100
```

**Date Format:** YYYY-MM-DD (ISO 8601)

#### 3. Keyword Search

Search all recordings for a keyword:

```bash
llcli search "AI agents"
```

With custom limit:
```bash
llcli search "consulting" --limit 50
```

#### 4. Help

```bash
llcli --help
llcli help
llcli -h
```

#### 5. Version

```bash
llcli --version
llcli version
llcli -v
```

---

## Options

### `--limit N`

Maximum number of results to return.

- **Default:** 20
- **Type:** Positive integer
- **Applies to:** All fetch commands

**Examples:**
```bash
llcli today --limit 100
llcli date 2025-11-17 --limit 50
llcli search "meeting" --limit 10
```

---

## Output Format

All commands return JSON to stdout:

```json
{
  "data": {
    "lifelogs": [
      {
        "id": "unique_id",
        "title": "Recording title",
        "startTime": "2025-11-17T12:17:00-08:00",
        "endTime": "2025-11-17T12:50:00-08:00",
        "markdown": "Full transcript...",
        "isStarred": false,
        "updatedAt": "2025-11-17T13:00:00-08:00"
      }
    ]
  }
}
```

### Exit Codes

- **0** - Success
- **1** - Error (invalid args, API failure, etc.)

### Error Handling

Errors and messages go to stderr:

```bash
# Success
llcli today > output.json
echo $?  # 0

# Error
llcli date invalid-date
# Error: Date must be in YYYY-MM-DD format
echo $?  # 1
```

---

## Examples

### Basic Usage

```bash
# Today's recordings
llcli today

# Specific date
llcli date 2025-11-17

# Search
llcli search "Acme Corp"
```

### With jq Processing

```bash
# Extract just titles
llcli today | jq -r '.data.lifelogs[].title'

# Count recordings
llcli date 2025-11-17 | jq '.data.lifelogs | length'

# Filter by keyword in markdown
llcli today | jq '.data.lifelogs[] | select(.markdown | test("consulting"; "i"))'

# Get recordings longer than 30 minutes
llcli today | jq '.data.lifelogs[] | select(
  ((.endTime | fromdateiso8601) - (.startTime | fromdateiso8601)) > 1800
)'
```

### Save to File

```bash
# Save today's recordings
llcli today > ~/recordings-$(date +%Y-%m-%d).json

# Save search results
llcli search "AI" > ~/ai-discussions.json
```

### Pipe to grep

```bash
# Find recordings mentioning specific people
llcli today | grep -i "alice\|bob"

# Check if keyword exists
if llcli search "consulting" | grep -q "consulting"; then
  echo "Found consulting discussions"
fi
```

### Multiple Commands

```bash
# Compare two dates
diff \
  <(llcli date 2025-11-17 | jq -r '.data.lifelogs[].title') \
  <(llcli date 2025-11-16 | jq -r '.data.lifelogs[].title')

# Combine multiple searches
{
  llcli search "AI"
  llcli search "consulting"
} | jq -s 'add'
```

---

## Configuration

### Environment Variables

**Location:** `$LIFEOS_ROOT/.env`

**Required:**
```bash
LIMITLESS_API_KEY=your_api_key_here
```

### Default Settings

| Setting | Value | Description |
|---------|-------|-------------|
| Timezone | `America/Los_Angeles` | Pacific Time |
| Base URL | `https://api.limitless.ai/v1` | API endpoint |
| Default Limit | `20` | Results per query |

### Customization

To change defaults, modify the `DEFAULTS` object in `llcli.ts`:

```typescript
const DEFAULTS = {
  timezone: 'America/Los_Angeles',
  baseUrl: 'https://api.limitless.ai/v1',
  limit: 20,
};
```

---

## API Reference

### Limitless.ai API

**Documentation:** https://api.limitless.ai/docs

**Endpoints Used:**
- `GET /v1/lifelogs` - Fetch recordings

**Authentication:**
- Header: `X-API-Key: {your_key}`

**Query Parameters:**
- `date` - YYYY-MM-DD format
- `search` - Keyword search
- `timezone` - IANA timezone (e.g., `America/Los_Angeles`)
- `limit` - Max results

---

## Development

### Testing

```bash
# Manual tests
llcli today
llcli date 2025-11-17
llcli search "test"
llcli --help

# Error cases
llcli date invalid-date  # Should fail with error
llcli search ""          # Should fail with error
llcli unknown-command    # Should fail with error
```

### Code Structure

```
llcli.ts
├── Types (interfaces)
├── Configuration (loadConfig)
├── API Functions (fetchLifelogs)
├── CLI Commands (fetchToday, fetchDate, fetchSearch)
├── Help Documentation (showHelp, showVersion)
└── Main Entry Point (main)
```

### Adding New Features

1. Add type definitions
2. Implement function
3. Add to main() switch
4. Update help text
5. Add examples to README
6. Test thoroughly

---

## Troubleshooting

### "LIMITLESS_API_KEY not found"

**Solution:** Add API key to `$LIFEOS_ROOT/.env`:
```bash
echo "LIMITLESS_API_KEY=your_key" >> $LIFEOS_ROOT/.env
```

### "Cannot read $LIFEOS_ROOT/.env file"

**Solution:** Create the file:
```bash
touch $LIFEOS_ROOT/.env
chmod 600 $LIFEOS_ROOT/.env
```

### "bun: command not found"

**Solution:** Install Bun runtime:
```bash
curl -fsSL https://bun.sh/install | bash
```

### "Permission denied"

**Solution:** Make executable:
```bash
chmod +x $LIFEOS_DIR/TOOLS/llcli/llcli.ts
```

### API Errors

Check:
1. API key is valid
2. Internet connection works
3. Limitless.ai API is operational

---

## Comparison with Old Script

### Old Approach (Bash Script)

```bash
#!/bin/bash
# fetch-lifelogs.sh

# 50+ lines of bash
# Manual URL construction
# String interpolation
# No validation
# No help system
# Hard to test
# Hard to maintain
```

### New Approach (llcli)

```typescript
// llcli.ts

// TypeScript with types
// Validated inputs
// Clean error handling
// Full documentation
// Composable design
// Testable
// Maintainable
```

### Benefits

| Feature | Old Script | llcli |
|---------|-----------|-------|
| Type Safety | ❌ | ✅ |
| Input Validation | ❌ | ✅ |
| Error Handling | Basic | Comprehensive |
| Documentation | Minimal | Full --help |
| Testability | Hard | Easy |
| Composability | Limited | Full |
| Maintainability | Low | High |

---

## Integration

### With Skills

Replace script calls:

**Old:**
```bash
$LIFEOS_ROOT/skills/lifelog/Scripts/fetch-lifelogs.sh today "" 20
```

**New:**
```bash
$LIFEOS_DIR/TOOLS/llcli/llcli.ts today --limit 20
```

### With Workflows

```markdown
**Step 1:** Fetch recordings
```bash
llcli today > today.json
```

**Step 2:** Process with jq
```bash
cat today.json | jq -r '.data.lifelogs[].markdown'
```
```

---

## Best Practices

### 1. Always Use --limit for Large Queries

```bash
# Good
llcli search "common word" --limit 100

# Can be slow
llcli search "the"
```

### 2. Validate JSON Output

```bash
llcli today | jq empty  # Validates JSON
```

### 3. Save Raw Data

```bash
# Save before processing
llcli today > raw.json
cat raw.json | jq '.data.lifelogs[0]'
```

### 4. Use Error Checking

```bash
if llcli date 2025-11-17 > data.json; then
  echo "Success"
else
  echo "Failed"
fi
```

---

## Future Enhancements

Potential features:

- [ ] `--format` option (json, markdown, text)
- [ ] `--timezone` override
- [ ] `--starred` filter
- [ ] `--duration-min` / `--duration-max` filters
- [ ] `--after` / `--before` time filters
- [ ] `list` command for date ranges
- [ ] `stats` command for summaries
- [ ] Config file support (~/.llclirc)
- [ ] Caching layer
- [ ] Offline mode

---

## License

MIT

---

## Support

For issues, questions, or contributions:
- File: `$LIFEOS_DIR/TOOLS/llcli/`
- Skill: `$LIFEOS_ROOT/skills/lifelog/`
- Constitution: `~/.claude/`

---

**Remember:** llcli is deterministic infrastructure for AI. Build it once, use it reliably forever.
