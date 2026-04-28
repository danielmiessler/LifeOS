# Customer Onboarding Playbook

**Version:** 1.0 | **Audience:** MSP Technical Staff  
**Purpose:** Step-by-step process for taking a new customer from signed contract to go-live.

---

## Overview

Every deployment follows three phases: **Discovery** (understand the customer), **Deployment** (install and configure the system), and **Validation** (confirm it works and hand off to the customer). Total elapsed time is typically 2–4 weeks, with most of the wait being Apple hardware shipping.

The guiding principle: **the customer should never have to touch a command line.** Everything the customer does—from powering on the Mac to querying their documents—is done through graphical interfaces. Everything else is the MSP's job.

---

## Phase 1: Discovery and Scoping (Week 1)

### 1.1 Initial Discovery Call (60–90 minutes)

Schedule a discovery call with the primary decision maker and, if available, their IT contact or office manager. Cover:

**Organizational profile:**
- Number of staff who will use the AI (active users, not total headcount)
- Peak concurrent usage: how many people likely using AI simultaneously at busiest time?
- Primary use cases (document Q&A, drafting, research, summarization, coding)
- Types of documents they handle (PDFs, Word docs, email threads, spreadsheets)

**Technical environment:**
- Existing network setup: ISP, router brand, wired vs. Wi-Fi primary?
- VLAN capability? (Managed switch, or flat network?)
- Active Directory / Azure AD in use? (Relevant for SSO on Tier L/XL)
- Existing Apple hardware? (Any Macs already enrolled in ABM or MDM?)
- Physical location of "server room" or dedicated device location

**Compliance requirements:**
- HIPAA covered entity? Business associates? (Execute BAA before deployment)
- CMMC Level 1 or Level 2? (Review existing SSP if available)
- State privacy law considerations? (Multi-state operations?)
- Prior security audit or risk analysis completed?

**Business context:**
- What triggered this purchase? (Compliance deadline, competitor using AI, productivity pain?)
- Who else evaluated? (Helps set expectations on timeline and process)
- Internal champion vs. skeptics? (Know who needs to be satisfied)

### 1.2 Scoping Output

Following discovery, produce a **Scoping Summary Document** (1–2 pages) that defines:

- Recommended tier (S / M / L / XL) with rationale
- Hardware BOM with part numbers and pricing
- Software configuration decisions (which models, workspace structure, SSO or not)
- Network changes required (VLAN setup, firewall rules)
- Compliance documents to be delivered (SSP template, BAA, risk analysis)
- Timeline estimate
- Any open questions or prerequisites

Send to customer for sign-off before ordering hardware.

### 1.3 Pre-Deployment Prerequisites Checklist

Before ordering hardware, confirm:

