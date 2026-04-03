# Bug Bounty Automation Tool

## Overview
The bug bounty automation tool tracks active programs, manages reconnaissance workflows, and organizes security research efforts.

## Location
`../../bug-bounty-tool/`

## Tool Structure

```
bug-bounty-tool/
├── bounty.sh              # Main CLI interface
├── src/                   # TypeScript source code
│   ├── commands/          # CLI commands
│   ├── database/          # Program database
│   ├── recon/             # Recon workflows
│   └── utils/             # Utility functions
├── cache/                 # Cached API responses
├── logs/                  # Execution logs
├── state.json             # Current state tracking
├── package.json           # Dependencies
└── README.md              # Full documentation
```

## Installation

### Dependencies
```bash
cd ../../bug-bounty-tool
bun install  # Using bun (preferred)
```

### Configuration
Configure API keys in `${PAI_DIR}/.env`:
```bash
HACKERONE_API_KEY=your_key_here
BUGCROWD_API_KEY=your_key_here
```

## Usage

### Main CLI Commands

**Update Programs:**
```bash
./bounty.sh update
```
- Fetches latest programs from platforms
- Updates local database
- Caches results for offline access

**List Active Programs:**
```bash
./bounty.sh list
```
- Shows all tracked programs
- Displays program metrics (scope, bounty range)
- Highlights new programs since last update

**Program Details:**
```bash
./bounty.sh show [program-id]
```
- Full program details
- Scope information
- Bounty range and metrics
- Past successful submissions (if public)

**Initiate Reconnaissance:**
```bash
./bounty.sh recon [program-id]
```
- Starts automated recon workflow
- Subdomain enumeration
- Port scanning
- Technology fingerprinting
- Content discovery
- Results saved to `recon/[program-name]/`

**Search Programs:**
```bash
./bounty.sh search [keyword]
```
- Search by company name
- Search by technology (e.g., "Node.js", "React")
- Search by bounty range

## Reconnaissance Workflow

### Automated Recon Process

When you run `./bounty.sh recon [program-id]`, the tool:

1. **Extracts Scope**
   - Parses program policy
   - Identifies in-scope domains
   - Notes exclusions and restrictions

2. **Subdomain Enumeration**
   ```bash
   # Uses multiple tools in parallel
   - subfinder for passive discovery
   - amass for comprehensive enumeration
   - Certificate transparency logs
   ```

3. **Port Scanning**
   ```bash
   # Scans discovered subdomains
   - nmap for top ports
   - Service version detection
   - Banner grabbing
   ```

4. **Technology Fingerprinting**
   ```bash
   # Identifies tech stack
   - whatweb for CMS/frameworks
   - Wappalyzer data
   - HTTP header analysis
   ```

5. **Content Discovery**
   ```bash
   # Finds hidden content
   - ffuf for directory fuzzing
   - Common wordlists (SecLists)
   - Technology-specific paths
   ```

6. **Results Organization**
   ```
   recon/[program-name]/
   ├── subdomains.txt
   ├── live-hosts.txt
   ├── ports/
   │   └── nmap-results.xml
   ├── technologies.json
   ├── content-discovery/
   │   └── discovered-paths.txt
   └── summary.md
   ```

### Manual Recon Integration

The tool provides a foundation; continue with manual testing:

```bash
# After automated recon completes:
cd recon/[program-name]

# Review findings
cat summary.md

# Deep-dive interesting targets
# - Focus on high-value subdomains (admin, api, staging)
# - Test discovered endpoints manually
# - Look for exposed credentials or keys
# - Test for common vulnerabilities
```

## Database Schema

### Program Record
```typescript
interface Program {
  id: string;
  name: string;
  platform: 'hackerone' | 'bugcrowd' | 'intigriti' | 'direct';
  url: string;
  scope: {
    domains: string[];
    wildcards: string[];
    apps: string[];
    exclusions: string[];
  };
  bounty: {
    min: number;
    max: number;
    currency: string;
  };
  metrics: {
    submissions: number;
    avgBounty: number;
    avgResponseTime: string;
  };
  status: 'active' | 'paused' | 'closed';
  lastUpdated: string;
}
```

## Advanced Features

### Custom Recon Workflows

Create custom recon workflows in `src/recon/custom/`:

```typescript
// Example: AWS-specific recon
export async function awsRecon(domains: string[]) {
  // Check for S3 buckets
  // Check for CloudFront distributions
  // Check for exposed EC2 metadata
  // Check for Lambda function URLs
}
```

### Notification Integration

Configure notifications for new programs:

```bash
# In ${PAI_DIR}/.env
SLACK_WEBHOOK_URL=your_webhook
DISCORD_WEBHOOK_URL=your_webhook
```

Tool will notify when:
- New programs match your criteria
- Existing programs update scope
- Bounty ranges change

### Progress Tracking

Track testing progress per program:

```bash
# Mark program as in-progress
./bounty.sh status [program-id] --status testing

# Add notes
./bounty.sh notes [program-id] --add "Found XSS in /search endpoint"

# View testing history
./bounty.sh history [program-id]
```

## Report Management

### Generate Report Drafts

```bash
./bounty.sh report [program-id] --vulnerability xss

# Generates template report:
# - Pre-filled program information
# - Scope verification
# - Severity guidelines for that program
# - Submission checklist
```

### Track Submissions

```bash
# Log submission
./bounty.sh submit [program-id] \
  --title "XSS in search function" \
  --severity high \
  --report-id H1-12345

# Check submission status
./bounty.sh submissions --status pending

# Mark as resolved
./bounty.sh submit H1-12345 --status resolved --bounty 500
```

## Integration with Pentest Workflow

### Phase 0: Scoping
```bash
# Select program and understand scope
./bounty.sh show [program-id]
./bounty.sh recon [program-id]
```

### Phase 1: Reconnaissance
```bash
# Automated recon provides foundation
# Continue with manual deep-dive
cd recon/[program-name]
```

### Phases 2-5: Manual Testing
- Use recon results as starting point
- Follow standard pentest methodology
- Document findings with report tool

## Troubleshooting

### API Rate Limiting
```bash
# Configure rate limits in src/config.ts
export const RATE_LIMITS = {
  hackerone: 100,  // requests per hour
  bugcrowd: 50
};
```

### Recon Failures
```bash
# Check logs
cat logs/recon-[program-id].log

# Re-run specific phase
./bounty.sh recon [program-id] --phase subdomain-enum
```

### Database Corruption
```bash
# Backup database
cp src/Database/programs.json programs-backup.json

# Rebuild from cache
./bounty.sh rebuild-db
```

## Best Practices

1. **Regular updates** - Update program list weekly
2. **Verify scope** - Always manually verify scope before testing
3. **Organize results** - Keep recon results structured
4. **Track progress** - Use built-in tracking to avoid duplicate effort
5. **Backup data** - Regular backups of program database and recon results

## See Also

- Bug bounty programs guide: `./Programs.md`
- Reconnaissance workflow: `../pentest/Reconnaissance.md`
- Pentest methodology: `../pentest/MasterMethodology.md`
- Full tool documentation: `../../bug-bounty-tool/README.md`
