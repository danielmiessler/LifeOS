# FFUF Resources Reference

## Recommended Wordlists (SecLists)

### Directory/File Discovery
- **Small (Quick scans)**: `Discovery/Web-Content/common.txt` (~4.6k entries)
- **Medium**: `Discovery/Web-Content/directory-list-2.3-medium.txt` (~220k entries)
- **Large**: `Discovery/Web-Content/directory-list-2.3-big.txt` (~1.2M entries)
- **Raft Collections**:
  - `Discovery/Web-Content/raft-large-directories.txt`
  - `Discovery/Web-Content/raft-large-files.txt`
  - `Discovery/Web-Content/raft-large-words.txt`

### API Testing
- `Discovery/Web-Content/api/api-endpoints.txt`
- `Discovery/Web-Content/common-api-endpoints-mazen160.txt`
- `Discovery/Web-Content/swagger-parameters.txt`

### Subdomain Discovery
- **Top lists**:
  - `Discovery/DNS/subdomains-top1million-5000.txt`
  - `Discovery/DNS/subdomains-top1million-20000.txt`
  - `Discovery/DNS/subdomains-top1million-110000.txt`
- **Combined**: `Discovery/DNS/namelist.txt`

### Parameter Names
- `Discovery/Web-Content/burp-parameter-names.txt`
- `Discovery/Web-Content/raft-large-words.txt`

### Backup/Config Files
- `Discovery/Web-Content/backup-files-only.txt`
- `Discovery/Web-Content/Common-DB-Backups.txt`

### Authentication Testing
- **Usernames**:
  - `Usernames/top-usernames-shortlist.txt`
  - `Usernames/xato-net-10-million-usernames.txt`
- **Passwords**:
  - `Passwords/Common-Credentials/10-million-password-list-top-1000.txt`
  - `Passwords/Common-Credentials/top-20-common-SSH-passwords.txt`

### Technology-Specific
- **PHP**: `Discovery/Web-Content/PHP.fuzz.txt`
- **ASP**: `Discovery/Web-Content/IIS.fuzz.txt`
- **Apache**: `Discovery/Web-Content/Apache.fuzz.txt`
- **Git**: `Discovery/Web-Content/git-head-potential-file-exposure.txt`

## File Extensions by Technology

### PHP
`.php .php3 .php4 .php5 .phtml .phps`

### ASP/ASP.NET
`.asp .aspx .ashx .asmx .axd`

### JSP/Java
`.jsp .jspx .jsw .jsv .jspf`

### CGI/Perl
`.cgi .pl`

### Python
`.py .pyc .pyo`

### Ruby
`.rb .rhtml`

### Node.js
`.js .json`

### Backup/Interesting
`.bak .backup .old .save .tmp .swp .git .env .config .conf .log .sql .db .sqlite`

## Common Response Sizes to Filter

These are typical "not found" or default response sizes (use with `-fs`):

- **404 pages**: Often consistent sizes like 1234, 4242, 9999
- **403 Forbidden**: Check with a known forbidden path first
- **Default pages**: IIS default is often ~1433 bytes
- **Empty responses**: 0 bytes

**Tip**: Always run a test request first to identify the baseline response size, then use `-ac` to auto-calibrate!

## Useful Number Ranges for IDOR Testing

```bash
# Generate sequential IDs
seq 1 1000 > ids.txt

# Generate with padding
seq -w 0001 9999 > padded_ids.txt

# Generate UUIDs (common pattern)
# Use custom scripts or existing UUID lists
```

## Rate Limiting Guidelines

| Environment | Recommended Rate | Threads | Notes |
|-------------|-----------------|---------|-------|
| Production (careful) | `-rate 2 -t 10` | 10 | Very stealthy |
| Production (normal) | `-rate 10 -t 20` | 20 | Balanced |
| Dev/Staging | `-rate 50 -t 40` | 40 | Fast |
| Local/Testing | No limit | 100+ | Maximum speed |

## Installing SecLists

```bash
# Clone the repository
git clone https://github.com/danielmiessler/SecLists.git /opt/SecLists

# Or install via package manager (Kali)
sudo apt install seclists

# Then reference in ffuf:
ffuf -w /opt/SecLists/Discovery/Web-Content/common.txt -u https://target.com/FUZZ -ac
```

## Quick Reference: Common ffuf Patterns

### Pattern 1: Initial Directory Discovery
```bash
ffuf -w /opt/SecLists/Discovery/Web-Content/raft-large-directories.txt \
     -u https://target.com/FUZZ \
     -ac -c -v \
     -o initial_scan.json
```

### Pattern 2: Authenticated API Fuzzing
```bash
# 1. Save authenticated request to req.txt
# 2. Run:
ffuf --request req.txt \
     -w /opt/SecLists/Discovery/Web-Content/api/api-endpoints.txt \
     -ac -mc 200,201,204 \
     -o api_results.json
```

### Pattern 3: Subdomain Discovery
```bash
ffuf -w /opt/SecLists/Discovery/DNS/subdomains-top1million-5000.txt \
     -u https://FUZZ.target.com \
     -ac -c -v
```

### Pattern 4: Parameter Discovery
```bash
ffuf -w /opt/SecLists/Discovery/Web-Content/burp-parameter-names.txt \
     -u "https://target.com/page?FUZZ=test" \
     -ac -fc 404
```

### Pattern 5: IDOR Testing (Authenticated)
```bash
# req.txt contains: GET /api/users/FUZZ/profile
ffuf --request req.txt \
     -w <(seq 1 10000) \
     -ac -mc 200 \
     -o idor_results.json
```
