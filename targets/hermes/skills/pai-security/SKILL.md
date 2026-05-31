---
name: pai-security
description: "Security assessment framework covering network recon, web application testing, API security review, and dependency auditing. USE WHEN you need to assess security posture — network recon, web app testing, API security review, dependency vulnerability scanning, or OWASP Top 10 analysis. NOT FOR production system penetration testing without authorization, social engineering, or physical security assessment."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, security, audit, assessment]
    related_skills: []
tags: [security, assessment, recon, pentest, prompt-injection, webapp]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-security skill"}' \
  > /dev/null 2>&1 &
```


# pai-security: Security Assessment Frameworks

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User wants network recon on a domain | DNS enumeration → port scan → service detection → report |
| User wants web app testing | URL discovery → parameter fuzzing → vulnerability check → report |
| User wants prompt injection testing | Vector selection → injection payloads → response analysis → report |
| User wants full security assessment | Recon → web test → injection test → aggregated report |
| User wants a specific CVE check | Look up CVE → check version/configuration → verify → report |

## Step-by-Step Procedures

### 1. Network Reconnaissance
```
1. Target: domain or IP range (user-provided, authorized)
2. DNS Enumeration:
   a. Resolve A, AAAA, MX, NS, TXT, CNAME records
   b. terminal(dig/nslookup) for DNS records
   c. Check for subdomains via common wordlist
3. Service Discovery:
   a. terminal(nmap -sV -sC target) — basic service scan
   b. Identify: web servers, databases, SSH, SMTP, etc.
   c. Version fingerprinting for each service
4. Open Port Analysis:
   a. List open ports with services
   b. Flag unusual or exposed services
   c. Check for known CVEs on detected versions
5. Report:
   - Open ports and services
   - Software versions
   - DNS configuration issues
   - Recommended hardening steps
```

### 2. Web Application Testing
```
1. Target: web application URL (authorized scope)
2. Information Gathering:
   a. web_extract(headers_only) → Server, X-Powered-By, cookies
   b. Check robots.txt, sitemap.xml, security.txt
   c. Identify tech stack (via headers, HTML comments, JS bundles)
3. Endpoint Discovery:
   a. Check common paths: /admin, /api, /.env, /wp-admin, etc.
   b. Read sitemap.xml for hidden routes
   c. Check JS bundles for API endpoints
4. Parameter Testing (read-only, no mutations):
   a. Check for reflected XSS in URL parameters
   b. Check for open redirects
   c. Check for IDOR in predictable IDs
5. Security Headers Audit:
   - Content-Security-Policy
   - X-Frame-Options
   - Strict-Transport-Security
   - X-Content-Type-Options
   - Referrer-Policy
   - Permissions-Policy
6. Report:
   - Findings with severity (Critical/High/Medium/Low/Info)
   - Evidence and reproduction steps
   - Remediation recommendations
```

### 3. Prompt Injection Testing
```
1. Target: AI system endpoint or integration (authorized testing)
2. Select injection vectors:
   a. Direct injection: "Ignore previous instructions and..."
   b. Role-play: "You are now DAN (Do Anything Now)..."
   c. Context overflow: Long preamble to confuse system prompt
   d. Delimiter confusion: Manipulating markdown/code blocks
   e. Multi-language: Switch languages mid-prompt
   f. Payload encoding: Base64, hex, leetspeak
   g. Token smuggling: Split keywords across special tokens
   h. Few-shot poisoning: Provide examples that shift behavior
3. For each vector:
   a. Craft injection payload
   b. Execute via LLM call or API
   c. Analyze response for:
      - Policy violations
      - System prompt leakage
      - Unauthorized actions
      - Refusal patterns
4. Scoring:
   - Each injection: Pass (blocked) / Fail (bypassed) / Partial
   - Overall: injection success rate
5. Report:
   - Vulnerability summary
   - Most effective vectors
   - Recommended mitigations (input sanitization, prompt hardening, output filtering)
```

### 4. Full Assessment Workflow
```
1. Run all three phases sequentially:
   a. Network Recon → baseline
   b. Web App Testing → vulnerabilities
   c. Prompt Injection → AI-specific risks
2. Aggregate findings:
   - Merge duplicate findings
   - Prioritize by severity
   - Identify cross-cutting risks
3. Generate executive summary:
   - Overall risk rating
   - Critical findings (require immediate action)
   - High findings (require planned action)
   - Medium findings (require scheduled action)
   - Low/Info findings (best practices)
4. Provide remediation roadmap
```

### 5. CVE Lookup & Verification
```
1. User provides CVE ID or software name + version
2. Search CVE database:
   a. web_extract(nvd.nist.gov) for CVE details
   b. Check CVSS score, exploitability, affected versions
3. If software + version provided:
   a. Check if version is in affected range
   b. Provide specific remediation guidance
   c. Reference patch version if available
4. Report: CVE details, affected status, remediation
```

## Gotchas

- NEVER run security tests without explicit written authorization
- nmap scans can trigger IDS/IPS alerts; use responsibly
- Prompt injection testing on production systems requires change management approval
- Some injection vectors may crash or degrade the target AI system
- CVE databases may be incomplete for very recent vulnerabilities
- Security header checks are passive (no exploitation)
- Web app testing is limited to read-only techniques unless otherwise specified
- False positives are common in automated scanning; verify manually
- Always document scope, methodology, and authorization before starting
- Prompt injection is an arms race; today's mitigations may fail tomorrow
- CVSS scores are guidelines, not absolute risk measurements

## Execution Log Pattern

```
[PAI-SECURITY] Phase: Network Recon | Target: example.com
[DNS] A: 93.184.216.34 | MX: mail.example.com | TXT: spf1, dkim
[SCAN] Ports: 80(HTTP) 443(HTTPS) 22(SSH) | Service: nginx 1.24, OpenSSH 9.3
[CVE] nginx 1.24: no critical CVEs | OpenSSH 9.3: CVE-2023-38408 (Medium)
[WEB] Headers: Missing CSP, X-Frame-Options ✓, HSTS ✓
[INJECT] Tested 8 vectors: 6 blocked, 2 partial bypasses
[RISK] Overall: Medium | Critical: 0 | High: 1 | Medium: 3 | Low: 5
[COMPLETE] Assessment completed in 24.3s
```
