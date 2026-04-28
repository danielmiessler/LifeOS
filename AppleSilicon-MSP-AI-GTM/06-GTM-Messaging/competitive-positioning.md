# Competitive Positioning

**Version:** 1.0 | **Audience:** Sales, Founder, Investors  
**Purpose:** How we compare to alternatives, how to win competitive conversations, and how to handle comparison scenarios.

---

## The Competitive Landscape

The AI tools market for professional services breaks into four categories:

| Category | Examples | Their Model | Their Problem |
|----------|----------|-------------|---------------|
| **Cloud AI SaaS** | ChatGPT Enterprise, Copilot, Gemini for Workspace | All inference in vendor's cloud | Data sovereignty, compliance exposure |
| **Cloud Gov AI** | Azure OpenAI GovCloud, AWS Bedrock GovCloud | FedRAMP authorized cloud | Expensive, complex, internet-dependent, overkill for SMB |
| **Self-Managed Local AI** | DIY Ollama, LM Studio, llama.cpp | Open source, customer-managed | No support, no compliance docs, no SLA |
| **Our MSP Model** | Apple Silicon + MLX + MDM managed | On-prem hardware, MSP-managed | — |

We win because we are the **only option** in the Venn diagram overlap of: (1) data stays on-premises, (2) fully managed service, (3) compliance documentation included, (4) accessible to non-technical staff.

---

## Head-to-Head Comparisons

### vs. Microsoft 365 Copilot

**Microsoft's position:** AI integrated natively into Word, Excel, Outlook, and Teams. Familiar interface. Enterprise-grade service. Microsoft handles compliance.

**The reality for regulated SMBs:**
- Even with Microsoft's "enterprise data protection," queries are processed in Microsoft's Azure infrastructure
- Microsoft's data residency commitments still mean data transits their global network
- Copilot is not FedRAMP Moderate authorized as an inference layer — it does not meet the CMMC cloud service requirement for CUI processing
- BAA for HIPAA covers some scenarios but Microsoft's AI terms of service have carve-outs that compliance officers increasingly question
- Works only when connected to the internet — offline scenarios (field sites, travel, network issues) fail completely

**Our advantage:**
- Definitive data sovereignty: air-gap possible, zero third-party data access
- Works offline — no internet required for inference
- Simpler compliance posture: local = no cloud authorization required
- Competitive on cost at 5+ users: our Silver tier at $599/node + $99/user beats Copilot's $30/user once you account for compliance documentation value

**When Microsoft wins:** Organizations already deeply embedded in Office workflows, where the Copilot-in-Word integration is the primary use case, and compliance is not CMMC or strict HIPAA.

---

### vs. ChatGPT Enterprise (OpenAI)

**OpenAI's position:** Enterprise tier with no training on customer data, SOC 2 Type II certified, admin controls.

**The reality:**
- "No training" is not the same as "no transmission" — data still goes to OpenAI's servers for inference
- SOC 2 ≠ HIPAA BAA ≠ CMMC compliance. These are different standards. OpenAI's SOC 2 doesn't make them a compliant HIPAA business associate by default
- OpenAI has faced well-publicized legal and regulatory scrutiny — regulated buyers increasingly want zero exposure
- $30+/user/month with no hardware asset: pure recurring cost with no residual value

**Our advantage:**
- No OpenAI access to your data, ever
- Hardware is a capital asset — has residual value after contract
- Cheaper at scale with similar model quality (Llama-3.3-70B benchmarks equal to GPT-4 Turbo on most tasks)
- Works without internet connectivity

**When OpenAI wins:** Organizations where model breadth (DALL-E, o1 reasoning, vision) is critical and data sensitivity is moderate.

---

### vs. Google Vertex AI / Gemini for Workspace

**Google's position:** Deep integration with Google Workspace (Docs, Sheets, Gmail), Gemini model family, enterprise controls.

**The reality:**
- Same cloud processing problem — all inference on Google's infrastructure
- Google Workspace data is already in Google's cloud — adding AI doesn't worsen this but doesn't improve it
- Regulated SMBs that have avoided cloud document storage specifically for compliance reasons cannot now adopt cloud AI without a policy change
- Vertex AI is primarily an enterprise developer platform — not accessible to non-technical staff without significant integration work

**Our advantage:**
- On-premises deployment compatible with organizations that keep documents on-prem
- No Google access to any business data
- No integration complexity — Open WebUI works day one

---

### vs. Self-Managed Local AI (DIY with open-source tools)

