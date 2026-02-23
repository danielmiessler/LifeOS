# OSINT Automation Frameworks - Installation Notes

**Installation Date:** 2025-11-11
**Installed For:** PAI webassessment skill
**Platform:** macOS (Apple Silicon)

---

## 1. SpiderFoot - Automated OSINT Collection

**Version:** 4.0.0
**Repository:** https://github.com/smicallef/spiderfoot
**Description:** Automated OSINT collection framework with 200+ modules for reconnaissance and threat intelligence gathering.

### Installation Details

**Location:** `~/.claude/skills/Webassessment/osint-tools/spiderfoot/`

**Installation Method:**
```bash
# Cloned from GitHub repository
cd ~/.claude/skills/Webassessment/osint-tools/
git clone https://github.com/smicallef/spiderfoot.git
cd spiderfoot
pip3 install -r requirements.txt
```

**Installed Dependencies:**
- CherryPy 18.10.0 (web server)
- beautifulsoup4, lxml (HTML parsing)
- dnspython (DNS queries)
- requests (HTTP client)
- netaddr, ipwhois, ipaddr (network utilities)
- phonenumbers (phone number analysis)
- python-whois (WHOIS lookups)
- cryptography, pyOpenSSL (SSL/TLS analysis)
- And 20+ additional OSINT modules

### Usage Instructions

**IMPORTANT - Python Version:**
SpiderFoot requires Python 3.9 (system Python). Use `/usr/bin/python3` explicitly:
```bash
# Verify correct Python version (should show 3.9.6)
/usr/bin/python3 --version

# If you use just 'python3', it may use Homebrew Python 3.14 which doesn't have the modules
```

#### CLI Mode (Command-Line Scans)

**Basic scan:**
```bash
cd ~/.claude/skills/Webassessment/osint-tools/spiderfoot
/usr/bin/python3 ./sf.py -s <TARGET> -t <EVENT_TYPES>
```

**Example - Domain reconnaissance:**
```bash
/usr/bin/python3 ./sf.py -s example.com -t DOMAIN_NAME,IP_ADDRESS,EMAILADDR
```

**Example - Use case based scanning:**
```bash
# Passive reconnaissance only
/usr/bin/python3 ./sf.py -s example.com -u passive

# Full footprint
/usr/bin/python3 ./sf.py -s example.com -u footprint

# Investigation mode
/usr/bin/python3 ./sf.py -s example.com -u investigate
```

**List available modules:**
```bash
/usr/bin/python3 ./sf.py -M
```

**List available event types:**
```bash
/usr/bin/python3 ./sf.py -T
```

**Output formats:**
```bash
# JSON output
/usr/bin/python3 ./sf.py -s example.com -u passive -o json > results.json

# CSV output
/usr/bin/python3 ./sf.py -s example.com -u passive -o csv > results.csv

# Tab-delimited (default)
/usr/bin/python3 ./sf.py -s example.com -u passive -o tab > results.txt
```

#### Web UI Mode (Recommended for Interactive Work)

**Start web interface:**
```bash
cd ~/.claude/skills/Webassessment/osint-tools/spiderfoot
/usr/bin/python3 ./sf.py -l 127.0.0.1:5001
```

**Access interface:**
- Open browser to: http://127.0.0.1:5001
- Full GUI for creating scans, viewing results, visualizing relationships
- Scan history and correlation analysis
- Export results in multiple formats

**Features in Web UI:**
- Interactive scan configuration
- Real-time scan progress monitoring
- Visual graph of discovered relationships
- Advanced filtering and search
- Multi-target scanning
- Scan comparison and correlation

### Key SpiderFoot Modules

**Network/Infrastructure:**
- DNS enumeration (subdomains, MX, NS records)
- IP geolocation and ASN lookup
- Port scanning and service detection
- SSL/TLS certificate analysis
- WHOIS and BGP data

**Web/Application:**
- HTTP headers and technology detection
- Robots.txt and sitemap parsing
- JavaScript/API endpoint discovery
- Security headers analysis
- Cookie analysis

**People/Organizations:**
- Email address harvesting
- Phone number discovery
- Social media profile discovery
- PGP key discovery
- Breach data correlation

**Threat Intelligence:**
- Malware hash lookups
- Botnet C2 detection
- Blacklist checking
- Reputation scoring
- Leaked credentials

### Performance Tuning

**Control concurrency:**
```bash
# Run with maximum 10 concurrent modules
/usr/bin/python3 ./sf.py -s example.com -u passive -max-threads 10
```

