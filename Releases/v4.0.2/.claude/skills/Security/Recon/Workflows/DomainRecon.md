# Domain Reconnaissance Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the DomainRecon workflow in the Recon skill to map domain infrastructure"}' \
  > /dev/null 2>&1 &
```

Running the **DomainRecon** workflow in the **Recon** skill to map domain infrastructure...

**Comprehensive domain infrastructure mapping and enumeration**

## Purpose

Perform full reconnaissance on a domain to discover:
- Domain registration and ownership details
- DNS configuration and records
- Subdomains and related assets
- Mail infrastructure and email security
- IP addresses and hosting providers
- Technology stack and web applications
- Certificate details and history
- Attack surface mapping

## When to Use

- Investigating target domains for pentesting
- Mapping organization's internet-facing infrastructure
- Bug bounty reconnaissance
- Attack surface assessment
- Called by OSINT for entity infrastructure mapping
- Threat intelligence on malicious domains
- Domain acquisition due diligence

## Input

**Domain name (FQDN):**
- Root domain: `example.com`
- Subdomain: `api.example.com`
- Internationalized domain: `münchen.de`

## Workflow Modes

### Passive Mode (Default)
- WHOIS lookup
- DNS enumeration
- Certificate transparency
- Public database searches
- No direct probing of subdomains

### Active Mode (Requires Authorization)
- Subdomain brute forcing
- HTTP/HTTPS probing
- Technology detection
- Vulnerability scanning
- Service fingerprinting

## Workflow Steps

### Phase 1: Domain Validation & WHOIS

**Step 1.1: Validate Domain Name**
```typescript
function isValidDomain(domain: string): boolean {
  // Basic domain regex
  const regex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  return regex.test(domain);
}
```

**Step 1.2: WHOIS Lookup**
```bash
whois example.com
```

**Extract:**
- **Registrar:** Company that registered the domain
- **Registration Date:** When domain was first registered
- **Expiration Date:** When domain registration expires
- **Updated Date:** Last modification
- **Status:** Domain status flags (clientTransferProhibited, etc.)
- **Name Servers:** Authoritative DNS servers
- **Registrant:** Domain owner (if not privacy-protected)
- **Admin Contact:** Administrative contact
- **Tech Contact:** Technical contact
- **DNSSEC:** Whether DNSSEC is enabled

**Example output parsing:**
```bash
# Extract key fields
whois example.com | grep -E "(Registrar:|Creation Date:|Expiry Date:|Name Server:)"
```

### Phase 2: DNS Enumeration

**Step 2.1: Core DNS Records**

```bash
# A records (IPv4)
dig example.com A +short

# AAAA records (IPv6)
dig example.com AAAA +short

# MX records (mail servers)
dig example.com MX +short

# NS records (name servers)
dig example.com NS +short

# SOA record (zone authority)
dig example.com SOA +short

# TXT records (various metadata)
dig example.com TXT

# CNAME records (for www typically)
dig www.example.com CNAME +short

# All records (attempt)
dig example.com ANY
```

**Step 2.2: Mail Infrastructure Analysis**

```bash
# MX records with priority
dig example.com MX

# Example output:
# 10 mail1.example.com
# 20 mail2.example.com

# Get IPs for mail servers
dig mail1.example.com A +short
dig mail2.example.com A +short

# SPF record
dig example.com TXT | grep "v=spf1"

# DMARC policy
dig _dmarc.example.com TXT

# DKIM selectors (common ones)
dig default._domainkey.example.com TXT
dig google._domainkey.example.com TXT
dig k1._domainkey.example.com TXT
dig selector1._domainkey.example.com TXT
dig selector2._domainkey.example.com TXT
```

**Email Security Assessment:**
- **SPF:** Check for sender policy framework
- **DMARC:** Check for domain-based message authentication
- **DKIM:** Check for domain keys identified mail
- **MTA-STS:** Check for mail transfer agent strict transport security

**Step 2.3: Name Server Analysis**

```bash
# Get authoritative name servers
dig example.com NS +short

