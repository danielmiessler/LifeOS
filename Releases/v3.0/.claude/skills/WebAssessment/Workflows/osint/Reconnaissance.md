# OSINT Reconnaissance Workflow

## Overview

**Reconnaissance** is the systematic process of discovering and enumerating an organization's external attack surface through subdomain enumeration, DNS analysis, port scanning, and technology fingerprinting. This workflow represents the primary active OSINT phase where we transition from passive information gathering to active probing and enumeration.

**Goal:** Build a comprehensive inventory of target infrastructure, identify entry points, and map the technology stack to inform subsequent testing phases.

## When to Use This Workflow

### Primary Scenarios

**Starting a Penetration Test:**
- Need complete asset inventory
- Must identify all subdomains and hosts
- Require technology stack understanding
- Building target list for vulnerability scanning

**Bug Bounty Reconnaissance:**
- Expanding beyond published program scope
- Discovering forgotten or legacy systems
- Finding development and staging environments
- Identifying subdomain takeover opportunities

**Attack Surface Monitoring:**
- Continuous monitoring for new assets
- Change detection and tracking
- Shadow IT discovery
- Third-party integration mapping

**Pre-Engagement Assessment:**
- Scoping and proposal development
- Understanding client infrastructure
- Estimating testing effort
- Identifying high-value targets

### Integration Points

**Feeds Into:**
- Content discovery and directory fuzzing
- Vulnerability scanning (Nessus, Nuclei)
- Web application testing
- Credential testing and authentication bypass

**Follows:**
- Passive OSINT (search engines, social media)
- Initial scope definition
- Authorization and rules of engagement
- Legal and ethical review

## Required Tools

### Essential (Core Workflow)

**Subdomain Enumeration:**
- **Subfinder** - Fast passive subdomain discovery
- **Amass** - Comprehensive active/passive enumeration
- **DNSRecon** - DNS enumeration and zone transfers

**Network Reconnaissance:**
- **Nmap** - Port scanning and service detection
- **Masscan** (optional) - Ultra-fast port scanning

**Technology Fingerprinting:**
- **WhatWeb** - Web technology identification
- **Wappalyzer** (browser extension) - Visual technology detection

**Data Aggregation:**
- **theHarvester** - Email and subdomain harvesting
- **Recon-ng** (optional) - Modular reconnaissance framework

### Supporting (Enhanced Capabilities)

**Subdomain Validation:**
- **httprobe** - Probe for working HTTP/HTTPS servers
- **httpx** - Fast HTTP toolkit

**DNS Analysis:**
- **dig** - DNS lookup utility (built-in)
- **host** - DNS lookup (built-in)
- **nslookup** - DNS query tool (built-in)

**Certificate Transparency:**
- **crt.sh** (web interface) - Certificate transparency logs
- **Certstream** - Real-time certificate monitoring

**Visual Reconnaissance:**
- **Aquatone** - HTTP-based reconnaissance
- **EyeWitness** - Screenshot web services

## Methodology

### Phase 1: Passive Subdomain Discovery

**Objective:** Discover subdomains without directly interacting with target infrastructure.

**Step 1: Run Subfinder (Passive Sources)**

Subfinder queries passive DNS sources, search engines, and certificate transparency logs:

```bash
# Basic subdomain enumeration
subfinder -d example.com -o subdomains-subfinder.txt

# With all sources enabled
subfinder -d example.com -all -o subdomains-all-sources.txt

# Multiple domains from file
subfinder -dL domains.txt -o subdomains-multiple.txt

# Verbose output to see sources
subfinder -d example.com -v -o subdomains-verbose.txt
```

**What This Finds:**
- Subdomains from certificate transparency logs
- Historical DNS records
- Search engine indexed subdomains
- Third-party data sources
- Public API results

**Expected Output:**
```
api.example.com
www.example.com
mail.example.com
dev.example.com
staging.example.com
```

**Step 2: Analyze Subfinder Results**

