# Security Architecture
## Apple Silicon Local AI — On-Premises Security Design

**Document type:** Internal Reference & Customer-Facing Technical Supplement  
**Applies to:** All service tiers (Starter, Silver, Gold, Enterprise)  
**Last updated:** Q2 2026

---

## Section 1: Data Sovereignty by Design

The foundational principle of this deployment model is architectural: **regulated data cannot exfiltrate a system it never enters.** Unlike cloud AI services, where inference happens on vendor infrastructure outside the customer's control, every component in this stack runs either on the customer's Apple Silicon hardware or on the customer's local network. This is not a policy or a BAA — it is physics.

### The Trust Boundary

The trust boundary is the customer's network perimeter. Nothing crosses it for AI operations.

```
[User Browser]
     |
     | HTTPS (LAN only — nginx TLS 1.3)
     |
[Open WebUI — Mac Mini/Studio/Pro]
     |
     | localhost (127.0.0.1)
     |
[AnythingLLM — RAG orchestration]
     |          |
     |          | [Local Vector DB — ChromaDB/Qdrant on local disk]
     |
     | localhost API (port 1234)
     |
[LM Studio — MLX inference engine]
     |
[Apple Silicon — Unified Memory]
     |
[FileVault 2 — encrypted NVMe / Thunderbolt SSD]
```

**Data IN:** A user uploads a document through their browser. It travels over the LAN (HTTPS) to Open WebUI, which passes it to AnythingLLM. AnythingLLM chunks the document, generates embeddings using the local LLM, and stores both the raw text and the vector embeddings on the local disk in an encrypted APFS volume. All of this happens on the customer's hardware.

**Data OUT:** Nothing. Inference, embedding generation, and vector search all occur in process on the same Apple Silicon machine. The LLM generates a response token-by-token in unified memory and returns it to Open WebUI over localhost. The response travels back to the user's browser over the LAN.

**No API calls to OpenAI, Anthropic, or any cloud service occur during AI operations.** The model weights are files on a local disk. Inference is a local CPU/GPU/Neural Engine operation.

### What Does Require Internet Access

The inference server requires outbound internet access only for:

| Purpose | Destination | Frequency | Can Be Restricted? |
|---------|-------------|-----------|-------------------|
| Model downloads | HuggingFace Hub, MLX Community | One-time or periodic | Yes — allowlist specific domains |
| MDM check-in | Mosyle/Jamf cloud | Every ~15 minutes | No — required for MDM function |
| OS updates | Apple update servers (swscan.apple.com, etc.) | Weekly or on-demand | Partially — can require MDM approval |
| Time sync | NTP servers | Periodic | Can use local NTP server |

**All AI inference traffic is LAN-only.** Firewall rules can enforce this explicitly.

> **Important for Regulated Industries:** Customers who need to demonstrate data sovereignty can produce firewall logs showing zero outbound connections during inference sessions. This is a concrete, auditable proof of compliance that cloud AI vendors cannot match.

---

## Section 2: Encryption Standards

### Encryption at Rest

**FileVault 2** provides full-disk encryption of the system volume using XTS-AES-128, the same standard used by the US government for protecting Sensitive but Unclassified (SBU) information. FileVault 2 is enforced via MDM configuration profile — if a device boots without FileVault active, MDM flags it as non-compliant within minutes.

- **System volume:** FileVault 2 (XTS-AES-128). Encryption is hardware-accelerated on Apple Silicon — zero performance penalty.
- **External model storage:** Thunderbolt SSDs formatted APFS with hardware encryption enabled. APFS encryption is enforced via MDM profile and verified in MDM compliance reports.
- **AnythingLLM data directory:** Stored on the encrypted system volume or encrypted external volume. The AnythingLLM database (documents, embeddings, conversation history) is protected at the OS level by FileVault.

