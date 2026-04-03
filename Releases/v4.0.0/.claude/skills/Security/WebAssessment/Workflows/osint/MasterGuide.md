# OSINT Master Guide

## Overview

**Open Source Intelligence (OSINT)** is the systematic collection, analysis, and exploitation of publicly available information to support security research, penetration testing, and intelligence operations. OSINT provides the foundational reconnaissance layer that informs all subsequent testing and exploitation activities.

**Purpose:** Establish comprehensive target understanding through passive and active information gathering from public sources.

**Value Proposition:** OSINT delivers 70-80% of penetration testing value through free, legal, publicly accessible sources - often revealing critical attack surface before active testing begins.

## When to Use OSINT

### Security Assessment Scenarios

**Initial Reconnaissance (Phase 1):**
- Starting a penetration test or security assessment
- Mapping organizational attack surface
- Identifying domains, subdomains, and infrastructure
- Discovering employee information and relationships
- Understanding technology stack and architecture

**Bug Bounty Research:**
- Program scope validation and expansion
- Asset discovery beyond published scope
- Historical vulnerability research
- Technology fingerprinting for known weaknesses

**Threat Intelligence:**
- Monitoring for exposed credentials
- Tracking data breaches and leaks
- Identifying security misconfigurations
- Discovering sensitive information exposure

**Social Engineering Preparation:**
- Building target profiles
- Identifying communication patterns
- Mapping organizational relationships
- Discovering personal and professional information

### Integration with Security Testing

OSINT is **NOT a standalone activity** - it feeds directly into:
- **Reconnaissance (Phase 1):** Passive information gathering
- **Mapping (Phase 2):** Active asset enumeration
- **Vulnerability Analysis (Phase 3):** Technology-specific testing
- **Exploitation (Phase 4):** Credential stuffing, targeted attacks

## The Four Phases of OSINT

### Phase 1: Planning & Requirements

**Define Intelligence Requirements:**
- What information do we need?
- What are the target boundaries?
- What are the success criteria?
- What are the legal and ethical constraints?

**Establish Scope:**
- Primary targets (domains, organizations, individuals)
- Secondary targets (partners, subsidiaries, vendors)
- Excluded targets (out of scope entities)
- Time boundaries (how far back to search)

**Document Rules of Engagement:**
- Authorization level and scope
- Passive vs active collection boundaries
- Data retention and handling procedures
- Responsible disclosure requirements

### Phase 2: Collection

**Passive Collection (No Direct Interaction):**
- Search engines (Google, Bing, DuckDuckGo)
- Social media platforms (LinkedIn, Twitter, Facebook)
- Public databases (WHOIS, DNS, certificates)
- Code repositories (GitHub, GitLab, Bitbucket)
- Historical archives (Wayback Machine)
- Breach databases (Have I Been Pwned, Dehashed)

**Active Collection (Direct Interaction):**
- Subdomain enumeration tools (Subfinder, Amass)
- DNS reconnaissance (DNSRecon, DNSdumpster)
- Port scanning (Nmap, Masscan)
- Technology fingerprinting (WhatWeb, Wappalyzer)
- Network mapping and service detection

**Automated Collection:**
- SpiderFoot for comprehensive automation
- theHarvester for email and subdomain harvesting
- Recon-ng for modular reconnaissance
- Maltego for visual relationship mapping

### Phase 3: Analysis & Correlation

**Data Processing:**
- Aggregate data from multiple sources
- Remove duplicates and false positives
- Validate findings through cross-reference
- Identify patterns and relationships

**Intelligence Development:**
- Correlate disparate data points
- Build attack surface maps
- Identify high-value targets
- Discover potential vulnerabilities
- Map trust relationships and dependencies

**Visualization:**
- Create network diagrams
- Build relationship maps
- Develop timeline visualizations
- Generate heat maps of activity

### Phase 4: Reporting & Action

**Documentation Requirements:**
- Executive summary of findings
- Detailed asset inventory
- Attack surface analysis
- Identified risks and exposures
- Recommended next steps

**Actionable Intelligence:**
- Prioritized target list for testing
- Technology-specific test cases
- Credential lists for validation
- Social engineering vectors
- Exploitation opportunities

**Integration with Testing:**
- Feed OSINT into reconnaissance phase
- Inform vulnerability testing priorities
- Support exploitation planning
- Validate findings and assumptions

## OSINT Methodology Framework

### The Intelligence Cycle

