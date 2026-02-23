# Netblock Reconnaissance Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the NetblockRecon workflow in the Recon skill to scan network blocks"}' \
  > /dev/null 2>&1 &
```

Running the **NetblockRecon** workflow in the **Recon** skill to scan network blocks...

**CIDR range and IP block investigation**

## Purpose

Perform reconnaissance on network blocks (CIDR ranges) to:
- Identify netblock ownership and allocation
- Discover live hosts in range
- Map infrastructure within network blocks
- Enumerate services across ranges
- Assess network segmentation
- Identify patterns and interesting hosts

## When to Use

- Pentesting entire network ranges
- Mapping organization's IP allocations
- Threat intelligence on attacker infrastructure
- Network asset inventory
- ISP/hosting provider investigation
- Called by domain-recon or ip-recon for related networks

## Input

**CIDR notation:**
- `/24` network: `192.168.1.0/24` (256 IPs)
- `/16` network: `10.0.0.0/16` (65,536 IPs)
- `/8` network: `10.0.0.0/8` (16,777,216 IPs)

**IP ranges:**
- Start-End: `192.168.1.1-192.168.1.254`
- Wildcard: `192.168.1.*`

## CRITICAL WARNING

**⚠️ AUTHORIZATION ABSOLUTELY REQUIRED FOR ACTIVE SCANNING**

Scanning network ranges you don't own is:
- **Illegal** in most jurisdictions
- **Detectable** by IDS/IPS systems
- **Aggressive** and can cause service impact
- **Potentially criminal** (Computer Fraud and Abuse Act in US)

**NEVER perform active netblock scanning without:**
1. Explicit written authorization (pentest SOW)
2. Confirmed scope (target ranges in writing)
3. Coordination with target (contact info, scan window)
4. Rate limiting (respectful scanning)

**Passive reconnaissance OK. Active = MUST HAVE AUTHORIZATION.**

## Workflow Modes

### Passive Mode (Default - Safe)
- WHOIS netblock lookup
- Sample IP investigation (a few IPs only)
- ASN mapping
- Public database queries
- No mass scanning

### Active Mode (Requires Authorization)
- Live host discovery
- Port scanning across range
- Service detection
- Network mapping

## Workflow Steps

### Phase 1: CIDR Validation and Parsing

**Step 1.1: Validate CIDR Notation**

```typescript
interface CIDRInfo {
  cidr: string;
  network: string;
  mask: number;
  firstIP: string;
  lastIP: string;
  totalIPs: number;
  usableIPs: number;
}

function parseCIDR(cidr: string): CIDRInfo {
  const [network, maskStr] = cidr.split('/');
  const mask = parseInt(maskStr);

  if (mask < 0 || mask > 32) {
    throw new Error('Invalid mask: must be 0-32');
  }

  // Calculate total IPs
  const totalIPs = Math.pow(2, 32 - mask);
  const usableIPs = totalIPs - 2; // Exclude network and broadcast

  // Calculate first and last IP
  const ipInt = ipToInt(network);
  const maskInt = ((0xFFFFFFFF << (32 - mask)) >>> 0);
  const networkInt = ipInt & maskInt;
  const broadcastInt = networkInt | (~maskInt >>> 0);

  return {
    cidr,
    network: intToIP(networkInt),
    mask,
    firstIP: intToIP(networkInt + 1),
    lastIP: intToIP(broadcastInt - 1),
    totalIPs,
    usableIPs
  };
}

function ipToInt(ip: string): number {
  return ip.split('.').reduce((int, octet) =>
    (int << 8) + parseInt(octet), 0) >>> 0;
}

