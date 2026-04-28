# HIPAA Safeguard Mapping
## Apple Silicon Local AI — Healthcare Compliance Reference

**Document type:** Internal Reference & Customer-Facing Compliance Supplement  
**Applies to:** Covered Entities (CEs) and Business Associates (BAs) in healthcare  
**Regulation:** HIPAA/HITECH — 45 CFR Parts 160 and 164  
**Last updated:** Q2 2026

---

> **Important for Medical Practices:** This document describes how this AI deployment satisfies HIPAA Security Rule safeguards. It does not constitute legal advice. Covered Entities should consult with HIPAA counsel to confirm applicability and complete their own risk analysis. The MSP provides technical controls and documentation support — the CE remains responsible for HIPAA compliance as the Covered Entity.

---

## Section 1: When HIPAA Applies to AI

### The Trigger: PHI Touches the System

HIPAA's Security Rule applies when a Covered Entity (CE) or Business Associate (BA) uses a system to **create, receive, maintain, or transmit** Protected Health Information (PHI). PHI includes any individually identifiable health information — patient names, dates of service, diagnoses, billing codes, insurance information, or any information that could identify a patient combined with health-related data.

An AI system that ingests any of the following is subject to HIPAA:
- Clinical notes or visit summaries
- Patient correspondence or intake forms
- Medical records or lab results
- Billing records containing patient identifiers
- Insurance authorization documents
- Any document where a patient could be identified in combination with health information

If the AI is used for general administrative tasks (scheduling, policies, non-patient correspondence) and is configured to exclude PHI from ingestion, HIPAA may not apply to the AI system. This boundary should be documented in the risk analysis.

### The Cloud AI Problem

When a medical practice uses a cloud AI service (ChatGPT, Claude API, Google Gemini, Microsoft Copilot in a non-BAA context) to process PHI, a chain of legal and technical obligations is triggered:

1. The cloud vendor becomes a **Business Associate** — they are receiving PHI on behalf of the CE
2. A **Business Associate Agreement (BAA)** is required from the vendor before any PHI is processed
3. Most cloud AI vendors **offer BAAs** but those BAAs typically **exclude liability** for how customers input data, limit breach notification obligations, and do not guarantee PHI is not used for model training
4. The CE is **trusting the vendor's infrastructure**, access controls, and incident response — which are largely opaque
5. If a breach occurs at the vendor, the CE bears the notification burden and potential OCR penalties

**On-premises AI eliminates the third-party BA relationship entirely for inference operations.** The PHI never leaves the customer's LAN. There is no vendor receiving PHI. The CE controls all aspects of security, audit, and incident response. The only BA relationship that may exist is with the MSP — and the MSP's scope (device management, not data access) is far narrower and more controllable than a cloud AI vendor's.

---

## Section 2: Administrative Safeguards (§164.308)

Administrative safeguards are the policies and procedures that govern how an organization manages the security of PHI. The MSP provides documentation support for all administrative safeguards.

### Risk Analysis (§164.308(a)(1)) — REQUIRED

**Requirement:** Conduct an accurate and thorough assessment of the potential risks and vulnerabilities to the confidentiality, integrity, and availability of ePHI.

**Implementation:** The MSP provides a **pre-populated risk analysis template** specific to the AI system components. The template identifies:
- Asset inventory (inference Mac hardware, software stack, network segment)
- Threat sources and threat events relevant to the system
- Current controls and their effectiveness
- Residual risk ratings for each threat/vulnerability combination
- Recommended additional controls for unacceptable residual risks

The customer's compliance officer reviews, updates, and signs the risk analysis annually or upon significant system change. The signed risk analysis is a primary OCR audit artifact.

### Risk Management (§164.308(a)(1)(ii)(B)) — REQUIRED

**Requirement:** Implement security measures to reduce risks and vulnerabilities to a reasonable and appropriate level.

**Implementation:** This deployment implements a layered security architecture (see `security-architecture.md`) addressing all identified risk categories. Security controls are enforced via MDM — not just documented, but technically enforced.

### Workforce Training (§164.308(a)(5)) — REQUIRED

**Requirement:** Implement policies and procedures for training workforce members regarding security of ePHI.

**Implementation:** The MSP provides a **"Using AI Safely"** training guide for all staff who will use the AI system. The guide covers:
- What types of information are appropriate to enter into the AI system
- What must NOT be entered (PHI from patients not relevant to the immediate task, social security numbers, financial account numbers)
- How AI-generated clinical content must be reviewed before use in patient records
- How to report a suspected security incident
- How to handle AI-generated responses that may contain PHI

Training completion is logged. Annual refresher training is recommended.

