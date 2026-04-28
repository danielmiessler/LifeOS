# Solution Tiers Overview — Apple Silicon AI MSP

## Naming Convention

Tiers use T-shirt size labels: **S (Solo/Micro)**, **M (Team)**, **L (Department)**, **XL (Enterprise/Multi-Site)**. The tier a customer belongs to is determined primarily by **concurrent active users and document/model workload** — not raw headcount. A 30-person firm where only 8 attorneys use AI simultaneously is a Tier M customer, not Tier L.

---

## Comparison Matrix

| Dimension | Tier S — Solo/Micro | Tier M — Team | Tier L — Department | Tier XL — Enterprise |
|---|---|---|---|---|
| **Target org size** | 1–4 active users | 5–25 concurrent users | 25–100 users | 100+ users / multi-site |
| **Primary use cases** | Document drafting, Q&A, summarization | Team chat, multi-workspace RAG, shared history | Full-dept AI, SSO, load-balanced inference | Enterprise-wide AI, hub-and-spoke multi-site |
| **Primary hardware** | Mac Mini M4 Pro 24GB | Mac Mini M4 Pro 48GB | Mac Studio M4 Max 64GB | Mac Studio M4 Ultra 192GB or cluster |
| **Hardware MSRP** | $1,399 | $1,799 | $2,399 | $4,999–$7,200+ |
| **MSP hardware price** | ~$1,920 | ~$2,520 | ~$3,240 | Custom (20–25% margin) |
| **Primary LLM** | Qwen2.5-14B-Instruct | Qwen2.5-32B-Instruct | Llama-3.3-70B / Qwen2.5-72B | 405B models or concurrent 70B |
| **RAG platform** | AnythingLLM + ChromaDB | AnythingLLM + LanceDB | AnythingLLM + PostgreSQL/pgvector | AnythingLLM + PostgreSQL (external) |
| **MDM** | Mosyle Business | Mosyle or Jamf Pro | Jamf Pro | Jamf Pro (enterprise, multi-site) |
| **SLA response time** | 4 hours | 2 hours | 1 hour (critical) | Dedicated engineer |
| **Setup fee** | $500 | $1,500 | $3,500 | $7,500–$15,000 |
| **Monthly MSP fee** | $299/month | $599/month | $1,299/month | $2,499–$4,999/month |
| **Annual contract value** | ~$3,600 MRR | ~$7,200 MRR | ~$15,600 MRR | $30,000–$60,000+ |
| **Deployment time** | 4–8 hours | 1–2 days | 2–4 days | 1–3 weeks |
| **High availability** | Single node | Single node + optional second | Primary + standby with Nginx failover | Clustered / hub-and-spoke |

---

## Tier Sizing Logic

### What drives tier selection

**Concurrent users** is the primary variable. A single inference node has a finite request queue — too many simultaneous requests causes latency that degrades the user experience from "ChatGPT-like" to "broken."

| Model size | 24GB node | 48GB node | 64GB node | 192GB node |
|---|---|---|---|---|
| 7B–14B models | 8–12 concurrent | 10–15 concurrent | 12–18 concurrent | 30+ concurrent |
| 32B models | Not supported | 2–5 concurrent | 5–8 concurrent | 15+ concurrent |
| 70B models | Not supported | 1 (full memory) | 2–4 concurrent | 8–12 concurrent |
| 405B models | Not supported | Not supported | Not supported | 1–2 concurrent |

**Document workload** is the secondary variable. Heavy RAG usage (ingesting hundreds of documents, running frequent retrieval queries) increases I/O and memory pressure. A small team running intensive document review pipelines may need Tier M hardware even if only 3–5 people are active.

**Model quality requirements** also drive tier selection. If a customer's use case requires state-of-the-art reasoning (complex legal analysis, medical differential diagnosis support, CMMC documentation generation), they need 32B or 70B models — which requires Tier M or above hardware.

---

## Upgrade Path Narrative

### S → M: When to move up

A Tier S customer should consider upgrading to Tier M when any of the following are true:

- **Concurrent users exceed 3–4** and response times feel sluggish
- **Team collaboration is needed** — multiple people need shared conversation history, separate workspaces, or user accounts
- **Document corpus grows beyond ~500 documents** in AnythingLLM and retrieval quality degrades
- **The firm adds staff** and the 24GB node can no longer hold the primary model in memory with headroom for requests
- **Regulatory needs grow** — a solo attorney joins a group practice or adds CUI-handling work that benefits from stronger (32B) model reasoning

Typical trigger: firm grows from 1–2 to 5+ active AI users, or adds a paralegal/associate who needs their own workspace.

### M → L: When to move up

A Tier M customer should upgrade to Tier L when:

- **Sustained concurrent load exceeds 10–12 users** at 32B model quality
- **SSO / Active Directory integration** is required (IT department mandates it)
- **High availability is non-negotiable** — a single node is a single point of failure; Tier L adds a standby node
- **70B model quality is required** at multi-user concurrency (Tier M can run 70B but only for single users at a time)
- **The firm has a dedicated IT function** and wants enterprise MDM, reporting, and monthly service reviews

Typical trigger: firm grows to 30+ attorneys, regional medical group adds a second clinic, or a defense contractor expands a contract requiring stronger AI reasoning.

### L → XL: When to move up

A Tier L customer should upgrade to Tier XL when:

- **Multiple physical sites** need local inference — Tier XL provides a hub-and-spoke architecture with edge nodes at satellite offices
- **405B-class model reasoning is required** for the highest-stakes tasks (expert-level analysis)
- **100+ concurrent users** exceed what a single Mac Studio node can serve, even with a standby
- **A dedicated SLA with a named engineer** is required — Tier XL includes dedicated engineering support and annual on-site visits

Typical trigger: law firm opens a second office, health system expands to regional facilities, or a prime contractor wins a large CMMC program requiring enterprise-wide AI governance.

---

## Key Principles

1. **All AI runs 100% on-premises.** No data leaves the customer's network at any tier. This is the core compliance guarantee.

2. **Open WebUI is the standard user interface at every tier.** Non-technical staff use a browser-based interface that looks and feels like ChatGPT — no software installation, no training required.

3. **Models are open source and free.** Qwen2.5, Llama-3.3, and other open-weight models are downloaded once and run locally. No per-token API costs at any tier.

4. **The MSP fee covers management, not compute.** Monthly fees pay for MDM, monitoring, model updates, patching, and support. The hardware is a one-time cost (sold by MSP at margin or customer-procured).

5. **Tiers are modular.** A Tier M customer can add a second Mac Mini M4 Pro node to double throughput without moving to Tier L — the MSP configures load balancing. Tier L and XL customers can similarly scale horizontally.
