# Bug Bounty Programs

## Overview
Track and manage active bug bounty programs, initiate reconnaissance workflows, and organize security research efforts.

## Bug Bounty Platforms

### Major Platforms
- **HackerOne** - https://hackerone.com
- **Bugcrowd** - https://bugcrowd.com
- **Intigriti** - https://intigriti.com
- **YesWeHack** - https://yeswehack.com
- **Synack** - https://synack.com (invite-only)

### Direct Programs
Many companies run direct bug bounty programs:
- Google VRP
- Microsoft Bug Bounty
- Apple Security Bounty
- Facebook Bug Bounty
- Tesla Bug Bounty

## Program Selection Criteria

### Scope Evaluation
- **Clear scope** - Well-defined in-scope targets
- **Reasonable exclusions** - Exclusions are fair and specific
- **Attack surface** - Large enough surface for meaningful testing
- **Wild card domains** - `*.example.com` allows subdomain hunting

### Reward Analysis
- **Minimum payout** - Lowest reward (shows program maturity)
- **Maximum payout** - Highest reward (indicates severity potential)
- **Average payout** - Typical reward (realistic expectations)
- **Payment reliability** - History of timely payments

### Program Maturity
- **Established programs** - Mature triage and response
- **New programs** - Fresh targets but may have process issues
- **Private programs** - Higher quality but need invitation
- **Public programs** - Open to all but higher competition

### Response Quality
- **Response time** - How quickly issues are triaged
- **Communication** - Quality of triage team interaction
- **Resolution time** - Time to fix and bounty payment
- **Reputation** - Community feedback on program

## Program Workflow

### 1. Program Research
```bash
# Research active programs
- Browse platform listings
- Check program metrics (submissions, avg bounty)
- Read program policy carefully
- Review past disclosed reports
```

### 2. Scope Analysis
```markdown
## Example Scope Review

**In Scope:**
- *.example.com (all subdomains)
- example.com
- api.example.com
- mobile apps (iOS, Android)

**Out of Scope:**
- Third-party integrations
- Social engineering
- Physical security
- DoS attacks

**Safe Harbor:**
- Stay in scope
- Don't access user data beyond what's necessary
- Report within 24 hours
- Give reasonable time to fix
```

### 3. Reconnaissance Initiation
```bash
# Use bug bounty automation tool
cd ~/.claude/skills/Webassessment/bug-bounty-tool
./bounty.sh recon [program-id]

# Manual recon workflow
1. Subdomain enumeration
2. Port scanning
3. Technology fingerprinting
4. Content discovery
5. Parameter discovery
```

### 4. Vulnerability Testing
Follow standard pentest methodology:
- See: `~/.claude/skills/Webassessment/Workflows/pentest/master-methodology.md`
- Focus on high-severity issues
- Document proof-of-concepts thoroughly

### 5. Report Submission
```markdown
## Report Template

# [Vulnerability Type] in [Affected Asset]

## Summary
Brief overview of the vulnerability (2-3 sentences)

## Severity Assessment
[Critical/High/Medium/Low] - with CVSS score if applicable

## Proof of Concept
### Reproduction Steps:
1. Navigate to [URL]
2. Perform [action]
3. Observe [result]

### Screenshots/Video:
[Attached]

## Impact
- What can an attacker do?
- What data is at risk?
- Business impact explanation

## Remediation
- Specific fix recommendations
- References to secure coding practices
- Example secure code (if applicable)

## References
- OWASP links
- CWE references
- Similar disclosed reports
```

## Bug Bounty Best Practices

### Do's ✅
- **Read the policy** - Understand scope and rules completely
- **Start broad** - Wide reconnaissance first
- **Quality over quantity** - Focus on high-severity issues
- **Clear PoCs** - Detailed reproduction steps
- **Professional communication** - Respectful and clear
- **Respect timelines** - Follow disclosure deadlines
- **Learn from duplicates** - Understand why it was a dup

### Don'ts ❌
- **Don't test out of scope** - Strict scope adherence
- **Don't spam** - Multiple low-quality reports hurts reputation
- **Don't argue about bounties** - Accept triage decisions gracefully
- **Don't pressure for quick payout** - Triage takes time
- **Don't publicly disclose prematurely** - Follow responsible disclosure
- **Don't access user data unnecessarily** - Minimal testing required

## Common Vulnerability Types (by Frequency)

### High Frequency
1. **IDOR** - Insecure Direct Object References
2. **XSS** - Cross-Site Scripting
3. **CSRF** - Cross-Site Request Forgery
4. **Authentication issues** - Weak auth, bypass
5. **Authorization flaws** - Missing access controls

### Medium Frequency
6. **SQL Injection** - Less common now but high impact
7. **SSRF** - Server-Side Request Forgery
8. **Open redirects** - Often low severity
9. **Information disclosure** - Varies in severity
10. **Business logic flaws** - Hard to find but valuable

### Low Frequency (High Impact)
11. **RCE** - Remote Code Execution
12. **Account takeover chains** - Chained vulnerabilities
13. **Payment manipulation** - E-commerce specific
14. **Subdomain takeover** - Infrastructure issues

## Automation Tool

### Tool Location
`~/.claude/skills/Webassessment/bug-bounty-tool/`

### Features
- Track active programs
- Automated program discovery
- Recon workflow initiation
- Progress tracking
- Report management

### Usage
See: `~/.claude/skills/Webassessment/Workflows/bug-bounty/automation-tool.md`

## Resources

### Wordlists & Tools
- **SecLists** - Comprehensive wordlist collection
- **Nuclei Templates** - Automated vulnerability scanning
- **Amass** - Asset discovery
- **FFUF** - Fast web fuzzing

### Learning Resources
- **Disclosed Reports** - Read past successful submissions
- **HackerOne Hacktivity** - Public disclosure timeline
- **Bugcrowd University** - Free training courses
- **PentesterLab** - Hands-on vulnerability training

### Community
- **Twitter** - #bugbounty community
- **Discord** - Bug bounty Discord servers
- **Reddit** - r/bugbounty
- **Blogs** - Read writeups from successful researchers

## Metrics to Track

### Personal Metrics
- Reports submitted
- Reports accepted vs duplicates
- Average bounty per report
- Response time (program quality indicator)
- Total earnings

### Program Metrics
- Active programs tracked
- Targets per program
- Vulnerabilities found per program
- Bounty range per program

## See Also

- Automation tool docs: `~/.claude/skills/Webassessment/Workflows/bug-bounty/AutomationTool.md`
- Pentest methodology: `~/.claude/skills/Webassessment/Workflows/pentest/MasterMethodology.md`
- Reconnaissance workflow: `~/.claude/skills/Webassessment/Workflows/pentest/Reconnaissance.md`
- Exploitation workflow: `~/.claude/skills/Webassessment/Workflows/pentest/Exploitation.md`