# Example output:
# ns1.example.com
# ns2.example.com

# Get IPs for each name server
for ns in $(dig example.com NS +short); do
  echo "=== $ns ==="
  dig $ns A +short
  dig $ns AAAA +short
done

# Check if name servers are in same domain (potential SPOF)
# Check if name servers are geographically distributed
```

**Step 2.4: Zone Transfer Attempt**

```bash
# Attempt zone transfer (usually fails but worth trying)
dig @ns1.example.com example.com AXFR

# If successful, you get ALL DNS records (jackpot!)
# If failed, continue with enumeration
```

### Phase 3: Subdomain Enumeration

**Step 3.1: Certificate Transparency**

```bash
# Query crt.sh for all certificates
curl -s "https://crt.sh/?q=%.example.com&output=json" | jq

# Extract unique subdomains
curl -s "https://crt.sh/?q=%.example.com&output=json" | \
  jq -r '.[].name_value' | \
  sed 's/\*\.//g' | \
  sort -u > subdomains_ct.txt

# Count
wc -l subdomains_ct.txt
```

**Categorize interesting subdomains:**
```bash
# Administrative interfaces
grep -E "(admin|panel|dashboard|manage|control)" subdomains_ct.txt

# API endpoints
grep -E "(api|rest|graphql|v1|v2)" subdomains_ct.txt

# Development/staging
grep -E "(dev|test|staging|uat|qa|demo)" subdomains_ct.txt

# Internal systems
grep -E "(internal|intranet|vpn|private)" subdomains_ct.txt

# Mail systems
grep -E "(mail|smtp|imap|pop|mx|webmail)" subdomains_ct.txt

# Databases
grep -E "(db|database|mysql|postgres|mongo)" subdomains_ct.txt
```

**Step 3.2: Common Subdomain Enumeration**

```bash
# Create wordlist of common subdomains
cat > common_subdomains.txt << 'EOF'
www
mail
ftp
localhost
webmail
smtp
pop
ns1
ns2
webdisk
ns
cpanel
whm
autodiscover
autoconfig
m
imap
test
mx
blog
dev
www2
admin
forum
news
vpn
ns3
mail2
new
mysql
old
lists
support
mobile
mx1
static
api
cdn
media
email
portal
beta
stage
staging
demo
intranet
git
shop
app
apps
files
dashboard
secure
login
panel
EOF

# Test each subdomain (DNS only - passive)
while read subdomain; do
  result=$(dig ${subdomain}.example.com A +short)
  if [ ! -z "$result" ]; then
    echo "${subdomain}.example.com -> $result"
  fi
done < common_subdomains.txt
```

**Step 3.3: Subdomain Brute Force (Active - Requires Authorization)**

```bash
# Using dnsgen + massdns (if authorized)
# This is ACTIVE reconnaissance
cat subdomains_ct.txt | dnsgen - | massdns -r resolvers.txt -o S -w live_subdomains.txt
```

### Phase 4: IP Address Enumeration

**Step 4.1: Resolve All Discovered Domains**

```bash
# For root domain
echo "=== example.com ===" > domain_ips.txt
dig example.com A +short >> domain_ips.txt
dig example.com AAAA +short >> domain_ips.txt

# For each subdomain found
while read subdomain; do
  echo "=== $subdomain ===" >> domain_ips.txt
  dig $subdomain A +short >> domain_ips.txt
  dig $subdomain AAAA +short >> domain_ips.txt
done < subdomains_ct.txt

# Extract unique IPs
grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' domain_ips.txt | sort -u > unique_ips.txt
```

**Step 4.2: Call IP-Recon for Each IP**

```typescript
// For each discovered IP, perform IP reconnaissance
const uniqueIPs = await extractUniqueIPs(domainReport);

