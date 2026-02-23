# OSINT Automation Workflow

## Overview

**OSINT Automation** leverages comprehensive frameworks like SpiderFoot and visual analysis platforms like Maltego to orchestrate multi-source intelligence gathering, automate repetitive reconnaissance tasks, and discover complex relationships that manual analysis might miss.

**Purpose:** Maximize intelligence collection efficiency through automation while maintaining analytical depth through correlation, visualization, and relationship mapping.

**Value Proposition:** Automated OSINT can perform in hours what manual collection would take days or weeks, with the added benefit of discovering non-obvious connections and patterns.

## When to Use This Workflow

### Automation is Ideal For

**Time-Constrained Assessments:**
- Limited engagement timeline
- Need rapid comprehensive baseline
- Multiple concurrent targets
- Quick-turnaround reporting requirements

**Large-Scale Reconnaissance:**
- Enterprise penetration tests
- Multi-domain organizations
- Complex organizational structures
- Extensive third-party relationships

**Continuous Monitoring:**
- Attack surface change detection
- New asset discovery
- Breach monitoring
- Threat intelligence gathering

**Relationship Discovery:**
- Complex organizational mapping
- Supply chain analysis
- Third-party risk assessment
- Lateral movement path identification

### Manual Beats Automation When

**Deep Context Required:**
- Understanding organizational culture
- Assessing individual motivations
- Interpreting nuanced communication
- Evaluating complex relationships

**Custom Scenarios:**
- Unique target environments
- Proprietary systems or platforms
- Non-standard reconnaissance requirements
- Creative attack vector development

**Stealth is Critical:**
- Covert reconnaissance operations
- Low-and-slow approaches
- Avoiding detection and attribution
- Sensitive political environments

## Required Tools

### Essential Automation Platforms

**SpiderFoot HX:**
- **Type:** Open-source automation framework
- **Capabilities:** 100+ modules, automated scanning, correlation engine
- **Interfaces:** CLI, Web UI, API
- **Best For:** Comprehensive automated reconnaissance

**Maltego:**
- **Type:** Visual link analysis and data mining
- **Capabilities:** Relationship mapping, graph analysis, data correlation
- **Interfaces:** Desktop application
- **Best For:** Visual investigation and relationship discovery

### API-Based Services

**Shodan:**
- **Type:** Internet-connected device search engine
- **Requires:** API key (paid tiers for full access)
- **Best For:** Infrastructure discovery, IoT devices, exposed services

**Censys:**
- **Type:** Internet-wide scanning and certificate search
- **Requires:** API key (free tier available)
- **Best For:** Certificate transparency, SSL/TLS analysis, infrastructure

**Dehashed:**
- **Type:** Breach database search
- **Requires:** Paid subscription
- **Best For:** Credential exposure, breach intelligence

**Hunter.io:**
- **Type:** Email discovery and verification
- **Requires:** API key (free tier available)
- **Best For:** Email enumeration, format detection

### Supporting Tools

**Automation Helpers:**
- **cron** - Scheduled reconnaissance
- **bash scripting** - Custom automation
- **Python** - Tool orchestration
- **jq** - JSON processing

**Output Processing:**
- **grep, awk, sed** - Text processing
- **csvkit** - CSV manipulation
- **xmlstarlet** - XML processing

## Methodology

### Phase 1: SpiderFoot Automated Reconnaissance

**Objective:** Conduct comprehensive automated OSINT scan using SpiderFoot's 100+ modules.

#### SpiderFoot Architecture

**Module Categories:**
- **Passive DNS** - Historical DNS records
- **Certificate Transparency** - SSL/TLS certificates
- **Search Engines** - Google, Bing, Yahoo indexing
- **Social Media** - LinkedIn, Twitter, Facebook presence
- **Threat Intelligence** - Malware, breaches, blacklists
- **WHOIS** - Domain registration information
- **Email** - Email discovery and validation
- **Web** - Content discovery, technology identification
- **Leaked Data** - Breach databases, paste sites

**Step 1: SpiderFoot CLI Installation**

```bash
# Clone SpiderFoot
git clone https://github.com/smicallef/spiderfoot
cd spiderfoot

# Install dependencies
pip3 install -r requirements.txt

# Test installation
python3 sf.py --help
```