> **CMMC Note:** FileVault 2 uses FIPS 140-2 validated cryptographic modules (Apple's CoreCrypto). This satisfies SC.3.177 (employ FIPS-validated cryptography). Document this in the System Security Plan.

### Encryption in Transit

All API communication between stack components stays on localhost (127.0.0.1) when all services run on a single inference Mac. For multi-user production deployments where Open WebUI serves an office, the following transit encryption applies:

- **User browser to Open WebUI:** TLS 1.3 via nginx reverse proxy. Certificate options:
  - Self-signed certificate (Starter tier — browser warning on first visit, user accepts)
  - Internal CA certificate (Silver/Gold tier — MSP deploys CA root to all workstations via MDM, eliminating browser warnings)
  - Let's Encrypt certificate via DNS challenge (if customer has an internal DNS resolver)
- **Inter-service API calls (AnythingLLM ↔ LM Studio):** localhost — no TLS required, no packet leaves the machine
- **MDM communication (device ↔ Mosyle/Jamf):** TLS 1.3, enforced by MDM platform

### Key Management

**FileVault Recovery Keys** are escrowed to the MDM platform (Mosyle or Jamf) at the time of device enrollment. This provides two benefits:

1. The MSP can perform remote management operations (including unlocking the device if needed) without requiring the customer to remember a recovery key
2. The customer retains a printed copy of the recovery key in their physical security documentation (required by many compliance frameworks)

Recovery key escrow is verified automatically by MDM. If a device is re-enrolled or wiped, a new recovery key is generated and escrowed automatically.

---

## Section 3: Access Control and Authentication

### Open WebUI — User-Level Access

Open WebUI provides built-in user account management. Every staff member who uses the AI system has an individual named account. No shared logins.

- **Admin account:** MSP creates one admin account during deployment. Customer designates an internal admin (typically IT or office manager) who can add/remove user accounts.
- **User accounts:** Individual accounts with unique credentials. Open WebUI does not expose user accounts to the network — authentication is required before any content is served.
- **SSO/LDAP (Silver and Gold tiers):** For customers with Active Directory or LDAP, Open WebUI supports LDAP authentication. This means user account lifecycle (hire/terminate) is managed by the customer's existing identity system. When an employee is terminated in AD, they lose access to the AI system immediately.
- **Session management:** Sessions expire after configurable idle timeout. Auto-logoff enforced.

### AnythingLLM — Workspace-Level Access Control

AnythingLLM supports workspace isolation. Different users or user groups can be restricted to specific workspaces, which contain specific document collections.

**Example use cases:**
- Law firm: "Litigation" workspace, "Contracts" workspace, "Real Estate" workspace — attorneys see only their practice area's documents
- Medical practice: "Clinical" workspace, "Billing" workspace — clinical staff cannot access billing records and vice versa
- Defense contractor: "Program A" workspace, "Program B" workspace — staff with need-to-know for specific programs access only those workspaces

### LM Studio API — Network-Level Access Control

LM Studio runs a local API server on port 1234. In production deployments:

- Firewall rules restrict port 1234 to LAN connections from authorized workstations (or the VLAN subnet)
- For additional security, an nginx reverse proxy sits in front of LM Studio and requires an API key header — this prevents any LAN device from querying the model directly
- API key is managed by the MSP and rotated periodically

### macOS — MDM-Enforced System Policies

MDM enforces the following on all inference Macs (configuration profiles deployed at enrollment, non-removable by local admin):

| Policy | Setting | Enforcement |
|--------|---------|-------------|
| Password minimum length | 12 characters | MDM configuration profile |
| Password complexity | Uppercase + lowercase + number + symbol | MDM configuration profile |
| Password expiry | 90 days | MDM configuration profile |
| Screen lock idle timeout | 5 minutes | MDM configuration profile |
| macOS firewall | Enabled | MDM configuration profile |
| Remote login (SSH) | Disabled | MDM configuration profile |
| Guest account | Disabled | MDM configuration profile |
| Automatic login | Disabled | MDM configuration profile |
| App installation | Restricted to MDM-approved apps | MDM allowed applications list |
| Remote management | MDM console only (not direct SSH) | MDM |

> **Zero-Trust Principle:** The inference server is not a general-purpose workstation. Users do not log into it. MDM lockdown restricts it to running only the approved AI stack applications. Even if a user had physical access, they could not install unapproved software without triggering an MDM compliance violation.

---

## Section 4: Audit Logging

Comprehensive audit logging satisfies both regulatory requirements and the practical need to detect anomalous activity.

### macOS Unified Log

The macOS Unified Log captures all system events — process starts/stops, authentication events, network connections, file system access. MDM can be configured to:

- Forward logs to a customer SIEM (Splunk, Microsoft Sentinel, etc.) via syslog
- Retain logs locally and make them available for MSP review
- Alert on specific event types (repeated authentication failures, unexpected processes, etc.)

### Open WebUI — Conversation Logs

Every conversation in Open WebUI is logged to the local database with:
- User account (named individual — no anonymous access)
- Timestamp (query time and response time)
- Full query text
- Full response text

The admin dashboard provides usage analytics. Conversation logs can be exported for compliance audits. For HIPAA customers: these logs constitute audit trails of PHI access if PHI was included in queries.

### AnythingLLM — Document Access Logs

AnythingLLM logs document ingestion and retrieval events:
- Which user accessed which workspace
- Which documents were retrieved as context for a query
- Timestamp of all document operations

### LM Studio — API Request Logs

LM Studio can optionally log all API requests (enabled by default for production deployments):
- Request timestamp
- Token count (input and output)
- Response time
- Error events

These logs are used primarily for performance monitoring and capacity planning, but also contribute to the overall audit trail.

### MDM Compliance Reports

The MDM platform (Mosyle/Jamf) provides continuous compliance monitoring:
- FileVault encryption status (per device)
- OS version and patch level
- Installed software inventory
- Configuration profile compliance
- Certificate expiry status

MSP has 24/7 access to MDM console. Compliance reports are available at any time for audits.

### Log Retention

| Framework | Retention Requirement | MSP Configuration |
|-----------|----------------------|-------------------|
| HIPAA | 6 years | 6-year retention for Open WebUI logs, macOS logs |
| CMMC | Per SSP (typically 3 years) | Configured to match SSP |
| General | 1 year minimum recommended | Default for non-regulated customers |

---

## Section 5: Network Segmentation

The recommended network architecture places inference servers on a dedicated VLAN, isolated from general office traffic and internet-facing systems.

### Recommended VLAN Layout

```
[Internet]
     |
[Customer Firewall/Router]
     |
     +-- [Office VLAN — 10.10.10.0/24]
     |       User workstations, printers, general office
     |       Firewall ALLOW rule: → 10.10.20.x:443 (Open WebUI)
     |
     +-- [AI Inference VLAN — 10.10.20.0/24]
     |       Mac Mini / Mac Studio inference servers
     |       Firewall ALLOW outbound: Apple update servers, Mosyle/Jamf MDM
     |       Firewall DENY outbound: everything else (internet blocked for AI traffic)
     |       Firewall DENY inbound: from internet
     |
     +-- [Management VLAN — 10.10.30.0/24] (optional, larger deployments)
             MDM console, monitoring, backup systems
```

### Firewall Rules — Inference Server

| Direction | Source | Destination | Port | Protocol | Action | Purpose |
|-----------|--------|-------------|------|----------|--------|---------|
| Inbound | Office VLAN | Inference VLAN | 443 | TCP | ALLOW | User access to Open WebUI |
| Inbound | Management VLAN | Inference VLAN | 443 | TCP | ALLOW | MSP management |
| Inbound | Any | Inference VLAN | Any | Any | DENY | Block all other inbound |
| Outbound | Inference VLAN | Apple servers | 443 | TCP | ALLOW | OS updates |
| Outbound | Inference VLAN | Mosyle/Jamf | 443 | TCP | ALLOW | MDM check-in |
| Outbound | Inference VLAN | HuggingFace (model downloads only) | 443 | TCP | ALLOW | Model updates (can be disabled after deployment) |
| Outbound | Inference VLAN | Any | Any | Any | DENY | Block all other outbound |

### MSP Remote Access

MSP does **not** access inference servers directly via SSH or RDP. All remote management occurs through:

1. **MDM console** (Mosyle/Jamf) — MDM can push configuration profiles, software, scripts, and commands without the MSP ever opening a terminal session on the customer's device
2. **WireGuard VPN** — for cases where direct access is required (troubleshooting, hardware configuration), MSP connects via a WireGuard VPN tunnel to a jump host, not directly to the inference server

This approach keeps MSP access logged, scoped, and auditable. The customer can review MDM activity logs at any time.

---

## Section 6: Incident Response

### Detection

| Source | Alert Condition | Response |
|--------|----------------|---------|
| MDM | Device fails compliance check (FileVault off, unapproved software, etc.) | Immediate MSP alert, customer notification within 1 hour |
| MDM | Device offline unexpectedly | MSP investigates, customer notification within 1 hour |
| Open WebUI | Unusual query volume (potential credential compromise) | MSP reviews logs, disables compromised account |
| Network monitoring | Unexpected outbound connections from inference VLAN | Immediate investigation |
| Customer report | Staff reports unusual AI behavior or unauthorized access attempt | MSP incident response initiated |

### Containment

1. **Disable user account** — Open WebUI admin revokes access for the affected account (can be done remotely by MSP)
2. **MDM remote lock** — device is locked remotely if physical compromise is suspected
3. **VLAN isolation** — firewall rules can be updated to cut the inference server off from the office network pending investigation
4. **MDM remote wipe** — last resort. All data on device is wiped, FileVault decryption keys revoked. Used only if device is physically stolen or unrecoverable compromise is confirmed.

### Recovery

1. **Model re-deployment** — LM Studio model files are re-deployed from MDM-managed package or re-downloaded from allowlisted source
2. **Configuration restoration** — MDM re-deploys all configuration profiles to a replacement or re-enrolled device
3. **Document re-ingestion** — AnythingLLM document library is restored from customer's backup. MSP provides document re-ingestion playbook.
4. **Audit** — Full incident documented in customer's System Security Plan (SSP)

### MSP Commitments

- MDM monitoring: 24/7, automated alerts
- Customer notification: within 1 hour of any detected incident or compliance violation
- Incident documentation: written report provided within 5 business days of incident resolution
- Annual incident response review: MSP reviews and updates IR procedures annually with customer

---

## Section 7: Physical Security

Physical security is the outermost layer of the defense-in-depth model. Apple Silicon hardware is both powerful and compact — physical theft is a realistic threat that must be addressed.

### Hardware Placement

- **Recommended:** Locked server cabinet or dedicated server room with access logging
- **Minimum acceptable:** Locked office or equipment closet — access restricted to authorized personnel
- **Not acceptable:** Open desk, lobby, or unlocked common area

### Theft Protection

Even if hardware is physically stolen, data is protected:

- **FileVault 2** — encrypted disk cannot be read without the decryption key, which is locked to the user's credentials and the secure enclave
- **MDM Activation Lock** — a stolen Apple Silicon Mac cannot be set up without the Apple ID credentials tied to Apple Business Manager. The device is a brick to a thief.
- **Remote wipe** — if the stolen device connects to the internet (even briefly), MDM can execute a remote wipe before any data can be extracted

### Physical Access Controls

| Control | Implementation |
|---------|---------------|
| Cable lock | Kensington lock (Mac Mini/Mac Studio) — included in deployment hardware |
| Cabinet lock | Rack-mount cabinet with keyed lock for server room deployments |
| Access log | Physical sign-in log or electronic access system for server room |
| Visitor policy | No unescorted visitors in server room — documented in customer security policy |

> **Important for Medical Practices:** HIPAA's Physical Safeguard requirements (§164.310) require documented facility access controls for systems that store PHI. The MSP's deployment documentation and physical security recommendations satisfy this requirement. Customer must maintain the physical access log as part of their HIPAA compliance program.