### Access Management (§164.308(a)(4)) — REQUIRED

**Requirement:** Implement policies and procedures for authorizing access to ePHI.

**Implementation:**
- Open WebUI user account provisioning and deprovisioning workflow is documented in the MSP onboarding playbook
- New employee onboarding: IT/admin creates named Open WebUI account, assigns appropriate workspace access
- Employee termination: Open WebUI account disabled same day as termination in directory (or immediately upon notification). If LDAP integration is configured, disabling the AD account disables AI access automatically.
- Access reviews: MSP recommends quarterly review of active accounts

### Contingency Plan (§164.308(a)(7)) — REQUIRED

**Requirement:** Establish policies and procedures for responding to an emergency that damages systems containing ePHI.

**Implementation:** MSP provides a **contingency plan template** covering:
- **Backup procedure:** AnythingLLM document library backup to encrypted external drive (daily automated backup via MDM-deployed script). Model files backed up to encrypted Thunderbolt SSD.
- **Disaster recovery:** Document re-ingestion playbook — step-by-step procedure to rebuild the AnythingLLM knowledge base from backup on a replacement inference Mac.
- **Emergency mode operation:** If the inference Mac is unavailable, staff fall back to non-AI workflows. The contingency plan documents these fallback procedures.
- **Testing:** MSP performs annual recovery test (restore from backup on test hardware). Test results documented.

### Evaluation (§164.308(a)(8)) — REQUIRED

**Requirement:** Perform periodic technical and non-technical evaluation of security controls.

**Implementation:** MSP provides quarterly MDM compliance reports documenting the status of all technical controls. Annual security review included in Gold tier SLA. Customer performs annual HIPAA security evaluation (administrative review) with MSP technical input.

---

## Section 3: Physical Safeguards (§164.310)

Physical safeguards protect the hardware on which ePHI resides from unauthorized physical access.

### Facility Access Controls (§164.310(a)) — REQUIRED

**Requirement:** Implement policies and procedures to limit physical access to systems that contain ePHI while ensuring that properly authorized access is allowed.

**Implementation:**
- Inference Mac placed in a locked location (server room, locked cabinet, or locked office)
- Physical access to the inference Mac restricted to IT staff and the MSP (during on-site service visits)
- Physical access log maintained (sign-in/sign-out, or electronic badge access system where available)
- MSP on-site visits documented in the MDM console (technician identity, date, work performed)

> **Important for Medical Practices:** HIPAA's Facility Access Controls require that you document who has physical access to systems storing ePHI and that access is limited. If the inference Mac is in an unlocked area, this control is not satisfied. The MSP's deployment includes a locked cable and recommends a locked server cabinet — document the chosen implementation in your risk analysis.

### Workstation Security (§164.310(b)) — REQUIRED

**Requirement:** Implement physical safeguards for all workstations that access ePHI.

**Implementation:**
- macOS screen lock enforced via MDM (5-minute idle timeout — satisfies "position workstations to minimize viewing by unauthorized individuals" through automatic locking)
- Physical screen privacy filters recommended for workstations in patient-visible areas (e.g., front desk)
- MDM password policy enforced on all enrolled workstations

### Device and Media Controls (§164.310(d)) — REQUIRED

**Requirement:** Implement policies and procedures that govern the receipt and removal of hardware and electronic media that contain ePHI.

**Implementation:**
- FileVault 2 encrypts all ePHI on the inference Mac's system volume — media disposal is safe once encryption is verified
- External storage (Thunderbolt SSD) uses APFS encryption — media disposal procedures require cryptographic erasure (APFS volume delete) or physical destruction
- MDM remote wipe capability enables rapid secure data erasure if a device must be decommissioned or is stolen
- USB storage device restriction (MDM) prevents unauthorized removal of ePHI on portable media
- MSP maintains a device/media disposal log as part of the service record

---

## Section 4: Technical Safeguards (§164.312)

Technical safeguards are the technology and policies governing access to and protection of ePHI.

### Access Control (§164.312(a)) — REQUIRED

**Requirement:** Implement technical policies and procedures that allow only authorized persons to access ePHI.

| Sub-requirement | Implementation |
|----------------|---------------|
| Unique user identification | Each staff member has a named Open WebUI account. No shared logins. User identity is logged with every interaction. |
| Emergency access procedure | MSP admin account provides emergency access if primary accounts are unavailable. Documented in contingency plan. |
| Automatic logoff | Open WebUI session timeout configurable. MDM enforces macOS screen lock (5-minute idle). Both layers enforce automatic logoff. |
| Encryption and decryption | FileVault 2 manages encryption/decryption transparently. Only authenticated users can decrypt. |