**Step 2: SpiderFoot CLI Scan**

```bash
# Basic scan (automatic module selection)
python3 sf.py -s example.com -o json > spiderfoot-output.json

# Scan with specific modules
python3 sf.py -s example.com -m sfp_dnsresolve,sfp_subdomain_takeover,sfp_ssl -o json

# List all available modules
python3 sf.py -M

# Scan multiple targets
python3 sf.py -s example.com -s example.org -o csv > results.csv

# Aggressive scan (enable all modules)
python3 sf.py -s example.com -m all -o json
```

**CLI Module Selection:**
```bash
# Subdomain discovery modules
sfp_subdomain_enum       # Subdomain enumeration
sfp_dnsresolve          # DNS resolution
sfp_certspotter         # Certificate transparency
sfp_virustotal          # VirusTotal lookups

# Email and username modules
sfp_email               # Email discovery
sfp_username            # Username search
sfp_hunter              # Hunter.io integration

# Threat intelligence modules
sfp_threatminer         # ThreatMiner lookups
sfp_leakix              # LeakIX data
sfp_haveibeenpwned      # Breach checking

# Infrastructure modules
sfp_shodan              # Shodan integration (API key required)
sfp_censys              # Censys integration (API key required)
sfp_banner              # Banner grabbing
```

**Step 3: SpiderFoot Web UI**

```bash
# Start web server
python3 sf.py -l 127.0.0.1:5001

# Access web interface
# Open browser: http://127.0.0.1:5001

# Create new scan via web UI:
# 1. Enter target (domain, IP, email, username)
# 2. Select scan type:
#    - "By Required Data" - Auto-select modules
#    - "All" - Run everything (slow)
#    - "Custom" - Manual module selection
# 3. Configure settings (optional)
# 4. Start scan
```

**Web UI Advantages:**
- Real-time scan progress monitoring
- Interactive data visualization
- Graph-based relationship display
- Easy filtering and search
- Export in multiple formats
- Scheduled scanning

**Step 4: API Configuration for Enhanced Results**

Edit `spiderfoot.conf` or configure via Web UI:

```ini
[apis]
# Shodan (highly recommended)
shodan_api_key = YOUR_SHODAN_API_KEY

# Hunter.io (email discovery)
hunter_api_key = YOUR_HUNTER_API_KEY

# HaveIBeenPwned (breach checking)
haveibeenpwned_api_key = YOUR_HIBP_API_KEY

# VirusTotal (domain reputation)
virustotal_api_key = YOUR_VT_API_KEY

# Censys (certificate search)
censys_api_id = YOUR_CENSYS_ID
censys_api_secret = YOUR_CENSYS_SECRET
```

**Free Tier API Keys:**
- Shodan: $5 one-time or limited free queries
- Hunter.io: 25 searches/month free
- HaveIBeenPwned: Free with attribution
- VirusTotal: Free tier available
- Censys: Free tier available

**Step 5: SpiderFoot Output Analysis**

**JSON Output Processing:**
```bash
# Parse SpiderFoot JSON output
cat spiderfoot-output.json | jq '.[]'

# Extract specific data types
cat spiderfoot-output.json | jq '.[] | select(.type=="IP_ADDRESS")'
cat spiderfoot-output.json | jq '.[] | select(.type=="EMAILADDR")'
cat spiderfoot-output.json | jq '.[] | select(.type=="SUBDOMAIN")'

# Extract all subdomains
cat spiderfoot-output.json | jq -r '.[] | select(.type=="SUBDOMAIN") | .data' | sort -u

# Extract all email addresses
cat spiderfoot-output.json | jq -r '.[] | select(.type=="EMAILADDR") | .data' | sort -u

# Extract threat intelligence findings
cat spiderfoot-output.json | jq '.[] | select(.type | contains("MALICIOUS"))'

# Count findings by type
cat spiderfoot-output.json | jq -r '.[].type' | sort | uniq -c | sort -rn
```

**Web UI Analysis:**
- Use "Browse" tab to explore by data type
- Use "Graph" tab for visual relationship mapping
- Use "Export" to save results (JSON, CSV, GEXF for Maltego)
- Filter by confidence level, module, data type

**Step 6: Correlation and Enrichment**

