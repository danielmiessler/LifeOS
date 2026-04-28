# Tier L — Department
### Apple Silicon AI MSP | T-Shirt Size: Large

---

## At a Glance

| | |
|---|---|
| **Target customers** | Mid-size law firm (25–75 attorneys), regional medical group, mid-size accounting firm, mid-size defense contractor |
| **Active concurrent users** | 25–100 |
| **Primary hardware** | Mac Studio M4 Max (64GB unified memory) |
| **Monthly MSP fee** | $1,299/month |
| **Setup fee** | $3,500 |
| **Deployment time** | 2–4 days |
| **SLA response time** | 1 hour (critical incidents) |

---

## Who This Is For

Tier L is built for organizations where AI has moved from a trial tool to operational infrastructure. The typical customer is a mid-size law firm with 25–75 attorneys across multiple practice areas, a regional medical group with 10–30 providers, an accounting firm with 30–80 professionals serving complex clients, or a defense contractor with a full program team handling CUI at scale.

At this tier, the AI system must support 25–100 concurrent users, integrate with enterprise identity management (Active Directory or LDAP), provide a high-availability architecture with automatic failover, and deliver the highest-quality open-weight models (70B class) at multi-user concurrency. The Mac Studio M4 Max with 64GB unified memory is the foundation — capable of running Llama-3.3-70B with 2–4 concurrent users at full quality, or Qwen2.5-14B for 12–18 simultaneous low-latency tasks.

---

## Hardware Bill of Materials

| Item | Model | Price |
|---|---|---|
| Primary inference node | Mac Studio M4 Max (64GB unified memory) | $2,399 |
| Accessories | Thunderbolt dock, rack shelf, UPS, managed switch | ~$300 |
| **Primary node total** | | **~$2,700** |
| **MSP hardware price (20% margin)** | | **~$3,240** |
| Optional: Standby node | Mac Studio M4 Max (64GB) | $2,399 additional |
| **Two-node HA configuration** | | **~$5,400 hardware** |

**Why Mac Studio M4 Max 64GB?** The M4 Max chip provides a significant bandwidth increase over the M4 Pro — 400GB/s memory bandwidth vs. 120GB/s — which directly translates to higher tokens/second at larger model sizes. Llama-3.3-70B runs at approximately 25 tokens/second on a single M4 Max 64GB node, enabling real-time multi-user interaction with state-of-the-art model quality. The Mac Studio form factor also provides better thermal headroom for sustained inference workloads compared to the Mac Mini.

**High Availability:** The primary + standby configuration uses Nginx health-check failover. If the primary node becomes unresponsive, Nginx automatically routes traffic to the standby within seconds. The standby runs the same models and is warm (loaded in memory) at all times. This is the first tier where always-on availability is engineered into the architecture.

---

## Software Stack

| Component | Software | Purpose |
|---|---|---|
| LLM inference | LM Studio (server mode) or llama.cpp server | Inference API; llama.cpp offers more precise concurrency controls for advanced load management |
| Chat interface | Open WebUI (enterprise multi-user with SSO) | Browser-based UI with LDAP/Active Directory authentication |
| Document AI / RAG | AnythingLLM (multi-workspace, enterprise config) | Large-scale workspace partitioning; production-grade retrieval |
| Vector database | PostgreSQL + pgvector | Production-grade vector store; handles 50+ concurrent retrieval users reliably |
| Load balancing | Nginx (reverse proxy) | Routes requests between primary and standby nodes; health-check failover |
| Device management | Jamf Pro | Enterprise Apple MDM; supports compliance reporting, configuration profiles, remote wipe |
| Device enrollment | Apple Business Manager | Multi-device enrollment; integrates with Jamf for automated provisioning |
| Embeddings model | nomic-embed-text-v2 or mxbai-embed-large | High-quality local embedding for RAG; runs as a lightweight sidecar process |