**The DIY position:** Technically capable users can run LLMs locally using open-source tools (llama.cpp, MLX, LM Studio) for the cost of hardware. No monthly fees.

**The reality for MSP customers:**
- "Free" software requires someone to manage it — model evaluation, updates, troubleshooting, security configuration, VLAN setup
- No compliance documentation — the SSP doesn't write itself, and an open-source local deployment has no vendor support for audit preparation
- No SLA — if the inference server goes down at 9am Monday, the team is stuck until someone technical can fix it
- No MDM — IT department or the owner has to maintain the device without enterprise device management
- Technical risk accumulates: misconfigured firewall, outdated models with known issues, no monitoring — these are liability exposures the MSP eliminates

**Our advantage:** The managed service IS the product. We're not selling software — we're selling the elimination of the operational and compliance burden. A DIY deployment can become our customer if they've discovered the operational cost of self-management.

**Competitive statement:** "You can absolutely run this yourself. Most of our customers started that way. They came to us when the model stopped loading after an update and their staff was down for half a day, or when their CMMC assessor asked for their SSP documentation for the AI system."

---

### vs. Azure Government / AWS GovCloud AI

**Cloud Gov position:** FedRAMP Moderate/High authorized cloud infrastructure. Purpose-built for government contractors. Microsoft and Amazon have significant investment in compliance certification.

**The reality for SMB defense contractors:**
- FedRAMP authorized ≠ CMMC compliant automatically — still requires customer-side controls
- Minimum setup complexity is significant: requires government cloud subscription, identity federation, compliance configuration, ongoing ATO process
- Cost: Azure Government AI starts at $50–$200+/user/month equivalent depending on usage; often requires enterprise agreement
- Still internet-dependent — no air-gap option
- Overkill for a 15-person machine shop with CMMC Level 2 obligations

**Our advantage:**
- Dramatically simpler to deploy (days vs. months)
- Dramatically lower cost for SMB scale
- Works in air-gapped or restricted-network environments
- On-premises means no cloud authorization requirement at all

