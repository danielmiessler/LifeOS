# Network Analysis OSINT Tools - Installation & Usage Notes

**Installation Date:** 2025-11-11
**System:** macOS (Darwin 25.0.0, ARM64)
**Status:** All 4 tools successfully installed and tested

---

## 🛠️ Installed Tools

### 1. DNSRecon - Active DNS Enumeration & Reconnaissance

**Version:** Latest (from GitHub)
**Installation Method:** GitHub repository clone + pip3 dependencies
**Location:** `~/.claude/skills/Webassessment/osint-tools/dnsrecon/`
**Repository:** https://github.com/darkoperator/dnsrecon

**Installation Commands:**
```bash
cd ~/.claude/skills/Webassessment/osint-tools
git clone https://github.com/darkoperator/dnsrecon.git
pip3 install dnspython netaddr lxml requests httpx loguru stamina ujson
```

**How to Run:**
```bash
cd ~/.claude/skills/Webassessment/osint-tools/dnsrecon
python3 dnsrecon.py [options]
```

**Common Use Cases:**

1. **Standard DNS Enumeration:**
   ```bash
   python3 dnsrecon.py -d example.com -t std
   ```
   - Retrieves SOA, NS, A, AAAA, MX, TXT records
   - Checks DNSSEC configuration
   - Identifies nameservers and their BIND versions

2. **Zone Transfer (AXFR) Attempt:**
   ```bash
   python3 dnsrecon.py -d example.com -t axfr
   ```
   - Attempts DNS zone transfer
   - Reveals all DNS records if misconfigured

3. **Subdomain Brute Force:**
   ```bash
   python3 dnsrecon.py -d example.com -t brt -D /path/to/wordlist.txt
   ```
   - Discovers subdomains using dictionary
   - Useful for finding hidden services

4. **Reverse DNS Lookup:**
   ```bash
   python3 dnsrecon.py -r 192.168.1.0/24
   ```
   - Maps IP addresses to hostnames
   - Useful for network mapping

5. **Certificate Transparency (crt.sh) Enumeration:**
   ```bash
   python3 dnsrecon.py -d example.com -t crt
   ```
   - Finds subdomains via certificate transparency logs

**Output Formats:**
- `-j output.json` - JSON format
- `-c output.csv` - CSV format
- `-x output.xml` - XML format

**Key Features:**
- DNSSEC validation
- Certificate transparency scraping
- Wildcard detection and filtering
- Multi-threaded scanning (--threads)
- SPF record analysis
- Whois integration

---

### 2. WhatWeb - Web Technology Fingerprinting

**Version:** 0.6.3
**Installation Method:** GitHub repository clone
**Location:** `~/.claude/skills/Webassessment/osint-tools/whatweb/`
**Repository:** https://github.com/urbanadventurer/WhatWeb
**Plugins:** 900+ technology detection plugins

**Installation Commands:**
```bash
cd ~/.claude/skills/Webassessment/osint-tools
git clone https://github.com/urbanadventurer/WhatWeb.git whatweb
```

**How to Run:**
```bash
cd ~/.claude/skills/Webassessment/osint-tools/whatweb
./whatweb [options] <target>
```

**Common Use Cases:**

1. **Basic Website Scan:**
   ```bash
   ./whatweb example.com
   ```
   - Identifies web server, CMS, frameworks
   - Detects JavaScript libraries
   - Shows HTTP headers

2. **Verbose Output:**
   ```bash
   ./whatweb -v example.com
   ```
   - Detailed plugin matches
   - Shows certainty levels
   - Displays all detected technologies

3. **Aggressive Scan (More Requests):**
   ```bash
   ./whatweb -a 3 example.com
   ```
   - Aggression levels: 1 (stealthy) to 4 (heavy)
   - Level 3 recommended for thorough analysis

4. **Scan Multiple URLs:**
   ```bash
   ./whatweb -i urls.txt
   ```
   - Batch scanning from file
   - One URL per line

5. **JSON Output:**
   ```bash
   ./whatweb --log-json=output.json example.com
   ```
   - Machine-readable format
   - Easy parsing for automation