### Audit Controls (§164.312(b)) — REQUIRED

**Requirement:** Implement hardware, software, and procedural mechanisms that record and examine activity in systems that contain or use ePHI.

**Implementation:**
- **Open WebUI conversation logs:** Every query and response logged with user identity and timestamp. If PHI was included in a query, this log documents when, by whom, and what was asked. Admin dashboard provides log search and export.
- **macOS Unified Log:** System-level events (authentication, process execution, network connections) logged continuously.
- **MDM compliance reports:** Device health, configuration compliance, and management actions logged continuously.
- **AnythingLLM document access log:** Which documents were retrieved as context for which queries, attributed to which user.
- **Log retention:** Configured to 6 years (HIPAA requirement). Log storage capacity is included in hardware sizing at deployment.

> **Important for Medical Practices:** The 6-year HIPAA log retention requirement is often overlooked. Logs must be retained from the date of creation, not the date of the last patient interaction. The MSP configures log retention at deployment and monitors available disk space via MDM to ensure logs are not prematurely overwritten.

### Integrity (§164.312(c)) — REQUIRED

**Requirement:** Implement policies and procedures to protect ePHI from improper alteration or destruction.

**Implementation:**
- FileVault 2 full-disk encryption protects data integrity at rest — unauthorized physical access cannot alter data without the encryption key
- TLS 1.3 for all network communications prevents in-transit data modification
- APFS filesystem integrity protection (copy-on-write, checksumming) detects storage-level corruption
- Backup verification — MDM-automated backup script verifies backup integrity after each backup

### Person or Entity Authentication (§164.312(d)) — REQUIRED

**Requirement:** Implement procedures to verify that a person or entity seeking access is who they claim to be.

**Implementation:**
- Open WebUI: password authentication required for all users
- macOS: FileVault password required at boot; macOS login required for console access
- MDM: device certificate authentication establishes device identity
- LDAP/AD integration (Silver/Gold): organizational identity system handles authentication, including any MFA configured in AD

### Transmission Security (§164.312(e)) — REQUIRED

**Requirement:** Implement technical security measures to guard against unauthorized access to ePHI that is being transmitted over an electronic communications network.

**Implementation:**
- **All ePHI remains on-premises LAN** — this is the primary transmission security control. ePHI is not transmitted over the internet at any point during AI operations.
- LAN transmission: TLS 1.3 (nginx reverse proxy) encrypts all traffic between user browsers and Open WebUI
- Remote access: if staff need to access the AI system remotely (e.g., from home), WireGuard VPN with certificate authentication is required. Direct internet exposure of Open WebUI is not permitted.
- Localhost inter-service communication (AnythingLLM ↔ LM Studio): no network transmission — same machine, same process context

---

## Section 5: Business Associate Agreement Considerations

### The MSP is a Business Associate

If the MSP has access to systems that store, process, or transmit PHI in the course of service delivery, the MSP meets the definition of a Business Associate under HIPAA (45 CFR §160.103). This is true even if the MSP's intent is only to manage devices and infrastructure — if PHI could be accessed incidentally, BA status applies.

**The MSP must sign a BAA with each medical/healthcare customer before beginning services.**

### What the MSP BAA Covers

The MSP's Business Associate Agreement documents the scope and limits of the MSP's access and obligations:

- **MDM remote management** — the MSP accesses device configuration (MDM console), not PHI content. MDM management does not typically expose PHI unless the MSP is performing hands-on troubleshooting.
- **Support ticket handling** — when a customer submits a support ticket, they should avoid including PHI in ticket descriptions. The MSP's support system is not a PHI-approved system.
- **Log review** — if the MSP reviews Open WebUI logs for security purposes (part of Silver/Gold SLA), those logs may contain PHI. This access is covered by the BAA.
- **On-site service** — technician physical access to the inference Mac is covered by the BAA.

### Key Limitation: MSP Does Not Access PHI Content

The MSP's access is limited to **device and system management** — not PHI data. This limitation is documented in the BAA and operationally enforced:

- MDM console access shows device health and configuration, not application data
- Open WebUI conversation logs are accessed only for security review, not clinical purposes
- AnythingLLM documents are not reviewed by the MSP except to verify ingestion function

This narrow scope limits the MSP's BA liability compared to a cloud AI vendor that processes all PHI through its infrastructure.

### MSP's Own HIPAA Obligations as a BA

As a Business Associate, the MSP must:
- Implement the Security Rule safeguards for any PHI it creates, receives, maintains, or transmits
- Maintain a HIPAA compliance program (workforce training, policies, breach notification procedures)
- Notify the CE within 60 days of discovering a breach of unsecured PHI
- Agree to HIPAA-required terms in the BAA (use/disclosure limitations, individual rights support, breach notification)
- Flow down BA obligations to any subcontractors who access PHI (e.g., MDM platform vendor)