**When cloud gov wins:** Very large organizations (500+ users), organizations already with an ATO process in place, or programs specifically requiring FedRAMP High (which our solution doesn't claim to meet).

---

## Positioning Matrix

| Criterion | Our MSP | Copilot | ChatGPT Ent. | DIY Local | Azure Gov |
|-----------|---------|---------|-------------|-----------|-----------|
| **Data stays on-premises** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Managed service (SLA + support)** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **CMMC documentation included** | ✅ | ❌ | ❌ | ❌ | ⚠️ partial |
| **HIPAA BAA available** | ✅ | ✅ | ⚠️ | ❌ | ✅ |
| **Works offline** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **SMB-accessible pricing** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Non-technical staff UX** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Hardware asset (residual value)** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Apple ecosystem compatible** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **CMMC-ready for SMB** | ✅ | ❌ | ❌ | ❌ | ⚠️ complex |

---

## Objection Handling Master List

### Cost Objections

**"It's too expensive."**
> "Let's work through the math together. What's your current cloud AI subscription per user? What does your compliance exposure cost to manage? In our experience, the managed service pays for itself in staff time savings within 60–90 days, and you end up owning a hardware asset worth $2,000–$5,000 at the end of year one."

**"We can just use free tools."**
> "Free software isn't free to operate. Someone has to maintain it, update it, document it for compliance, and fix it when it breaks. What's the hourly rate of the person doing that? If it's a technical staff member, you're spending $50–$150/hour on an activity we handle for a fixed monthly fee."

**"This costs more than Copilot."**
> "Copilot is $30/user/month with no compliance documentation and data going to Microsoft. For a 10-person team, that's $3,600/year with ongoing data sovereignty exposure. Our Silver tier for 10 users is $1,589/month — more expensive per month, but it includes compliance documentation, 24/7 monitoring, and zero data leaving your network. The question is: what's the cost of the exposure that Copilot creates?"

### Technical Objections

**"Our IT person can manage this."**
> "Absolutely, and IT teams are great partners in our deployments. The gap is specialization: evaluating AI model releases, mapping deployments to CMMC controls, maintaining AnythingLLM workspaces, tracking bar ethics guidance for law firms. These are things a generalist IT person shouldn't have to become an expert in. We're the specialist layer."

**"What happens when the AI is wrong?"**
> "The same thing that happens when any professional tool produces incorrect output — a human reviews it. We train your staff on this from day one: the AI is a drafting assistant, not a decision-maker. You review everything before it goes anywhere. The difference from cloud AI is that even when the AI is wrong, your data never left your building."

**"Will this integrate with our existing software?"**
> "Open WebUI has an OpenAI-compatible API, so anything that can talk to ChatGPT can talk to our system. We also support LDAP/Active Directory single sign-on for Silver and Gold tiers. Deep EMR or practice management integrations are a roadmap item — today, staff uses the browser interface alongside their existing tools."

### Compliance Objections

**"We already have a HIPAA compliance program."**
> "Great — our documentation is additive to what you have. We provide the Risk Analysis template for the AI system specifically, the technical safeguard documentation, and the BAA. Your existing compliance program covers everything else. We're filling a specific gap that most compliance programs don't address yet: how to handle AI tools."

**"How do we know your system is actually compliant?"**
> "We provide control-by-control documentation mapping our stack to HIPAA technical safeguards and CMMC Level 2 practices. We don't certify the system — the customer's auditor or assessor does that. But we give you everything the assessor needs to see, and we've structured the architecture to pass that review."

**"Our lawyers said we need FedRAMP for CMMC."**
> "For cloud services handling CUI, FedRAMP Moderate is required — that's accurate. Our system isn't a cloud service. It's on-premises hardware inside your facility, which means it's subject to the same physical and technical controls as your other on-premises servers. No cloud authorization is required. We can provide a documentation memo explaining this distinction for your attorneys if helpful."

### Timing Objections

**"We're not ready yet."**
> "CMMC Phase 2 enforcement starts November 2026. If you're planning to address AI compliance before then, now is the right time — deployment takes 2–4 weeks, and you want your staff trained and using the system before busy season or assessment windows. What would 'ready' look like for you?"

**"We want to wait and see how AI develops."**
> "The hardware commitment is modest and the models are already good enough for your specific use cases. The AI improves automatically as part of the managed service — when better models are available, we update yours. You're not locking in to today's model quality; you're locking in the infrastructure that runs whatever model is best."

---

## Three Scenarios: Cloud AI vs. Our Solution

### Scenario 1: Law Firm — Client Confidentiality

**Using cloud AI:**  
An associate uploads a confidential settlement agreement to ChatGPT to draft response language. Three months later, the client reads an article about law firms using AI and asks the managing partner: "Was our settlement agreement processed through any AI service?" The honest answer is: "Yes, through OpenAI's servers." The client terminates the engagement. The managing partner calls the state bar ethics hotline. The associate's promotion is delayed.

**Using our solution:**  
The same associate queries the same document through Open WebUI. The document never leaves the firm's network. The managing partner's answer to the client: "Our AI runs on servers in our office. Your documents never leave our building." The client is reassured. The firm is differentiated.

---

### Scenario 2: Medical Practice — HIPAA Audit

**Using cloud AI:**  
A physician uses a third-party voice AI app to transcribe patient notes. HHS OCR receives a complaint and initiates an audit. The auditor asks: "What systems process PHI?" The practice manager lists the EHR, billing system — and then realizes the AI transcription app wasn't in the Risk Analysis. It wasn't covered by a BAA. The fine is $50,000. The corrective action plan takes 18 months.

**Using our solution:**  
The physician uses the on-premises AI for note drafting. In the HHS audit, the system is fully documented: Risk Analysis updated, BAA with the MSP covering the remote management scope, technical safeguards mapped. The auditor reviews the documentation, finds everything in order, closes the audit with a commendation for proactive AI governance.

---

### Scenario 3: Defense Contractor — CMMC Assessment

**Using cloud AI:**  
A 20-person defense subcontractor uses Microsoft Copilot to help draft proposal responses. Some proposals reference specifications and technical requirements that qualify as CUI. During a C3PAO CMMC Level 2 assessment in October 2026, the assessor asks about systems that process CUI. The contractor lists their network — but the assessor asks specifically about AI tools. Copilot is identified. It doesn't have FedRAMP authorization for CUI. The assessment fails on AC.1.002 and SC.3.177. The prime contractor is notified. The contract renewal is at risk.

**Using our solution:**  
The same contractor uses the MSP's on-premises AI for proposal drafting. The C3PAO assessor asks about AI systems. The MSP's pre-populated SSP sections are provided: control mappings for AC, IA, SC, AU, and CM domains. The inference server is on its own VLAN, FileVault-encrypted, MDM-managed. The assessor reviews the documentation and marks the AI system as "implemented." The assessment passes.