for (const ip of uniqueIPs) {
  // Call ip-recon workflow
  const ipInfo = await ipRecon(ip, { passive: true });

  domainReport.infrastructure.push({
    ip: ip,
    asn: ipInfo.asn,
    organization: ipInfo.organization,
    location: ipInfo.location,
    hosting: ipInfo.hostingType
  });
}
```

**Step 4.3: Identify Hosting Providers**

```typescript
// Group IPs by hosting provider
const hostingProviders = {};

for (const ipInfo of domainReport.infrastructure) {
  const provider = ipInfo.organization;

  if (!hostingProviders[provider]) {
    hostingProviders[provider] = [];
  }

  hostingProviders[provider].push(ipInfo.ip);
}

// Example output:
// "Amazon Web Services": ["1.2.3.4", "5.6.7.8"]
// "Cloudflare": ["104.26.10.10"]
// "Example Corp": ["10.20.30.40"]
```

### Phase 5: Active Probing (Authorization Required)

**AUTHORIZATION CHECK:**
```typescript
if (activeMode && !isAuthorized()) {
  console.log("⚠️  Active subdomain probing requires authorization");
  console.log("Passive enumeration complete. Switch to passive-only mode.");
  return passiveReport;
}
```

**Step 5.1: HTTP/HTTPS Probing**

```bash
# Probe all discovered subdomains
cat subdomains_ct.txt | httpx -silent

# With details
cat subdomains_ct.txt | httpx -status-code -title -tech-detect -server

# Save live web applications
cat subdomains_ct.txt | httpx -silent > live_webapps.txt
```

**Step 5.2: Technology Detection**

```bash
# Detect technologies on each live webapp
while read webapp; do
  echo "=== $webapp ==="
  whatweb $webapp
done < live_webapps.txt

# Or using httpx
cat live_webapps.txt | httpx -tech-detect -cdn -server
```

**Step 5.3: Screenshot Capture**

```bash
# Take screenshots of all web applications (useful for reporting)
cat live_webapps.txt | while read url; do
  domain=$(echo $url | sed 's|https\?://||' | sed 's|/.*||')
  aquatone-capture -url $url -out screenshots/$domain.png
done
```

### Phase 6: Certificate Analysis

**Step 6.1: Current Certificates**

```bash
# For each HTTPS endpoint
for domain in $(cat live_webapps.txt | grep https); do
  echo "=== $domain ==="

  # Certificate details
  echo | openssl s_client -connect ${domain}:443 -servername $domain 2>/dev/null | \
    openssl x509 -noout -dates -subject -issuer -ext subjectAltName

done
```

**Extract:**
- Common Name (CN)
- Subject Alternative Names (SANs) - additional domains on cert
- Issuer (Let's Encrypt, DigiCert, etc.)
- Validity period
- Certificate transparency logs
- Serial number

**Step 6.2: Historical Certificates**

```bash
# Get certificate history from crt.sh
curl -s "https://crt.sh/?q=example.com&output=json" | \
  jq -r '.[] | "\(.issuer_name) | \(.not_before) | \(.not_after)"' | \
  sort -u
```

**Analyze:**
- Issuer changes (org switches certificate providers)
- Validity period patterns
- Expired certificates
- Revoked certificates

### Phase 7: Report Compilation

**Generate comprehensive domain report:**

```markdown
# Domain Reconnaissance Report: example.com

**Generated:** 2025-11-11 05:00:00 PST
**Mode:** [Passive Only | Active Authorized]
**Authorization:** [Not Required | Pentest Engagement XYZ]

## Executive Summary
- **Domain:** example.com
- **Registrar:** Example Registrar Inc
- **Registration:** 2010-03-15 (15 years old)
- **Expiration:** 2026-03-15 (120 days remaining)
- **Subdomains Found:** 47
- **IP Addresses:** 8 unique IPs
- **Web Applications:** 23 live applications
- **Risk Level:** [Low | Medium | High]

---

## Domain Registration