```bash
# Count discovered subdomains
wc -l subdomains-subfinder.txt

# Look for interesting patterns
grep -E "(dev|staging|test|admin|internal)" subdomains-subfinder.txt

# Identify unique TLD patterns
grep -oE "\.[a-z]+$" subdomains-subfinder.txt | sort -u

# Check for wildcard subdomains
head -20 subdomains-subfinder.txt
```

### Phase 2: Active Subdomain Enumeration

**Objective:** Discover additional subdomains through DNS brute-forcing and permutation.

**Step 1: Run Amass (Active + Passive)**

Amass combines passive sources with active DNS enumeration:

```bash
# Basic active enumeration
amass enum -d example.com -o subdomains-amass.txt

# Passive only (no active DNS queries)
amass enum -passive -d example.com -o subdomains-amass-passive.txt

# Aggressive mode with brute-forcing
amass enum -active -d example.com -brute -o subdomains-amass-active.txt

# With custom wordlist
amass enum -d example.com -brute -w /path/to/wordlist.txt -o subdomains-custom.txt

# Multiple domains with config file
amass enum -df domains.txt -config amass-config.ini -o subdomains-multi.txt
```

**Amass Config Example** (`amass-config.ini`):
```ini
[scope]
domains = example.com

[bruteforce]
enabled = true
recursive = true
wordlist_file = /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt

[resolvers]
resolver = 8.8.8.8
resolver = 1.1.1.1
```

**What This Finds:**
- Everything Subfinder found (Amass includes passive sources)
- Brute-forced subdomains from wordlists
- Permutations and alterations
- Recursive enumeration results
- Reverse DNS lookups

**Step 2: Combine and Deduplicate Results**

```bash
# Merge all subdomain lists
cat subdomains-*.txt | sort -u > subdomains-all.txt

# Remove wildcard false positives (manual review needed)
# Look for patterns like: abc123.example.com, xyz789.example.com
grep -v "[a-f0-9]{32}" subdomains-all.txt > subdomains-filtered.txt

# Count total unique subdomains
wc -l subdomains-all.txt
```

### Phase 3: DNS Reconnaissance

**Objective:** Extract detailed DNS information and identify misconfigurations.

**Step 1: DNS Record Enumeration with DNSRecon**

```bash
# Standard DNS enumeration
dnsrecon -d example.com -t std

# Zone transfer attempt (rarely works but worth trying)
dnsrecon -d example.com -t axfr

# Brute force with wordlist
dnsrecon -d example.com -t brt -D /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt

# Comprehensive scan (all record types)
dnsrecon -d example.com -t std,brt,srv,axfr -o dnsrecon-output.xml
```

**What to Look For:**
- **Zone transfer success** - Major misconfiguration
- **CNAME records** - Potential subdomain takeovers
- **SPF/DMARC records** - Email security posture
- **TXT records** - May contain sensitive info
- **MX records** - Email infrastructure
- **NS records** - Nameserver information

**Step 2: Manual DNS Queries**

```bash
# Check all common record types
dig example.com A
dig example.com AAAA
dig example.com MX
dig example.com NS
dig example.com TXT
dig example.com SOA

# Check specific subdomain
dig api.example.com A

# Reverse DNS lookup
dig -x 192.168.1.100

# Check CNAME for subdomain takeover
dig subdomain.example.com CNAME
```

**Step 3: Identify Subdomain Takeover Opportunities**

```bash
# Extract CNAME records pointing to external services
for subdomain in $(cat subdomains-all.txt); do
  cname=$(dig +short $subdomain CNAME)
  if [[ ! -z "$cname" ]]; then
    echo "$subdomain -> $cname"
  fi
done > cname-records.txt

# Look for common takeover patterns
grep -E "(github.io|herokuapp.com|azurewebsites.net|s3.amazonaws.com)" cname-records.txt
```

**Common Subdomain Takeover Indicators:**
- Points to GitHub Pages but repository doesn't exist
- Points to Heroku but app is deleted
- Points to AWS S3 but bucket doesn't exist
- Points to Azure but resource is deallocated

### Phase 4: Subdomain Validation

**Objective:** Identify which discovered subdomains are actually live and serving content.

