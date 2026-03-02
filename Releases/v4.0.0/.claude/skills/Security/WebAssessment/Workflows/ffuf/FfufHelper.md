# FFUF Helper Script

## Overview
The FFUF helper script (`ffuf_helper.py`) automates common web fuzzing tasks and provides batch processing capabilities for penetration testing workflows.

## Location
`../../ffuf-helper.py`

## Purpose
- Automate repetitive fuzzing tasks
- Batch process multiple targets
- Standardize fuzzing workflows
- Generate organized output reports

## Usage

### Basic Usage
```bash
python ffuf_helper.py --help
```

### Common Patterns

**Directory Fuzzing:**
```bash
python ffuf_helper.py \
    --target https://target.com \
    --mode directory \
    --wordlist /path/to/wordlist.txt
```

**Subdomain Enumeration:**
```bash
python ffuf_helper.py \
    --target target.com \
    --mode subdomain \
    --wordlist /path/to/subdomains.txt
```

**Batch Fuzzing:**
```bash
python ffuf_helper.py \
    --targets-file targets.txt \
    --mode directory \
    --wordlist /path/to/wordlist.txt
```

## Features

### Auto-Calibration
- Automatically filters common false positives
- Adjusts filters based on response patterns
- Reduces manual result analysis

### Result Organization
- Structured output directory
- JSON and text output formats
- Organized by target and fuzzing mode

### Rate Limiting
- Configurable request rates
- Prevents target overload
- Respects server resources

### Authentication Support
- Cookie-based authentication
- Header-based authentication (API keys, Bearer tokens)
- Custom authentication methods

## Output Format

### Directory Structure
```
ffuf-results/
├── target-com/
│   ├── directory-fuzz/
│   │   ├── results.json
│   │   ├── results.txt
│   │   └── discovered-paths.txt
│   ├── subdomain-enum/
│   │   ├── results.json
│   │   └── subdomains.txt
│   └── vhost-discovery/
│       ├── results.json
│       └── vhosts.txt
└── summary.txt
```

### Result Fields
- URL/endpoint discovered
- HTTP status code
- Response size
- Word count
- Timestamp

## Integration with Pentest Workflow

### Phase 1: Reconnaissance
```bash
# Subdomain enumeration
python ffuf_helper.py \
    --target target.com \
    --mode subdomain \
    --wordlist subdomains.txt

# Vhost discovery
python ffuf_helper.py \
    --target target.com \
    --mode vhost \
    --wordlist vhosts.txt
```

### Phase 2: Mapping
```bash
# Directory and file discovery
python ffuf_helper.py \
    --target https://target.com \
    --mode directory \
    --wordlist directories.txt

# Parameter fuzzing
python ffuf_helper.py \
    --target https://target.com/api \
    --mode parameter \
    --wordlist parameters.txt
```

## Configuration

### Wordlists
The helper uses wordlists from `../../ffuf-resources/`:
- `common-directories.txt` - Common web directories
- `common-files.txt` - Common file names
- `subdomains.txt` - Subdomain wordlist
- `parameters.txt` - API parameter names

### Custom Wordlists
```bash
python ffuf_helper.py \
    --target https://target.com \
    --mode directory \
    --wordlist /path/to/custom-wordlist.txt
```

## Advanced Features

### Authenticated Fuzzing
```bash
python ffuf_helper.py \
    --target https://target.com \
    --mode directory \
    --wordlist wordlist.txt \
    --cookie "session=abc123" \
    --header "Authorization: Bearer token"
```

### Custom Filters
```bash
python ffuf_helper.py \
    --target https://target.com \
    --mode directory \
    --wordlist wordlist.txt \
    --filter-status 404,403 \
    --filter-size 4242
```

### Rate Limiting
```bash
python ffuf_helper.py \
    --target https://target.com \
    --mode directory \
    --wordlist wordlist.txt \
    --rate 10  # 10 requests per second
```

## Best Practices

1. **Start with small wordlists** - Test with small lists first
2. **Use auto-calibration** - Let the tool filter noise automatically
3. **Respect rate limits** - Don't overwhelm target systems
4. **Organize results** - Use structured output for easy analysis
5. **Document findings** - Save important discoveries immediately

## Troubleshooting

### No Results Found
- Check target is accessible
- Verify wordlist path is correct
- Try disabling auto-calibration
- Adjust filters (may be too aggressive)

### Too Many Results
- Enable auto-calibration
- Add status code filters
- Add size filters
- Use more specific wordlist

### Authentication Issues
- Verify cookie/token is valid
- Check authentication headers are correct
- Test authentication manually first

## See Also

- Main FFUF guide: `./FfufGuide.md`
- Pentest methodology: `../pentest/MasterMethodology.md`
- Wordlist resources: `../../ffuf-resources/`
