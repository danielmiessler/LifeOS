# Acme Corp - Web Application Assessment

**Client:** Acme Corp
**Project:** Security assessment of customer portal
**Timeline:** 2026-01-20 through 2026-02-15
**Status:** Active - Testing phase

## Context

Acme wants us to assess their new customer portal before launch. Focus areas:
- Authentication and authorization
- Data exposure and sensitive information leakage
- Business logic flaws
- API security

## Current work

Testing authentication bypass vectors and session management

## Key findings

- Predictable session tokens (high severity)
- Missing rate limiting on login endpoint
- API returns sensitive PII without proper authorization checks

## Scope

**In scope:**
- Customer portal (portal.acme.com)
- API endpoints (/api/v1/*)
- Authentication mechanisms

**Out of scope:**
- Internal admin portal
- Third-party payment processor

## Files

- `findings.md` - Documented vulnerabilities
- `creds.md` - Test accounts (gitignored)
- `requests.http` - API request collection
- `screenshots/` - Evidence

## Contact

**Point of contact:** Jane Smith (jane@acme.com)
**Slack channel:** #acme-pentest
