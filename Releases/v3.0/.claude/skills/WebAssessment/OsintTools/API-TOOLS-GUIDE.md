# OSINT API Tools Guide

**Comprehensive guide to using paid OSINT services in PAI webassessment skill**

---

## Table of Contents

1. [Overview](#overview)
2. [Supported Services](#supported-services)
3. [Installation & Setup](#installation--setup)
4. [Service Details](#service-details)
5. [Usage Examples](#usage-examples)
6. [Rate Limits & Pricing](#rate-limits--pricing)
7. [Legal & Ethical Considerations](#legal--ethical-considerations)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers the integration of three premium OSINT (Open Source Intelligence) services into the webassessment skill:

- **Shodan** - IoT device search and network reconnaissance
- **Dehashed** - Credential breach monitoring and analysis
- **OSINT Industries** - Comprehensive OSINT data aggregation

These services provide professional-grade intelligence gathering capabilities for authorized security assessments, penetration testing, and research.

---

## Supported Services

### 1. Shodan

**What it provides:**
- Search engine for Internet-connected devices
- IoT and ICS/SCADA device discovery
- Exposed service identification (FTP, SSH, HTTP, etc.)
- Network attack surface mapping
- Port and banner information
- Geolocation of devices
- Historical data on services

**Best use cases:**
- External attack surface assessment
- IoT security research
- Identifying exposed services
- Network reconnaissance
- Vulnerability research

**Website:** https://www.shodan.io/

---

### 2. Dehashed

**What it provides:**
- Search engine for leaked credentials
- Access to billions of breach records
- Email compromise detection
- Password exposure analysis
- Username correlation across breaches
- Historical breach data

**Best use cases:**
- Credential breach monitoring
- Password security assessment
- User account compromise detection
- Domain-wide breach analysis
- Proactive security monitoring

**Website:** https://dehashed.com/

---

### 3. OSINT Industries

**What it provides:**
- Unified OSINT data aggregation platform
- Social media profile correlation
- Email address intelligence
- Username enumeration across platforms
- Domain and WHOIS data
- Phone number lookups
- Breach data integration

**Best use cases:**
- Comprehensive target profiling
- Social media investigation
- Identity correlation
- Multi-source data enrichment
- Reconnaissance for social engineering assessments

**Website:** https://www.osint.industries/

---

## Installation & Setup

### Step 1: Install Python Dependencies

```bash
# Install required packages
pip install shodan requests python-dotenv

# Or using pip3 on macOS
pip3 install shodan requests python-dotenv
```

### Step 2: Subscribe to Services

Choose which services you need and create accounts:

1. **Shodan**: https://account.shodan.io/register
2. **Dehashed**: https://dehashed.com/ (click "Sign Up")
3. **OSINT Industries**: https://www.osint.industries/ (create account)

### Step 3: Obtain API Keys

**Shodan:**
1. Log in to https://account.shodan.io/
2. Navigate to "Account" → "API Key"
3. Copy your API key

**Dehashed:**
1. Log in to https://dehashed.com/
2. Go to account settings/dashboard
3. Generate or view your API key
4. Note your account email (required for authentication)

**OSINT Industries:**
1. Log in to https://www.osint.industries/
2. Navigate to API settings or dashboard
3. Generate or copy your API key

### Step 4: Configure Environment Variables

Add your API keys to `${PAI_DIR}/.env`:

```bash
# Open .env file
nano ${PAI_DIR}/.env

# Add these lines (replace with your actual keys):
SHODAN_API_KEY=your_actual_shodan_api_key_here
DEHASHED_API_KEY=your_actual_dehashed_api_key_here
DEHASHED_EMAIL=your_dehashed_account_email@example.com
OSINT_INDUSTRIES_API_KEY=your_actual_osint_industries_key_here
```

**CRITICAL:** Ensure `${PAI_DIR}/.env` is in `.gitignore` and NEVER commit it to any repository.

### Step 5: Test Your Setup

```bash
cd ~/.claude/skills/Webassessment/osint-tools/
python3 osint-api-tools.py --test
```

Expected output:
```
Testing OSINT API connections...

Shodan: ✓ PASS
Dehashed: ✓ PASS
OSINT Industries: ✓ PASS
```

---

## Service Details

### Shodan API

**Authentication:**
- API key passed as parameter to Shodan class
- Automatically loaded from `SHODAN_API_KEY` environment variable

**API Endpoints Used:**
- `/shodan/host/search` - Search for devices
- `/shodan/host/{ip}` - Get host information
- `/api-info` - Get account information

**Data Returned:**
- IP addresses and ports
- Service banners
- Geolocation (country, city, coordinates)
- Organization/ISP information
- Hostnames
- Operating system detection
- Vulnerability tags (when available)

**Query Syntax Examples:**
```
apache                        # Search for Apache servers
port:22                       # Search for SSH servers
country:US                    # Devices in United States
apache country:US             # Apache servers in US
org:"Google"                  # Devices owned by Google
has_screenshot:true           # Devices with screenshots
vuln:CVE-2014-0160           # Devices vulnerable to Heartbleed
```

---

### Dehashed API

**Authentication:**
- HTTP Basic Auth using email + API key
- Email: `DEHASHED_EMAIL` environment variable
- API Key: `DEHASHED_API_KEY` environment variable

**API Endpoints Used:**
- `/search` - Search breach database

**Data Returned:**
- Email addresses
- Usernames
- Passwords (hashed and plaintext when available)
- Hashed passwords
- IP addresses
- Phone numbers
- Database names (breach sources)

**Query Syntax Examples:**
```
email:user@example.com           # Search by email
username:johndoe                 # Search by username
domain:example.com               # Search by domain
password:123456                  # Search by password (ethical use only)
ip_address:192.168.1.1          # Search by IP
name:"John Doe"                  # Search by name
```

**Field Modifiers:**
- `email:` - Email address
- `username:` - Username
- `password:` - Password
- `hashed_password:` - Password hash
- `domain:` - Email domain
- `name:` - Name field
- `vin:` - Vehicle identification number
- `address:` - Physical address
- `phone:` - Phone number

---

### OSINT Industries API

**Authentication:**
- Bearer token in Authorization header
- Token from `OSINT_INDUSTRIES_API_KEY` environment variable

**API Endpoints Used:**
- `/v1/search` - Unified search endpoint
- `/v1/health` - Health check endpoint

**Data Returned:**
- Social media profiles
- Email correlations
- Username correlations
- Domain registration data
- Breach data (aggregated)
- Phone number information
- Associated accounts

**Query Types:**
- `email` - Search by email address
- `username` - Search by username
- `domain` - Search by domain
- `phone` - Search by phone number
- `name` - Search by name
- `address` - Search by address

---

## Usage Examples

### Python Library Usage

#### Example 1: Shodan Device Search

```python
from osint_api_tools import ShodanClient

# Initialize client (loads API key from environment)
client = ShodanClient()

# Search for Apache servers in the US
result = client.search("apache country:US", max_results=10)

if result.success:
    print(f"Found {result.data['total']} total results")
    for match in result.data['matches']:
        print(f"{match['ip_str']}:{match['port']} - {match.get('org', 'Unknown')}")
else:
    print(f"Error: {result.error['message']}")
```

#### Example 2: Shodan Host Lookup

```python
from osint_api_tools import ShodanClient

client = ShodanClient()

# Get detailed information about specific IP
result = client.host("8.8.8.8")

if result.success:
    host = result.data
    print(f"IP: {host['ip_str']}")
    print(f"Organization: {host.get('org', 'N/A')}")
    print(f"Operating System: {host.get('os', 'N/A')}")
    print(f"Ports: {host.get('ports', [])}")
```

#### Example 3: Dehashed Email Search

```python
from osint_api_tools import DehashedClient

client = DehashedClient()

# Search for breaches containing specific email
result = client.search_email("user@example.com")

if result.success:
    print(f"Found {result.data['total']} breach records")
    for entry in result.data['entries']:
        print(f"Database: {entry.get('database_name', 'Unknown')}")
        print(f"  Email: {entry.get('email', 'N/A')}")
        print(f"  Username: {entry.get('username', 'N/A')}")
        print(f"  Password: {entry.get('password', '[REDACTED]')}")
        print()
```

#### Example 4: Dehashed Domain Search

```python
from osint_api_tools import DehashedClient

client = DehashedClient()

# Search for all breaches from a specific domain
result = client.search_domain("example.com")

if result.success:
    print(f"Found {result.data['total']} compromised accounts from example.com")
    unique_databases = set(entry.get('database_name') for entry in result.data['entries'])
    print(f"Affected databases: {', '.join(unique_databases)}")
```

#### Example 5: OSINT Industries Username Search

```python
from osint_api_tools import OSINTIndustriesClient

client = OSINTIndustriesClient()

# Search for username across multiple platforms
result = client.search_username("target_user")

if result.success:
    print("Found profiles:")
    print(json.dumps(result.data['results'], indent=2))
```

#### Example 6: OSINT Industries Email Intelligence

```python
from osint_api_tools import OSINTIndustriesClient

client = OSINTIndustriesClient()

# Gather intelligence on email address
result = client.search_email("user@example.com")

if result.success:
    print("Email intelligence:")
    print(json.dumps(result.data['results'], indent=2))
```

### Command-Line Usage

#### Test All Connections

```bash
python3 osint-api-tools.py --test
```

#### Shodan Queries

```bash
# Search Shodan
python3 osint-api-tools.py --shodan "apache country:US"

# Get host information
python3 osint-api-tools.py --shodan-host "8.8.8.8"

# Output as JSON
python3 osint-api-tools.py --shodan "nginx" --json
```

#### Dehashed Queries

```bash
# Generic search
python3 osint-api-tools.py --dehashed "email:user@example.com"

# Email-specific search
python3 osint-api-tools.py --dehashed-email "user@example.com"

# Username search
python3 osint-api-tools.py --dehashed-username "johndoe"

# JSON output
python3 osint-api-tools.py --dehashed-email "user@example.com" --json
```

#### OSINT Industries Queries

```bash
# Email search
python3 osint-api-tools.py --osint-email "user@example.com"

# Username search
python3 osint-api-tools.py --osint-username "target_user"

# JSON output for parsing
python3 osint-api-tools.py --osint-email "user@example.com" --json
```

### Integration with Security Workflows

#### Example: Pre-Engagement Reconnaissance

```python
#!/usr/bin/env python3
"""
Pre-engagement reconnaissance script
Combines multiple OSINT sources for comprehensive target intelligence
"""

from osint_api_tools import ShodanClient, DehashedClient, OSINTIndustriesClient
import json

def recon_domain(domain):
    """Perform multi-source reconnaissance on a domain."""

    print(f"[*] Starting reconnaissance on: {domain}\n")

    # Shodan - Find exposed services
    print("[*] Searching Shodan for exposed services...")
    try:
        shodan = ShodanClient()
        shodan_result = shodan.search(f"hostname:{domain}", max_results=50)
        if shodan_result.success:
            print(f"  [+] Found {shodan_result.data['total']} exposed devices")
    except Exception as e:
        print(f"  [-] Shodan error: {e}")

    # Dehashed - Check for credential breaches
    print("[*] Searching Dehashed for credential breaches...")
    try:
        dehashed = DehashedClient()
        dehashed_result = dehashed.search_domain(domain)
        if dehashed_result.success:
            print(f"  [+] Found {dehashed_result.data['total']} compromised credentials")
    except Exception as e:
        print(f"  [-] Dehashed error: {e}")

    # OSINT Industries - Profile correlation
    print("[*] Searching OSINT Industries for domain intelligence...")
    try:
        osint_ind = OSINTIndustriesClient()
        osint_result = osint_ind.search_domain(domain)
        if osint_result.success:
            print(f"  [+] OSINT Industries data retrieved")
    except Exception as e:
        print(f"  [-] OSINT Industries error: {e}")

    print("\n[*] Reconnaissance complete")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python3 recon_domain.py <domain>")
        sys.exit(1)

    recon_domain(sys.argv[1])
```

---

## Rate Limits & Pricing

### Shodan

**Free Tier:**
- 1 result per search
- 100 query credits per month
- No on-demand scanning
- Rate limit: 1 query/second

**Freelancer ($69/month):**
- 5,000 results per search
- Unlimited query credits
- No on-demand scanning
- Rate limit: Unlimited

**Small Business ($359/month):**
- 10,000 results per search
- Unlimited query credits
- On-demand scanning (5 scans/month)
- Rate limit: Unlimited
- Access to data streaming API

**Corporate ($899+/month):**
- Custom result limits
- Unlimited scanning
- Dedicated support
- Custom rate limits

**Recommendation:** Start with Freelancer tier ($69/month) for most security assessment needs.

---

### Dehashed

**Pricing:**
- $10-$50/month based on query volume
- Pay-as-you-go options available
- No free tier
- Custom enterprise pricing for high-volume users

**Rate Limits:**
- Standard tier: ~1-5 queries/second
- Enterprise tier: Custom rate limits
- Daily query caps vary by subscription

**Recommendation:** Start with $10-20/month tier for credential monitoring. Excellent value for the data provided.

---

### OSINT Industries

**Freemium Tier:**
- Limited queries per day (~10-50)
- Basic data access
- Reduced features
- Rate limit: 1 query/minute

**Paid Tiers:**
- Pricing not publicly disclosed (contact sales)
- Higher query limits
- Full feature access
- Faster rate limits
- API access

**Recommendation:** Start with free tier to evaluate. Upgrade to paid tier if you need consistent access.

---

## Legal & Ethical Considerations

### ⚠️ CRITICAL: Authorization Requirements

**YOU MUST:**
- Obtain explicit written authorization before testing any target
- Comply with all applicable laws and regulations
- Respect Terms of Service for each API provider
- Document all reconnaissance activities
- Use data only for authorized security assessments

**YOU MUST NOT:**
- Test systems without authorization (this is illegal)
- Use credentials found in breaches for unauthorized access
- Share or distribute breach data publicly
- Use services for harassment, stalking, or malicious purposes
- Violate privacy laws (GDPR, CCPA, etc.)

### Regulatory Compliance

**GDPR (General Data Protection Regulation):**
- Personal data from OSINT sources may be subject to GDPR
- Ensure you have legal basis for processing personal data
- Document data processing activities
- Implement appropriate security measures

**CCPA (California Consumer Privacy Act):**
- Similar requirements to GDPR for California residents
- Respect data deletion requests
- Provide transparency in data usage

**CFAA (Computer Fraud and Abuse Act):**
- Unauthorized access to computer systems is a federal crime in the US
- Using OSINT data to facilitate unauthorized access is illegal
- Always obtain proper authorization

### Ethical Use Guidelines

1. **Scope Limitation**: Only query targets within your authorized scope
2. **Data Minimization**: Collect only necessary data for your assessment
3. **Secure Storage**: Encrypt and secure all collected OSINT data
4. **Data Retention**: Delete data when assessment is complete
5. **Responsible Disclosure**: Report vulnerabilities through proper channels
6. **Privacy Respect**: Respect individual privacy even when data is "public"

### Terms of Service Compliance

**Shodan:**
- Do not use for illegal activities
- Do not redistribute API data publicly
- Respect rate limits
- Attribute Shodan when publishing research

**Dehashed:**
- Use only for authorized security research
- Do not use credentials for unauthorized access
- Do not publicly share breach data
- Comply with data retention policies

**OSINT Industries:**
- Review and comply with their Terms of Service
- Use data only for legitimate purposes
- Do not scrape or redistribute data
- Report any data accuracy issues

---

## Troubleshooting

### Common Issues

#### 1. API Key Not Found

**Error:**
```
APIKeyMissingError: Shodan API key not found. Set SHODAN_API_KEY in ${PAI_DIR}/.env
```

**Solution:**
1. Verify API key is in `${PAI_DIR}/.env`
2. Ensure no typos in environment variable name
3. Restart your shell or reload environment:
   ```bash
   source ~/.zshrc
   ```
4. Test with:
   ```bash
   echo $SHODAN_API_KEY
   ```

#### 2. Invalid API Key

**Error:**
```
APIKeyInvalidError: Invalid Shodan credentials
```

**Solution:**
1. Verify API key is correct (copy-paste from account dashboard)
2. Check for extra spaces or newlines in .env file
3. Ensure API key hasn't expired
4. Check account status (payment issues, suspended account, etc.)

#### 3. Rate Limit Exceeded

**Error:**
```
RateLimitError: Shodan rate limit exceeded
```

**Solution:**
1. Wait before making additional queries
2. Implement rate limiting in your scripts:
   ```python
   import time
   time.sleep(1)  # Wait 1 second between queries
   ```
3. Upgrade to higher tier for increased limits
4. Cache results to reduce redundant queries

#### 4. Module Import Errors

**Error:**
```
ImportError: No module named 'shodan'
```

**Solution:**
```bash
pip3 install shodan requests python-dotenv
```

#### 5. Connection Timeout

**Error:**
```
RequestError: Connection timeout
```

**Solution:**
1. Check internet connection
2. Verify API service status (check service website)
3. Increase timeout in code:
   ```python
   response = session.get(url, timeout=60)  # 60 seconds
   ```
4. Check firewall/proxy settings

#### 6. SSL/TLS Certificate Errors

**Error:**
```
SSLError: Certificate verification failed
```

**Solution:**
1. Update certificates:
   ```bash
   pip3 install --upgrade certifi
   ```
2. Check system date/time is correct
3. Verify not behind corporate proxy with SSL inspection

### Debug Mode

Enable debug output for troubleshooting:

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Your OSINT queries here
```

### Getting Help

1. **Check API Documentation:**
   - Shodan: https://developer.shodan.io/api
   - Dehashed: https://dehashed.com/docs
   - OSINT Industries: Contact support for API docs

2. **Contact API Support:**
   - Shodan: help@shodan.io
   - Dehashed: Support through website
   - OSINT Industries: Support through website

3. **Review Service Status:**
   - Check for service outages or maintenance
   - Monitor API status pages

---

## Additional Resources

### Shodan Resources
- **Shodan CLI**: `pip install shodan` includes CLI tool
- **Shodan Search Guide**: https://help.shodan.io/the-basics/search-query-fundamentals
- **Shodan Filters**: https://www.shodan.io/search/filters
- **Shodan Exploits**: https://exploits.shodan.io/

### Dehashed Resources
- **Dehashed Search Syntax**: Available in platform documentation
- **Breach Notification**: Set up alerts for your domains

### OSINT Industries Resources
- **API Documentation**: Available after account creation
- **Community Forum**: Check for user guides and tips

### General OSINT Resources
- **OSINT Framework**: https://osintframework.com/
- **Awesome OSINT**: https://github.com/jivoi/awesome-osint
- **IntelTechniques**: https://inteltechniques.com/

---

## Next Steps

1. **Subscribe to Services**: Choose which services fit your budget and needs
2. **Configure API Keys**: Add keys to `${PAI_DIR}/.env`
3. **Test Connections**: Run `python3 osint-api-tools.py --test`
4. **Run Example Queries**: Test with sample data
5. **Integrate with Workflows**: Build custom reconnaissance scripts
6. **Create Aliases**: Add CLI shortcuts to your shell profile
7. **Document Usage**: Keep logs of OSINT activities for compliance

### Recommended Starting Point

**Budget-Conscious Approach:**
1. Start with **OSINT Industries free tier** (no cost)
2. Add **Dehashed** at $10/month (excellent value)
3. Add **Shodan Freelancer** at $69/month when budget allows

**Total:** $10/month initially, $79/month for full capability

**Professional Setup:**
- **All three services** with paid tiers: ~$100-150/month
- Provides comprehensive OSINT coverage
- Suitable for regular penetration testing and security assessments

---

## Summary

This guide provides complete setup and usage instructions for integrating Shodan, Dehashed, and OSINT Industries into your webassessment workflow. These tools are essential for modern security assessments but must be used responsibly and legally.

**Key Takeaways:**
- ✅ All three services require API keys (configure in `${PAI_DIR}/.env`)
- ✅ Python wrapper provides unified interface
- ✅ CLI tool available for quick queries
- ✅ Always obtain authorization before testing
- ✅ Respect rate limits and Terms of Service
- ✅ Start small and scale as needed

**Happy (ethical) hunting! 🔍**
