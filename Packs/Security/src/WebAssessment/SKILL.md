---
name: WebAssessment
description: Full web app security assessment — app understanding, threat modeling, OWASP testing, ffuf fuzzing, Playwright automation, AI-assisted vuln analysis. Coordinates with Recon and PromptInjection skills. USE WHEN web assessment, pentest, security testing, vulnerability scan, threat model app, understand application, create threat model, vulnerability analysis, Gemini analysis, ffuf, fuzzing, bug bounty, OSINT, browser automation, Playwright.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/WebAssessment/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the WebAssessment skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **WebAssessment** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# WebAssessment Skill

Security assessment infrastructure integrating reconnaissance, threat modeling, and vulnerability testing.


## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "understand application", "what does this app do", "map the application" | UnderstandApplication |
| "threat model", "attack scenarios", "how would I attack" | CreateThreatModel |
| "pentest", "security assessment", "test for vulnerabilities" | Pentest/MasterMethodology |
| "fuzz with ffuf", "directory fuzzing", "content discovery" | ffuf/FfufGuide |
| "OSINT", "reconnaissance", "open source intelligence" | osint/MasterGuide |
| "test web app", "Playwright", "browser automation" | webapp/TestingGuide |
| "bug bounty", "bounty programs" | bug-bounty/Programs |
| "vulnerability analysis with AI", "Gemini analysis" | VulnerabilityAnalysisGemini3 |

## Skill Integration

WebAssessment coordinates with specialized skills:

| Phase | Skill | Purpose |
|-------|-------|---------|
| Scope Definition | **Recon** | Corporate structure, domain enumeration |
| Target Discovery | **Recon** | Subdomains, endpoints, ports |
| Understanding | **WebAssessment** | App narrative, user flows, sensitive data |
| Threat Modeling | **WebAssessment** | Attack scenarios, test prioritization |
| Injection Testing | **PromptInjection** | LLM-specific attacks |
| Intelligence | **OSINT** | People, companies, social media |

## Assessment Workflow

```
1. Corporate Structure (Recon) → Define scope and targets
2. Subdomain Enumeration (Recon) → Find all domains
3. Endpoint Discovery (Recon) → Extract JS endpoints
4. Understand Application → Build app narrative
5. Create Threat Model → Prioritize attack scenarios
6. Execute Testing → Test against identified threats
7. Report Findings → Document with PoCs
```

## Recon Skill Tools

WebAssessment uses tools from the Recon skill:

```bash
# Corporate structure for scope
bun ~/.claude/skills/Security/Recon/Tools/CorporateStructure.ts target.com

# Subdomain enumeration
bun ~/.claude/skills/Security/Recon/Tools/SubdomainEnum.ts target.com

# Endpoint discovery from JavaScript
bun ~/.claude/skills/Security/Recon/Tools/EndpointDiscovery.ts https://target.com

# Port scanning
bun ~/.claude/skills/Security/Recon/Tools/PortScan.ts target.com

# Path discovery
bun ~/.claude/skills/Security/Recon/Tools/PathDiscovery.ts https://target.com
```

## UnderstandApplication Output

Produces structured narrative including:
- **Summary**: Purpose, industry, user base, critical functions
- **User Roles**: Access levels and capabilities
- **User Flows**: Step-by-step processes with sensitive data
- **Technology Stack**: Frontend, backend, auth, third-party
- **Attack Surface**: Entry points, inputs, file uploads, websockets

## CreateThreatModel Output

Generates prioritized attack plan:
- **Threats**: OWASP/CWE mapped with risk scores
- **Attack Paths**: Multi-step attack scenarios
- **Test Plan**: Prioritized with tool suggestions
- **Effort Estimates**: Quick/medium/extensive per threat

## Threat Categories

| Category | Triggers On |
|----------|-------------|
| Authentication | Auth mechanisms detected |
| Access Control | Multiple user roles |
| Injection | All web apps |
| Data Exposure | Sensitive data identified |
| File Upload | Upload functionality |
| API Security | API endpoints |
| WebSocket | WebSocket detected |
| Business Logic | All web apps |
| Payment Security | Payment flows |

## 6-Phase Pentest Methodology

**Phase 0**: Scoping & Preparation
**Phase 1**: Reconnaissance (Recon skill)
**Phase 2**: Mapping (content discovery)
**Phase 3**: Vulnerability Analysis
**Phase 4**: Exploitation
**Phase 5**: Reporting

## Key Principles

1. **Authorization first** - Never test without explicit permission
2. **Understand before testing** - Build app narrative first
3. **Threat model guides testing** - Don't test blindly
4. **Breadth then depth** - Wide recon, focused exploitation
5. **Document everything** - Notes, screenshots, commands

## Workflow Index

**Core Assessment:**
- `Workflows/UnderstandApplication.md` - Application reconnaissance
- `Workflows/CreateThreatModel.md` - Attack scenario generation

**Penetration Testing:**
- `Workflows/pentest/MasterMethodology.md` - 6-phase methodology
- `Workflows/pentest/ToolInventory.md` - Security tools reference
- `Workflows/pentest/Reconnaissance.md` - Asset discovery
- `Workflows/pentest/Exploitation.md` - Vulnerability testing

**Web Fuzzing:**
- `Workflows/ffuf/FfufGuide.md` - FFUF fuzzing guide
- `Workflows/ffuf/FfufHelper.md` - Automated fuzzing helper

**Bug Bounty:**
- `Workflows/bug-bounty/Programs.md` - Program tracking
- `Workflows/bug-bounty/AutomationTool.md` - Bounty automation

**Web App Testing:**
- `Workflows/webapp/TestingGuide.md` - Playwright testing
- `Workflows/webapp/Examples.md` - Testing patterns

**OSINT:**
- `Workflows/osint/MasterGuide.md` - OSINT methodology
- `Workflows/osint/Reconnaissance.md` - Domain recon
- `Workflows/osint/SocialMediaIntel.md` - SOCMINT
- `Workflows/osint/Automation.md` - SpiderFoot/Maltego
- `Workflows/osint/MetadataAnalysis.md` - ExifTool analysis

**AI-Powered:**
- `Workflows/VulnerabilityAnalysisGemini3.md` - Gemini deep analysis

## Examples

**Example 1: Full assessment workflow**
```
User: "Security assessment on app.example.com"
→ Run UnderstandApplication to build narrative
→ Run CreateThreatModel to prioritize testing
→ Follow MasterMethodology with threat model guidance
→ Report findings with OWASP/CWE references
```

**Example 2: Quick threat model**
```
User: "How would I attack this app?"
→ Run CreateThreatModel on target
→ Get prioritized attack paths
→ Get test plan with tool suggestions
```

**Example 3: Integrate with Recon**
```
User: "Assessment on target.com including all subdomains"
→ CorporateStructure (Recon) → Find parent/child companies
→ SubdomainEnum (Recon) → Find all subdomains
→ EndpointDiscovery (Recon) → Extract JS endpoints
→ UnderstandApplication → Build app narrative
→ CreateThreatModel → Generate attack plan
```