```bash
# Identify high-value findings
- Exposed credentials and API keys
- Subdomain takeover opportunities
- Exposed admin interfaces
- Leaked documents and source code
- Employee email addresses
- Social media accounts
- Technology stack information
- Third-party relationships

# Prioritize for manual investigation
- Malicious/threat intelligence indicators
- Breached credentials
- Exposed sensitive information
- Misconfigured services
- Legacy/forgotten systems
```

### Phase 2: Maltego Visual Investigation

**Objective:** Use Maltego for visual relationship analysis and complex pattern discovery.

**Step 1: Maltego Setup**

```bash
# Download Maltego Community Edition (free)
# https://www.maltego.com/downloads/

# Install and register (requires email)

# Alternative: Maltego CE via snap (Linux)
sudo snap install maltego

# Launch Maltego
maltego
```

**Maltego Editions:**
- **Community Edition** - Free, limited transforms, 12-entity limit per graph
- **Classic** - Paid, more transforms, no entity limit
- **XL** - Enterprise, API access, custom transforms

**Step 2: Initial Investigation Setup**

```bash
# Create new graph
# File → New → Blank Graph

# Add initial entity:
# Palette → Infrastructure → Domain
# Or: Palette → Personal → Email Address
# Or: Palette → Personal → Person

# Enter target information
# Right-click entity → Properties → Set domain/email/name
```

**Step 3: Running Transforms**

**Transform Categories:**

**Domain Intelligence:**
```
Domain → DNS Name (discovers subdomains)
Domain → Email Address (finds emails)
Domain → Website (identifies web properties)
Domain → IP Address (resolves infrastructure)
Domain → MX Record (identifies mail servers)
Domain → Name Server (finds DNS servers)
```

**Email Intelligence:**
```
Email Address → Person (finds owner)
Email Address → Domain (extracts domain)
Email Address → Email Address (finds related emails)
Email Address → Breach Data (checks breaches) [requires API]
```

**Person Intelligence:**
```
Person → Email Address (finds emails)
Person → Phone Number (finds phone numbers)
Person → Social Media Profile (discovers profiles)
Person → Company (identifies employer)
```

**Infrastructure Intelligence:**
```
IP Address → Domain (reverse DNS)
IP Address → Location (geolocation)
IP Address → Network Block (identifies netblock)
IP Address → Port (discovers open ports) [requires API]
```

**Step 4: Transform Execution**

```bash
# Manual transform execution:
1. Select entity (single or multiple)
2. Right-click → Run Transform
3. Choose transform category
4. Select specific transform
5. Wait for results
6. Review new entities added to graph

# Transform combinations:
Domain → DNS Names → Email Addresses → Person
Domain → IP Address → Ports → Services
Person → Social Media → Posts → Relationships
Email → Domain → Websites → Technologies
```

**Step 5: Graph Analysis and Visualization**

**Layout Algorithms:**
- **Hierarchical** - Parent-child relationships
- **Circular** - Equal importance entities
- **Organic** - Natural clustering
- **Grid** - Organized structure
- **Block** - Grouped categories

**Visual Analysis Techniques:**
```bash
# Apply layouts
View → Layout → [Choose algorithm]

# Group entities by type
Select entities → Right-click → Group

# Color-code by importance
Select entities → Right-click → Change Color

# Add notes and annotations
Right-click → Add Note

# Create views (filters)
View → Create View → Filter by entity type, transform source
```

**Step 6: Advanced Maltego Features**

**Filtering:**
```bash
# Filter by entity type
View → Filter by Entity Type → Select types to show/hide

# Filter by transform source
View → Filter by Transform Source

# Filter by link type
View → Filter by Link Type

# Custom filters
View → Create Custom Filter → Define criteria
```

**Entity Management:**
```bash
# Merge duplicate entities
Select entities → Right-click → Merge Entities

# Delete irrelevant entities
Select entities → Delete

# Bookmark important entities
Select entities → Right-click → Add to Bookmarks

# Export entities
Select entities → Right-click → Export → CSV/XML
```

**Collaboration:**
```bash
# Export graph
File → Export Graph → MTGX (Maltego format)
File → Export Graph → PDF/PNG (visual export)

# Import external data
File → Import → From SpiderFoot GEXF
File → Import → From CSV
```

