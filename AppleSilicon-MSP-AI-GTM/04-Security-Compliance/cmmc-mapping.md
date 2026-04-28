# CMMC Level 2 Control Mapping
## Apple Silicon Local AI — Defense Contractor Compliance Reference

**Document type:** Internal Reference & Pre-Assessment Customer Supplement  
**Applies to:** Defense contractors subject to CMMC Level 2 (CUI handling)  
**CMMC Phase 2 enforcement date:** November 10, 2026  
**NIST reference:** SP 800-171 Rev 2 (110 practices)  
**Last updated:** Q2 2026

---

> **CMMC Note:** CMMC Phase 2 enforcement begins November 10, 2026. Defense contractors who handle Controlled Unclassified Information (CUI) in their DoD contracts must achieve CMMC Level 2 certification before this date to remain eligible for contract awards. This document maps the AI system controls implemented by this deployment to the relevant CMMC Level 2 practices.

---

## Section 1: CMMC Scope for AI Systems

### When an AI System is In Scope

CMMC Level 2 applies to any system that **stores, processes, or transmits** Controlled Unclassified Information (CUI). The key question is: does the AI system touch CUI?

If a defense contractor uses the AI system to ingest and analyze:
- Contract documents or statements of work containing program specifics
- Technical specifications, engineering drawings, or design documents
- Supplier information related to a DoD program
- Personnel or security-clearance adjacent information
- Any document marked CUI or FOUO

...then the AI system is **in scope** for CMMC. The system must meet the applicable controls, and it must be documented in the contractor's System Security Plan (SSP).

### On-Premises vs. Cloud — A Critical Distinction

| Deployment Model | CMMC Implication |
|-----------------|-----------------|
| Cloud AI (ChatGPT, Claude API, Copilot) | The cloud service must be FedRAMP Authorized at the Moderate baseline (or equivalent). Most commercial AI services are not. Using them to process CUI is a compliance violation. |
| On-premises AI (this stack) | Treated as an on-premises server. No FedRAMP required. Subject to the same NIST SP 800-171 controls as any other on-premises system in the contractor's environment. |

This is one of the most important compliance advantages of on-premises AI deployment. A contractor does not need to wait for an AI vendor to achieve FedRAMP authorization. The contractor controls the system, and the controls are implemented and auditable today.

> **CMMC Note:** CMMC Level 2 does not require cloud hosting. It requires that CUI be protected with the 110 practices from NIST SP 800-171. An on-premises system that implements those practices is fully compliant. This deployment is designed to satisfy those practices.

### Scoping Boundary

For CMMC purposes, the AI system's scope includes:
- The inference Mac(s) (hardware)
- The software stack (LM Studio, AnythingLLM, Open WebUI)
- The network segment on which the inference Mac resides (AI VLAN)
- The user workstations that access the inference server
- The MDM platform used to manage the inference Mac

The MDM platform (Mosyle/Jamf) is a shared service and may be treated as an external service provider — the MSP must have appropriate agreements in place (see Section 3).

---

## Section 2: Control Mapping Table

The following tables map CMMC Level 2 practices to specific controls implemented in this deployment. This is not exhaustive of all 110 practices — it covers the domains most directly relevant to an AI inference system. The full SSP template provided by the MSP maps all applicable practices.

---

### Access Control (AC) — 22 Practices

| Practice | Requirement (NIST SP 800-171) | Implementation |
|----------|-------------------------------|---------------|
| **AC.1.001** | Limit system access to authorized users, processes acting on behalf of authorized users, and devices | MDM enrollment required for all devices — only MDM-enrolled Macs appear on the AI VLAN. Open WebUI requires individual user account login. VLAN firewall rules restrict access to authorized subnet. |
| **AC.1.002** | Limit system access to the types of transactions and functions that authorized users are permitted to execute | AnythingLLM workspace-level access control restricts users to CUI-relevant document sets. Open WebUI user roles (admin vs. user) limit administrative functions. |
| **AC.2.005** | Provide privacy and security notices consistent with CUI rules | Open WebUI system prompt configured with CUI handling notice displayed to all users at session start. Workforce training (covered in SSP) addresses CUI marking and handling. |
| **AC.2.006** | Limit use of portable storage devices on systems that process, store, or transmit CUI | MDM configuration profile blocks unauthorized USB mass storage devices. Only MSP-managed, MDM-enrolled Thunderbolt drives are permitted. Removable media policy documented in SSP. |
| **AC.2.007** | Employ the principle of least privilege, including for specific security functions and privileged accounts | Inference Mac runs as a locked-down appliance. Standard users do not have local admin rights. MSP admin account is separate from daily use accounts. LM Studio API restricted to AnythingLLM (not exposed to end users directly). |
| **AC.2.013** | Monitor and control remote access sessions | MSP remote access occurs exclusively through MDM console — direct SSH access is disabled via MDM configuration profile. All MDM management actions are logged in the MDM console audit trail. |
| **AC.3.017** | Separate the duties of individuals to reduce the risk of malevolent activity | Open WebUI admin account (customer IT/office manager) separated from MSP admin account. CUI document ingestion (admin function) separated from CUI query (user function). |
| **AC.3.021** | Authorize remote execution of privileged commands via remote access only for documented operational needs | MSP uses Apple Business Manager and Jamf/Mosyle for all remote operations. Remote execution of scripts or commands is logged in MDM and requires MSP operational documentation. No ad-hoc SSH sessions. |

