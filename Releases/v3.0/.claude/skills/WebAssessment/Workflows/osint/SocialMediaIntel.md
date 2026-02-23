# Social Media Intelligence (SOCMINT) Workflow

## Overview

**Social Media Intelligence (SOCMINT)** is the collection, analysis, and exploitation of information from social media platforms to support security assessments, social engineering preparation, and organizational reconnaissance. SOCMINT reveals human relationships, organizational structures, and behavioral patterns that technical reconnaissance cannot discover.

**Purpose:** Build comprehensive profiles of individuals and organizations through analysis of publicly available social media data to inform security testing and social engineering scenarios.

**Critical Distinction:** SOCMINT operates in the most ethically sensitive area of OSINT. The line between legitimate security research and privacy invasion is narrow, context-dependent, and requires constant vigilance.

## When to Use This Workflow

### Legitimate Security Scenarios

**Social Engineering Preparation (Authorized):**
- Phishing campaign development for authorized testing
- Pretexting scenario creation
- Vishing (voice phishing) preparation
- Physical penetration testing reconnaissance

**Organizational Mapping:**
- Employee enumeration for large organizations
- Departmental structure identification
- Key personnel identification
- Relationship and hierarchy mapping
- Third-party vendor identification

**Threat Intelligence:**
- Monitoring for compromised employee accounts
- Detecting credential exposure
- Identifying insider threats
- Tracking security awareness
- Assessing social engineering susceptibility

**Attack Surface Understanding:**
- Technology stack hints from employee posts
- Security tool identification from job postings
- Infrastructure details from conference talks
- Business process understanding

### When NOT to Use SOCMINT

**⚠️ STOP - Do Not Proceed Without Authorization:**
- Personal relationship research beyond professional scope
- Stalking or harassment investigations
- Background checks without legal authority
- Competitive intelligence gathering beyond public information
- Law enforcement activities without proper authority
- Any activity that feels invasive or inappropriate

**Ethical Boundary Test:** If you would be uncomfortable explaining your research to the target's face, you're probably crossing ethical boundaries.

## Required Tools

### Essential Tools

**Username Search:**
- **Sherlock** - Username search across 300+ platforms
- **WhatsMyName** - Username enumeration
- **Namechk** - Username availability checker

**Platform-Specific Tools:**
- **Osintgram** - Instagram intelligence gathering
- **Tinfoleak** - Twitter/X intelligence analysis
- **LinkedIn Sales Navigator** (manual, web-based)

**Data Aggregation:**
- **theHarvester** - Email and username harvesting
- **SpiderFoot** - Automated social media module

**Search Engines:**
- Google Advanced Search
- Bing
- DuckDuckGo
- Specialized search operators

### Supporting Tools

**Profile Analysis:**
- **Social-Analyzer** - Profile deep analysis
- **Twint** - Twitter scraping (may be broken, check status)
- **Instaloader** - Instagram scraping

**Relationship Mapping:**
- **Maltego** - Visual relationship analysis
- Manual documentation (spreadsheets, diagrams)

**Archive and History:**
- **Wayback Machine** - Historical social media content
- **Archive.today** - Social media snapshots

## Methodology

### Phase 1: Target Identification

**Objective:** Identify target individuals and their social media presence.

**Step 1: Employee Enumeration**

```bash
# Use theHarvester for email addresses
theHarvester -d example.com -b linkedin,google -l 500

# Extract usernames from email addresses
cat theharvester-results.html | grep -oE "[a-zA-Z0-9._%+-]+@example\.com" | \
  cut -d'@' -f1 | sort -u > usernames.txt

# Manual LinkedIn reconnaissance
# Search: "site:linkedin.com/in/ example.com"
# Export names manually or use LinkedIn Sales Navigator
```

**Step 2: Name to Username Conversion**

Common username patterns:
```
john.smith
jsmith
smithj
john_smith
johnsmith
john-smith
john123
jsmith23
```

Create username wordlist:
```bash
# For name "John Smith"
cat > username-candidates.txt <<EOF
john.smith
john_smith
john-smith
johnsmith
jsmith
smithj
j.smith
john.s
johnsmithsec
EOF
```

