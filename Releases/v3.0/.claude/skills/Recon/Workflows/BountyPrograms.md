# Bounty Programs Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the BountyPrograms workflow in the Recon skill to find bounty programs"}' \
  > /dev/null 2>&1 &
```

Running the **BountyPrograms** workflow in the **Recon** skill to find bounty programs...

Discover and monitor public bug bounty programs from aggregated sources.

## Trigger Phrases

- "check available bounty programs"
- "new bounty programs"
- "find bounty programs"
- "does X have a bounty program"
- "bounty program list"
- "bug bounty opportunities"

## Data Sources

| Source | URL | Description |
|--------|-----|-------------|
| ProjectDiscovery Chaos | chaos.projectdiscovery.io | Community-curated bounty programs |
| chaos-bugbounty-list.json | GitHub (projectdiscovery/public-bugbounty-programs) | Central JSON registry |
| HackerOne | hackerone.com | Major bounty platform |
| Bugcrowd | bugcrowd.com/bug-bounty-list | Comprehensive bounty list |

## Tool Usage

```bash
# List all bounty programs
bun ~/.claude/skills/Recon/Tools/BountyPrograms.ts list

# Show only paid bounty programs (not just swag)
bun ~/.claude/skills/Recon/Tools/BountyPrograms.ts list --bounty-only

# Search for programs by keyword
bun ~/.claude/skills/Recon/Tools/BountyPrograms.ts search "crypto"
bun ~/.claude/skills/Recon/Tools/BountyPrograms.ts search "finance"
bun ~/.claude/skills/Recon/Tools/BountyPrograms.ts search "cloud"

# Check if a domain has a bounty program
bun ~/.claude/skills/Recon/Tools/BountyPrograms.ts check example.com

# Update local cache from sources
bun ~/.claude/skills/Recon/Tools/BountyPrograms.ts update

# Export as JSON
bun ~/.claude/skills/Recon/Tools/BountyPrograms.ts list --json > bounty-programs.json
```

## Output

The tool returns:
- Program name and URL
- Bounty type (💰 cash, 🎁 swag)
- In-scope domains
- Platform information

## Integration with Other Workflows

### Finding New Targets

```bash
# 1. Get list of bounty programs
bun BountyPrograms.ts list --bounty-only --json > targets.json

# 2. For each program, run subdomain enumeration
for domain in $(jq -r '.programs[].domains[]' targets.json | head -10); do
  bun SubdomainEnum.ts $domain
done

# 3. Port scan discovered subdomains
bun PortScan.ts subdomains.txt --top-ports 1000

# 4. Path discovery on web targets
bun PathDiscovery.ts https://target.com
```

### Monitoring for New Programs

Run regularly to check for new opportunities:

```bash
# Daily check for new programs
bun BountyPrograms.ts update
bun BountyPrograms.ts new --days 7
```

## Contributing New Programs

To add new programs to Chaos:
1. Fork github.com/projectdiscovery/public-bugbounty-programs
2. Add program to chaos-bugbounty-list.json
3. Submit pull request

Format:
```json
{
  "name": "Program Name",
  "url": "https://hackerone.com/program",
  "bounty": true,
  "swag": false,
  "domains": ["example.com", "*.example.com"]
}
```

## Cache

Local cache stored at: `~/.claude/skills/Recon/Data/BountyPrograms.json`
Cache expires after 24 hours and auto-refreshes on next use.
