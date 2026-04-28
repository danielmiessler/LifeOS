# Tier XL — Enterprise / Multi-Site
### Apple Silicon AI MSP | T-Shirt Size: Extra Large

---

## At a Glance

| | |
|---|---|
| **Target customers** | Large law firm, health system, regional accounting group, prime contractor with distributed teams |
| **Active concurrent users** | 100+ / multi-site |
| **Primary hardware** | Mac Studio M4 Ultra (192GB) or Mac Studio M4 Max cluster (3x 64GB) |
| **Monthly MSP fee** | $2,499–$4,999/month |
| **Setup fee** | $7,500–$15,000 |
| **Deployment time** | 1–3 weeks |
| **SLA response time** | Dedicated engineer; contractual uptime SLA |

---

## Who This Is For

Tier XL is for organizations where AI has become critical infrastructure — not a productivity tool, but a core operational system that must be available, auditable, and governed like any other enterprise platform. The typical customer is a large law firm with 100+ attorneys across multiple offices, a regional health system with hospital and clinic sites, a national accounting firm's regional practice, or a prime government contractor running distributed teams across secure facilities.

The defining characteristics of a Tier XL customer are: multiple physical locations each requiring local AI (no cross-site data transfer), 100+ concurrent users on a single site or combined, a requirement for 405B-class reasoning or simultaneous multi-70B-model serving, and an organizational expectation of a named MSP engineer, contractual SLAs, and formal governance documentation.

This tier is also the entry point for customers whose compliance posture requires not just on-premises inference, but air-gapped or network-isolated inference with full audit trail support.

---

## Hardware Bill of Materials

### Option A — M4 Ultra (Recommended for single-site 100+ users)

| Item | Model | Price |
|---|---|---|
| Primary inference node | Mac Studio M4 Ultra (192GB unified memory) | $4,999 |
| Accessories | Thunderbolt storage, rack shelf, UPS | ~$500 |
| **Option A total** | | **~$5,500** |
| **MSP hardware price (20–25% margin)** | | **~$6,600–$6,875** |

**M4 Ultra performance:** The M4 Ultra runs Llama-3.3-405B (if a quantized version is available) or multiple 70B models simultaneously in different memory partitions. Two 70B models can run concurrently with full context windows, effectively doubling the firm's high-quality inference throughput from a single machine. For organizations not yet needing 405B, the Ultra runs Llama-3.3-70B at 8–12 concurrent requests — more than any comparable single-node solution.

### Option B — Mac Studio M4 Max Cluster (Recommended for redundancy + load distribution)

| Item | Model | Price |
|---|---|---|
| Node 1 — Primary | Mac Studio M4 Max (64GB) | $2,399 |
| Node 2 — Secondary | Mac Studio M4 Max (64GB) | $2,399 |
| Node 3 — Tertiary / standby | Mac Studio M4 Max (64GB) | $2,399 |
| Networking | Managed switch, 10GbE NICs, rack | ~$800 |
| **Option B total** | | **~$8,000** |
| **MSP hardware price** | | **~$9,600–$10,000** |

**Cluster advantage:** Three nodes provide N+1 redundancy — one node can fail and the cluster continues serving at full capacity. The cluster also allows model specialization: one node serves 70B models, one serves fast 14B models for high-volume requests, and one is warm standby. HAProxy distributes load across all healthy nodes.

### Multi-Site Hardware

For hub-and-spoke deployments, each satellite office runs a Tier S or Tier M node (see those tier files for hardware). The Tier XL node serves as the HQ hub for organizational administration, policy management, and the highest-capability inference — but satellite offices do all inference locally on their own hardware.

---

## Software Stack