**Step 1: Probe for HTTP/HTTPS Services**

```bash
# Install httprobe if needed
go install github.com/tomnomnom/httprobe@latest

# Probe all subdomains for web services
cat subdomains-all.txt | httprobe > live-hosts.txt

# Probe with custom ports
cat subdomains-all.txt | httprobe -p http:8080 -p https:8443 > live-hosts-custom.txt

# More aggressive probing
cat subdomains-all.txt | httprobe -c 50 > live-hosts-fast.txt
```

**Expected Output:**
```
https://api.example.com
https://www.example.com
http://dev.example.com
https://staging.example.com
```

**Step 2: Advanced HTTP Analysis (Optional)**

```bash
# Install httpx if needed
go install github.com/projectdiscovery/httpx/cmd/httpx@latest

# Get detailed HTTP information
cat subdomains-all.txt | httpx -title -status-code -tech-detect -o httpx-results.txt

# Extract specific information
cat subdomains-all.txt | httpx -json -o httpx-results.json

# Screenshot web services (requires httpx with screenshot support)
cat subdomains-all.txt | httpx -screenshot -o httpx-screenshots/
```

### Phase 5: Port Scanning and Service Detection

**Objective:** Identify open ports and running services on discovered hosts.

**Step 1: Fast Port Scan with Nmap**

```bash
# Quick scan of top 1000 ports
nmap -T4 -iL subdomains-all.txt -oA nmap-quick

# Comprehensive scan of all ports (slower)
nmap -p- -T4 -iL subdomains-all.txt -oA nmap-full

# Service version detection
nmap -sV -T4 -iL subdomains-all.txt -oA nmap-services

# OS detection (requires root/sudo)
sudo nmap -O -T4 -iL subdomains-all.txt -oA nmap-os
```

**Nmap Timing Templates:**
- `-T0` (Paranoid) - Very slow, IDS evasion
- `-T1` (Sneaky) - Slow, IDS evasion
- `-T2` (Polite) - Slows down to use less bandwidth
- `-T3` (Normal) - Default speed
- `-T4` (Aggressive) - Fast scan, assumes good network
- `-T5` (Insane) - Very fast, may miss results

**Step 2: Targeted Service Scans**

```bash
# Scan only web ports (80, 443, 8000-8443)
nmap -p 80,443,8000-8443 -T4 -iL subdomains-all.txt -oA nmap-web-ports

# Scan common database ports
nmap -p 3306,5432,27017,6379,1433 -T4 -iL subdomains-all.txt -oA nmap-databases

# Scan common admin ports
nmap -p 22,3389,5900,8080,9090 -T4 -iL subdomains-all.txt -oA nmap-admin

# Comprehensive service enumeration
nmap -sV -sC -p- -T4 --open -iL subdomains-all.txt -oA nmap-comprehensive
```

**Nmap Output Analysis:**
```bash
# Extract open ports
grep "open" nmap-quick.nmap

# Find specific services
grep -E "(http|https|ssh|mysql|postgresql)" nmap-services.nmap

# List hosts with specific port open
grep -B 5 "3389/tcp.*open" nmap-quick.nmap
```

**Step 3: Masscan for Ultra-Fast Scanning (Optional)**

```bash
# Scan all ports on all hosts (very fast, very noisy)
sudo masscan -iL subdomains-all.txt -p0-65535 --rate=10000 -oL masscan-results.txt

# Top 100 ports only
sudo masscan -iL subdomains-all.txt --top-ports 100 --rate=5000 -oL masscan-top100.txt

# Follow up with Nmap for service detection
grep "open" masscan-results.txt | awk '{print $4":"$3}' | \
  xargs -I {} nmap -sV -p {} -oA nmap-masscan-followup
```

**⚠️ WARNING:** Masscan is EXTREMELY noisy and will trigger IDS/IPS. Only use with explicit authorization.

### Phase 6: Technology Fingerprinting

**Objective:** Identify web technologies, frameworks, and software versions.

**Step 1: WhatWeb Scanning**