```
┌──────────────────────────────────────────────┐
│  1. PLANNING                                 │
│     ↓                                        │
│  2. COLLECTION (Passive → Active)            │
│     ↓                                        │
│  3. PROCESSING (Filter, Validate, Aggregate) │
│     ↓                                        │
│  4. ANALYSIS (Correlate, Visualize, Assess)  │
│     ↓                                        │
│  5. DISSEMINATION (Report, Brief, Action)    │
│     ↓                                        │
│  6. FEEDBACK (Refine, Iterate, Improve)      │
│     └─────────────────────────────────────→  │
└──────────────────────────────────────────────┘
```

### Progressive Disclosure

**Level 1 - Surface Intelligence:**
- Public websites and social media
- Search engine results
- Basic WHOIS data
- SSL certificate information

**Level 2 - Deep Intelligence:**
- Subdomain enumeration
- DNS zone walking
- Code repository analysis
- Historical data archives

**Level 3 - Advanced Intelligence:**
- Breach database correlation
- Dark web monitoring
- Advanced Google dorking
- IoT device discovery (Shodan, Censys)

**Level 4 - Covert Intelligence:**
- Social engineering reconnaissance
- Physical location intelligence
- Supply chain analysis
- Third-party relationship mapping

## Tool Categories and When to Use Each

### 1. Domain & Network Reconnaissance

**Purpose:** Discover infrastructure, subdomains, and network topology

**Tools:**
- **Subfinder** - Fast subdomain discovery using passive sources
- **Amass** - In-depth subdomain enumeration with DNS brute-forcing
- **DNSRecon** - DNS enumeration and zone transfer testing
- **theHarvester** - Email, subdomain, and host gathering
- **Recon-ng** - Modular reconnaissance framework

**When to Use:**
- Starting any penetration test
- Bug bounty initial reconnaissance
- Attack surface mapping
- Infrastructure change detection

### 2. Technology Fingerprinting

**Purpose:** Identify web technologies, frameworks, and software versions

**Tools:**
- **WhatWeb** - Web technology identification
- **Wappalyzer** (browser extension) - Technology stack detection
- **Nmap** - Service version detection

**When to Use:**
- After subdomain discovery
- Before vulnerability scanning
- To identify known vulnerable software
- Technology-specific testing planning

### 3. Social Media Intelligence (SOCMINT)

**Purpose:** Gather information about individuals and organizations from social platforms

**Tools:**
- **Sherlock** - Username search across 300+ platforms
- **Osintgram** - Instagram intelligence gathering
- **Tinfoleak** - Twitter/X intelligence analysis
- **LinkedIn manual reconnaissance**

**When to Use:**
- Social engineering preparation
- Employee enumeration
- Organizational structure mapping
- Personal information gathering

**⚠️ ETHICAL WARNING:** Social media intelligence can easily cross ethical boundaries. Always:
- Have explicit authorization
- Respect privacy expectations
- Document justification
- Consider proportionality

### 4. Metadata & Document Analysis

**Purpose:** Extract metadata from files and images for intelligence value

**Tools:**
- **ExifTool** - Comprehensive metadata extraction
- **FOCA** - Document metadata analysis (Windows)
- **Metagoofil** - Public document metadata harvester

**When to Use:**
- Analyzing publicly available documents
- Extracting geolocation data
- Identifying document authors and systems
- Building software inventory

### 5. Automation & Orchestration

**Purpose:** Comprehensive automated reconnaissance and relationship mapping

**Tools:**
- **SpiderFoot** - All-in-one OSINT automation (100+ modules)
- **Maltego** - Visual link analysis and data mining
- **Shodan** - Internet-connected device search
- **Censys** - Internet-wide scanning and analysis

**When to Use:**
- Large-scale reconnaissance
- Time-constrained assessments
- Comprehensive intelligence gathering
- Relationship visualization and analysis

### 6. Credential & Breach Intelligence

**Purpose:** Discover exposed credentials and data breaches

**Tools:**
- **Dehashed** - Paid breach database search
- **Have I Been Pwned API** - Breach notification service
- **H8mail** - Email breach checking
- **Breach-parse** - Local breach database searching

**When to Use:**
- Credential stuffing preparation
- Password spray attack planning
- Organizational breach assessment
- Incident response investigation

**⚠️ LEGAL WARNING:** Accessing or using compromised credentials without authorization is illegal. Use only for:
- Authorized security testing
- Defensive breach notification
- Incident response with proper authority

## Integration with Penetration Testing Methodology

### OSINT in the 6-Phase Framework

**Phase 0: Scoping & Preparation**
- OSINT informs scope definition
- Identifies assets for inclusion/exclusion
- Establishes baseline intelligence requirements