### WHOIS Information
- **Domain:** example.com
- **Registrar:** Example Registrar Inc (registrar.example.com)
- **Registration Date:** 2010-03-15 14:23:00 UTC
- **Expiration Date:** 2026-03-15 14:23:00 UTC
- **Updated Date:** 2025-09-10 08:15:00 UTC
- **Status:**
  - clientTransferProhibited
  - clientUpdateProhibited
- **DNSSEC:** ❌ Unsigned

### Registrant (Privacy Protected)
- **Organization:** Privacy Protected
- **Email:** privacy@exampleregistrar.com

### Name Servers
- ns1.example.com (1.2.3.5)
- ns2.example.com (5.6.7.9)
- ns3.example.com (10.20.30.40)
- **Analysis:** ⚠️ All name servers in same domain (potential SPOF)

---

## DNS Configuration

### A Records (IPv4)
- **example.com:**
  - 1.2.3.4
  - 5.6.7.8

### AAAA Records (IPv6)
- **example.com:**
  - 2001:db8::1
  - 2001:db8::2

### CNAME Records
- **www.example.com** → example.com

### MX Records (Mail Servers)
| Priority | Hostname | IP Address |
|----------|----------|------------|
| 10 | mail1.example.com | 1.2.3.10 |
| 20 | mail2.example.com | 5.6.7.20 |

### TXT Records
```
v=spf1 include:_spf.example.com include:_spf.google.com ~all
google-site-verification=abcd1234567890
_dmarc.example.com: v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com
```

---

## Email Security Assessment

### SPF (Sender Policy Framework)
- **Record:** `v=spf1 include:_spf.example.com include:_spf.google.com ~all`
- **Mechanism:** Softfail (~all)
- **Includes:** example.com mail servers + Google Workspace
- **Assessment:** ✅ Properly configured
- **Recommendation:** Consider hardfail (-all) for stricter enforcement

### DMARC (Domain-based Message Authentication)
- **Record:** `v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com`
- **Policy:** Quarantine
- **Aggregate Reports:** dmarc@example.com
- **Forensic Reports:** Not configured
- **Percentage:** 100% (default)
- **Assessment:** ✅ Good (quarantine policy)
- **Recommendation:** Monitor reports, consider p=reject when confident

### DKIM (DomainKeys Identified Mail)
- **Selectors Found:**
  - default._domainkey.example.com ✅
  - google._domainkey.example.com ✅
  - k1._domainkey.example.com ✅
- **Assessment:** ✅ Multiple selectors configured
- **Providers:** In-house + Google Workspace

### MTA-STS (Mail Transfer Agent Strict Transport Security)
- **Status:** ❌ Not configured
- **Recommendation:** Consider implementing MTA-STS for enhanced email security

---

## Subdomain Enumeration

### Discovery Summary
- **Certificate Transparency:** 47 subdomains
- **Common Name Enumeration:** 12 additional
- **Zone Transfer:** ❌ Failed (expected)
- **Total Unique:** 59 subdomains

### Full Subdomain List
```
1. example.com
2. www.example.com
3. api.example.com
4. api-v2.example.com
5. admin.example.com
6. dashboard.example.com
7. portal.example.com
8. app.example.com
9. mail.example.com
10. webmail.example.com
11. smtp.example.com
12. imap.example.com
13. mx1.example.com
14. mx2.example.com
15. ns1.example.com
16. ns2.example.com
17. ns3.example.com
18. blog.example.com
19. shop.example.com
20. store.example.com
21. cdn.example.com
22. static.example.com
23. media.example.com
24. images.example.com
25. assets.example.com
26. dev.example.com
27. staging.example.com
28. uat.example.com
29. qa.example.com
30. test.example.com
31. demo.example.com
32. beta.example.com
33. vpn.example.com
34. internal.example.com
35. intranet.example.com
36. docs.example.com
37. wiki.example.com
38. support.example.com
39. help.example.com
40. status.example.com
41. monitor.example.com
42. analytics.example.com
43. tracking.example.com
44. mobile.example.com
45. m.example.com
46. secure.example.com
47. login.example.com
48. auth.example.com
49. sso.example.com
50. oauth.example.com
51. git.example.com
52. gitlab.example.com
53. jenkins.example.com
54. ci.example.com
55. db.example.com
56. mysql.example.com
57. postgres.example.com
58. redis.example.com
59. backup.example.com
```

