---
name: AnnualReports
description: Aggregate and analyze annual security reports from major vendors — extract trends, compare threat landscapes year-over-year, produce synthesized threat intelligence summaries. Fetch, list, and update report sources. USE WHEN annual reports, security reports, threat reports, industry reports, vendor reports, threat landscape, fetch report, list sources, update sources.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/AnnualReports/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the AnnualReports skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **AnnualReports** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# AnnualReports - Security Report Aggregation

Aggregates and analyzes annual security reports from 570+ sources across the cybersecurity industry.

**Source:** [awesome-annual-security-reports](https://github.com/jacobdjwilson/awesome-annual-security-reports)

## Workflow Routing

- **UPDATE** - Fetch latest report sources from GitHub (use `Tools/UpdateSources.ts`)
- **ANALYZE** - Analyze reports for trends and insights (use `Tools/ListSources.ts` + content analysis)
- **FETCH** - Download specific reports (use `Tools/FetchReport.ts`)

## Quick Reference

```bash
# Update sources from GitHub
bun run ~/.claude/skills/Security/AnnualReports/Tools/UpdateSources.ts

# List all sources
bun run ~/.claude/skills/Security/AnnualReports/Tools/ListSources.ts [category]

# Fetch a specific report
bun run ~/.claude/skills/Security/AnnualReports/Tools/FetchReport.ts <vendor> <report-name>
```

## Categories

### Analysis Reports
- **Global Threat Intelligence** (56 reports) - CrowdStrike, Microsoft, IBM, Mandiant, etc.
- **Regional Assessments** (11 reports) - FBI, CISA, Europol, NCSC, etc.
- **Sector Specific Intelligence** (13 reports) - Healthcare, Finance, Energy, Transport
- **Application Security** (21 reports) - OWASP, Veracode, Snyk, GitGuardian
- **Cloud Security** (11 reports) - Google Cloud, AWS, Wiz, Datadog
- **Vulnerabilities** (14 reports) - Rapid7, VulnCheck, Edgescan
- **Ransomware** (9 reports) - Veeam, Zscaler, Palo Alto
- **Data Breaches** (6 reports) - Verizon DBIR, IBM Cost of Breach
- **Physical Security** (6 reports) - Dragos, Nozomi, Waterfall
- **AI and Emerging Technologies** (11 reports) - Anthropic, Google, Zimperium

### Survey Reports
- **Industry Trends** (68 reports) - WEF, ISACA, Splunk, Gartner
- **Executive Perspectives** (7 reports) - CISO reports, Deloitte, Proofpoint
- **Workforce and Culture** (5 reports) - ISC2, KnowBe4, CompTIA
- **Market and Investment Research** (5 reports) - IT Harvest, Recorded Future
- **Application Security** (9 reports) - Checkmarx, Snyk, Traceable
- **Cloud Security** (7 reports) - Palo Alto, ISC2, Fortinet
- **Identity Security** (19 reports) - CyberArk, Okta, SailPoint
- **Penetration Testing** (5 reports) - HackerOne, Cobalt, Bugcrowd
- **Privacy and Data Protection** (8 reports) - Cisco, Proofpoint, Drata
- **Ransomware** (6 reports) - Sophos, Delinea, Semperis
- **AI and Emerging Technologies** (12 reports) - Darktrace, Wiz, HiddenLayer

## Data Files

- `Data/sources.json` - All report sources with metadata
- `Reports/` - Downloaded report files (PDFs, markdown)

## Examples

**Example 1: Update sources from upstream**
```
User: "Update the annual reports"
→ Invokes UPDATE workflow
→ Fetches latest README from GitHub
→ Parses and updates sources.json
→ Reports new/changed entries
```

**Example 2: Find threat intelligence reports**
```
User: "What threat reports are available?"
→ Lists Global Threat Intelligence category
→ Shows 56 reports from major vendors
→ Provides direct URLs
```

**Example 3: Analyze ransomware trends**
```
User: "Analyze ransomware reports"
→ Invokes ANALYZE workflow
→ Fetches relevant reports
→ Synthesizes findings across vendors
→ Produces trend analysis
```
