# Tier M — Team
### Apple Silicon AI MSP | T-Shirt Size: Medium

---

## At a Glance

| | |
|---|---|
| **Target customers** | 5–20 attorney firm, small medical group practice, mid-size accounting firm, defense contractor team |
| **Active concurrent users** | 5–25 |
| **Primary hardware** | Mac Mini M4 Pro (48GB unified memory) |
| **Monthly MSP fee** | $599/month |
| **Setup fee** | $1,500 |
| **Deployment time** | 1–2 days |
| **SLA response time** | 2 business hours |

---

## Who This Is For

Tier M is the workhorse tier for small professional teams where AI productivity is becoming a firm-wide asset rather than an individual tool. The typical customer is a law firm with 5–20 attorneys, a medical group with 3–8 providers sharing administrative staff, an accounting firm in busy season with a team of CPAs working the same client files, or a defense contractor team with 10–25 personnel handling CUI.

At this tier, multiple people need AI access simultaneously, different practice groups or departments need their own document workspaces, and conversation history needs to persist across sessions with user accounts. The 48GB node running Qwen2.5-32B-Instruct delivers state-of-the-art performance for legal, medical, and financial document work — meaningfully better than the 14B tier for complex analysis tasks.

---

## Hardware Bill of Materials

| Item | Model | Price |
|---|---|---|
| Primary inference node | Mac Mini M4 Pro (48GB unified memory) | $1,799 |
| Networking / accessories | Thunderbolt hub, managed switch port, UPS | ~$300 |
| **Total hardware** | | **~$2,100** |
| **MSP hardware price (20% margin)** | | **~$2,520** |

**Why 48GB?** The jump from 24GB to 48GB is the jump from 14B models to 32B models — a significant quality tier. Qwen2.5-32B-Instruct at 4-bit quantization uses approximately 18–20GB, leaving substantial headroom for 2–5 concurrent requests. The M4 Pro chip handles this workload efficiently at approximately 35–45 tokens/second per request. For the occasional heavy reasoning task, Llama-3.3-70B fits in 48GB at reduced quantization (occupying the full memory budget, so single-user at a time for that model).

**Scaling:** A single Mac Mini M4 Pro 48GB handles 5–15 concurrent light users comfortably. For teams pushing toward 20–25 concurrent users, a second unit can be added — the MSP configures LM Studio's API on both nodes and sets up a simple load-balancing configuration. This is significantly cheaper than upgrading to Tier L hardware and appropriate for teams with burst usage patterns.

---

## Software Stack

| Component | Software | Purpose |
|---|---|---|
| LLM inference | LM Studio (server mode, headless) | Headless API server; manages model serving without a GUI on the node |
| Chat interface | Open WebUI (multi-user) | Browser-based interface with user accounts, conversation history, admin controls |
| Document AI / RAG | AnythingLLM (multi-workspace) | Separate workspaces per practice group or matter type; multiple teams, isolated documents |
| Vector database | LanceDB | Better performance than embedded ChromaDB for multi-user concurrent retrieval workloads |
| Device management | Mosyle Business or Jamf Pro | MDM enrollment and policy management; Jamf for firms with existing Apple infrastructure |
| Device enrollment | Apple Business Manager | Zero-touch enrollment; MSP manages device assignment |

**Architecture note:** LM Studio runs in server mode — no GUI, no display required. The Mac Mini sits on the network and serves inference requests to Open WebUI and AnythingLLM over the local network. Users access Open WebUI from their own Macs or PCs via a browser; no software is installed on user machines.

**LanceDB vs. ChromaDB:** LanceDB is chosen at Tier M because it handles concurrent reads more efficiently than ChromaDB's embedded mode. As multiple users query different workspaces simultaneously, LanceDB's architecture degrades more gracefully under load.

---

## Recommended Models

| Purpose | Model | Concurrency |
|---|---|---|
| Primary assistant | Qwen2.5-32B-Instruct | 2–5 concurrent requests |
| Complex reasoning | Llama-3.3-70B | Single user at a time (full memory) |
| Lightweight / fast tasks | Qwen2.5-Coder-7B | 8–12 concurrent requests |

**Model rotation strategy:** LM Studio can be configured to serve Qwen2.5-32B as the default model for all users. The MSP sets up a separate endpoint for Llama-3.3-70B that loads on demand — useful for a senior attorney who needs the highest-quality analysis on a complex brief but doesn't need it running for the whole team all day.

---

## Pricing

| Item | Amount |
|---|---|
| Hardware (MSP-supplied) | ~$2,520 one-time |
| Setup / onboarding fee | $1,500 one-time |
| Monthly MSP service fee | $599/month |
| **Annual contract value** | **~$7,200 MRR + $4,020 one-time** |