### Categorized Subdomains

**High-Interest (Potential Attack Vectors):**
- admin.example.com - Administrative interface
- dashboard.example.com - Admin dashboard
- portal.example.com - User portal
- api.example.com - API endpoint
- api-v2.example.com - API v2 endpoint
- internal.example.com - Internal systems
- intranet.example.com - Internal network
- vpn.example.com - VPN access
- sso.example.com - Single sign-on
- oauth.example.com - OAuth provider

**Non-Production Environments (Should be restricted):**
- dev.example.com - Development
- staging.example.com - Staging
- uat.example.com - User acceptance testing
- qa.example.com - Quality assurance
- test.example.com - Testing
- demo.example.com - Demonstration
- beta.example.com - Beta testing

**Infrastructure:**
- ns1.example.com - Name server 1
- ns2.example.com - Name server 2
- ns3.example.com - Name server 3
- mx1.example.com - Mail exchanger 1
- mx2.example.com - Mail exchanger 2
- mail.example.com - Mail server
- smtp.example.com - SMTP server

**Application Services:**
- app.example.com - Main application
- blog.example.com - Blog
- shop.example.com - E-commerce
- store.example.com - Store
- mobile.example.com - Mobile site
- m.example.com - Mobile site (alternate)

**Static Assets:**
- cdn.example.com - Content delivery
- static.example.com - Static files
- media.example.com - Media files
- images.example.com - Image hosting
- assets.example.com - Asset hosting

---

## IP Address Mapping

### Unique IP Addresses
**Total:** 8 unique IPv4 addresses

| IP Address | Subdomains | Organization | ASN | Location |
|------------|------------|--------------|-----|----------|
| 1.2.3.4 | www, example.com | Cloudflare | AS13335 | San Francisco, CA |
| 1.2.3.10 | mail1, smtp, imap | Example Hosting | AS12345 | New York, NY |
| 5.6.7.20 | mail2, mx2 | Example Hosting | AS12345 | New York, NY |
| 10.20.30.1 | api, api-v2 | AWS | AS16509 | Virginia, US |
| 10.20.30.2 | app, portal | AWS | AS16509 | Virginia, US |
| 10.20.30.5 | admin, dashboard | AWS | AS16509 | Virginia, US |
| 192.168.1.50 | db, mysql | Example Corp | AS54321 | Chicago, IL |
| 192.168.1.51 | redis, backup | Example Corp | AS54321 | Chicago, IL |

### Hosting Provider Breakdown
- **Cloudflare** (CDN/Proxy): 1 IP (www, main site)
- **AWS** (Cloud Hosting): 3 IPs (application tier)
- **Example Hosting** (Email): 2 IPs (mail infrastructure)
- **Example Corp** (On-premise): 2 IPs (databases, internal)

### IPv6 Addresses
- **2001:db8::1** - example.com (Cloudflare)
- **2001:db8::2** - example.com (Cloudflare backup)

---

## Live Web Applications (Active Scan)

### HTTP/HTTPS Services
**Total:** 23 live web applications discovered

| URL | Status | Server | Title | Technologies |
|-----|--------|--------|-------|--------------|
| https://example.com | 200 | nginx/1.20.1 | Example - Home | Laravel, Vue.js, Cloudflare |
| https://www.example.com | 200 | nginx/1.20.1 | Example - Home | Laravel, Vue.js, Cloudflare |
| https://api.example.com | 401 | nginx/1.18.0 | Unauthorized | Express.js, Node.js |
| https://api-v2.example.com | 401 | nginx/1.18.0 | API v2 | FastAPI, Python |
| https://admin.example.com | 302 | nginx/1.20.1 | Redirect to /login | Laravel, Vue.js |
| https://dashboard.example.com | 403 | nginx/1.20.1 | Forbidden | React, Node.js |
| https://portal.example.com | 200 | Apache/2.4.52 | User Portal | WordPress |
| https://blog.example.com | 200 | nginx/1.20.1 | Example Blog | WordPress, Cloudflare |
| https://shop.example.com | 200 | nginx/1.20.1 | Example Store | WooCommerce, WordPress |
| [... 14 more ...]