### Phase 3: API-Based Automation

**Objective:** Leverage external APIs for targeted intelligence gathering.

#### Shodan API

**Step 1: Shodan Search**

```bash
# Install shodan CLI
pip3 install shodan

# Initialize with API key
shodan init YOUR_API_KEY

# Search for organization
shodan search "org:\"Example Company\""

# Search for specific ports
shodan search "port:3389 org:\"Example Company\""

# Search for specific products
shodan search "product:nginx org:\"Example Company\""

# Download search results
shodan download results.json.gz "org:\"Example Company\""

# Parse results
shodan parse results.json.gz --fields ip_str,port,product,version
```

**Shodan Search Operators:**
```
org:"Example Company"              # Organization search
net:192.168.1.0/24                # CIDR block
hostname:example.com               # Hostname
port:22                           # Specific port
product:Apache                    # Software product
os:Windows                        # Operating system
country:US                        # Geographic location
city:"San Francisco"              # City
vuln:CVE-2021-44228              # Vulnerability (Log4j example)
```

**Step 2: Shodan Host Lookup**

```bash
# Get detailed information for specific IP
shodan host 192.168.1.100

# Get detailed information in JSON
shodan host 192.168.1.100 --format json

# Parse JSON output
shodan host 192.168.1.100 --format json | jq '.ports'
shodan host 192.168.1.100 --format json | jq '.vulns'
```

**Step 3: Shodan Monitoring**

```bash
# Create network monitor (requires paid membership)
shodan alert create "Example Company" 192.168.1.0/24

# List monitors
shodan alert list

# Get monitor details
shodan alert info ALERT_ID

# Enable specific triggers
shodan alert enable ALERT_ID all

# Stream real-time alerts
shodan stream
```

#### Censys API

**Step 1: Censys Search**

```bash
# Install censys CLI
pip3 install censys

# Configure API credentials
censys config

# Search certificates
censys search certificates "parsed.names: example.com"

# Search hosts
censys search hosts "services.service_name: HTTP and autonomous_system.name: \"Example Company\""

# Export results
censys search hosts "example.com" --output json > censys-hosts.json
```

**Censys Search Operators:**
```
parsed.names: example.com                      # Certificate names
services.service_name: HTTP                   # Service type
autonomous_system.name: "Example Company"     # ASN/Organization
protocols: "443/https"                        # Protocol
services.tls.certificates.leaf_data.issuer.common_name: "Let's Encrypt"
```

#### Hunter.io API

**Step 1: Email Discovery**

```bash
# Use curl for API calls
HUNTER_API_KEY="your_api_key"

# Domain search (find email addresses for domain)
curl "https://api.hunter.io/v2/domain-search?domain=example.com&api_key=$HUNTER_API_KEY" | jq

# Email verification
curl "https://api.hunter.io/v2/email-verifier?email=john@example.com&api_key=$HUNTER_API_KEY" | jq

# Email pattern detection
curl "https://api.hunter.io/v2/domain-search?domain=example.com&api_key=$HUNTER_API_KEY" | \
  jq '.data.pattern'

# Extract all found emails
curl "https://api.hunter.io/v2/domain-search?domain=example.com&api_key=$HUNTER_API_KEY" | \
  jq -r '.data.emails[].value'
```

#### Dehashed API

**Step 1: Credential Search**

```bash
# Dehashed search (requires paid subscription)
DEHASHED_API_KEY="your_api_key"
DEHASHED_USER="your_username"

# Search by email
curl -u "$DEHASHED_USER:$DEHASHED_API_KEY" \
  "https://api.dehashed.com/search?query=email:john@example.com"

# Search by domain
curl -u "$DEHASHED_USER:$DEHASHED_API_KEY" \
  "https://api.dehashed.com/search?query=example.com"

# Search by username
curl -u "$DEHASHED_USER:$DEHASHED_API_KEY" \
  "https://api.dehashed.com/search?query=username:jsmith"

# Parse results
curl -u "$DEHASHED_USER:$DEHASHED_API_KEY" \
  "https://api.dehashed.com/search?query=example.com" | \
  jq '.entries[] | {email: .email, password: .password, username: .username}'
```