The monthly fee covers: MDM management, proactive system monitoring (CPU/memory/temperature), weekly model review (checking for new releases), 2-hour SLA response, quarterly business reviews, and network configuration management.

The $1,500 setup fee includes: network configuration (static IP assignment, firewall rules), user account creation in Open WebUI (importing directory), AnythingLLM workspace setup (one workspace per practice area or department), data migration from existing document stores (up to 10GB), and a 1-hour staff training session.

---

## Use Case Examples

**1. Multi-attorney brief review — law firm**
A litigation team of 6 attorneys is working on a summary judgment motion. Each attorney accesses Open WebUI from their Mac. They share a "Litigation — Smith v. Jones" workspace in AnythingLLM containing case documents, deposition transcripts, and prior rulings. Each attorney can independently ask: "What testimony supports our position on the duty of care element?" The 32B model synthesizes across 800 pages of documents and returns cited, grounded answers. All six can be working simultaneously.

**2. Patient record review — medical group**
A 4-physician family practice uploads patient intake forms and prior records to a HIPAA-appropriate local workspace. Before each day's appointments, the care coordinator asks AnythingLLM: "Summarize the chronic conditions, current medications, and last visit notes for patients on Dr. Chen's schedule today." The AI returns a structured pre-briefing document. No PHI leaves the building.

**3. Audit workpaper generation — accounting firm**
During busy season, a team of 8 CPAs are each working different client files. Each client has their own AnythingLLM workspace containing financial statements, prior year returns, and client-provided documentation. Each CPA can independently query their client's workspace to generate preliminary workpaper narratives, identify anomalies, and draft management letter points.

**4. CMMC documentation — defense contractor**
A 12-person defense contractor team needs to produce System Security Plan documentation across 6 NIST SP 800-171 control families. The team uploads existing policies and procedures to AnythingLLM. Different team members work on different control families simultaneously, prompting the AI to: "Review our existing Access Control policy against 3.1.1–3.1.22 and identify gaps. Draft remediation language for any deficiencies."

**5. Shared knowledge base — multi-specialty practice**
A physical therapy group creates separate AnythingLLM workspaces for each specialty (sports rehab, pediatric PT, neurological PT). Each workspace contains clinical protocols, referral templates, and outcome tracking forms. Therapists query their specialty workspace for protocol guidance, documentation templates, and referral letter drafts — with the AI grounded in practice-specific documents.

---

## Accessibility — How Non-Technical Staff Use This

**For end users:** Open WebUI at this tier adds user accounts — each team member logs in with a username and password (set by the MSP during onboarding). The interface is identical to the Tier S experience: a chat window in a browser. Conversation history is saved per user. No new software is installed on user machines.

**For document workspaces:** AnythingLLM's workspace interface is accessible via a browser link. Office administrators can upload new documents to a workspace without any technical knowledge — it's a drag-and-drop file upload interface. The MSP configures workspace access permissions so each team member sees only the workspaces relevant to their role.

**Admin controls:** The MSP manages user account creation, model selection, and workspace permissions. The firm's office manager or practice administrator can be granted a read-only admin view to see which users are active and which workspaces are in use — without needing to manage the underlying infrastructure.

---

## What's NOT Included

- **The AI models themselves** — Qwen2.5-32B, Llama-3.3-70B, and other open-weight models are open source and free. The MSP downloads and manages them as part of the service.
- **Microsoft 365 / Google Workspace deep integration** — Users copy-paste content between Office apps and Open WebUI. Native plugin integration is not included at this tier.
- **Active Directory / LDAP SSO** — User accounts in Open WebUI are managed by the MSP, not synced from AD. SSO integration is a Tier L feature.
- **GPU cluster expansion** — Tier M is a single-node (or dual-node burst) architecture. Complex multi-model orchestration or fine-tuning is not supported.
- **Guaranteed uptime SLA** — The 2-hour response SLA covers incident response time, not guaranteed availability. Hardware failure recovery (replacement unit) is next-business-day.
- **Unlimited document ingestion** — AnythingLLM workspace performance is best under 2,000 documents per workspace. Larger corpora require Tier L infrastructure.
- **24/7 support** — Service hours are business hours. After-hours emergency support is available as an add-on.

---

## Upgrade Path

Consider upgrading to Tier L when any of the following apply:

- Sustained concurrent usage regularly exceeds 15 users and response times degrade
- Active Directory / LDAP SSO is required by IT policy
- A standby node with automatic failover is required (compliance or continuity obligation)
- 70B model quality is needed for multiple simultaneous users (not just one at a time)
- The firm grows to 30+ attorneys or providers and centralized AI governance is needed

See `tier-L.md` for the next tier.