### Technology Stack Analysis

**Web Servers:**
- nginx 1.20.1 (60% of services)
- nginx 1.18.0 (25% of services)
- Apache 2.4.52 (15% of services)

**Backend Frameworks:**
- Laravel + PHP 8.1 (40%)
- Express.js + Node.js (20%)
- FastAPI + Python (15%)
- WordPress (25%)

**Frontend:**
- Vue.js (40%)
- React (30%)
- WordPress (25%)
- Static HTML (5%)

**CDN/Proxy:**
- Cloudflare (85% of public-facing services)
- Direct (15% - APIs and internal tools)

**Databases (inferred):**
- MySQL/MariaDB (WordPress sites, Laravel)
- PostgreSQL (FastAPI)
- MongoDB (Node.js APIs)
- Redis (detected on redis.example.com)

---

## Certificate Analysis

### Current Production Certificate
- **Common Name:** example.com
- **Subject Alternative Names (47 domains):**
  - example.com
  - *.example.com
  - www.example.com
  - [+44 more specific subdomains]
- **Issuer:** Let's Encrypt Authority X3
- **Valid From:** 2025-10-15 00:00:00 UTC
- **Valid To:** 2026-01-15 00:00:00 UTC (85 days remaining)
- **Serial Number:** 04:3f:8a:...[truncated]
- **Signature Algorithm:** SHA256-RSA
- **Key Size:** 2048 bit RSA

### Wildcard Certificate
- ✅ Wildcard (*.example.com) included
- Covers all first-level subdomains
- Does NOT cover nested subdomains (e.g., api.admin.example.com)

### Historical Certificates
**12 certificates found in CT logs:**

1. **Current** (2025-10-15 to 2026-01-15) - Let's Encrypt
2. **Previous** (2025-07-15 to 2025-10-15) - Let's Encrypt
3. **Migration** (2025-04-01 to 2025-07-01) - DigiCert
4. [... 9 older certificates]