**Strict mode (faster, more focused):**
```bash
# Only enable modules that directly consume target
/usr/bin/python3 ./sf.py -s example.com -t DOMAIN_NAME -x
```

### Notes and Warnings

- **Passive vs Active:** Use `-u passive` for stealthy reconnaissance
- **Rate Limiting:** Some API modules require API keys in configuration
- **Legal:** Only scan targets you have authorization to assess
- **OpenSSL Warning:** LibreSSL 2.8.3 warning is cosmetic, doesn't affect functionality
- **Dependency Note:** Cryptography 3.4.8 installed (downgraded from 41.0.2 for compatibility)

---

## 2. Maltego Community Edition - Visual Link Analysis

**Version:** 4.11.0
**Download:** https://www.maltego.com/downloads/
**Description:** Industry-leading visual link analysis and relationship mapping platform for OSINT investigations.

### Installation Details

**Location:** `/Applications/Maltego.app`

**Installation Method:**
```bash
# Installed via Homebrew Cask (recommended)
brew install --cask maltego
```

**Downloaded from:** https://downloads.maltego.com/maltego-v4/mac/Maltego.v4.11.0.dmg

**Requirements:**
- Java 11 (install with: `brew install --cask temurin@11`)
- Rosetta 2 for Apple Silicon Macs (pre-installed on most systems)
- Free Maltego Community Edition account (required for activation)

### First-Time Setup

**1. Launch Maltego:**
```bash
open /Applications/Maltego.app
```

**2. Create Free Account:**
- Visit: https://www.maltego.com/
- Click "Sign Up" or "Get Community Edition"
- Register with email address
- Verify email address
- Account provides:
  - Community Edition license (free forever)
  - Access to free transforms
  - Limited commercial transforms

**3. Activate Maltego:**
- Launch Maltego.app
- Click "Login with Maltego Account"
- Enter registered email and password
- Select "Maltego CE (Community Edition)" license
- Complete initial setup wizard

### Usage Instructions

**Maltego is GUI-only** - all operations performed through the application interface.

**Core Concepts:**
- **Entities:** Data points (domains, IPs, people, emails, companies)
- **Transforms:** Actions that discover related entities
- **Graphs:** Visual representations of entity relationships
- **Machines:** Automated transform sequences

**Basic Workflow:**

1. **Create New Graph:**
   - File → New Graph
   - Drag entity type from palette (e.g., "Domain")
   - Enter target value (e.g., "example.com")

2. **Run Transforms:**
   - Right-click entity
   - Select transform category (DNS, WHOIS, etc.)
   - Choose specific transform to run
   - Results appear as connected entities

3. **Analyze Relationships:**
   - Visual graph shows connections
   - Entities grouped by type
   - Link labels show relationship type
   - Click entities to see properties

4. **Export Results:**
   - File → Export → Graph as Image
   - File → Export → Excel/CSV
   - Generates investigative reports

### Available Transform Categories

**Free Community Edition Transforms:**

**Network/Infrastructure:**
- DNS to IP address resolution
- IP to geolocation mapping
- Domain to MX/NS records
- WHOIS lookups
- Netblock analysis

**Company/Organization:**
- Company to website discovery
- Email to domain relationships
- Domain registration details
- Organizational structure mapping

**People:**
- Email to person associations
- Social media profile discovery
- Phone number lookups
- Alias and identity correlation

**Additional Transforms (Paid/API):**
- Threat intelligence feeds
- Dark web monitoring
- Breach data correlation
- Advanced social media analysis
- Commercial databases

### Maltego Strengths

**Visual Investigation:**
- See relationships at a glance
- Identify hidden connections
- Pattern recognition
- Network mapping

**Automation:**
- Run transform chains automatically
- Save investigation workflows as "machines"
- Batch processing of multiple targets
- Scheduled/repeated investigations

**Collaboration:**
- Export graphs for reports
- Share investigation templates
- Team collaboration (paid editions)

**Integration:**
- Python transform framework
- API connectivity to external tools
- Custom transform development
- Import/export via CSV/XML

### Community Edition Limitations

**Free tier includes:**
- Unlimited local transforms
- Basic infrastructure discovery
- Core OSINT transforms
- Graph visualization
- Export capabilities

**Not included (paid editions only):**
- Commercial transform hub access
- Premium threat intelligence
- Advanced social media transforms
- Team collaboration features
- Large-scale graph rendering (>10,000 entities)

**Workaround:** Use SpiderFoot + Maltego together - gather data with SpiderFoot, visualize in Maltego