---

## Section 6: Compared to Cloud AI — Risk Comparison

The following table illustrates the compliance risk differential between cloud-based AI services and this on-premises deployment for healthcare use cases.

| Risk Factor | Cloud AI (e.g., ChatGPT, Claude API, Gemini) | This On-Premises Stack |
|-------------|----------------------------------------------|----------------------|
| **PHI sent to third party** | Yes — PHI travels to cloud vendor's servers for inference | No — PHI stays on customer's LAN. Zero data egress for AI operations. |
| **BAA required** | Yes — cloud vendor must sign BAA before PHI can be processed | Only with MSP — narrower scope, more controllable. No inference-layer BA. |
| **BAA quality / liability** | Vendor BAAs typically limit liability for user-input PHI; many exclude training data guarantees | MSP BAA is negotiated directly; scope is limited to device management, not PHI processing |
| **PHI used for model training** | Risk varies by vendor and BAA terms; some enterprise tiers exclude training | No risk — inference uses locally-stored model weights. No data leaves for training. |
| **Breach notification** | Vendor breach affects all customers; CE learns of breach when vendor reports it | Customer controls all PHI. Breach is limited to local environment. CE knows immediately if their system is compromised (MDM alert). |
| **FedRAMP requirement** | If processing CUI in a government context — may be required. HIPAA does not require FedRAMP for non-government CE. | Not applicable — on-premises system. No cloud authorization required. |
| **Audit trail access** | Vendor provides limited log access; audit trail is in vendor's systems | Full audit trail is under CE control. Logs are local, exportable, and retained per CE requirements. |
| **OCR investigation exposure** | Vendor breach creates OCR investigation risk for CE even if CE had no direct fault | CE controls all systems. No vendor-side breach vector. CE's own controls are auditable and demonstrable. |
| **Cost of compliance** | BAA negotiation, vendor security review, monitoring of vendor compliance posture | MSP-provided controls, MDM compliance reports, annual security review — included in SLA |
| **Geographic data residency** | PHI may traverse or reside in multiple data center regions | PHI is physically located in customer's facility. Geographic residency is certain. |

> **Important for Medical Practices:** When presenting this comparison to a medical practice, focus on the OCR audit scenario. If OCR investigates a breach, the CE must demonstrate that it implemented "reasonable and appropriate" safeguards. With cloud AI, the CE's ability to demonstrate control is limited — they are dependent on the vendor's documentation. With this on-premises deployment, every control is locally implemented, locally documented, and locally auditable. The CE can produce MDM reports, Open WebUI logs, and configuration evidence on demand. That's a substantially stronger OCR posture.

---

## Appendix: HIPAA Safeguard Checklist for AI Deployment

Use this checklist at deployment and annually for compliance review.

### Administrative Safeguards
- [ ] Risk analysis completed and signed by compliance officer
- [ ] Risk management plan documented and implemented
- [ ] "Using AI Safely" workforce training completed by all AI system users (training log maintained)
- [ ] Access management workflow documented (provisioning/deprovisioning)
- [ ] Contingency plan documented and tested (recovery test completed)
- [ ] BAA signed with MSP before service commencement

### Physical Safeguards
- [ ] Inference Mac in locked location — location documented
- [ ] Physical access log in place and actively maintained
- [ ] Cable lock installed (Mac Mini/Mac Studio)
- [ ] Screen privacy filters on user workstations in patient-visible areas (if applicable)
- [ ] Device disposal procedure documented

### Technical Safeguards
- [ ] FileVault 2 enabled — verified in MDM compliance report
- [ ] Open WebUI user accounts: all staff have named individual accounts, no shared logins
- [ ] Open WebUI admin account: MFA enabled, separate from staff accounts
- [ ] Session auto-logoff configured in Open WebUI
- [ ] MDM screen lock (5-minute idle) verified on inference Mac
- [ ] TLS 1.3 configured on nginx reverse proxy — certificate installed
- [ ] Log retention: 6-year retention configured and verified
- [ ] Backup: automated daily backup verified, recovery test completed
- [ ] LDAP/AD integration configured (Silver/Gold tier) — or manual account management procedure documented
- [ ] USB storage restriction enforced via MDM

### Ongoing Monitoring
- [ ] MDM compliance reports reviewed quarterly
- [ ] Open WebUI user account list reviewed quarterly (terminated employees removed)
- [ ] Risk analysis updated annually or upon significant system change
- [ ] Incident response test (tabletop) completed annually
- [ ] Workforce training refresher completed annually