**llama.cpp server option:** For organizations that need fine-grained control over request queuing, context length management, or concurrent slot allocation, llama.cpp server provides lower-level controls than LM Studio. The MSP selects based on the customer's concurrency profile during the setup assessment.

**PostgreSQL + pgvector:** At 50+ users with multiple active workspaces, embedded vector stores (ChromaDB, LanceDB) can develop contention issues under heavy concurrent retrieval. PostgreSQL with the pgvector extension runs as a self-hosted service on the same network, providing ACID-compliant vector storage with proper connection pooling. It also enables cross-workspace search capabilities that embedded stores cannot provide.

---

## Recommended Models

| Purpose | Model | Performance | Concurrency |
|---|---|---|---|
| Primary — state of the art | Llama-3.3-70B | ~25 tok/sec | 2–4 concurrent |
| Primary — high quality | Qwen2.5-72B | ~22 tok/sec | 2–3 concurrent |
| Fast responses — high volume | Qwen2.5-14B-Instruct | ~60 tok/sec | 12–18 concurrent |
| Embeddings | nomic-embed-text-v2 | Very fast | Essentially unlimited |

**Model routing strategy:** The MSP configures Open WebUI with two primary endpoints — a "Standard" endpoint serving Qwen2.5-14B for routine tasks (drafting, summarization, quick Q&A) and a "Deep Analysis" endpoint serving Llama-3.3-70B for complex work (brief analysis, expert opinions, CMMC gap assessments). Users select which mode they need from a dropdown in Open WebUI. This prevents the 70B model from being consumed by routine tasks and preserves throughput for the work that genuinely needs 70B-class reasoning.

---

## Pricing

| Item | Amount |
|---|---|
| Hardware — single node (MSP-supplied) | ~$3,240 one-time |
| Hardware — HA two-node config (optional) | ~$6,480 one-time |
| Setup / onboarding fee | $3,500 one-time |
| Monthly MSP service fee | $1,299/month |
| **Annual contract value** | **~$15,600 MRR + setup** |

The monthly fee covers: 24/7 system monitoring with alerting, 1-hour critical incident response, dedicated Customer Success Manager (quarterly business reviews + monthly check-ins), Jamf Pro management, monthly model update review and deployment, Nginx configuration management, pgvector maintenance, and a 4-week annual on-site visit option (or equivalent remote session).

The $3,500 setup fee includes: full network integration (firewall rules, VLAN configuration, static IP assignment), Active Directory / LDAP SSO configuration in Open WebUI, AnythingLLM workspace setup for each practice group or department, pgvector database initialization and migration, Nginx reverse proxy configuration, Jamf Pro enrollment of all Mac devices, data migration (up to 50GB of documents), and a 3-hour staff training workshop (live or remote).

---

## Use Case Examples

**1. Firm-wide document intelligence — mid-size law firm**
A 45-attorney firm creates AnythingLLM workspaces for each practice area: Litigation, Corporate M&A, Real Estate, Employment, and IP. Each practice group's documents — form libraries, prior briefs, client correspondence, expert reports — are ingested into their workspace. Associates can ask questions across their practice area's entire document corpus simultaneously. Senior partners use the Llama-3.3-70B "Deep Analysis" endpoint for strategic analysis of complex transactions. The AI handles 30–40 simultaneous queries during peak hours.

**2. Clinical decision support — regional medical group**
A 15-physician regional group with 4 clinic locations (using a hub-and-spoke VPN configuration within Tier L) deploys a shared AI platform. Physicians access clinical guideline workspaces containing uploaded specialty protocols, drug interaction references, and payer policy documents. Nurses use the standard endpoint for prior authorization letter drafting. The AI is never the decision-maker — it's a synthesis and drafting tool that reduces documentation time by 30–45 minutes per provider per day.

**3. Year-end close acceleration — accounting firm**
During Q1 audit season, 40 CPAs are simultaneously using the platform across 15 client engagements. Each client has an isolated workspace. The platform handles: workpaper narrative generation, footnote drafting from trial balance data, management representation letter drafting, and technical accounting research against an ingested library of GAAP standards and FASB ASUs. The Qwen2.5-14B fast endpoint handles routine drafting; the 70B endpoint handles technical accounting analysis.