function intToIP(int: number): string {
  return [
    (int >>> 24) & 0xFF,
    (int >>> 16) & 0xFF,
    (int >>> 8) & 0xFF,
    int & 0xFF
  ].join('.');
}
```

**Step 1.2: Assess Scan Size**

```typescript
function assessScanSize(cidrInfo: CIDRInfo): {
  category: string;
  recommendation: string;
  estimatedTime: string;
} {
  const { mask, totalIPs } = cidrInfo;

  if (mask >= 24) {
    // /24 to /32 (1-256 IPs)
    return {
      category: 'Small',
      recommendation: 'Safe to scan with proper authorization',
      estimatedTime: '< 5 minutes'
    };
  } else if (mask >= 20) {
    // /20 to /23 (257-4096 IPs)
    return {
      category: 'Medium',
      recommendation: 'Scan in batches, use rate limiting',
      estimatedTime: '5-30 minutes'
    };
  } else if (mask >= 16) {
    // /16 to /19 (4097-65536 IPs)
    return {
      category: 'Large',
      recommendation: 'Sample scan only, or use distributed scanning',
      estimatedTime: '1-4 hours'
    };
  } else {
    // /8 to /15 (65537+ IPs)
    return {
      category: 'Extremely Large',
      recommendation: 'DO NOT scan entire range. Sample only.',
      estimatedTime: '> 24 hours'
    };
  }
}
```

### Phase 2: Passive Netblock Intelligence

**Step 2.1: WHOIS Netblock Lookup**

```bash
# WHOIS for CIDR
whois -h whois.arin.net "n 192.168.1.0/24"

# Alternative RIRs based on range
# ARIN (North America): whois.arin.net
# RIPE (Europe): whois.ripe.net
# APNIC (Asia-Pacific): whois.apnic.net
# LACNIC (Latin America): whois.lacnic.net
# AFRINIC (Africa): whois.afrinic.net
```

**Extract:**
- NetRange (start - end IPs)
- CIDR blocks
- Organization name
- Registration date
- Allocation status
- Abuse contact
- Technical contact
- Parent/child allocations

**Step 2.2: ASN Mapping**

```bash
# Get ASN for first IP in range
whois -h whois.cymru.com " -v 192.168.1.1"

# Output format:
# AS | IP | BGP Prefix | CC | Registry | Allocated | AS Name
```

**Extract:**
- ASN number
- BGP prefix
- Country code
- Allocation date
- AS name/organization

**Step 2.3: Sample IP Investigation**

```typescript
// For large ranges, sample a few representative IPs
function getSampleIPs(cidrInfo: CIDRInfo): string[] {
  const samples = [];

  // Always include network boundaries
  samples.push(cidrInfo.firstIP);
  samples.push(cidrInfo.lastIP);

  // Add middle IP
  const midInt = Math.floor((ipToInt(cidrInfo.firstIP) + ipToInt(cidrInfo.lastIP)) / 2);
  samples.push(intToIP(midInt));

  // Add quartiles
  const quarter1 = Math.floor(ipToInt(cidrInfo.firstIP) + (cidrInfo.totalIPs * 0.25));
  const quarter3 = Math.floor(ipToInt(cidrInfo.firstIP) + (cidrInfo.totalIPs * 0.75));
  samples.push(intToIP(quarter1));
  samples.push(intToIP(quarter3));

  // Add common offsets
  const firstOctet = cidrInfo.network.split('.').slice(0, 3).join('.');
  samples.push(`${firstOctet}.1`); // Common gateway
  samples.push(`${firstOctet}.10`); // Common server
  samples.push(`${firstOctet}.100`); // Common server
  samples.push(`${firstOctet}.254`); // Common gateway

  return [...new Set(samples)]; // Remove duplicates
}