- [ ] MSP Agreement signed
- [ ] Service tier selected (Bronze / Silver / Gold)
- [ ] BAA signed (healthcare customers only)
- [ ] Scoping Summary approved by customer
- [ ] Network diagram or description received from customer
- [ ] Physical location for Mac identified (power + wired Ethernet confirmed)
- [ ] IT contact identified (who to coordinate with for VLAN setup)
- [ ] Customer organization added to Apple Business Manager (MSP's ABM org)
- [ ] Hardware ordered (direct from Apple with DEP enrollment, or through MSP stock)

---

## Phase 2: Deployment (Weeks 2–3)

### 2.1 Pre-Ship MDM Configuration

Before hardware arrives at the customer site, complete MDM setup:

- [ ] Create customer organization in Mosyle (or Jamf) — name, admin contact, billing
- [ ] Create device enrollment group for this customer
- [ ] Build base configuration profile:
  - FileVault 2 enabled, recovery key escrowed to MDM
  - Password policy: 12-char minimum, complexity required, 90-day rotation
  - Screen lock: 5-minute idle
  - Firewall: enabled, stealth mode on
  - Gatekeeper: App Store + identified developers
  - Remote login: disabled (MSP uses MDM remote access, not SSH)
  - Software updates: deferred 30 days, then MDM-push
- [ ] Configure MDM automated enrollment: this links the device serial number to the customer org so it auto-enrolls on first boot
- [ ] Pre-stage software deployment scripts:
  - LM Studio (download and install)
  - AnythingLLM (download and install)
  - Open WebUI (Docker or native install)
  - Monitoring agent (if applicable)

### 2.2 Day 1: Customer Unboxes the Hardware

**Customer's entire job:** Unbox the Mac, plug in power and Ethernet, turn it on.

What happens automatically:
1. Mac boots and connects to internet via Ethernet
2. Activation lock check passes (device is in ABM)
3. MDM enrollment prompt appears — customer clicks "Enroll" (or auto-enrolls in newer macOS)
4. Configuration profile installs silently: FileVault, password policy, firewall
5. Managed software begins installing in background (LM Studio, AnythingLLM)
6. Mac notifies MSP via MDM that device is enrolled — MSP receives alert

**Customer action:** Call or message MSP: "The Mac is on and connected."

**MSP response:** Confirm enrollment visible in MDM console. Verify FileVault enabled. Begin remote configuration.

### 2.3 Remote Configuration Session (2–6 hours depending on tier)

MSP connects via MDM remote management console (Mosyle screen sharing or Jamf Remote):

**LM Studio setup:**
- [ ] Open LM Studio, accept terms
- [ ] Download selected AI model (e.g., Qwen2.5-14B for Tier S, Qwen2.5-32B for Tier M)
  - Model download: 8–40GB depending on model — allow 30–120 minutes on customer's connection
- [ ] Configure LM Studio to start server on boot
- [ ] Verify LM Studio API responding: `curl http://localhost:1234/v1/models` returns model list
- [ ] Set server to listen on `0.0.0.0:1234` with API key authentication (for LAN access)

**AnythingLLM setup:**
- [ ] Install and launch AnythingLLM
- [ ] Configure LLM provider: point to LM Studio at `http://localhost:1234`
- [ ] Configure embedding model (nomic-embed-text or mxbai-embed-large via LM Studio)
- [ ] Create initial workspaces matching customer's practice structure:
  - Law firm example: "General Research," "Contract Review," "Client Files"
  - Medical example: "Clinical Notes," "Prior Auth," "Patient Education"
  - CMMC example: "Contract Documents," "CUI Workspace," "Proposals"
- [ ] Test document ingestion: upload a sample PDF, run a query, verify response
- [ ] Configure AnythingLLM to run as background service

**Open WebUI setup:**
- [ ] Install Open WebUI
- [ ] Connect to LM Studio API (`http://localhost:1234`)
- [ ] Set admin credentials (generate strong password, store in MSP password manager)
- [ ] Create user accounts for each staff member with individual credentials
- [ ] Configure system prompt if needed (e.g., "You are a legal research assistant. Always cite your sources. Never provide legal advice.")
- [ ] Enable conversation history retention
- [ ] Configure session timeout (30-minute idle)
- [ ] Test: log in as test user, send a message, verify response

**Network configuration (if VLAN requested):**
- [ ] Coordinate with customer's IT or ISP for VLAN setup
- [ ] Firewall rule: allow inbound 1234/tcp (LM Studio API) and 3000/tcp (Open WebUI) from office VLAN
- [ ] Block outbound from inference server except: 443 (Apple updates, Mosyle/Jamf MDM), 80/443 (model downloads, allowlisted)
- [ ] Verify remote access from a non-server machine on office network

**Nginx reverse proxy (Tier M and above):**
- [ ] Install nginx
- [ ] Configure upstream blocks for LM Studio and Open WebUI
- [ ] Generate TLS certificate (self-signed or customer's internal CA)
- [ ] Enable HTTPS on port 443
- [ ] Test: `https://ai.company.local` loads Open WebUI login page

**Verification before handoff:**
- [ ] LM Studio API responds and serves the correct model
- [ ] AnythingLLM ingests a document and returns accurate answers from it
- [ ] Open WebUI accessible from a workstation on the office network
- [ ] All user accounts created and test-login verified
- [ ] MDM shows device as "Compliant" (FileVault ✓, OS version ✓, required apps ✓)
- [ ] Monitoring alert triggered for test: confirm MSP receives alert

---

## Phase 3: Validation and Go-Live (Week 3–4)

### 3.1 Staff Training Session (1–2 hours, remote video)

Invite all staff who will use the AI. Cover:

**Module 1: Accessing the AI (15 minutes)**
- How to open Open WebUI in a browser
- Logging in with individual credentials
- Starting a conversation

**Module 2: Getting Good Results (20 minutes)**
- How to write clear prompts (role + task + context)
- Example prompts for their specific use cases
- How to ask follow-up questions
- What the AI is good at vs. not good at (set honest expectations)

**Module 3: Using Document Q&A via AnythingLLM (20 minutes)**
- How to upload a document to their workspace
- How to query documents: "Summarize the key obligations in this contract"
- How workspaces are organized (who can access what)
- Document retention: what stays, what to clean up

**Module 4: Data Handling and What NOT to Do (15 minutes)**
- This AI is private — your documents stay on your server
- Still: don't enter passwords, SSNs not part of the case, personal information you don't need the AI to know
- AI is a tool, not a decision maker — always review AI output before acting on it
- Specific guidance for their industry:
  - Law: no attorney-client privileged communications as context unless intentional
  - Medical: PHI is okay (stays local), but verify AI output against clinical judgment
  - CMMC: CUI documents go in the CUI workspace only

**Module 5: Getting Help (10 minutes)**
- How to report a problem (MSP support contact)
- What to do if the AI seems wrong or makes things up (hallucination)
- How to request a new document workspace or user account

### 3.2 Compliance Documentation Handoff

Deliver the following documents to the appropriate stakeholder:

**For all customers:**
- MDM compliance report (current device status)
- "Quick Reference Guide" (1-page PDF: how to log in, support contact, 3 best-practice tips)

**For HIPAA customers:**
- Signed BAA
- Pre-populated Risk Analysis template (customer completes the PHI/risk sections)
- Workforce Training log template

**For CMMC Level 2 customers:**
- Pre-populated System Security Plan (SSP) sections covering the AI system's scope
- POA&M (Plan of Action and Milestones) template if any controls are not yet fully implemented
- CMMC self-assessment checklist relevant to the AI system components

### 3.3 Go-Live and 30-Day Check-In

- [ ] Send "You're Live" email to customer with:
  - Login URL for Open WebUI
  - Support contact (email + phone for Silver/Gold)
  - Quick Reference PDF attached
  - "30-day check-in call" scheduled
- [ ] Mark customer active in MSP management console
- [ ] Set up monitoring alerts in Mosyle/Jamf
- [ ] Schedule QBR (quarterly for Silver/Gold, annual for Bronze)

**30-day check-in agenda (30 minutes):**
1. Usage check: are staff actually using it? Any friction?
2. Model quality: are responses meeting expectations?
3. Workspace review: any new document sets to add?
4. Technical issues: anything not working as expected?
5. Compliance: any questions on documentation?
6. Roadmap: upcoming model updates, any feature requests?

---

## Master Deployment Checklist

```
PRE-DEPLOYMENT
[ ] MSP Agreement signed
[ ] Service tier selected
[ ] BAA signed (healthcare)
[ ] Scoping Summary approved
[ ] Network requirements confirmed
[ ] Physical device location confirmed
[ ] Customer org created in ABM
[ ] Hardware ordered (DEP enrolled)

MDM SETUP (before hardware ships)
[ ] Customer org created in Mosyle/Jamf
[ ] Configuration profile built and tested
[ ] Automated enrollment configured
[ ] Software deployment scripts staged

DAY 1 — HARDWARE ARRIVES
[ ] Customer unboxes and connects
[ ] MDM enrollment confirmed
[ ] FileVault enabled and key escrowed
[ ] MSP receives enrollment alert

REMOTE CONFIGURATION
[ ] LM Studio installed and model downloaded
[ ] LM Studio API verified responding
[ ] AnythingLLM installed and configured
[ ] Workspaces created per customer structure
[ ] Document ingestion tested
[ ] Open WebUI installed and connected to LM Studio
[ ] User accounts created (one per staff member)
[ ] System prompt configured
[ ] Nginx/TLS configured (Tier M+)
[ ] LAN access verified from workstation
[ ] MDM shows device compliant

TRAINING
[ ] Staff training session completed
[ ] All staff tested login and first query
[ ] Data handling guidelines reviewed

HANDOFF
[ ] Go-live email sent
[ ] Quick Reference PDF delivered
[ ] Compliance docs delivered (HIPAA/CMMC)
[ ] 30-day check-in scheduled
[ ] Monitoring alerts active
[ ] Customer marked live in MSP console
```

---

## Escalation Contacts

| Issue | First Contact | Escalate To |
|-------|--------------|-------------|
| MDM enrollment failure | Mosyle/Jamf support | MSP senior engineer |
| Model not loading | Check LM Studio logs | MSP senior engineer |
| Network/VLAN | Customer IT contact | MSP + customer ISP |
| Compliance question | MSP + customer's attorney or compliance officer | Specialist referral |
| Hardware failure | Apple support (AppleCare) | MSP coordinates |