### Notes and Warnings

- **Account Required:** Cannot use without free Maltego account
- **Java Dependency:** Requires Java 11 (install via Homebrew if needed)
- **Architecture:** Built for Intel, runs via Rosetta 2 on Apple Silicon
- **Legal:** Only investigate targets with proper authorization
- **API Keys:** Some transforms require third-party API keys
- **Performance:** Large graphs (>5000 entities) may be slow on Community Edition

---

## Integration Strategy: SpiderFoot + Maltego

**Recommended Workflow:**

1. **SpiderFoot: Data Collection**
   - Run comprehensive scan on target
   - Export results as CSV/JSON
   - Collect relationship data

2. **Maltego: Visualization**
   - Import SpiderFoot data
   - Create visual graph
   - Identify key relationships
   - Generate investigative reports

3. **Iterative Investigation:**
   - Use Maltego to identify interesting leads
   - Use SpiderFoot to deep-dive on specific entities
   - Update Maltego graph with new discoveries
   - Repeat until investigation complete

**Example Combined Workflow:**

```bash
# 1. SpiderFoot reconnaissance
cd ~/.claude/skills/Webassessment/osint-tools/spiderfoot
/usr/bin/python3 ./sf.py -s target.com -u investigate -o json > target-recon.json

# 2. Process results in Maltego
# - Import JSON to Maltego graph
# - Visualize entity relationships
# - Identify pivot points

# 3. Targeted follow-up with SpiderFoot
/usr/bin/python3 ./sf.py -s discovered-subdomain.target.com -u footprint -o json > subdomain-deep.json

# 4. Update Maltego graph with new findings
```

**Data Flow:**
```
Target → SpiderFoot (automated collection) → JSON/CSV export →
Maltego (visual analysis) → Identify leads → SpiderFoot (targeted scans) →
Maltego (updated graph) → Final report
```

---

## Quick Reference Commands

**SpiderFoot CLI Scan:**
```bash
cd ~/.claude/skills/Webassessment/osint-tools/spiderfoot
/usr/bin/python3 ./sf.py -s <target> -u passive -o json > output.json
```

**SpiderFoot Web UI:**
```bash
cd ~/.claude/skills/Webassessment/osint-tools/spiderfoot
/usr/bin/python3 ./sf.py -l 127.0.0.1:5001
# Visit: http://127.0.0.1:5001
```

**Launch Maltego:**
```bash
open /Applications/Maltego.app
```

**Update SpiderFoot:**
```bash
cd ~/.claude/skills/Webassessment/osint-tools/spiderfoot
git pull origin master
pip3 install -r requirements.txt --upgrade
```

**Update Maltego:**
```bash
brew upgrade --cask maltego
```

---

## Troubleshooting

### SpiderFoot Issues

**Problem: Module import errors**
```bash
# Solution: Reinstall requirements
cd ~/.claude/skills/Webassessment/osint-tools/spiderfoot
pip3 install -r requirements.txt --force-reinstall
```

**Problem: Web UI won't start**
```bash
# Solution: Check if port 5001 is in use
lsof -i :5001
# Kill process or use different port:
python3 ./sf.py -l 127.0.0.1:5002
```

**Problem: SSL/OpenSSL warnings**
- These are cosmetic warnings only
- SpiderFoot functions normally
- Related to LibreSSL vs OpenSSL versions

### Maltego Issues

**Problem: "Java not found"**
```bash
# Solution: Install Java 11
brew install --cask temurin@11
```

**Problem: "Application can't be opened"**
```bash
# Solution: Allow in System Settings
System Settings → Privacy & Security → Allow Maltego
```

**Problem: Can't login/activate**
- Ensure internet connection active
- Verify email/password correct
- Check Maltego service status: https://status.maltego.com/
- Reset password at: https://www.maltego.com/

---

## Additional Resources

**SpiderFoot:**
- Documentation: https://www.spiderfoot.net/documentation/
- GitHub: https://github.com/smicallef/spiderfoot
- Module list: https://www.spiderfoot.net/modules/
- API documentation: https://www.spiderfoot.net/documentation/api/

**Maltego:**
- User guide: https://docs.maltego.com/
- Transform hub: https://www.maltego.com/transform-hub/
- Tutorial videos: https://www.maltego.com/blog/category/tutorials/
- Community forum: https://community.maltego.com/

**OSINT Framework:**
- OSINT resource directory: https://osintframework.com/
- Complements both tools with additional resources

---

**Installation completed successfully on 2025-11-11 by Engineer Agent**