```bash
# Scan single target
whatweb https://example.com

# Scan list of URLs
whatweb -i live-hosts.txt

# Aggressive mode (more plugins, more requests)
whatweb --aggression 3 -i live-hosts.txt

# Output to JSON for parsing
whatweb --log-json=whatweb-results.json -i live-hosts.txt

# Verbose output
whatweb -v https://example.com
```

**What WhatWeb Identifies:**
- Web server (Nginx, Apache, IIS)
- Programming languages (PHP, Python, Ruby)
- Frameworks (Rails, Django, Laravel)
- CMS platforms (WordPress, Drupal, Joomla)
- JavaScript libraries (jQuery, React, Vue)
- Analytics platforms (Google Analytics, etc.)
- CDN providers (Cloudflare, Akamai)

**Step 2: Manual Technology Detection**

```bash
# Check HTTP headers for technology indicators
curl -I https://example.com

# Look for specific headers
curl -I https://example.com | grep -E "(Server|X-Powered-By|X-AspNet-Version)"

# Check for common framework indicators
curl https://example.com | grep -E "(wp-content|/rails/|/django-admin)"

# Detect CMS
curl -s https://example.com | grep -i "generator" | head -1
```

**Step 3: Browser-Based Detection**

Use **Wappalyzer** browser extension for visual confirmation:
- Install extension in Chrome/Firefox
- Browse to target site
- Click extension icon to see detected technologies
- Export results for documentation

### Phase 7: Data Collection and Aggregation

**Objective:** Collect additional intelligence using theHarvester.

**Step 1: Email and Subdomain Harvesting**

```bash
# Harvest from all sources
theHarvester -d example.com -b all -f theharvester-results

# Google only
theHarvester -d example.com -b google

# Specific sources
theHarvester -d example.com -b bing,linkedin,twitter

# With DNS brute force
theHarvester -d example.com -b google -c

# Limit results
theHarvester -d example.com -b all -l 500
```

**theHarvester Sources:**
- `google` - Google search
- `bing` - Bing search
- `linkedin` - LinkedIn profiles
- `twitter` - Twitter mentions
- `shodan` - Shodan database
- `hunter` - Hunter.io (requires API key)
- `censys` - Censys database (requires API key)

**Step 2: Recon-ng Framework (Advanced)**

```bash
# Launch recon-ng
recon-ng

# Create workspace
workspaces create example_com

# Add domain
db insert domains example.com

# Load and run modules
modules load recon/domains-hosts/google_site_web
run

modules load recon/hosts-hosts/resolve
run

# Show discovered hosts
show hosts

# Export results
output show hosts csv
```

## Output Analysis

### Prioritizing Discovered Assets

**High-Value Targets:**
- Development/staging environments (`dev.`, `staging.`, `test.`)
- Admin panels and interfaces (`admin.`, `cpanel.`, `manage.`)
- API endpoints (`api.`, `api-v2.`, `rest.`)
- Internal services exposed externally (`internal.`, `vpn.`, `intranet.`)
- Legacy systems (`old.`, `legacy.`, `v1.`)
- Third-party integrations

**Interesting Patterns:**
- Geographic identifiers (`us.`, `eu.`, `asia.`)
- Environment indicators (`prod.`, `qa.`, `uat.`)
- Service-specific subdomains (`mail.`, `ftp.`, `sftp.`)
- Version identifiers (`v1.`, `v2.`, `api-v3.`)

**Red Flags:**
- Unusual ports open (8080, 8443, 8000, 9090)
- Outdated software versions
- Development frameworks in production
- Missing security headers
- Subdomain takeover opportunities
- Zone transfer success
- Exposed admin interfaces
- Sensitive information in DNS TXT records

### Organizing Results

**Create Structured Directory:**
```bash
mkdir -p recon-results/{subdomains,dns,ports,web,reports}

# Move results to organized structure
mv subdomains-*.txt recon-results/subdomains/
mv dnsrecon-* recon-results/dns/
mv nmap-* recon-results/ports/
mv whatweb-* recon-results/web/
```