### Phase 4: Custom Automation and Orchestration

**Objective:** Build custom automation pipelines combining multiple tools and sources.

**Step 1: Bash Orchestration Script**

```bash
#!/bin/bash
# OSINT Automation Pipeline

DOMAIN="$1"
OUTDIR="osint-automation-$(date +%Y%m%d-%H%M%S)"

if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <domain>"
  exit 1
fi

echo "[+] Creating output directory: $OUTDIR"
mkdir -p $OUTDIR/{spiderfoot,subdomains,emails,shodan,reports}

echo "[+] Phase 1: SpiderFoot Comprehensive Scan"
cd ~/spiderfoot
python3 sf.py -s $DOMAIN -o json > ../$OUTDIR/spiderfoot/scan-results.json 2>&1 &
SPIDER_PID=$!

echo "[+] Phase 2: Subdomain Enumeration (Parallel)"
subfinder -d $DOMAIN -all -o $OUTDIR/subdomains/subfinder.txt &
PID1=$!
amass enum -passive -d $DOMAIN -o $OUTDIR/subdomains/amass.txt &
PID2=$!

echo "[+] Phase 3: Email Harvesting"
theHarvester -d $DOMAIN -b all -f $OUTDIR/emails/theharvester 2>&1 &
PID3=$!

echo "[+] Waiting for subdomain enumeration..."
wait $PID1 $PID2

echo "[+] Combining subdomains"
cat $OUTDIR/subdomains/*.txt | sort -u > $OUTDIR/subdomains/all.txt
echo "    Found: $(wc -l < $OUTDIR/subdomains/all.txt) unique subdomains"

echo "[+] Phase 4: Finding live hosts"
cat $OUTDIR/subdomains/all.txt | httprobe > $OUTDIR/subdomains/live.txt
echo "    Live: $(wc -l < $OUTDIR/subdomains/live.txt) hosts"

echo "[+] Phase 5: Technology fingerprinting"
whatweb --aggression 3 -i $OUTDIR/subdomains/live.txt \
  --log-json=$OUTDIR/subdomains/whatweb.json 2>&1

echo "[+] Waiting for email harvesting..."
wait $PID3

echo "[+] Phase 6: Shodan reconnaissance"
if [ ! -z "$SHODAN_API_KEY" ]; then
  shodan search "org:\"$DOMAIN\"" --limit 100 > $OUTDIR/shodan/results.txt
  echo "    Shodan results: $(wc -l < $OUTDIR/shodan/results.txt)"
else
  echo "    Skipped (no SHODAN_API_KEY set)"
fi

echo "[+] Waiting for SpiderFoot scan..."
wait $SPIDER_PID

echo "[+] Phase 7: Processing SpiderFoot results"
cat $OUTDIR/spiderfoot/scan-results.json | \
  jq -r '.[] | select(.type=="SUBDOMAIN") | .data' | \
  sort -u > $OUTDIR/spiderfoot/subdomains.txt

cat $OUTDIR/spiderfoot/scan-results.json | \
  jq -r '.[] | select(.type=="EMAILADDR") | .data' | \
  sort -u > $OUTDIR/spiderfoot/emails.txt

echo "[+] Phase 8: Generating summary report"
cat > $OUTDIR/reports/summary.md <<EOF
# OSINT Automation Report
**Target:** $DOMAIN
**Date:** $(date)

## Summary Statistics
- Subdomains discovered: $(wc -l < $OUTDIR/subdomains/all.txt)
- Live HTTP/HTTPS hosts: $(wc -l < $OUTDIR/subdomains/live.txt)
- Email addresses found: $(cat $OUTDIR/spiderfoot/emails.txt $OUTDIR/emails/* 2>/dev/null | sort -u | wc -l)
- SpiderFoot findings: $(cat $OUTDIR/spiderfoot/scan-results.json | jq '. | length')

## Files Generated
- Subdomains: $OUTDIR/subdomains/all.txt
- Live hosts: $OUTDIR/subdomains/live.txt
- Emails: $OUTDIR/spiderfoot/emails.txt
- Technology: $OUTDIR/subdomains/whatweb.json
- SpiderFoot: $OUTDIR/spiderfoot/scan-results.json

## Next Steps
1. Review live hosts for interesting targets
2. Analyze SpiderFoot findings for exposures
3. Test discovered email addresses
4. Manual investigation of high-value assets
EOF

echo "[+] Automation complete! Results in $OUTDIR/"
echo "[+] View summary: cat $OUTDIR/reports/summary.md"
```