// Investigate each sample
for (const sampleIP of getSampleIPs(cidrInfo)) {
  const ipInfo = await ipRecon(sampleIP, { passive: true });
  console.log(`Sample IP ${sampleIP}:`, ipInfo.summary);
}
```

**Step 2.4: BGP Prefix Information**

```bash
# Get all BGP prefixes for ASN
curl "https://api.bgpview.io/asn/12345/prefixes"
```

**Identifies:**
- All CIDR blocks owned by this ASN
- IPv4 and IPv6 ranges
- Related network allocations

### Phase 3: Active Reconnaissance (Authorization Required)

**AUTHORIZATION CHECK:**

```typescript
async function checkNetblockAuthorization(cidr: string): Promise<boolean> {
  console.log("⚠️  NETWORK BLOCK SCANNING AUTHORIZATION REQUIRED");
  console.log(`Target: ${cidr}`);
  console.log(`This is ACTIVE scanning that will generate significant network traffic.`);
  console.log("");
  console.log("You MUST have:");
  console.log("1. Written authorization (pentest SOW)");
  console.log("2. Confirmed scope (target in writing)");
  console.log("3. Contact information for coordination");
  console.log("4. Scan window approval");
  console.log("");

  const response = await askUser("Do you have proper authorization? (yes/no)");

  if (response.toLowerCase() !== 'yes') {
    console.log("❌ Authorization not confirmed. Stopping.");
    return false;
  }

  // Document authorization
  await logAuthorizationEvent({
    target: cidr,
    type: 'netblock-scan',
    timestamp: new Date(),
    authConfirmed: true,
    techniques: ['host-discovery', 'port-scan']
  });

  return true;
}
```

**Step 3.1: Live Host Discovery**

**For Small Ranges (/24 to /28):**

```bash
# nmap ping scan
nmap -sn 192.168.1.0/24

# Output: List of live hosts
# Nmap scan report for 192.168.1.1
# Host is up (0.0010s latency).

# Or using naabu
naabu -host 192.168.1.0/24 -ping
```

**For Medium Ranges (/20 to /23):**

```bash
# Scan in batches
for subnet in {0..15}; do
  nmap -sn 192.168.${subnet}.0/24 --max-rate 100
  sleep 10 # Rate limiting
done
```

**For Large Ranges (/16 and larger):**

```bash
# DO NOT scan entire range
# Sample subnets only
for subnet in 0 1 10 100 254; do
  nmap -sn 10.0.${subnet}.0/24 --max-rate 50
done
```

**Extract live hosts:**
```bash
nmap -sn 192.168.1.0/24 | grep "Nmap scan report" | awk '{print $5}' > live_hosts.txt
```

**Step 3.2: Port Scanning Live Hosts**

**Conservative approach:**

```bash
# Scan only common ports on discovered hosts
while read host; do
  echo "Scanning $host..."
  naabu -host $host -top-ports 100 --rate 100
  sleep 2
done < live_hosts.txt
```

**Comprehensive approach (if authorized):**

```bash
# Full port scan on live hosts
while read host; do
  naabu -host $host -p - --rate 500
done < live_hosts.txt
```

**Step 3.3: Service Detection**

```bash
# HTTP/HTTPS probing
cat live_hosts.txt | httpx -silent -status-code -title

# Or specific ports
for host in $(cat live_hosts.txt); do
  # SSH banner
  timeout 2 nc -v $host 22 2>&1 | grep SSH

  # HTTP
  curl -s -I http://$host --max-time 2

  # HTTPS
  curl -s -I https://$host --max-time 2 -k
done
```

**Step 3.4: Pattern Recognition**

```typescript
// Identify interesting hosts based on patterns
function categorizeHosts(liveHosts: HostInfo[]): CategorizedHosts {
  const categories = {
    gateways: [],
    servers: [],
    workstations: [],
    iot: [],
    unknown: []
  };

  for (const host of liveHosts) {
    // Gateways typically end in .1 or .254
    if (host.ip.endsWith('.1') || host.ip.endsWith('.254')) {
      categories.gateways.push(host);
    }
    // Servers often have many open ports
    else if (host.openPorts.length > 5) {
      categories.servers.push(host);
    }
    // IoT devices have specific port patterns
    else if (host.openPorts.includes(8080) || host.openPorts.includes(8443)) {
      categories.iot.push(host);
    }
    // Workstations typically have fewer ports
    else if (host.openPorts.length <= 3) {
      categories.workstations.push(host);
    }
    else {
      categories.unknown.push(host);
    }
  }

  return categories;
}
```

### Phase 4: Report Generation

```markdown
# Netblock Reconnaissance Report: 192.168.1.0/24

