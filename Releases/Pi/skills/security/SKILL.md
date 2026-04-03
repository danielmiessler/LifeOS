---
name: security
description: Security assessment including reconnaissance, web assessment (OWASP), vulnerability analysis, threat modeling, and security news analysis. USE WHEN recon, reconnaissance, port scan, subdomain, DNS, WHOIS, web assessment, OWASP, pentest, vulnerability analysis, threat modeling, security trends, security research.
metadata:
  author: pai
  version: 1.0.0
---

# Security Skill

## Capabilities

### Reconnaissance
- Subdomain enumeration
- DNS analysis
- WHOIS lookup
- Port scanning
- ASN mapping
- Technology fingerprinting

### Web Assessment (OWASP)
- Authentication testing
- Authorization testing
- Input validation
- Session management
- Error handling
- Cryptography review

### Threat Modeling
- STRIDE framework
- Attack surface mapping
- Risk assessment matrix
- Mitigation recommendations

## Tools

Use these CLI tools when available:
- `nmap` — Port scanning
- `ffuf` — Web fuzzing
- `dig` / `whois` — DNS/WHOIS
- `curl` — HTTP testing
- `jq` — JSON parsing

## Rules

- Only perform authorized testing
- Document all findings with evidence
- Rate severity: Critical > High > Medium > Low > Info
- Provide remediation for each finding