**Detected Technologies:**
- Web servers (Apache, Nginx, IIS)
- CMS platforms (WordPress, Joomla, Drupal)
- JavaScript frameworks (React, Vue, Angular)
- Programming languages (PHP, Ruby, Python)
- Analytics (Google Analytics, Matomo)
- CDNs (Cloudflare, Akamai)
- Security products (WAFs, DDoS protection)

**Key Features:**
- 900+ technology fingerprints
- Supports HTTP/HTTPS
- Cookie tracking
- Custom headers detection
- Performance metric collection

---

### 3. ExifTool - Metadata Extraction from Files

**Version:** 13.36
**Installation Method:** Homebrew
**Location:** `/opt/homebrew/bin/exiftool` (system-wide)
**Documentation:** https://exiftool.org/

**Installation Command:**
```bash
brew install exiftool
```

**How to Run:**
```bash
exiftool [options] <file>
```

**Common Use Cases:**

1. **Extract All Metadata:**
   ```bash
   exiftool image.jpg
   ```
   - Shows camera model, GPS location, timestamps
   - Reveals software used for editing
   - Displays author/copyright information

2. **Extract Specific Tags:**
   ```bash
   exiftool -GPS* image.jpg
   ```
   - GPS coordinates
   - Altitude and direction
   - Useful for geolocation

3. **Remove All Metadata:**
   ```bash
   exiftool -all= image.jpg
   ```
   - Strips ALL metadata
   - Creates backup with _original suffix
   - Privacy protection

4. **Batch Processing:**
   ```bash
   exiftool -r /path/to/directory/
   ```
   - Recursive directory scan
   - Processes all supported files

5. **Export to CSV:**
   ```bash
   exiftool -csv -r /path/to/directory/ > metadata.csv
   ```
   - Structured data export
   - Easy analysis in spreadsheets

6. **Check PDF Metadata:**
   ```bash
   exiftool document.pdf
   ```
   - Author, creator software
   - Creation/modification dates
   - Document properties

**Supported File Types:**
- Images: JPEG, PNG, GIF, TIFF, RAW formats
- Videos: MP4, MOV, AVI, MKV
- Documents: PDF, DOC, XLS, PPT
- Audio: MP3, WAV, FLAC
- Archives: ZIP, RAR
- And 100+ more formats

**Key Features:**
- Read/write/edit metadata
- GPS coordinate extraction
- Timestamp analysis
- Software fingerprinting
- Privacy leak detection

**Privacy Note:** Always check images for GPS data before sharing publicly!

---

### 4. Nmap - Network Discovery & Port Scanning

**Version:** 7.98
**Installation Method:** Pre-installed (or Homebrew)
**Location:** System-wide binary
**Documentation:** https://nmap.org/

**Installation Command (if needed):**
```bash
brew install nmap
```

**How to Run:**
```bash
nmap [options] <target>
```

**Common Use Cases:**

1. **Ping Scan (Host Discovery):**
   ```bash
   nmap -sn 192.168.1.0/24
   ```
   - Discovers live hosts without port scanning
   - Fast network mapping

2. **Basic Port Scan:**
   ```bash
   nmap example.com
   ```
   - Scans 1000 most common ports
   - Shows open services

3. **Full Port Scan:**
   ```bash
   nmap -p- example.com
   ```
   - Scans all 65535 ports
   - Comprehensive but slower

4. **Service Version Detection:**
   ```bash
   nmap -sV example.com
   ```
   - Identifies service versions
   - Detects software running on ports

5. **OS Detection:**
   ```bash
   sudo nmap -O example.com
   ```
   - Fingerprints operating system
   - Requires root/sudo

6. **Aggressive Scan:**
   ```bash
   sudo nmap -A example.com
   ```
   - OS detection, version detection, scripts
   - Traceroute included
   - Most comprehensive single command

7. **Stealth SYN Scan:**
   ```bash
   sudo nmap -sS example.com
   ```
   - Half-open scan (more stealthy)
   - Requires root/sudo

8. **Script Scan (Vulnerability Detection):**
   ```bash
   nmap --script vuln example.com
   ```
   - Runs NSE vulnerability scripts
   - Detects common security issues