**Step 3: Google Dorking for Social Profiles**

```
# LinkedIn profiles
site:linkedin.com/in/ "example.com"

# Twitter profiles mentioning company
site:twitter.com "works at Example Company"

# Facebook profiles
site:facebook.com "works at Example Company"

# Instagram profiles
site:instagram.com "Example Company"

# GitHub profiles
site:github.com "example.com"
```

### Phase 2: Username Search and Enumeration

**Objective:** Discover social media accounts across multiple platforms.

**Step 1: Sherlock Username Search**

```bash
# Search single username across all platforms
sherlock john.smith

# Search with specific output file
sherlock john.smith -o sherlock-john-smith.txt

# Search multiple usernames from file
sherlock --timeout 10 --print-found < username-candidates.txt > sherlock-results.txt

# Search only specific sites
sherlock john.smith --site Twitter --site Instagram --site GitHub

# Verbose output to see progress
sherlock -v john.smith
```

**Sherlock Output Analysis:**
```bash
# Extract only found profiles
grep "^\[+\]" sherlock-results.txt

# Count platforms where username exists
grep -c "^\[+\]" sherlock-results.txt

# Extract URLs only
grep -oE "https?://[^ ]+" sherlock-results.txt > found-profiles.txt
```

**Step 2: WhatsMyName for Additional Coverage**

```bash
# Clone WhatsMyName
git clone https://github.com/WebBreacher/WhatsMyName
cd WhatsMyName

# Run web_accounts_list_checker.py
python3 web_accounts_list_checker.py -u john.smith

# Check multiple usernames
while read username; do
  python3 web_accounts_list_checker.py -u $username
  sleep 2
done < ../username-candidates.txt
```

**Step 3: Manual Platform Checks**

**High-Value Platforms:**
- **LinkedIn** - Professional information, connections, employment history
- **Twitter/X** - Real-time thoughts, interests, complaints, technology mentions
- **GitHub** - Code repositories, projects, technical skills
- **Facebook** - Personal information, family, friends, photos
- **Instagram** - Visual content, locations, lifestyle
- **Reddit** - Interests, communities, questions, problems

**Manual Check Process:**
```
1. Navigate to platform
2. Search username or real name
3. Review profile for:
   - Employment verification
   - Technology mentions
   - Location information
   - Contact information
   - Relationship networks
   - Security-relevant details
```

### Phase 3: Instagram Intelligence with Osintgram

**Objective:** Extract detailed intelligence from Instagram accounts.

**⚠️ ETHICAL WARNING:** Osintgram is EXTREMELY invasive. Use only for:
- Authorized security testing
- Your own accounts for testing
- Accounts with explicit authorization

**Step 1: Osintgram Setup**

```bash
# Clone and setup
git clone https://github.com/Datalux/Osintgram
cd Osintgram
pip3 install -r requirements.txt

# Configure Instagram credentials (use dedicated research account)
# Edit config/settings.py with credentials
```

**Step 2: Osintgram Commands**

```bash
# Launch Osintgram
python3 main.py

# Set target
> set target john.smith

# Profile information
> info
> profile
> userinfo

# Content analysis
> photos
> comments
> tagged

# Location intelligence
> photosmap
> places

# Relationship mapping
> followers
> followings
> fwersemail
> fwingsemail

# Engagement analysis
> likes
> wcommented
> wtagged

# Export data
> addrs
> user_stories
```

**What Osintgram Reveals:**
- Full name and bio
- Email addresses and phone numbers (if public)
- Profile picture history
- Posted photos and captions
- Comments and engagements
- Followers and following lists
- Email addresses of connections
- Geolocation data from photos
- Posting patterns and frequency
- Interests and hashtags

**Step 3: Instagram OSINT Analysis**

```bash
# Analyze for security-relevant information
- Technology mentions (company systems, tools)
- Location patterns (home, office, frequented places)
- Relationship networks (colleagues, friends, family)
- Security practices (check-ins, personal info sharing)
- Travel patterns (vacation announcements, absence)
- Behavioral patterns (posting times, habits)
```

### Phase 4: Twitter/X Intelligence with Tinfoleak

**Objective:** Analyze Twitter/X accounts for intelligence value.