**Step 2: Python Orchestration (Advanced)**

```python
#!/usr/bin/env python3
"""
Advanced OSINT Automation with API Integration
"""

import subprocess
import json
import os
from concurrent.futures import ThreadPoolExecutor
import requests

class OSINTAutomation:
    def __init__(self, target, output_dir):
        self.target = target
        self.output_dir = output_dir
        self.results = {
            'subdomains': [],
            'emails': [],
            'ips': [],
            'technologies': [],
            'breaches': []
        }

    def run_subfinder(self):
        """Run Subfinder for subdomain discovery"""
        cmd = f"subfinder -d {self.target} -all -silent"
        result = subprocess.run(cmd.split(), capture_output=True, text=True)
        self.results['subdomains'].extend(result.stdout.strip().split('\n'))

    def run_amass(self):
        """Run Amass for subdomain discovery"""
        cmd = f"amass enum -passive -d {self.target}"
        result = subprocess.run(cmd.split(), capture_output=True, text=True)
        self.results['subdomains'].extend(result.stdout.strip().split('\n'))

    def run_spiderfoot(self):
        """Run SpiderFoot CLI"""
        output_file = f"{self.output_dir}/spiderfoot.json"
        cmd = f"python3 ~/spiderfoot/sf.py -s {self.target} -o json"
        with open(output_file, 'w') as f:
            subprocess.run(cmd.split(), stdout=f, stderr=subprocess.PIPE)

        # Parse SpiderFoot results
        with open(output_file, 'r') as f:
            data = json.load(f)
            for item in data:
                if item['type'] == 'SUBDOMAIN':
                    self.results['subdomains'].append(item['data'])
                elif item['type'] == 'EMAILADDR':
                    self.results['emails'].append(item['data'])
                elif item['type'] == 'IP_ADDRESS':
                    self.results['ips'].append(item['data'])

    def check_haveibeenpwned(self, email):
        """Check if email appears in breaches"""
        url = f"https://haveibeenpwned.com/api/v3/breachedaccount/{email}"
        headers = {'hibp-api-key': os.getenv('HIBP_API_KEY', '')}
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"Error checking {email}: {e}")
        return []

    def run_breach_checks(self):
        """Check all emails for breaches"""
        if not os.getenv('HIBP_API_KEY'):
            print("Skipping breach checks (no HIBP_API_KEY)")
            return

        for email in self.results['emails']:
            breaches = self.check_haveibeenpwned(email)
            if breaches:
                self.results['breaches'].append({
                    'email': email,
                    'breaches': breaches
                })

    def run_all(self):
        """Run all reconnaissance tasks in parallel"""
        os.makedirs(self.output_dir, exist_ok=True)

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = []
            futures.append(executor.submit(self.run_subfinder))
            futures.append(executor.submit(self.run_amass))
            futures.append(executor.submit(self.run_spiderfoot))

            # Wait for all to complete
            for future in futures:
                future.result()

        # Deduplicate results
        self.results['subdomains'] = list(set(self.results['subdomains']))
        self.results['emails'] = list(set(self.results['emails']))
        self.results['ips'] = list(set(self.results['ips']))

        # Run breach checks
        self.run_breach_checks()

        # Save results
        self.save_results()

    def save_results(self):
        """Save all results to files"""
        # Subdomains
        with open(f"{self.output_dir}/subdomains.txt", 'w') as f:
            f.write('\n'.join(self.results['subdomains']))

        # Emails
        with open(f"{self.output_dir}/emails.txt", 'w') as f:
            f.write('\n'.join(self.results['emails']))

        # IPs
        with open(f"{self.output_dir}/ips.txt", 'w') as f:
            f.write('\n'.join(self.results['ips']))

        # Full results JSON
        with open(f"{self.output_dir}/results.json", 'w') as f:
            json.dump(self.results, f, indent=2)

        # Summary
        print(f"\n[+] Automation Complete!")
        print(f"    Subdomains: {len(self.results['subdomains'])}")
        print(f"    Emails: {len(self.results['emails'])}")
        print(f"    IPs: {len(self.results['ips'])}")
        print(f"    Breaches: {len(self.results['breaches'])}")
        print(f"\n[+] Results saved to: {self.output_dir}/")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <domain>")
        sys.exit(1)

    target = sys.argv[1]
    output_dir = f"osint-auto-{target}"

    automation = OSINTAutomation(target, output_dir)
    automation.run_all()
```