---

### Identification and Authentication (IA) — 11 Practices

| Practice | Requirement (NIST SP 800-171) | Implementation |
|----------|-------------------------------|---------------|
| **IA.1.076** | Identify system users, processes acting on behalf of users, and devices | Open WebUI: named individual user accounts (no anonymous access, no shared accounts). MDM: each device has a unique MDM identity certificate. LM Studio API: application-level API key identifies AnythingLLM process. |
| **IA.1.077** | Authenticate identities of users, processes, or devices before allowing access to organizational systems | Open WebUI: password authentication required before any session. macOS: FileVault password required at boot. MDM: device certificate-based authentication to MDM platform. |
| **IA.2.078** | Enforce a minimum password complexity and change of passwords when new passwords are established | MDM configuration profile enforces: minimum 12 characters, uppercase + lowercase + number + symbol. 90-day expiry. Password history prevents reuse of last 10 passwords. |
| **IA.2.079** | Prohibit password reuse for a specified number of generations | MDM configuration profile: 10-generation password history enforced on macOS. |
| **IA.2.080** | Allow temporary passwords used for system logons with immediate change requirement | Covered in MSP onboarding playbook: temporary passwords set to require change on first login via MDM scripted configuration. |
| **IA.2.081** | Store and transmit only cryptographically protected passwords | macOS stores passwords using industry-standard hashing (bcrypt/PBKDF2). Open WebUI hashes passwords before storage. No plaintext passwords stored or transmitted. |
| **IA.3.083** | Use multifactor authentication (MFA) for local and network access to privileged accounts and for network access to non-privileged accounts | MDM admin account uses MFA (enforced by Mosyle/Jamf). Open WebUI admin account: MFA available and recommended (TOTP). For Silver/Gold tier LDAP integration: organization's AD MFA policy applies to all users. |

> **CMMC Note:** IA.3.083 (MFA for privileged accounts) is required at Level 2. The MSP admin account must use MFA — this is enforced by the MDM platform. For network-accessible non-privileged accounts (all staff using Open WebUI over LAN), MFA is strongly recommended and is included in the Gold tier configuration.

---

### System and Communications Protection (SC) — 27 Practices

| Practice | Requirement (NIST SP 800-171) | Implementation |
|----------|-------------------------------|---------------|
| **SC.1.175** | Monitor, control, and protect organizational communications at the external boundaries and key internal boundaries | Customer firewall enforces VLAN isolation. AI inference VLAN has no direct internet access for AI operations. External boundary monitoring provided by customer's existing firewall. MSP can assist with firewall rule documentation for SSP. |
| **SC.1.176** | Implement subnetworks for publicly accessible system components that are separated from internal networks | Inference server resides on dedicated AI VLAN (e.g., 10.10.20.0/24) isolated from the office VLAN and from any internet-accessible systems. No public-facing components. |
| **SC.3.177** | Employ FIPS-validated cryptography when used to protect the confidentiality of CUI | FileVault 2 uses Apple's CoreCrypto framework, which includes FIPS 140-2 validated AES-128 in XTS mode. APFS encryption on external storage uses the same validated module. Document FIPS validation certificates in SSP. |
| **SC.3.187** | Establish and manage cryptographic keys for cryptography employed in organizational systems | FileVault recovery keys generated at enrollment and automatically escrowed to MDM (Mosyle/Jamf). MSP holds recovery key for management purposes. Customer retains printed copy. Key rotation occurs on device re-enrollment. |
| **SC.3.190** | Protect the authenticity of communications sessions | TLS 1.3 enforced for all LAN communications between user browsers and Open WebUI (via nginx reverse proxy). TLS 1.3 for MDM communication. Inter-service calls on localhost are not exposed to network interception. |
| **SC.3.191** | Protect CUI at rest | FileVault 2 (FIPS-validated AES-128) encrypts all CUI on the system volume. External storage encrypted via APFS. AnythingLLM vector DB and document storage reside on encrypted volumes. |
| **SC.3.192** | Implement DNS filtering | MSP configures DNS resolver to block known malicious domains. AI VLAN outbound traffic restricted to allowlisted domains (Apple, MDM provider, model sources). |