**Scan Types:**
- `-sS` - SYN scan (stealth, requires sudo)
- `-sT` - TCP connect scan (no sudo needed)
- `-sU` - UDP scan
- `-sn` - Ping scan only (no ports)

**Output Formats:**
- `-oN output.txt` - Normal format
- `-oX output.xml` - XML format
- `-oG output.gnmap` - Greppable format
- `-oA basename` - All formats

**Key Features:**
- Network discovery and mapping
- Port scanning (TCP/UDP)
- Service/version detection
- OS fingerprinting
- NSE scripting engine (600+ scripts)
- Firewall/IDS evasion techniques

**Safety Notes:**
⚠️ **CRITICAL WARNINGS:**
- Only scan networks/hosts you own or have permission to test
- Port scanning without authorization may be illegal
- Use `-T2` or lower timing for stealthier scans
- Always get written permission before scanning
- Consider using `--max-rate` to limit bandwidth impact

---

## 🔐 Security & Legal Considerations

**IMPORTANT:** These tools are powerful and can be used for both defensive and offensive purposes.

**Legal Requirements:**
- ✅ Only use on systems you own
- ✅ Get written authorization before testing client systems
- ✅ Use example.com or localhost for practice
- ❌ Never scan without permission
- ❌ Never use for malicious purposes

**Best Practices:**
1. Document all authorized scans
2. Use rate limiting to avoid DoS
3. Scan during approved maintenance windows
4. Store results securely
5. Report findings responsibly

---

## 📊 Integration with WebAssessment Skill

These tools are part of PAI webassessment skill workflow for:

**OSINT Reconnaissance:**
- DNSRecon: Enumerate DNS records and subdomains
- WhatWeb: Identify web technologies and frameworks
- ExifTool: Extract metadata from discovered files
- Nmap: Map network topology and services

**Typical Workflow:**
1. **Passive Reconnaissance** - Certificate transparency, WHOIS
2. **DNS Enumeration** - DNSRecon to map domain infrastructure
3. **Network Discovery** - Nmap to find live hosts and services
4. **Technology Fingerprinting** - WhatWeb to identify web stack
5. **Metadata Analysis** - ExifTool on discovered files
6. **Vulnerability Assessment** - Specialized tools (separate workflow)

---

## 🔧 Troubleshooting

**DNSRecon Issues:**
- If import errors occur, reinstall dependencies: `pip3 install -r requirements.txt`
- For Python version conflicts, consider using virtual environment

**WhatWeb Issues:**
- Ruby gem warnings can be ignored (clocale-0.0.4)
- For SSL certificate errors, use `--no-check-certificate` option

**ExifTool Issues:**
- If command not found, check PATH: `/opt/homebrew/bin` should be in PATH
- Run `brew link exiftool` if needed

**Nmap Issues:**
- Some scans require sudo (SYN scan, OS detection)
- Firewall may block certain scan types
- Use `-Pn` if host seems down but you know it's up (skips ping)

---

## 📚 Additional Resources

**DNSRecon:**
- GitHub: https://github.com/darkoperator/dnsrecon
- DNS enumeration techniques
- DNSSEC validation guides

**WhatWeb:**
- GitHub: https://github.com/urbanadventurer/WhatWeb
- Plugin development guide
- Wiki with usage examples

**ExifTool:**
- Official site: https://exiftool.org/
- Tag documentation
- FAQ and examples

**Nmap:**
- Official site: https://nmap.org/
- Nmap book (free online)
- NSE script documentation
- Reference guide

---

## 🎯 Quick Reference Commands

**DNS Enumeration:**
```bash
cd ~/.claude/skills/Webassessment/osint-tools/dnsrecon
python3 dnsrecon.py -d TARGET -t std -j output.json
```

**Web Technology Detection:**
```bash
cd ~/.claude/skills/Webassessment/osint-tools/whatweb
./whatweb -a 3 -v TARGET --log-json=output.json
```

**Metadata Extraction:**
```bash
exiftool -r -csv /path/to/files/ > metadata.csv
```

**Network Scan:**
```bash
nmap -sV -sC -oA scan_results TARGET
```

---

**Last Updated:** 2025-11-11
**Maintained By:** PAI Security Infrastructure
**Status:** Production Ready ✅