**Generated:** 2025-11-11 06:00:00 PST
**Scan Type:** [Passive Only | Active Authorized]
**Authorization:** [Not Required | Pentest Engagement SOW-2025-001]

## Executive Summary
- **CIDR:** 192.168.1.0/24
- **Total IPs:** 256
- **Usable IPs:** 254
- **Live Hosts:** 47 (18.5% utilization)
- **Organization:** Example Corporation
- **ASN:** AS54321

---

## Network Block Information

### CIDR Details
- **Network:** 192.168.1.0/24
- **First IP:** 192.168.1.1
- **Last IP:** 192.168.1.254
- **Broadcast:** 192.168.1.255
- **Mask:** /24 (255.255.255.0)
- **Total Addresses:** 256
- **Usable Addresses:** 254

### Ownership (WHOIS)
- **Organization:** Example Corporation
- **ASN:** AS54321
- **NetRange:** 192.168.0.0 - 192.168.15.255
- **CIDR Blocks:** 192.168.0.0/20
- **Allocation Date:** 2015-03-20
- **Country:** United States
- **State:** California

### Contact Information
- **Abuse Email:** abuse@example.com
- **Abuse Phone:** +1-555-0100
- **NOC Email:** noc@example.com
- **Technical Contact:** netops@example.com

---

## Sample IP Analysis (Passive)

### Sample IP: 192.168.1.1
- **Reverse DNS:** gateway.example.com
- **Type:** Gateway/Router (inferred)
- **Organization:** Example Corporation
- **Location:** San Francisco, CA

### Sample IP: 192.168.1.10
- **Reverse DNS:** mail.example.com
- **Type:** Mail Server
- **Services (passive):** SMTP (inferred from DNS)

### Sample IP: 192.168.1.50
- **Reverse DNS:** db-01.example.com
- **Type:** Database Server
- **Services (passive):** Database (inferred from hostname)

### Sample IP: 192.168.1.100
- **Reverse DNS:** web-prod-01.example.com
- **Type:** Web Server
- **Services (passive):** HTTP/HTTPS (inferred)

---

## Live Host Discovery (Active Scan)

### Discovery Summary
- **Total IPs Scanned:** 254
- **Live Hosts Found:** 47
- **Utilization Rate:** 18.5%
- **Response Times:** 0.1ms - 50ms (all local network)

### Live Hosts by IP Range
- **192.168.1.1-10:** 10 hosts (100% - Infrastructure)
- **192.168.1.11-50:** 15 hosts (37.5% - Servers)
- **192.168.1.51-100:** 12 hosts (24% - Mixed)
- **192.168.1.101-200:** 8 hosts (8% - Workstations)
- **192.168.1.201-254:** 2 hosts (3.7% - Printers/IoT)

### Categorized Hosts

**Infrastructure (10 hosts):**
- 192.168.1.1 - gateway.example.com (Router)
- 192.168.1.2 - fw-01.example.com (Firewall)
- 192.168.1.3 - fw-02.example.com (Firewall)
- 192.168.1.5 - switch-core-01.example.com (Switch)
- 192.168.1.10 - dns-01.example.com (DNS Server)
- [... 5 more]

**Servers (15 hosts):**
- 192.168.1.20 - mail-01.example.com (Mail Server)
- 192.168.1.25 - web-prod-01.example.com (Web Server)
- 192.168.1.26 - web-prod-02.example.com (Web Server)
- 192.168.1.30 - api-prod-01.example.com (API Server)
- 192.168.1.50 - db-01.example.com (Database Server)
- 192.168.1.51 - db-02.example.com (Database Server)
- 192.168.1.60 - app-01.example.com (Application Server)
- [... 8 more]