---

### Configuration Management (CM) — 9 Practices

| Practice | Requirement (NIST SP 800-171) | Implementation |
|----------|-------------------------------|---------------|
| **CM.2.061** | Establish and maintain baseline configurations and inventories of organizational systems (including hardware, software, firmware, and documentation) throughout the respective system development life cycles | MDM maintains real-time software inventory for all enrolled devices. Baseline configuration defined in MDM configuration profiles. Hardware inventory maintained in MDM device records. SSP documents baseline configuration. |
| **CM.2.062** | Establish and maintain a security configuration for organizational systems | MDM configuration profiles define the security baseline: FileVault on, firewall on, screen lock 5 min, approved apps only. These profiles are enforced — local admin cannot override them. |
| **CM.2.064** | Establish and enforce security configuration settings for information technology products employed in organizational systems | All security configuration settings are enforced via MDM (not just documented — enforced). Non-compliant devices generate automated MDM alerts within minutes. |
| **CM.2.065** | Track, review, approve, and log changes to organizational systems | All changes to MDM configuration profiles are logged in MDM audit trail. Software updates are pushed via MDM (logged). Any deviation from baseline triggers a compliance alert. |
| **CM.3.068** | Restrict, disable, or prevent the use of nonessential programs, functions, ports, protocols, and services | MDM allowed-applications list restricts inference Mac to approved software only. Network firewall blocks all ports except 443 (LAN inbound). USB storage blocked via MDM. Bluetooth restricted. |

---

### Audit and Accountability (AU) — 9 Practices

| Practice | Requirement (NIST SP 800-171) | Implementation |
|----------|-------------------------------|---------------|
| **AU.2.041** | Ensure that the actions of individual users can be uniquely traced to those users so that they can be held accountable for their actions | Open WebUI conversation logs are keyed to named individual user accounts. macOS Unified Log records user-attributed events. No shared accounts permitted. |
| **AU.2.042** | Create and retain system audit logs and records to the extent needed to enable the monitoring, analysis, investigation, and reporting of unlawful or unauthorized system activity | Open WebUI logs: retained per SSP (minimum 3 years for CMMC). macOS Unified Log: retained and archivable. MDM audit trail: retained in MDM platform. AnythingLLM document access log: retained locally. |
| **AU.2.043** | Provide a system capability that compares and synchronizes internal system clocks with an authoritative source to generate time stamps for audit records | macOS time synchronization enabled (NTP) via MDM configuration. All log timestamps are synchronized to authoritative time source. Consistent timestamps across all system components. |
| **AU.3.045** | Review and update logged events | MSP quarterly log review included in Silver and Gold SLA tiers. Review covers: anomalous query patterns, failed authentication attempts, unexpected system events, compliance drift. Customer receives quarterly log review summary report. |
| **AU.3.046** | Alert in the event of an audit logging process failure | MDM monitors device health including disk space (log storage). MDM alerts MSP if disk usage exceeds threshold. Open WebUI alerts on database write failures. |

---

### Incident Response (IR) — 3 Practices

| Practice | Requirement (NIST SP 800-171) | Implementation |
|----------|-------------------------------|---------------|
| **IR.2.092** | Establish an operational incident-handling capability for organizational systems | MSP provides written Incident Response Plan (IRP) template as part of Gold tier onboarding. Customer adapts template to their organization. MSP acts as technical IR support. |
| **IR.2.093** | Track, document, and report incidents to designated officials and/or authorities | Incident tracking documented in SSP-linked incident log. MSP notifies customer within 1 hour of detected incident. Customer responsible for DIBCAC/DoD reporting as required. |
| **IR.2.094** | Test the organizational incident response capability | MSP facilitates annual tabletop exercise for Gold tier customers. Exercise scenarios include device theft, credential compromise, and unauthorized data access. |

---

### Risk Assessment (RA) — 3 Practices

