---
name: privacy-security
description: Privacy and security analysis. PII detection and redaction, secret scanning (API keys, tokens, passwords), containment patterns, access control review, vulnerability assessment, and compliance checks. USE WHEN security, privacy, PII, secret, API key, token, password leak, vulnerability, audit, compliance, GDPR, CCPA, contain, isolate.
metadata:
  author: pai
  version: 1.0.0
---

# Privacy & Security — Analysis

## PII Detection

| Type | Pattern | Risk |
|------|---------|------|
| Email | user@domain.com | High |
| SSN/ID | 123-45-6789 | Critical |
| Phone | +1 (555) 123-4567 | High |
| Address | Street, city, ZIP | Medium |
| IP | 192.168.1.1 | Low |
| Credit Card | 4111-1111-1111-1111 | Critical |

**Action**: Flag, redact (show partial), or quarantine.

## Secret Scanning

Check for hardcoded:
- API keys (AIza, sk-, etc.)
- Auth tokens (Bearer, JWT in code)
- Passwords (plaintext in configs)
- Private keys (BEGIN PRIVATE KEY, BEGIN RSA PRIVATE KEY)
- Connection strings (contains password=, pwd=)

**Action**: Alert immediately. Recommend secrets manager.

## Containment Patterns

| Pattern | When | Approach |
|---------|------|----------|
| Sandbox | Untrusted code | Restricted execution environment |
| Redact | Sensitive in output | Mask or replace before display |
| Quarantine | Suspected breach | Disconnect from network, snapshot |
| Rotate | Compromised credential | Issue new, revoke old |
| Audit | Compliance check | Log all access, review periodically |

## Principles

- Least privilege: Minimal access needed
- Defense in depth: Multiple protection layers
- Fail secure: Default-deny on errors
- Audit everything: Log who accessed what and when
