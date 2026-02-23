# Understand Application Workflow

Produces a structured narrative of application functionality, user flows, and sensitive data for security assessments.

## Trigger Phrases

- "understand this application"
- "analyze this app"
- "what does this application do"
- "map the application"
- "application reconnaissance"
- "understand the attack surface"

## Purpose

Before testing an application, build understanding of:
1. What the application does (purpose, industry, user base)
2. Who uses it (user roles and access levels)
3. How they use it (critical user flows)
4. What sensitive data is processed
5. What the attack surface looks like

## Input Sources

Gather information from:

1. **Direct observation** - Browse the application, note functionality
2. **Recon data** - Use output from Recon skill (subdomains, endpoints, JS analysis)
3. **Documentation** - API docs, help pages, marketing materials
4. **Technology detection** - Headers, scripts, framework fingerprints

## Output Structure

Produce a markdown document with these sections:

```markdown
# Application Understanding: [Target]

## Executive Summary
- **Purpose:** [What the app does - e-commerce, SaaS, social, etc.]
- **Industry:** [Healthcare, Finance, Retail, Tech, etc.]
- **User Base:** [Enterprise/B2B, Consumer/B2C, Developers, Mixed]
- **Critical Functions:** [List key functionality]

## Technology Stack
- **Frontend:** [React, Vue, Angular, jQuery, etc.]
- **Backend:** [Node/Express, Django, Rails, PHP, ASP.NET, etc.]
- **Authentication:** [OAuth2, JWT, Session-based, SAML, API Key]
- **Third-Party Services:** [Stripe, AWS, Firebase, Auth0, etc.]

## User Roles

### [Role Name] ([access level: public/authenticated/privileged/admin])
[Description of this role]
**Capabilities:**
- [What this role can do]
- [What this role can access]

## User Flows

### [Flow Name]
[Description]
**Steps:**
1. [Step 1]
2. [Step 2]
...
**Sensitive Data:** [What sensitive data is involved]
**Auth Required:** [Yes/No]
**Endpoints:** [Key endpoints used]

## Sensitive Data Exposure

| Type | Location | Exposure | Risk |
|------|----------|----------|------|
| [Data type] | [Where found] | [visible/transmitted/stored] | [low/medium/high/critical] |

## Attack Surface

- **Entry Points:** [URLs, forms, APIs]
- **Auth Mechanisms:** [How users authenticate]
- **Data Inputs:** [Forms, file uploads, API params]
- **File Uploads:** [Yes/No - describe if yes]
- **WebSockets:** [Yes/No - describe if yes]
- **API Endpoints:** [List discovered APIs]

## Notes
- [Additional observations]
- [Unusual behaviors]
- [Potential security concerns noticed]
```

## Technology Detection Patterns

Look for these indicators:

**Frontend:**
- React: `react`, `createElement`, `__REACT`
- Vue.js: `vue`, `__VUE__`, `v-bind`
- Angular: `angular`, `ng-`, `[ngClass]`
- Next.js: `_next/`, `next/router`

**Backend:**
- Node/Express: `x-powered-by: express`
- Django: `csrfmiddlewaretoken`
- Rails: `csrf-token`, rails patterns
- PHP: `.php`, `PHPSESSID`
- ASP.NET: `.aspx`, `__VIEWSTATE`

**Authentication:**
- OAuth2: `oauth`, `authorization_code`, `access_token`
- JWT: `eyJ` prefix in tokens
- SAML: `SAMLRequest`
- Session: `session_id`, `connect.sid`

## Sensitive Data Patterns

Flag these as sensitive:
- **PII:** Email, phone, SSN, credit card
- **Auth:** Passwords, tokens, API keys, sessions
- **Financial:** Account numbers, payment info, billing

## Integration with Recon Skill

Use Recon outputs to enhance understanding:

```bash
# Get corporate structure for scope
bun ~/.claude/skills/Recon/Tools/CorporateStructure.ts target.com

# Enumerate subdomains
bun ~/.claude/skills/Recon/Tools/SubdomainEnum.ts target.com

# Extract endpoints from JavaScript
bun ~/.claude/skills/Recon/Tools/EndpointDiscovery.ts https://target.com
```

## Workflow Execution

1. **Gather recon data** - Run Recon skill tools if not already done
2. **Browse application** - Navigate key pages, note functionality
3. **Identify technology** - Check headers, scripts, framework patterns
4. **Map user roles** - Identify who uses this and at what access levels
5. **Trace user flows** - Document key processes (login, checkout, etc.)
6. **Identify sensitive data** - Note what data is collected/displayed
7. **Document attack surface** - Entry points, inputs, APIs
8. **Produce output** - Generate structured markdown document

## Output Location

Save understanding document to:
`~/.claude/skills/Webassessment/Data/{client}/understanding.md`

Or return inline for immediate use in threat modeling.