**Step 1: Tinfoleak Setup**

```bash
# Clone Tinfoleak
git clone https://github.com/vaguileradiaz/tinfoleak
cd tinfoleak

# Install dependencies
pip3 install -r requirements.txt

# Configure Twitter API credentials (required)
# Apply for Twitter Developer account and create app
# Add credentials to config file
```

**Step 2: Tinfoleak Analysis**

```bash
# Basic user information
python3 tinfoleak.py -u john_smith

# Get user's geolocation information
python3 tinfoleak.py -u john_smith -g

# Get user's Twitter client information
python3 tinfoleak.py -u john_smith -c

# Get hashtags used by user
python3 tinfoleak.py -u john_smith -s

# Get user's mentioned users
python3 tinfoleak.py -u john_smith -m

# Comprehensive analysis
python3 tinfoleak.py -u john_smith -a
```

**Step 3: Manual Twitter/X Reconnaissance**

**Advanced Twitter Search Operators:**
```
# All tweets from user
from:john_smith

# Tweets mentioning company
from:john_smith "Example Company"

# Tweets about specific technology
from:john_smith (AWS OR Azure OR "cloud infrastructure")

# Location-based tweets
from:john_smith near:"San Francisco"

# Date range
from:john_smith since:2024-01-01 until:2024-12-31

# Sensitive information patterns
from:john_smith (password OR credentials OR token OR API)

# Technology stack hints
from:john_smith (MongoDB OR PostgreSQL OR MySQL OR Redis)

# Security tool mentions
from:john_smith (SIEM OR firewall OR IDS OR WAF)
```

**What to Look For:**
- Technology stack mentions
- Security tool discussions
- Conference presentations
- Code snippets or credentials
- Complaints about systems
- Out-of-office announcements
- Work-related frustrations
- Professional relationships

### Phase 5: LinkedIn Reconnaissance

**Objective:** Map organizational structure and professional relationships.

**⚠️ NOTE:** LinkedIn has strict terms of service. Use manual browsing, not automated scraping.

**Step 1: Employee Enumeration**

```
Manual Search Process:
1. Search: "Example Company" in LinkedIn search
2. Filter by "People"
3. Note employee names and titles
4. Document organizational hierarchy
5. Identify key personnel (C-suite, IT, Security)
```

**Step 2: Profile Analysis**

**Information to Extract:**
- Current position and duration
- Previous employers
- Education and certifications
- Skills and endorsements
- Connections (if visible)
- Posts and articles
- Groups and interests
- Contact information (if public)

**Security-Relevant Details:**
- Security certifications (CISSP, CEH, OSCP)
- Technology skills (Python, AWS, Kubernetes)
- Tools and platforms used
- Projects and responsibilities
- Recent job changes (insider threat risk)
- Professional frustrations (social engineering vector)

**Step 3: Organizational Mapping**

```bash
# Create organizational chart (manual documentation)
CEO: Jane Doe
├── CTO: John Smith (target's manager)
│   ├── VP Engineering: Alice Brown
│   │   ├── Director DevOps: Bob Johnson
│   │   └── Senior Engineer: [TARGET] John Smith
│   └── VP Security: Charlie Davis
└── CFO: Diana Wilson
```

**Step 4: LinkedIn Sales Navigator (Paid Tool)**

Advanced features:
- Boolean search capabilities
- Advanced filters (company size, seniority, department)
- Lead recommendations
- Saved searches and alerts
- InMail capabilities (DO NOT USE for unauthorized testing)

### Phase 6: GitHub and Code Repository Intelligence

**Objective:** Discover code repositories, technical projects, and potential exposures.

**Step 1: GitHub User Search**

```bash
# Search for user profiles
# Manual: github.com search bar

# Search for organization repositories
# Manual: github.com/example-company

# Search code for email addresses
# Manual: "example.com" in:email
```

**Step 2: Repository Analysis**

```bash
# Clone interesting repositories for analysis
git clone https://github.com/username/repository

# Search for sensitive information
# Use tools like truffleHog, gitleaks, or git-secrets

# Analyze commit history
git log --all --author="john.smith@example.com"

# Check for exposed credentials
grep -r "password\|secret\|api_key\|token" .

# Look for configuration files
find . -name "*.env" -o -name "*.config" -o -name "*.yml"
```