| Component | Software | Purpose |
|---|---|---|
| LLM inference | llama.cpp server (primary) | Precise concurrency slot control, KV cache management, batch size tuning |
| Inference (alternative) | vLLM (where Apple Silicon support is available) | Higher throughput for very high concurrency; evaluate per deployment |
| Chat interface | Open WebUI (enterprise) | Multi-tenant, SSO, full audit logging, API key management |
| Document AI / RAG | AnythingLLM with external PostgreSQL | Production-grade RAG with centralized vector storage |
| Vector database | PostgreSQL + pgvector (dedicated server) | Dedicated database server (Mac Mini M4, 16GB) separate from inference nodes |
| Load balancing | HAProxy or Nginx Plus | Advanced health-check routing, sticky sessions, weighted distribution |
| Monitoring | Prometheus + Grafana (self-hosted) | Real-time inference metrics, request latency, queue depth, hardware telemetry |
| Device management | Jamf Pro (enterprise, multi-site) | Multi-site MDM; compliance reporting; configuration profiles per site |
| Device enrollment | Apple Business Manager (multi-site) | Site-specific enrollment groups; automated provisioning |
| VPN (multi-site) | WireGuard (site-to-site) | Encrypted tunnels between HQ and satellite offices; inference traffic stays local |
| Secrets management | (Customer's existing system or Vault) | API keys, model credentials, admin credentials managed via customer's enterprise standard |

**llama.cpp server at this tier:** The concurrency control in llama.cpp allows the MSP to set explicit slot limits per model — ensuring that a surge in 70B requests doesn't queue-block fast-path 14B requests. This kind of QoS control is not available in LM Studio's server mode and becomes important at 100+ concurrent users.

**Prometheus + Grafana:** Tier XL customers get a self-hosted monitoring stack. A dedicated Grafana dashboard shows: tokens/second per model, active request count, queue depth, GPU/CPU/memory utilization per node, and request latency percentiles (p50, p95, p99). Alerts are configured for queue depth thresholds, node health, and disk usage.

---

## Multi-Site Architecture

Tier XL introduces the hub-and-spoke network model for organizations with multiple physical locations.

```
[HQ — Tier XL Inference Cluster]
        |           |           |
  WireGuard VPN tunnels (site-to-site)
        |           |           |
[Office A      [Office B      [Office C
 Tier S/M       Tier M         Tier S
 local node]    local node]    local node]
```

**Key principle: inference is always local.** Each satellite office's AI system processes requests on its own hardware. The WireGuard VPN is used for: MDM management traffic (Jamf → satellite nodes), model update distribution (new model files distributed from HQ), and administrative access (MSP remote support). Patient records, legal documents, and CUI never traverse the VPN for inference purposes.

**Model distribution:** When the MSP pushes a model update (e.g., a new Qwen2.5-32B revision), the update is distributed to satellite nodes automatically over the VPN during off-hours. Each satellite node receives and validates the model file before the old version is swapped out.

**Centralized governance, local execution:** Jamf Pro manages all nodes from a single pane of glass. Open WebUI admin configuration is synchronized across sites. AnythingLLM workspaces at each site are isolated — the regional accountant's documents in Office A are not accessible from Office B.

---

## Recommended Models

| Purpose | Model | Ultra performance | Cluster (per node) |
|---|---|---|---|
| Highest reasoning | Llama-3.3-405B (quantized) | ~10–15 tok/sec | Not supported per node |
| Premium general | Llama-3.3-70B | 8–12 concurrent | 2–4 concurrent |
| High-quality standard | Qwen2.5-72B | 6–10 concurrent | 2–3 concurrent |
| Fast / high-volume | Qwen2.5-14B | 30+ concurrent | 12–18 concurrent per node |
| Embeddings | nomic-embed-text-v2 | Dedicated sidecar | Dedicated sidecar |

**Model governance:** At Tier XL, the MSP maintains a model registry — a documented list of approved models, their versions, quantization levels, and approval dates. New models are tested in a staging configuration before deployment. The model registry is provided to the customer as part of quarterly governance reporting.

---

## Pricing

| Item | Amount |
|---|---|
| Hardware — Option A Ultra (MSP-supplied) | ~$6,600–$6,875 one-time |
| Hardware — Option B 3-node cluster (MSP-supplied) | ~$9,600–$10,000 one-time |
| Setup fee | $7,500–$15,000 one-time |
| Monthly MSP service fee | $2,499–$4,999/month |
| **Annual contract value** | **$30,000–$60,000+ MRR** |

**Fee range drivers:** The $2,499/month floor covers a single-site Tier XL with one inference cluster, Jamf Pro enterprise MDM, 24/7 monitoring, 1-hour critical SLA, and monthly governance reports. The $4,999/month ceiling covers multi-site deployments with 3+ satellite offices, dedicated named engineer, on-site quarterly visits, full Prometheus/Grafana management, and a contractual uptime guarantee.

The setup fee range ($7,500–$15,000) reflects deployment scope:
- $7,500: Single-site, single cluster, standard SSO integration
- $15,000: Multi-site (3+ locations), WireGuard VPN deployment, HAProxy cluster configuration, Prometheus/Grafana setup, Jamf Pro multi-site enrollment, full staff training program, and governance documentation package (AI policy template, model registry, data handling procedures)

---

## Use Case Examples

**1. Multi-office law firm — AI infrastructure deployment**
A 120-attorney firm with offices in three cities deploys Tier XL at HQ and Tier M nodes at each satellite office. HQ attorneys access the M4 Ultra cluster serving Llama-3.3-70B at 8–12 concurrent requests. Satellite offices run Qwen2.5-32B on their local Mac Mini M4 Pro 48GB nodes. Matter documents are uploaded to site-specific AnythingLLM workspaces. The HQ Grafana dashboard shows the MSP real-time utilization across all nodes. Monthly governance reports are delivered to the firm's General Counsel and IT Director.

**2. Regional health system — distributed clinical AI**
A regional health system with a main hospital and 6 clinic sites deploys a hub-and-spoke architecture. Each clinic runs a Tier S node for clinical documentation assistance. The hospital runs a Tier XL M4 Ultra for administrative, compliance, and population health analytics work. HIPAA-protected data is processed locally at each site — no PHI is transmitted over the VPN. The compliance team receives a monthly audit log summary from Jamf Pro and Open WebUI.

**3. Prime contractor — CMMC program AI**
A defense prime contractor with CMMC Level 3 obligations and 200 personnel across 4 secure facilities deploys Tier XL at their primary facility and Tier M nodes at three program sites. The M4 Ultra serves the highest-stakes work: CDRL drafting, RFP response generation, system engineering document synthesis, and CMMC evidence package assembly. Program security officers have a dedicated workspace with ingested ITAR-controlled documents. No AI inference uses cloud infrastructure at any stage.

**4. National accounting firm regional practice — audit season scale**
A regional practice with 180 professionals across 5 office locations deploys Tier XL for the tax and audit season. The three-node Mac Studio cluster handles burst demand during January–April, with HAProxy distributing load across nodes. Each client engagement has an isolated AnythingLLM workspace. Workpaper generation, footnote drafting, technical accounting research, and management letter preparation are all handled by the AI platform. Post-season, two nodes are put into low-power standby mode — the cluster scales down without hardware changes.

**5. Government consulting firm — classified-adjacent AI infrastructure**
A government consulting firm supporting multiple federal agencies deploys an air-gapped Tier XL cluster for work on sensitive (but unclassified) government programs. The cluster has no internet connectivity whatsoever — models are distributed via encrypted USB drive during setup and updates, per the firm's security policy. Prometheus/Grafana monitoring is entirely internal. Open WebUI has no external API connectivity. All inference happens inside the firm's physically secured server room.

---

## Accessibility — How Non-Technical Staff Use This

**Enterprise SSO:** At Tier XL, Open WebUI integrates with the organization's enterprise identity provider — Active Directory, Azure AD/Entra, Okta, or LDAP. Users log in with their existing enterprise credentials. Multi-factor authentication is supported. Role-based access control is configured to mirror the organization's existing security groups.

**Model selection UX:** Despite the complexity of the underlying cluster, the user-facing experience remains simple. Open WebUI presents users with a curated model menu based on their role: a junior associate may see "Standard" and "Research" options; a senior partner sees those plus "Expert Analysis" (the 70B or 405B endpoint). The infrastructure complexity is entirely invisible.

**Administrative console:** IT administrators and MSP-designated contacts access a Grafana dashboard showing system health, a Jamf Pro console for device management, and an Open WebUI admin panel for user and workspace management. The firm's IT team can manage day-to-day user access; the MSP handles infrastructure.

**Training:** The MSP provides a formal training program at Tier XL: a 2-hour live workshop for end users, a separate 3-hour administrator training session, and written runbooks for common operational tasks. Training can be delivered on-site or via video conference.

---

## What's NOT Included

- **The AI models themselves** — All open-weight models (Llama-3.3-405B, Llama-3.3-70B, Qwen2.5-72B, etc.) are open source and free. No per-token or per-seat model licensing cost at any scale.
- **Custom model fine-tuning** — Tier XL includes RAG-based document grounding, not supervised fine-tuning on customer data. Fine-tuning is a separate custom engagement requiring additional hardware (M4 Ultra for LoRA fine-tuning) and is priced separately.
- **Classified system integration** — Tier XL supports sensitive-but-unclassified and CUI workloads. Integration with classified systems (SIPRNet, JWICS, etc.) is outside scope and requires a separate assessment.
- **Software development / API integration** — The MSP configures the AI platform as a service. Custom application development (integrating the AI API into the customer's proprietary software) is a professional services engagement billed separately.
- **Hardware warranty beyond Apple standard** — Apple's standard 1-year limited warranty applies to all hardware. AppleCare+ is recommended and can be procured by the MSP at cost. Hardware replacement on failure is advance-swap next business day; the MSP maintains a spare node for XL customers on annual contract.
- **Internet access or cloud services** — The AI platform is 100% on-premises and designed to operate without internet connectivity (after initial model download). Internet access for the facility is the customer's responsibility.
- **Data destruction certification** — At end of contract, the MSP will perform a secure erase of all customer data on MSP-managed hardware. A data destruction certificate is available for an additional fee.

---

## Why Not Cloud AI?

The question every Tier XL customer asks — and should ask.

A comparable cloud AI deployment (GPT-4o via Azure OpenAI, Claude API via Amazon Bedrock) would cost $10–$50+ per million tokens, with usage-based billing that scales directly with adoption. At 100+ active users generating thousands of interactions per day, cloud AI costs can reach $5,000–$20,000/month or more — and every token of client data is transmitted to a third-party cloud provider.

Tier XL costs $2,499–$4,999/month (fixed, regardless of usage) with zero data egress. For regulated industries, this isn't just a cost calculation — it's a compliance calculation. The law firm's client confidences, the health system's PHI, the contractor's CUI: none of it leaves the building.

The MSP's value is converting the complexity of enterprise AI infrastructure into a managed, predictable monthly service.