| Practice | Requirement (NIST SP 800-171) | Implementation |
|----------|-------------------------------|---------------|
| **RA.2.141** | Periodically assess the risk to organizational operations, organizational assets, and individuals | MSP provides pre-populated Risk Assessment template for the AI system components. Customer completes and signs. Annual review included in Gold tier SLA. |
| **RA.2.142** | Scan for vulnerabilities in organizational systems and applications periodically | MDM tracks OS version and patch status continuously. MSP reviews CVEs for all stack components (LM Studio, AnythingLLM, Open WebUI) quarterly. Vulnerability scan report provided to customer annually. |
| **RA.2.143** | Remediate vulnerabilities in accordance with risk assessments | Patch deployment via MDM for OS updates. Application updates pushed via MDM package deployment. Critical vulnerabilities remediated within 30 days (Silver/Gold SLA). |

---

## Section 3: System Security Plan (SSP) Guidance

### The SSP is the Core CMMC Artifact

CMMC Level 2 requires a System Security Plan that documents how each of the 110 practices is implemented (or planned, with a Plan of Action & Milestones for gaps). The SSP is reviewed by the C3PAO (Third-Party Assessment Organization) during the formal assessment.

### MSP Deliverables for SSP Preparation

The MSP provides the following to support SSP development:

1. **Pre-populated SSP template** covering all controls implemented by the AI system components. The template maps each practice to specific system components (hardware model, software version, MDM configuration profile name).
2. **Evidence package** — MDM compliance reports, configuration profile exports, and log samples that serve as evidence artifacts for the C3PAO assessment.
3. **Control narratives** — written explanations of how each control is implemented, in the format required by CMMC assessment guides.
4. **Gap analysis** — identification of any practices where the customer's broader environment (not the AI system) may have gaps requiring attention before the C3PAO assessment.

### Customer Responsibilities

The customer (contractor) is responsible for:
- Defining CUI categories handled by the organization and documenting them in the SSP
- Completing the organizational sections of the SSP (workforce policies, physical security, supply chain)
- Maintaining the SSP as a living document (updated when system changes occur)
- Engaging and managing the C3PAO relationship for formal assessment

### C3PAO Assessment Timeline

> **CMMC Note:** CMMC Phase 2 enforcement begins November 10, 2026. C3PAO assessments are in high demand. Defense contractors should begin the assessment process no later than Q2 2026 to allow time for assessment scheduling, any remediation, and certification issuance before the enforcement deadline. The MSP can assist with C3PAO referrals and assessment preparation.

---

## Section 4: What CMMC Level 2 Does NOT Require

Several common misconceptions create unnecessary concern about CMMC compliance for on-premises AI systems. The following clarifications are based on the CMMC Level 2 Assessment Guide and NIST SP 800-171 Rev 2.

### CMMC Level 2 Does NOT Require Cloud Hosting

NIST SP 800-171 was written for on-premises systems handling CUI. On-premises deployment is the baseline assumption. There is no requirement to move CUI to a cloud service. In fact, using cloud AI services to process CUI without FedRAMP authorization is a compliance violation that on-premises deployment avoids entirely.

### CMMC Level 2 Does NOT Require FedRAMP Authorization

FedRAMP is required for cloud services used by federal agencies and contractors to process CUI in cloud environments. It does not apply to on-premises systems. An on-premises server running AI inference is governed by NIST SP 800-171, not FedRAMP.

### CMMC Level 2 Does NOT Require AI Tool Certification

There is no CMMC certification for LLM runtimes, inference engines, or AI applications. LM Studio, AnythingLLM, and Open WebUI are not required to be individually "CMMC certified." What is required is that the **system** in which these tools operate implements the 110 practices from NIST SP 800-171. This deployment is designed to satisfy those practices at the system level.

### CMMC Level 2 DOES Require What This Deployment Provides

- Documented system boundary and SSP: provided via MSP SSP template
- Access control with individual accountability: provided via Open WebUI user accounts, MDM device identity
- Encryption of CUI at rest and in transit: provided via FileVault 2 (FIPS-validated), TLS 1.3
- Audit logging with retention: provided via Open WebUI logs, macOS Unified Log, MDM audit trail
- Configuration management via baseline enforcement: provided via MDM configuration profiles
- Incident response capability: provided via MDM monitoring, MSP IR support

> **CMMC Note:** The FY2026 NDAA Section 1513 directs DoD to develop a cybersecurity framework for AI systems. A status report is due June 2026. This may result in additional AI-specific requirements in future CMMC revisions. This deployment's architecture — local inference, MDM control, comprehensive audit logging — is well-positioned to satisfy any reasonable AI-specific controls that may emerge, as it provides maximum visibility and control over AI operations.