**Workstations (12 hosts):**
- 192.168.1.101-112 (Developer workstations - inferred)

**IoT/Other (2 hosts):**
- 192.168.1.250 - printer-01.example.com
- 192.168.1.251 - printer-02.example.com

**Unknown/No rDNS (8 hosts):**
- 192.168.1.75, 192.168.1.80, ... (no reverse DNS)

---

## Port Scan Results

### Top Open Ports Across Range
| Port | Service | Count | % of Live Hosts |
|------|---------|-------|-----------------|
| 22 | SSH | 42 | 89.4% |
| 80 | HTTP | 18 | 38.3% |
| 443 | HTTPS | 18 | 38.3% |
| 3306 | MySQL | 2 | 4.3% |
| 5432 | PostgreSQL | 2 | 4.3% |
| 25 | SMTP | 1 | 2.1% |
| 53 | DNS | 1 | 2.1% |

### Hosts by Port Count
- **1-3 open ports:** 20 hosts (likely workstations)
- **4-10 open ports:** 15 hosts (likely servers)
- **11+ open ports:** 12 hosts (infrastructure devices)

### Interesting Services

**Database Servers:**
- 192.168.1.50:3306 (MySQL)
- 192.168.1.51:3306 (MySQL)
- 192.168.1.55:5432 (PostgreSQL)

**Web Servers:**
- 192.168.1.25:80,443 (nginx 1.20.1)
- 192.168.1.26:80,443 (nginx 1.20.1)

**Mail Server:**
- 192.168.1.20:25,587,993,995 (Postfix, Dovecot)

---

## Service Detection

### Web Applications
**Total:** 18 HTTP/HTTPS services

| Host | URL | Status | Server | Title |
|------|-----|--------|--------|-------|
| 192.168.1.25 | https://192.168.1.25 | 200 | nginx/1.20.1 | Example Production |
| 192.168.1.26 | https://192.168.1.26 | 200 | nginx/1.20.1 | Example Production |
| 192.168.1.30 | https://192.168.1.30 | 401 | Express.js | API Unauthorized |

### SSH Banners
**OpenSSH Versions:**
- OpenSSH 8.2p1 Ubuntu: 30 hosts
- OpenSSH 7.9p1 Debian: 10 hosts
- OpenSSH 9.0p1 Ubuntu: 2 hosts

**Observation:** Mix of SSH versions - potential patching inconsistency

---

## Network Segmentation Analysis

### Observed Patterns

**Subnet Organization:**
- .1-.10: Infrastructure (routers, firewalls, DNS)
- .11-.50: Production servers
- .51-.100: Databases and backend services
- .101-.200: Workstations
- .201-.254: IoT devices and printers

**Segmentation Assessment:**
- ⚠️ **Poor Segmentation:** All devices in single /24
- ⚠️ **Security Concern:** Databases accessible from workstation range
- ✅ **Logical Organization:** IP assignment follows pattern

**Recommendations:**
1. Implement VLANs to separate:
   - Production servers (/25)
   - Databases (/26 with strict ACLs)
   - Workstations (/25)
   - Guest/IoT (/26)

2. Apply firewall rules:
   - Database access only from application tier
   - Workstations cannot reach production directly
   - Segment by function, not just IP range

---

## Security Observations

### Positive Indicators
- ✅ SSH enabled on most systems (remote management)
- ✅ HTTPS used on web services
- ✅ Consistent naming convention (aids management)

### Security Concerns
⚠️ **High Priority:**
1. **Database Exposure:** MySQL/PostgreSQL accessible from workstation range
2. **Flat Network:** No network segmentation (single broadcast domain)
3. **SSH Version Mix:** Inconsistent patching (security risk)
4. **Unknown Hosts:** 8 hosts without rDNS (shadow IT?)