**What to Look For:**
- Exposed credentials and API keys
- Configuration files with secrets
- Internal tool names and versions
- Architecture and infrastructure details
- Security tools and practices
- Code quality and security practices
- Personal projects revealing skills

### Phase 7: Data Aggregation and Analysis

**Objective:** Correlate information from multiple sources to build comprehensive profiles.

**Step 1: Create Target Dossier**

```markdown
# Target: John Smith

## Professional Information
- Position: Senior Software Engineer
- Company: Example Company
- Duration: 3 years
- Department: DevOps
- Manager: Alice Brown (VP Engineering)

## Contact Information
- Email: john.smith@example.com
- Phone: (Found on LinkedIn)
- Location: San Francisco, CA

## Social Media Presence
- LinkedIn: linkedin.com/in/john-smith-dev
- Twitter: @john_smith_dev
- GitHub: github.com/johnsmith
- Instagram: @johnsmith (personal)

## Technology Stack
- Languages: Python, Go, JavaScript
- Cloud: AWS (primary), Azure (secondary)
- Tools: Kubernetes, Docker, Terraform, Jenkins
- Security: Familiar with WAF, SIEM, IDS

## Security-Relevant Observations
- Recently tweeted frustration about "legacy authentication system"
- GitHub repo shows Okta integration project
- LinkedIn shows AWS Certified Solutions Architect
- Instagram check-ins show frequent travel (office security?)

## Relationship Network
- Direct report to Alice Brown
- Collaborates with: Bob Johnson (DevOps), Charlie Davis (Security)
- External network: 500+ LinkedIn connections
- Active in AWS and DevOps communities

## Behavioral Patterns
- Posts to Twitter during work hours (9am-5pm PST)
- Instagram activity mostly weekends
- GitHub commits typically evening hours
- Frequent conference speaker (technical authority)

## Social Engineering Vectors
- Technology frustrations (legacy systems)
- Professional ambitions (career advancement)
- Community involvement (responds to technical questions)
- AWS expertise (potential pretext: AWS support)

## Recommendations
- High-value target for cloud infrastructure access
- Technical knowledge suggests phishing resistance
- Professional frustrations = potential pretext angle
- Manager (Alice) may be alternative target path
```

**Step 2: Relationship Mapping**

```bash
# Use Maltego for visual mapping (manual process)
# Or create manual diagram

Target: John Smith
├── Professional Relationships
│   ├── Manager: Alice Brown
│   ├── Peers: Bob Johnson, Carol White
│   └── Reports: None (individual contributor)
├── Social Connections
│   ├── Conference network: 50+ speakers/attendees
│   ├── LinkedIn: 500+ professional connections
│   └── Twitter: 300+ followers (tech community)
└── Technology Relationships
    ├── AWS community member
    ├── DevOps practitioner community
    └── Open source contributor
```

### Phase 8: Reporting and Documentation

**Objective:** Document findings in actionable format for security testing.

**Step 1: Executive Summary**

```markdown
## SOCMINT Summary: Example Company

### Scope
- 50 employees enumerated
- 35 social media profiles discovered
- 5 high-value targets identified

### Key Findings
1. Significant information exposure on LinkedIn (technology stack)
2. Active GitHub presence reveals internal tools
3. Twitter complaints about legacy authentication system
4. Instagram check-ins reveal office location and travel patterns

### Security Implications
- Social engineering vectors identified
- Technology stack completely mapped
- Key personnel and relationships documented
- Potential credential exposure in GitHub repositories

### Recommendations
1. Employee security awareness training
2. Social media policy enforcement
3. GitHub repository review and secret scanning
4. LinkedIn profile guidelines for technical staff
```

**Step 2: Target Profiles**

Create individual dossiers for high-value targets (see Step 1 above).

**Step 3: Organizational Map**

Visual representation of organizational structure, reporting relationships, and key personnel.

## Output Analysis

### High-Value Intelligence

**Technology Stack:**
- Cloud providers (AWS, Azure, GCP)
- Programming languages
- Frameworks and tools
- Security products
- CI/CD pipeline
- Monitoring and logging