**Phase 1: Reconnaissance (OSINT-Heavy)**
- Passive OSINT (search engines, social media, public databases)
- Active OSINT (subdomain enum, DNS recon, port scanning)
- Technology fingerprinting and version detection
- **Primary OSINT Phase - Most OSINT happens here**

**Phase 2: Mapping**
- Use OSINT-discovered assets for content discovery
- Validate OSINT findings through active testing
- Expand discovered infrastructure

**Phase 3: Vulnerability Analysis**
- Use OSINT-discovered technologies for targeted testing
- Test OSINT-discovered credentials
- Exploit OSINT-discovered misconfigurations

**Phase 4: Exploitation**
- Credential stuffing with OSINT-discovered emails
- Social engineering using OSINT-built profiles
- Targeted attacks based on OSINT intelligence

**Phase 5: Reporting**
- Document OSINT methodology
- Report information exposure findings
- Recommend OSINT-specific mitigations

### OSINT Output Feeds Into

**Immediate Actions:**
- Subdomain takeover attempts
- Exposed credential validation
- Technology-specific vulnerability scanning
- Misconfiguration exploitation

**Strategic Planning:**
- Social engineering campaign design
- Targeted phishing scenario development
- Supply chain attack vectors
- Physical security assessment

## Legal and Ethical Considerations

### Legal Framework

**Always Allowed (Public Information):**
- Search engine queries
- Public website browsing
- Social media review (public profiles)
- WHOIS lookups
- Public DNS queries
- Public code repositories

**Requires Authorization:**
- Port scanning and active probing
- Subdomain brute-forcing (active)
- DNS zone transfer attempts
- Social engineering interactions
- Accessing non-public information

**Never Allowed Without Explicit Authority:**
- Using compromised credentials
- Accessing breach databases for unauthorized purposes
- Impersonation or social engineering
- Accessing private social media content
- Computer Fraud and Abuse Act (CFAA) violations

### Ethical Guidelines

**Principle of Proportionality:**
- Collect only information necessary for assessment objectives
- Avoid invasive personal information gathering
- Respect privacy expectations
- Consider psychological impact on targets

**Responsible Disclosure:**
- Report exposed sensitive information to responsible parties
- Allow reasonable remediation time
- Follow coordinated disclosure practices
- Document findings appropriately

**Professional Boundaries:**
- Maintain separation between personal and professional research
- Avoid mission creep into unnecessary areas
- Document decision-making process
- Seek guidance when uncertain

### Privacy Considerations

**Personal Information Handling:**
- Minimize collection of personal data
- Secure storage of collected information
- Limited retention periods
- Proper disposal procedures

**Social Media Boundaries:**
- Respect "public but not publicized" information
- Consider context collapse issues
- Avoid deep personal relationship mapping without justification
- Document necessity for sensitive information

## OSINT Best Practices

### Operational Security (OpSec)

**Protect Your Identity:**
- Use VPN or proxy for sensitive research
- Separate OSINT infrastructure from personal
- Avoid leaving attribution breadcrumbs
- Consider target's monitoring capabilities

**Data Management:**
- Organize findings systematically
- Use proper file naming conventions
- Maintain chain of custody
- Version control for long-term operations

### Quality Control

**Source Validation:**
- Verify information from multiple sources
- Check publication dates and currency
- Assess source reliability and bias
- Document provenance

**False Positive Elimination:**
- Cross-reference all findings
- Validate active reconnaissance results
- Test credentials in authorized environments only
- Document confidence levels

### Efficiency Optimization

**Automation First:**
- Use SpiderFoot for comprehensive scans
- Script repetitive manual tasks
- Create custom tool combinations
- Build reusable workflows

**Progressive Refinement:**
- Start broad, narrow focus based on findings
- Iterate through intelligence cycle
- Refine requirements based on results
- Know when to stop (diminishing returns)

## Output Formats and Deliverables

### Standard OSINT Report Structure

**1. Executive Summary**
- High-level findings
- Critical exposures
- Immediate risks
- Recommended actions

**2. Methodology**
- Tools and techniques used
- Data sources consulted
- Time period covered
- Scope and limitations

**3. Findings**
- Discovered assets (domains, IPs, services)
- Technology stack identification
- Exposed information and credentials
- Social media and personnel intelligence
- Misconfiguration and vulnerabilities

**4. Analysis**
- Attack surface assessment
- Risk prioritization
- Relationship mapping
- Pattern identification

**5. Recommendations**
- Immediate remediation actions
- Strategic security improvements
- Monitoring recommendations
- Further investigation priorities

### Tool Output Formats