**4. Program management AI — mid-size defense contractor**
A 60-person defense contractor with a CMMC Level 3 obligation deploys the platform for their program management office. Workspaces include: the full contract requirements library (CDRLs, SOW, DIDs), the program's document repository, and the CMMC assessment evidence set. Program managers, engineers, and compliance staff work simultaneously. ITAR-sensitive data stays on-premises by design. The AI assists with deliverable drafting, compliance gap analysis, and status reporting.

**5. Staff training and knowledge management — healthcare administration**
A regional hospital's administrative department (billing, coding, HR, compliance) uses the platform for knowledge base Q&A. AnythingLLM workspaces contain the employee handbook, CMS billing guidance, payer contracts, and HR policies. Staff ask questions in plain English; the AI retrieves grounded answers from authoritative internal documents rather than relying on general knowledge. This reduces compliance errors from staff misinterpreting policy and cuts HR query volume by approximately 40%.

---

## Accessibility — How Non-Technical Staff Use This

**SSO integration:** At Tier L, Open WebUI authenticates against Active Directory or LDAP. Users log in with their existing network credentials — no new username or password to remember. When a staff member leaves the firm, their access is revoked in Active Directory and it immediately propagates to the AI platform.

**Role-based access:** The MSP configures Open WebUI user groups that mirror the firm's org structure. An associate in the Litigation group sees the Litigation models and workspaces; a paralegal sees a curated set of tools appropriate to their role. Admins see a management console with usage metrics.

**User interface:** The Open WebUI interface is unchanged from lower tiers — a browser-based chat window. The only difference is that users see their organizational role reflected in which models and workspaces are available to them. The "Standard" vs. "Deep Analysis" model selection appears as a simple dropdown.

**Document uploads:** Department administrators (legal assistant leads, office managers) are trained to upload documents to AnythingLLM workspaces. The MSP provides a 30-minute training on the upload interface. Day-to-day document management is handled by the firm, not the MSP — keeping the workflow in familiar hands.

---

## What's NOT Included

- **The AI models themselves** — Llama-3.3-70B, Qwen2.5-72B, and all other open-weight models are open source and free. No per-token or per-user model licensing cost.
- **Fine-tuning or custom model training** — Tier L uses off-the-shelf open-weight models via RAG for document grounding. Custom fine-tuning on client data is a custom engagement, not included in the base service.
- **Microsoft 365 / SharePoint native integration** — Documents must be uploaded to AnythingLLM workspaces manually or via the MSP-configured ingest pipeline. Native SharePoint or OneDrive sync connectors are not included in the base tier.
- **On-site hardware support** — Hardware replacement is next-business-day advance swap. On-site hardware service visits are outside the monthly fee scope (available as add-on).
- **Unlimited storage** — PostgreSQL and document storage run on the Mac Studio's internal SSD (8TB max with external Thunderbolt storage). Document corpora exceeding 200GB require additional storage planning.
- **vLLM or advanced serving infrastructure** — Tier L uses LM Studio or llama.cpp. Production-grade distributed serving frameworks (vLLM, Ray Serve) are Tier XL features.
- **SIEM integration** — Audit logs from Open WebUI and Jamf are available but not integrated into a SIEM platform at this tier. SIEM export is a Tier XL add-on.

---

## Upgrade Path

Consider upgrading to Tier XL when any of the following apply:

- Multiple physical offices each need local inference (site-to-site architecture)
- 100+ concurrent users exceed what a two-node Mac Studio configuration can serve
- 405B-class model reasoning is required for the firm's highest-stakes work
- A dedicated named engineer and enterprise contractual SLA are required
- The firm is a government prime contractor requiring enterprise-grade AI governance documentation

See `tier-XL.md` for the enterprise tier.