**Organizational Structure:**
- Key decision makers
- IT and security team composition
- Reporting relationships
- Departmental organization
- Third-party vendors and partners

**Behavioral Patterns:**
- Work hours and schedules
- Travel patterns
- Communication preferences
- Professional frustrations
- Career ambitions

**Security Practices:**
- Security awareness level
- Information sharing habits
- Access control practices
- Password management hints
- Security tool usage

### Red Flags and Opportunities

**Critical Exposures:**
- Credentials in GitHub repositories
- API keys in public code
- Detailed infrastructure diagrams shared publicly
- Security tool configurations disclosed
- Out-of-office announcements with duration

**Social Engineering Vectors:**
- Professional frustrations (disgruntled employees)
- Career ambitions (eager to prove themselves)
- Technical expertise areas (pretext opportunities)
- Relationship networks (trusted referrals)
- Personal interests (common ground)

## Next Steps

### Immediate Actions

**1. Credential Validation:**
- Test discovered email addresses
- Check for password reuse (breach databases)
- Attempt password reset flows
- Test for username enumeration

**2. Social Engineering Preparation:**
- Develop pretexts based on findings
- Create targeted phishing scenarios
- Prepare vishing scripts
- Design physical penetration pretexts

**3. Targeted Reconnaissance:**
- Deep dive on high-value targets
- Map additional relationships
- Monitor for new exposures
- Track behavioral changes

### Integration with Security Testing

**Feed Into Phishing Campaigns:**
- Use discovered information for targeted phishing
- Reference legitimate projects and initiatives
- Leverage relationship networks for trust
- Time campaigns based on behavioral patterns

**Support Physical Penetration:**
- Use organizational knowledge for pretexts
- Identify key personnel for impersonation
- Understand office routines and patterns
- Map physical security practices

**Inform Technical Testing:**
- Use technology stack for targeted attacks
- Test discovered credentials
- Focus on identified tools and systems
- Exploit knowledge gaps and frustrations

## Legal and Ethical Considerations

### Legal Framework

**Always Legal:**
- Viewing public social media profiles
- Reading publicly posted content
- Following public accounts
- Searching public databases

**Requires Authorization:**
- Connecting/friending targets
- Direct communication
- Creating fake profiles
- Impersonation
- Any form of social engineering

**Never Legal Without Explicit Authority:**
- Accessing private content
- Unauthorized account access
- Harassment or stalking
- Impersonation for fraudulent purposes
- CFAA violations

### Ethical Guidelines

**The Invasiveness Spectrum:**

```
LOW INVASIVENESS ←→ HIGH INVASIVENESS

[Public Profiles] → [Deep Profile Analysis] → [Relationship Mapping] →
[Behavioral Tracking] → [Personal Life Details] → [Family/Friends]
```

**Ethical Decision Framework:**

1. **Necessity Test:** Is this information necessary for security objectives?
2. **Proportionality Test:** Is the invasiveness proportional to the risk?
3. **Publicity Test:** Would I be comfortable explaining this research publicly?
4. **Reversibility Test:** Can the target reasonably control this exposure?
5. **Impact Test:** What harm could this research cause?

**Stop If:**
- Research feels voyeuristic rather than professional
- Information is deeply personal without security relevance
- Necessity is questionable or weak
- Family or non-professional relationships are involved
- You feel uncomfortable or uncertain

### Privacy Boundaries

**Professional vs Personal:**
- **Professional information:** Fair game (LinkedIn, professional Twitter)
- **Personal information:** Requires strong justification (Instagram, Facebook)
- **Family information:** Almost never justified
- **Health/religious/political:** Never justified without extraordinary cause

**Context Collapse Consideration:**
- Information may be public but not publicized
- Consider poster's expectations and intent
- Respect "public for friends" vs "public for everyone"
- Be aware of surveillance implications

### Responsible Disclosure

**Found Sensitive Information:**
- Document finding location and exposure
- Report to responsible party immediately
- Allow reasonable remediation time
- Do not exploit or publicize unnecessarily
- Follow coordinated disclosure practices