**Generate Summary Report:**
```bash
cat > recon-results/reports/summary.txt <<EOF
Reconnaissance Summary - $(date)
Target: example.com

Discovered Subdomains: $(wc -l < subdomains-all.txt)
Live HTTP/HTTPS Hosts: $(wc -l < live-hosts.txt)
Total Open Ports: $(grep -c "open" nmap-quick.nmap)

High-Value Targets:
$(grep -E "(dev|staging|admin|api)" live-hosts.txt)

Interesting Findings:
- Zone transfer: [Success/Fail]
- Subdomain takeovers: [Count]
- Exposed admin panels: [Count]
- Outdated software: [Details]

Next Steps:
1. Content discovery on high-value targets
2. Vulnerability scanning on identified services
3. Manual testing of admin interfaces
4. Credential testing on authentication endpoints
EOF
```

## Command Sequence Examples

### Quick Reconnaissance (30 minutes)

```bash
# 1. Subdomain discovery
subfinder -d example.com -o subs.txt

# 2. Find live hosts
cat subs.txt | httprobe > live.txt

# 3. Quick port scan
nmap -T4 -p- -iL live.txt -oA nmap-quick

# 4. Technology fingerprinting
whatweb -i live.txt --log-json=tech.json

# 5. Summary
echo "Found $(wc -l < subs.txt) subdomains, $(wc -l < live.txt) live hosts"
```

### Comprehensive Reconnaissance (2-4 hours)

```bash
#!/bin/bash
DOMAIN="example.com"
OUTDIR="recon-$DOMAIN-$(date +%Y%m%d)"
mkdir -p $OUTDIR/{subdomains,dns,ports,web}

echo "[+] Phase 1: Passive subdomain discovery"
subfinder -d $DOMAIN -all -o $OUTDIR/subdomains/subfinder.txt

echo "[+] Phase 2: Active subdomain enumeration"
amass enum -active -d $DOMAIN -brute -o $OUTDIR/subdomains/amass.txt

echo "[+] Phase 3: Combine and deduplicate"
cat $OUTDIR/subdomains/*.txt | sort -u > $OUTDIR/subdomains/all.txt

echo "[+] Phase 4: DNS reconnaissance"
dnsrecon -d $DOMAIN -t std,axfr -o $OUTDIR/dns/dnsrecon.xml

echo "[+] Phase 5: Find live hosts"
cat $OUTDIR/subdomains/all.txt | httprobe > $OUTDIR/subdomains/live.txt

echo "[+] Phase 6: Port scanning"
nmap -T4 -p- -sV -iL $OUTDIR/subdomains/live.txt -oA $OUTDIR/ports/nmap-full

echo "[+] Phase 7: Technology fingerprinting"
whatweb --aggression 3 -i $OUTDIR/subdomains/live.txt --log-json=$OUTDIR/web/whatweb.json

echo "[+] Phase 8: Email harvesting"
theHarvester -d $DOMAIN -b all -f $OUTDIR/theharvester

echo "[+] Reconnaissance complete. Results in $OUTDIR/"
```

### Bug Bounty Reconnaissance (Optimized)

```bash
#!/bin/bash
# Bug bounty optimized for speed and comprehensive coverage
DOMAIN="$1"
if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <domain>"
  exit 1
fi

echo "[+] Starting bug bounty recon for $DOMAIN"

# Parallel subdomain discovery
echo "[+] Subdomain discovery (parallel)"
subfinder -d $DOMAIN -o sub1.txt &
PID1=$!
amass enum -passive -d $DOMAIN -o sub2.txt &
PID2=$!

# Wait for subdomain discovery
wait $PID1 $PID2

# Combine and find live hosts
cat sub1.txt sub2.txt | sort -u | httprobe -c 50 > live.txt

echo "[+] Found $(wc -l < live.txt) live hosts"

# Parallel port scanning and tech detection
nmap -T4 -p 80,443,8000-9000 -iL live.txt -oA nmap-quick &
PID3=$!
whatweb --aggression 3 -i live.txt --log-json=tech.json &
PID4=$!

wait $PID3 $PID4

echo "[+] Quick recon complete!"
echo "[+] Next: Review live.txt and tech.json for interesting targets"
```