⚠️ **Medium Priority:**
1. **IoT Devices:** Printers on same network as production
2. **No Apparent Monitoring:** No IDS/IPS detected
3. **Reverse DNS:** Not all hosts have rDNS entries

---

## Recommendations

### Immediate Actions
1. **Network Segmentation:**
   - Implement VLANs for production, databases, workstations
   - Apply strict firewall rules between segments
   - Isolate IoT devices on separate network

2. **Database Security:**
   - Move databases to isolated VLAN
   - Restrict access to application tier only
   - Implement bastion hosts for admin access

3. **Patch Management:**
   - Standardize SSH versions
   - Create patching schedule
   - Prioritize internet-facing systems

4. **Asset Inventory:**
   - Identify 8 unknown hosts (no rDNS)
   - Create CMDB (Configuration Management Database)
   - Implement IPAM (IP Address Management)

### Further Investigation (if authorized)
1. **Vulnerability Scanning:**
   - Run Nessus/OpenVAS on identified systems
   - Focus on database servers and web applications
   - Check for missing patches

2. **Web Application Testing:**
   - Assess 18 web applications for vulnerabilities
   - Test authentication mechanisms
   - Check for OWASP Top 10

3. **Configuration Audits:**
   - Review SSH configurations
   - Check for default credentials
   - Assess service hardening

---

## Tools Used
- whois - Netblock information
- nmap - Host discovery and port scanning
- naabu - Fast port scanning
- httpx - Web service detection
- IPInfo API - IP metadata

**Authorization:** Active reconnaissance authorized - Pentest Engagement SOW-2025-001
**Scan Window:** 2025-11-11 06:00-08:00 PST
**Contact:** security@example.com, +1-555-0199

**Analyst:** {DAIDENTITY.NAME} (recon skill)

**Report End**
```

## Rate Limiting and Respectful Scanning

```typescript
// Implement rate limiting to avoid DoS
async function scanWithRateLimit(
  ips: string[],
  scanFunc: (ip: string) => Promise<any>,
  rateLimit: number = 10 // requests per second
): Promise<any[]> {
  const results = [];
  const delayMs = 1000 / rateLimit;

  for (const ip of ips) {
    const result = await scanFunc(ip);
    results.push(result);

    // Rate limit
    await sleep(delayMs);

    // Progress indication
    if (results.length % 10 === 0) {
      console.log(`Progress: ${results.length}/${ips.length} (${(results.length/ips.length*100).toFixed(1)}%)`);
    }
  }

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Integration Examples

### Called by ip-recon

```typescript
// IP recon discovers this IP is in a netblock
const ipInfo = await ipRecon("192.168.1.50");

// Get the netblock
const netblock = ipInfo.cidr; // "192.168.1.0/24"

// Call netblock recon on the entire range
const netblockReport = await netblockRecon(netblock, { passive: true });
```

### Called by domain-recon

```typescript
// Domain recon discovers multiple IPs in same netblock
const domainIPs = await getDomainIPs("example.com");

// Extract common netblocks
const netblocks = findCommonNetblocks(domainIPs);

// Recon each netblock
for (const netblock of netblocks) {
  await netblockRecon(netblock);
}
```

## Success Criteria

### Passive Recon Complete
- ✅ CIDR parsed and validated
- ✅ WHOIS netblock info retrieved
- ✅ ASN identified
- ✅ Sample IPs investigated
- ✅ BGP prefixes identified
- ✅ Report generated

### Active Recon Complete (if authorized)
- ✅ Authorization documented
- ✅ Live hosts discovered
- ✅ Port scans completed
- ✅ Services detected
- ✅ Patterns identified
- ✅ Rate limiting applied (no DoS)
- ✅ Coordination maintained (if required)

---

**Critical Reminder:** Never scan networks you don't own. Always get written authorization. Respect rate limits. Coordinate with network owners.