**Employee Privacy Issues:**
- Report systematic privacy exposures
- Recommend employee training
- Suggest social media policies
- Balance security with individual privacy rights

## Best Practices

### Operational Security

**Protect Your Research:**
- Use separate research accounts
- Avoid leaving digital footprints
- Don't friend/follow targets
- Use view-only reconnaissance
- Consider legal discovery implications

**Documentation Security:**
- Encrypt sensitive research data
- Limit access to need-to-know
- Proper retention and destruction
- Chain of custody maintenance
- Compliance with data protection laws

### Quality Control

**Verify Information:**
- Cross-reference multiple sources
- Check dates and currency
- Assess reliability and bias
- Distinguish fact from inference
- Document confidence levels

**Avoid Confirmation Bias:**
- Don't cherry-pick supporting information
- Consider contradictory evidence
- Reassess conclusions regularly
- Seek alternative explanations
- Document uncertainty

### Efficiency

**Focus on High-Value Intelligence:**
- Prioritize professional profiles over personal
- Focus on decision-makers and technical staff
- Technology and security information first
- Organizational structure over individual details
- Quality over quantity

**Know When to Stop:**
- Diminishing returns on deep dives
- Recognize invasiveness creep
- Set time limits per target
- Establish sufficiency criteria
- Balance breadth and depth

## Troubleshooting

### Common Issues

**Issue: Username not found on any platforms**
```bash
# Try variations
- Add numbers (john.smith1, john.smith23)
- Try different separators (john_smith, john-smith, john.smith)
- Try abbreviated versions (jsmith, j.smith)
- Try full name variations (johnsmith, smithjohn)
- Check for nicknames or aliases
```

**Issue: Profiles are private or locked down**
```bash
# Respect privacy settings - DO NOT ATTEMPT TO BYPASS
# Document that profile exists but is private
# Focus on available public information only
# Consider this a positive security indicator
```

**Issue: Too much information, analysis paralysis**
```bash
# Focus on security-relevant information only
# Create structured dossiers (see Phase 7)
# Prioritize technical and organizational intel
# Set time limits per target
# Use templates for consistency
```

**Issue: Ethical uncertainty**
```bash
# STOP research immediately
# Consult legal counsel or senior leadership
# Review authorization scope
# Document decision rationale
# Err on side of caution - when in doubt, DON'T
```

## Tool Reference

### Sherlock
```bash
# Basic usage
sherlock username

# Common options
sherlock username --timeout 10
sherlock username --print-found
sherlock username --csv
```

### Osintgram
```bash
# Most useful commands
info, profile, userinfo     # Profile information
followers, followings       # Relationship network
fwersemail, fwingsemail     # Email extraction
photos, photosmap           # Content and location
addrs                       # Extract email addresses
```

### Tinfoleak
```bash
# Most useful flags
-u username                 # Target user
-g                         # Geolocation
-c                         # Twitter clients used
-s                         # Hashtags
-a                         # All analysis
```

## References

**Tool Documentation:**
- Sherlock: https://github.com/sherlock-project/sherlock
- Osintgram: https://github.com/Datalux/Osintgram
- Tinfoleak: https://github.com/vaguileradiaz/tinfoleak
- WhatsMyName: https://github.com/WebBreacher/WhatsMyName

**SOCMINT Best Practices:**
- OSINT Framework: https://osintframework.com/
- IntelTechniques: https://inteltechniques.com/
- Trace Labs OSINT: https://www.tracelabs.org/

**Ethics and Privacy:**
- Bellingcat Ethics Guide
- OSINT Curious Ethics Guidelines
- NATO OSINT Handbook

**Related Workflows:**
- `master-guide.md` - Complete OSINT methodology and ethics
- `reconnaissance.md` - Technical reconnaissance workflows
- `automation.md` - SpiderFoot social media modules
- `../pentest/master-methodology.md` - Integration with pentest phases

---

**Key Takeaway:** SOCMINT is the most powerful and most ethically fraught OSINT discipline. Always operate with explicit authorization, respect privacy boundaries, focus on security-relevant information, and maintain professional distance. When in doubt about ethics, STOP and seek guidance. The goal is legitimate security testing, not surveillance.