### Phase 5: Continuous Monitoring and Alerting

**Objective:** Set up ongoing reconnaissance for change detection.

**Step 1: Scheduled Reconnaissance**

```bash
# Create monitoring script
cat > ~/osint-monitor.sh <<'EOF'
#!/bin/bash
DOMAIN="example.com"
BASELINE_DIR="$HOME/osint-baseline"
CURRENT_DIR="$HOME/osint-current-$(date +%Y%m%d)"

mkdir -p $CURRENT_DIR

# Run subdomain discovery
subfinder -d $DOMAIN -o $CURRENT_DIR/subdomains.txt

# Compare with baseline
if [ -f $BASELINE_DIR/subdomains.txt ]; then
  # Find new subdomains
  comm -13 <(sort $BASELINE_DIR/subdomains.txt) <(sort $CURRENT_DIR/subdomains.txt) > $CURRENT_DIR/new-subdomains.txt

  # Find removed subdomains
  comm -23 <(sort $BASELINE_DIR/subdomains.txt) <(sort $CURRENT_DIR/subdomains.txt) > $CURRENT_DIR/removed-subdomains.txt

  # Alert if changes detected
  if [ -s $CURRENT_DIR/new-subdomains.txt ]; then
    echo "New subdomains detected:"
    cat $CURRENT_DIR/new-subdomains.txt
    # Send alert (email, Slack, etc.)
  fi
else
  echo "Creating baseline..."
  cp -r $CURRENT_DIR $BASELINE_DIR
fi
EOF

chmod +x ~/osint-monitor.sh

# Schedule with cron (daily at 2am)
echo "0 2 * * * $HOME/osint-monitor.sh" | crontab -
```

**Step 2: Shodan Monitoring**

```bash
# Create Shodan monitor for organization
shodan alert create "Example Company Monitor" 192.168.1.0/24

# Enable all triggers
shodan alert enable ALERT_ID all

# Continuous monitoring (stream in separate terminal)
shodan stream --alert ALERT_ID
```

**Step 3: Certificate Transparency Monitoring**

```bash
# Use CertStream for real-time certificate monitoring
pip3 install certstream

# Create monitoring script
cat > ~/cert-monitor.py <<'EOF'
#!/usr/bin/env python3
import certstream

def callback(message, context):
    if message['message_type'] == "certificate_update":
        all_domains = message['data']['leaf_cert']['all_domains']

        for domain in all_domains:
            if 'example.com' in domain:
                print(f"New certificate: {domain}")

certstream.listen_for_events(callback)
EOF

python3 ~/cert-monitor.py
```

## Output Analysis and Correlation

### Aggregating Multi-Source Intelligence

**Combine All Sources:**
```bash
# Merge subdomains from all sources
cat spiderfoot/subdomains.txt \
    subfinder-results.txt \
    amass-results.txt \
    maltego-export.txt \
    | sort -u > all-subdomains.txt

# Merge emails
cat spiderfoot/emails.txt \
    theharvester-results.txt \
    hunter-results.txt \
    | sort -u > all-emails.txt

# Merge IPs
cat spiderfoot/ips.txt \
    shodan-results.txt \
    nmap-results.txt \
    | sort -u > all-ips.txt
```

### Relationship Discovery

**Identify Patterns:**
```bash
# Common subdomain patterns
cat all-subdomains.txt | grep -E "(dev|staging|test|admin|internal)"

# Email pattern detection
cat all-emails.txt | awk -F'@' '{print $1}' | \
  sed 's/[0-9]//g' | sort | uniq -c | sort -rn

# Technology clustering
cat whatweb-results.json | jq -r '.plugins | keys[]' | \
  sort | uniq -c | sort -rn

# Geographic distribution
cat shodan-results.txt | grep -oE 'country_name: [A-Z]+' | \
  sort | uniq -c | sort -rn
```