**Subdomain Lists:**
```
subdomain1.example.com
subdomain2.example.com
api.example.com
dev.example.com
```

**Port Scan Results:**
```
Host: target.example.com (192.168.1.100)
22/tcp   open  ssh      OpenSSH 8.2p1
80/tcp   open  http     nginx 1.18.0
443/tcp  open  https    nginx 1.18.0
```

**Technology Stack:**
```
Web Server: Nginx 1.18.0
Framework: Ruby on Rails 6.1
Database: PostgreSQL (inferred from headers)
CDN: Cloudflare
```

## Next Steps After OSINT

### Immediate Actions

**1. Asset Inventory Validation:**
- Verify discovered domains are in scope
- Confirm IP address ownership
- Validate subdomain resolution
- Check for wildcard DNS

**2. Priority Target Selection:**
- Identify high-value assets
- Focus on unique or sensitive systems
- Prioritize development/staging environments
- Target legacy or forgotten systems

**3. Technology-Specific Testing:**
- Research known vulnerabilities for discovered versions
- Prepare exploits for identified software
- Configure vulnerability scanners appropriately
- Plan manual testing approaches

### Transition to Active Testing

**Move to Phase 2 (Mapping):**
- Content discovery on discovered hosts
- Parameter fuzzing on identified endpoints
- Authentication mechanism analysis
- Session management testing

**Prepare for Phase 3 (Vulnerability Analysis):**
- Technology-specific vulnerability testing
- Credential validation and testing
- Configuration review and hardening assessment
- Business logic flaw discovery

## Contrarian Insights

### Free Tools Deliver 70-80% of Capability

**The OSINT Reality:**
- Expensive commercial tools add marginal value
- Free/open-source tools are battlefield-tested
- Community support exceeds commercial support
- Customization and scripting trump GUIs

**Investment Priority:**
- **Time in methodology** over money in tools
- **Skill development** over software licenses
- **Custom automation** over commercial platforms
- **API access** (Shodan, Dehashed) over full platforms

### Quality Over Quantity

**Common Mistake:** Running every OSINT tool and drowning in noise

**Better Approach:**
- Start with SpiderFoot for comprehensive baseline
- Use 2-3 specialized tools for deep dives
- Focus on validation and correlation
- Know when to stop collecting and start analyzing

### Manual Analysis Beats Automation

**Tools can collect, only humans can understand:**
- Relationship context requires human judgment
- Risk assessment needs business understanding
- Creative attack vectors come from human insight
- False positives require human filtering

**Balanced Approach:**
- Automate collection and aggregation
- Manually analyze and correlate
- Automate reporting and visualization
- Manually prioritize and strategize

## References and Further Reading

### Essential Resources

**OSINT Framework:**
- https://osintframework.com/ - Comprehensive OSINT tool directory

**Recommended Wordlists:**
- SecLists: https://github.com/danielmiessler/SecLists
- Assetnote: https://wordlists.assetnote.io/

**Tool Documentation:**
- Subfinder: https://github.com/projectdiscovery/subfinder
- Amass: https://github.com/OWASP/Amass
- theHarvester: https://github.com/laramies/theHarvester
- Recon-ng: https://github.com/lanmaster53/recon-ng
- SpiderFoot: https://github.com/smicallef/spiderfoot

### Methodology References

**Intelligence Community:**
- NATO OSINT Handbook
- CIA Guide to OSINT
- ODNI Guide to Cyber Threat Intelligence

**Security Community:**
- OWASP Testing Guide (Information Gathering)
- PTES Technical Guidelines (Intelligence Gathering)
- NIST Special Publication 800-115

### Training and Certification

**Free Training:**
- Trace Labs OSINT Search Party
- IntelTechniques OSINT Tooling
- OSINT Curious webcasts

**Paid Training:**
- SANS SEC487: Open-Source Intelligence (OSINT) Gathering and Analysis
- TCM Security OSINT course
- Micah Hoffman's OSINT training

## Related Workflows

**See Also:**
- `Reconnaissance.md` - Subdomain enumeration and domain reconnaissance
- `Social-media-intel.md` - Social media intelligence gathering
- `Automation.md` - SpiderFoot and Maltego automation
- `MetadataAnalysis.md` - Document and image metadata extraction
- `../pentest/Reconnaissance.md` - Integration with penetration testing
- `../pentest/ToolInventory.md` - Complete tool reference

---

**Key Takeaway:** OSINT is the foundation of all security testing. Master passive and active reconnaissance, automate repetitive tasks, and always operate within legal and ethical boundaries. The best OSINT practitioners balance automated collection with manual analysis and creative thinking.