**Observations:**
- Migration from DigiCert to Let's Encrypt (April 2025)
- 90-day renewal cycle (Let's Encrypt standard)
- Consistent SANs across renewals
- No revoked certificates found

---

## Attack Surface Summary

### Public-Facing Services
- **Web Applications:** 23 live HTTP/HTTPS services
- **Mail Services:** 2 mail servers (SMTP, IMAP)
- **DNS Services:** 3 name servers
- **API Endpoints:** 2 APIs (v1 and v2)

### Concerning Exposures
⚠️ **High Priority:**
1. **admin.example.com** - Administrative interface publicly accessible
2. **dashboard.example.com** - Dashboard accessible (403 but discoverable)
3. **internal.example.com** - Internal systems exposed
4. **db.example.com** - Database server discoverable
5. **gitlab.example.com** - Source code repository
6. **jenkins.example.com** - CI/CD pipeline

⚠️ **Medium Priority:**
1. **dev/staging/uat/qa.example.com** - Non-production environments
2. **vpn.example.com** - VPN endpoint (potential target)
3. **sso.example.com** - Authentication provider
4. **api.example.com** - API without apparent rate limiting

### Security Posture

**Positive Indicators:**
- ✅ Email security configured (SPF, DMARC, DKIM)
- ✅ HTTPS enforced on all web services
- ✅ Modern TLS certificates (Let's Encrypt)
- ✅ CDN usage (Cloudflare) for DDoS protection
- ✅ Regular certificate renewals

**Areas of Concern:**
- ⚠️ Administrative interfaces publicly discoverable
- ⚠️ Database servers exposed in DNS
- ⚠️ Non-production environments accessible
- ⚠️ All name servers in same domain (SPOF)
- ⚠️ No MTA-STS for email security
- ⚠️ DNSSEC not enabled

---

## Recommendations

### Immediate Actions
1. **Restrict Admin Interfaces:**
   - Move admin.example.com behind VPN
   - Implement IP whitelist for dashboard.example.com
   - Remove internal.example.com from public DNS

2. **Secure Non-Production:**
   - Require VPN for dev/staging/uat/qa environments
   - Consider separate domain for non-production

3. **Database Security:**
   - Remove db.example.com, mysql.example.com from public DNS
   - Ensure databases only accessible from application tier

4. **DNS Hardening:**
   - Implement DNSSEC
   - Distribute name servers across different networks
   - Consider third-party DNS (Cloudflare, Route53)

### Further Investigation (if authorized)
1. **Web Application Testing:**
   - Assess admin.example.com for vulnerabilities
   - Test APIs for authentication bypasses
   - Check for common web vulnerabilities (OWASP Top 10)

2. **Infrastructure Enumeration:**
   - Port scan all discovered IPs
   - Identify additional services
   - Map network architecture

3. **Social Engineering Vectors:**
   - Enumerate user accounts
   - Test password policies
   - Assess email security (phishing susceptibility)

### Ongoing Monitoring
1. **Certificate Transparency:**
   - Monitor CT logs for new subdomains
   - Alert on unexpected certificate issuance

2. **DNS Changes:**
   - Track DNS record modifications
   - Alert on new subdomain additions

3. **WHOIS Monitoring:**
   - Monitor expiration date
   - Track registrar changes

---

## Tools Used
- whois - Domain registration lookup
- dig - DNS enumeration
- crt.sh - Certificate transparency
- IPInfo API - IP geolocation and ASN
- httpx - HTTP/HTTPS probing (active)
- whatweb - Technology detection (active)

**Authorization:** Passive reconnaissance only (no authorization required)

**Analyst:** {DAIDENTITY.NAME} (recon skill)

**Report End**
```

## Integration Examples

### Called by OSINT

```typescript
// OSINT discovers company domains
const company = await osintInvestigate("Acme Corporation");

// Recon each domain
for (const domain of company.domains) {
  const domainReport = await domainRecon(domain, { mode: 'passive' });

  // Add to company infrastructure map
  company.infrastructure.domains.push(domainReport);
}
```

### Calling ip-recon for discovered IPs

```typescript
// After domain recon discovers IPs
const uniqueIPs = domainReport.uniqueIPs;

for (const ip of uniqueIPs) {
  const ipInfo = await ipRecon(ip, { passive: true });

  domainReport.infrastructure.push({
    ip: ip,
    info: ipInfo
  });
}
```

### Calling webassessment

```typescript
// After discovering live web applications
const liveApps = domainReport.liveWebApps;
const interestingApps = liveApps.filter(app =>
  app.url.includes('admin') ||
  app.url.includes('api') ||
  app.status === 403 // Forbidden - something to hide?
);

if (authorized) {
  for (const app of interestingApps) {
    await webAssessment(app.url);
  }
}
```

## Success Criteria

### Passive Recon Complete
- ✅ WHOIS data retrieved
- ✅ DNS records enumerated (A, AAAA, MX, NS, TXT, SOA)
- ✅ Email security assessed (SPF, DMARC, DKIM)
- ✅ Certificate transparency searched
- ✅ Subdomains enumerated (passive methods)
- ✅ IP addresses identified
- ✅ Hosting providers mapped
- ✅ Report generated

### Active Recon Complete (if authorized)
- ✅ Authorization documented
- ✅ Live web applications probed
- ✅ Technology stack detected
- ✅ Screenshots captured
- ✅ Comprehensive attack surface mapped
- ✅ No aggressive techniques used

---

**Key Principle:** Domain recon provides the foundation for all subsequent security testing. Be thorough in enumeration and careful about what you expose.