## Next Steps

### Immediate Actions

**1. Validate Interesting Findings:**
- Test subdomain takeover candidates
- Verify zone transfer results
- Confirm outdated software versions
- Check exposed admin panels

**2. Prioritize Testing Targets:**
- Create high/medium/low priority lists
- Focus on development/staging first
- Target legacy and forgotten systems
- Identify unique or sensitive services

**3. Prepare for Content Discovery:**
- Create target lists for ffuf
- Prepare authenticated session cookies
- Identify technology-specific wordlists
- Plan parameter fuzzing strategies

### Transition to Next Phase

**Move to Content Discovery (FFUF):**
```bash
# Use discovered live hosts for directory fuzzing
ffuf -u https://FUZZ/FUZZ -w subdomains:live.txt -w paths:wordlist.txt
```

**Move to Vulnerability Scanning:**
```bash
# Scan discovered hosts with Nuclei
nuclei -l live.txt -t /path/to/templates/
```

**Move to Web Application Testing:**
```bash
# Manual testing of high-value targets
# Focus on authentication, APIs, admin panels
```

## Troubleshooting

### Common Issues

**Issue: Too many subdomains (potential wildcard DNS)**
```bash
# Test for wildcard
dig randomstring12345.example.com

# If it resolves, filter carefully
# Look for legitimate subdomains with specific patterns
```

**Issue: Rate limiting or blocking**
```bash
# Slow down enumeration
amass enum -d example.com -rate 10

# Use different DNS resolvers
amass enum -d example.com -r 8.8.8.8,1.1.1.1

# Add delays between requests
for sub in $(cat wordlist.txt); do
  dig $sub.example.com
  sleep 1
done
```

**Issue: No results from passive sources**
```bash
# Try active enumeration
amass enum -active -d example.com -brute

# Use custom wordlists
amass enum -d example.com -brute -w /path/to/large-wordlist.txt

# Check if domain is very new or has no public presence
```

**Issue: Nmap very slow**
```bash
# Reduce timing to T3 or T2
nmap -T3 -iL hosts.txt

# Scan only specific ports
nmap -p 80,443 -iL hosts.txt

# Use masscan for initial sweep, then nmap for details
sudo masscan -iL hosts.txt --top-ports 100 --rate=5000
```

## Legal and Ethical Reminders

**Always Required:**
- Written authorization for all active scanning
- Respect scope boundaries strictly
- Honor rate limits and robot.txt
- Report critical findings responsibly

**Never Do Without Authorization:**
- Port scanning production systems
- DNS zone transfer attempts
- Aggressive brute-forcing
- Exploitation of discovered vulnerabilities

**Best Practices:**
- Document all commands executed
- Maintain chain of custody for findings
- Use separate infrastructure for testing
- Consider impact on production systems

## References

**Tool Documentation:**
- Subfinder: https://github.com/projectdiscovery/subfinder
- Amass: https://github.com/OWASP/Amass/blob/master/doc/user_guide.md
- DNSRecon: https://github.com/darkoperator/dnsrecon
- Nmap: https://nmap.org/book/man.html
- WhatWeb: https://github.com/urbanadventurer/WhatWeb
- theHarvester: https://github.com/laramies/theHarvester

**Wordlists:**
- SecLists DNS: https://github.com/danielmiessler/SecLists/tree/master/Discovery/DNS
- Assetnote Wordlists: https://wordlists.assetnote.io/

**Related Workflows:**
- `master-guide.md` - Complete OSINT methodology
- `automation.md` - SpiderFoot automated reconnaissance
- `../pentest/reconnaissance.md` - Penetration testing recon phase
- `../ffuf/ffuf-guide.md` - Content discovery after recon

---

**Key Takeaway:** Reconnaissance is about comprehensive discovery and intelligent prioritization. Use automated tools for breadth, manual analysis for depth, and always respect authorization boundaries. The goal is not just finding assets, but understanding the attack surface to inform effective testing.