### Prioritizing Findings

**High-Value Targets:**
1. Exposed credentials in breaches
2. Admin interfaces discovered
3. Development/staging environments
4. Subdomain takeover opportunities
5. Exposed API endpoints
6. Legacy forgotten systems
7. Third-party integrations
8. Employee email addresses (social engineering)

## Next Steps

### Immediate Actions

**1. Validate High-Priority Findings:**
- Test exposed credentials (authorized only)
- Confirm subdomain takeovers
- Verify exposed services
- Check for sensitive data exposure

**2. Manual Deep-Dive:**
- Investigate anomalies and outliers
- Research unique findings
- Understand context and relationships
- Build attack narratives

**3. Feed Into Testing:**
- Provide target lists to scanning tools
- Configure vulnerability scanners
- Prepare social engineering campaigns
- Develop exploitation strategies

### Integration with Security Testing

**Content Discovery:**
```bash
# Use discovered hosts for ffuf
ffuf -u https://FUZZ -w all-subdomains.txt -w /path/to/paths.txt
```

**Credential Testing:**
```bash
# Test discovered credentials (authorized only)
# Use discovered email/password combinations from breaches
# Test against authentication endpoints
```

**Social Engineering:**
```bash
# Use discovered organizational structure
# Leverage relationship maps from Maltego
# Create targeted phishing campaigns
```

## Troubleshooting

### Common Issues

**SpiderFoot not finding results:**
- Check API key configuration
- Enable more modules (may be too conservative)
- Increase scan depth settings
- Verify target is reachable

**Maltego transform failures:**
- Check API quotas and limits
- Verify API keys are current
- Try different transform providers
- Use community transforms as backup

**API rate limiting:**
```bash
# Add delays between requests
sleep 1

# Use multiple API keys (rotate)
# Spread requests over time
# Use paid tiers for higher limits
```

**Too many false positives:**
```bash
# Filter and deduplicate
sort -u results.txt

# Remove wildcards and generated subdomains
grep -v "[a-f0-9]{32}" results.txt

# Cross-reference multiple sources
# Manual validation of findings
```

## Best Practices

### Automation Strategy

**Start Broad, Then Focus:**
1. Run comprehensive automated scan (SpiderFoot)
2. Review findings for interesting patterns
3. Use Maltego for targeted relationship analysis
4. Manual deep-dive on high-value targets

**Validation is Critical:**
- Don't trust automation blindly
- Verify high-impact findings manually
- Cross-reference multiple sources
- Document confidence levels

**Know the Limitations:**
- Automation finds breadth, not depth
- Context requires human analysis
- Creative thinking beats automation
- False positives are inevitable

### Operational Security

**API Key Management:**
- Use dedicated keys for OSINT research
- Rotate keys regularly
- Monitor usage and quotas
- Separate personal from professional

**Attribution Awareness:**
- Automated tools leave fingerprints
- Consider VPN/proxy usage
- Distributed scanning for stealth
- Rate limit to avoid detection

## References

**SpiderFoot:**
- Project: https://github.com/smicallef/spiderfoot
- Documentation: https://www.spiderfoot.net/documentation/
- Module List: https://www.spiderfoot.net/documentation/modules/

**Maltego:**
- Download: https://www.maltego.com/downloads/
- Transform Hub: https://www.maltego.com/transform-hub/
- Documentation: https://docs.maltego.com/

**API Services:**
- Shodan: https://developer.shodan.io/
- Censys: https://search.censys.io/api
- Hunter.io: https://hunter.io/api-documentation
- Dehashed: https://www.dehashed.com/docs

**Related Workflows:**
- `master-guide.md` - Complete OSINT methodology
- `reconnaissance.md` - Manual reconnaissance techniques
- `social-media-intel.md` - Social media intelligence
- `metadata-analysis.md` - File and metadata analysis

---

**Key Takeaway:** Automation is force multiplication for OSINT, but human analysis is irreplaceable. Use SpiderFoot and Maltego for comprehensive collection and relationship discovery, but apply manual validation and creative thinking for actionable intelligence. Balance speed with accuracy, and always verify high-impact findings through multiple sources.
