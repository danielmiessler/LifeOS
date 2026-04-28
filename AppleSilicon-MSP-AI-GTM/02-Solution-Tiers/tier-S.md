# Tier S — Solo/Micro
### Apple Silicon AI MSP | T-Shirt Size: Small

---

## At a Glance

| | |
|---|---|
| **Target customers** | Solo attorney, solo medical practitioner, 1–2 person accounting firm, small business owner handling CUI |
| **Active concurrent users** | 1–4 |
| **Primary hardware** | Mac Mini M4 Pro (24GB unified memory) |
| **Monthly MSP fee** | $299/month |
| **Setup fee** | $500 |
| **Deployment time** | 4–8 hours (remote) |
| **SLA response time** | 4 business hours |

---

## Who This Is For

Tier S is designed for the solo practitioner or micro-firm where one or two people need professional-grade AI without the overhead of a team deployment. The target profile is a regulated professional — attorney, physician, CPA, or government contractor — who handles sensitive client data and cannot use cloud AI services due to confidentiality rules, HIPAA requirements, state bar ethics opinions, or CMMC obligations.

This tier delivers AI capability comparable to GPT-4-class performance, running entirely on hardware that fits on a desk, managed remotely by the MSP. The customer never configures software, manages models, or troubleshoots infrastructure.

---

## Hardware Bill of Materials

| Item | Model | Price |
|---|---|---|
| Primary inference node | Mac Mini M4 Pro (24GB unified memory) | $1,399 |
| Power/connectivity accessories | Thunderbolt hub, ethernet adapter, UPS | ~$200 |
| **Total hardware** | | **~$1,600** |
| **MSP hardware price (20% margin)** | | **~$1,920** |

**Why 24GB?** The M4 Pro's unified memory architecture means 24GB is shared between CPU, GPU, and the Neural Engine — all accelerating inference simultaneously. A 14B parameter model in 4-bit quantization uses approximately 8–10GB, leaving ample headroom for the OS, Open WebUI, AnythingLLM, and concurrent document retrieval. Performance is approximately 30–50 tokens/second on 14B models — fast enough for real-time, conversational interaction.

---

## Software Stack

| Component | Software | Purpose |
|---|---|---|
| LLM inference | LM Studio (MLX backend) | Loads and serves language models, provides OpenAI-compatible API |
| Chat interface | Open WebUI | Browser-based user interface — no software installation required |
| Document AI / RAG | AnythingLLM | Ingest documents, ask questions, retrieve answers grounded in firm documents |
| Vector database | ChromaDB (embedded) | Stores document embeddings for retrieval; runs inside AnythingLLM |
| Device management | Mosyle Business | MDM enrollment, policy enforcement, remote management (~$4/device/month) |
| Device enrollment | Apple Business Manager | Free; enables zero-touch enrollment and corporate ownership |

**How it works end-to-end:** LM Studio runs silently in the background, serving the AI model via a local API. Open WebUI connects to that API and presents a chat interface accessible from any browser on the local network. AnythingLLM connects to the same API for document Q&A, storing embeddings in ChromaDB. Mosyle keeps the device enrolled, patched, and observable by the MSP.

---

## Recommended Models

| Purpose | Model | Notes |
|---|---|---|
| General assistant | Qwen2.5-14B-Instruct | Excellent instruction-following, legal and medical document fluency |
| Document Q&A | Qwen2.5-14B-Instruct (via AnythingLLM RAG) | Same model; RAG pipeline retrieves relevant document chunks |
| Code / structured output | Qwen2.5-Coder-14B | For contracts with structured clauses, data extraction, formatted output |

All models are open-weight and downloaded once during setup. No per-use cost. The MSP manages model updates as part of the monthly service.

---

## Pricing

| Item | Amount |
|---|---|
| Hardware (MSP-supplied) | ~$1,920 one-time |
| Setup / onboarding fee | $500 one-time |
| Monthly MSP service fee | $299/month |
| **Annual contract value** | **~$3,600 MRR + $2,420 one-time** |

The monthly fee covers: MDM management via Mosyle, proactive system monitoring, monthly model updates, remote support access, 4-hour SLA response during business hours, and quarterly check-in calls.

Customers who source their own hardware pay the setup fee and monthly service fee only.

---

## Use Case Examples

**1. Contract review — solo attorney**
A solo family law attorney uploads opposing counsel's draft settlement agreement to AnythingLLM. She asks: "What provisions favor the opposing party, and which are standard?" The AI retrieves the relevant clauses and produces a structured analysis. She uses it as a first-pass redline guide, saving 45–60 minutes of reading.

**2. SOAP note drafting — solo physician**
A concierge medicine physician speaks patient visit notes into a transcription tool, then pastes the transcript into Open WebUI. She prompts: "Convert this into a structured SOAP note for a 45-year-old with Type 2 diabetes presenting with fatigue." The AI produces a complete note she edits and signs — without the transcript leaving her local network.

**3. Client intake summarization — CPA**
A solo CPA receives a new client's prior-year tax documents as PDFs. He uploads them to AnythingLLM and asks: "Summarize income sources, identify any unusual deductions, and flag items that may require carryforward analysis." The AI produces a pre-engagement summary in under two minutes.

**4. CUI document drafting — small government contractor**
A two-person firm with a CMMC Level 2 obligation needs to draft a System Security Plan section. The owner prompts Open WebUI with the relevant NIST SP 800-171 control families and asks for draft policy language. The AI generates a first draft compliant with the framework — locally, with no data exposure.

**5. Email drafting — regulated professional**
A solo estate planning attorney needs to communicate a complex trust structure to a client in plain language. She pastes the trust document sections into Open WebUI and asks: "Explain this to a non-lawyer client in 3 paragraphs." The AI produces a client-ready summary she reviews and sends.

---

## Accessibility — How Non-Technical Staff Use This

Open WebUI is the customer-facing interface. It runs in any web browser on the local network — no app installation, no account creation with a cloud provider, no software to maintain. The user experience is nearly identical to ChatGPT.

**What a user sees:** A browser tab with a chat interface. They type a message, the AI responds. That's it.

**Document Q&A:** AnythingLLM has its own simple browser interface at a local address. The user uploads PDFs or Word documents through a drag-and-drop interface, then switches to a chat view to ask questions about those documents.

**MSP provides:** A one-page "getting started" guide, a 30-minute onboarding call, and ongoing support for any questions. No technical knowledge is required from the customer.

---

## What's NOT Included

- **The AI models themselves** — Qwen2.5-14B, Llama, and other open-weight models are open source and free to download. The MSP downloads and configures them during setup; no license cost is passed to the customer.
- **Microsoft 365 or Google Workspace integration** — Open WebUI and AnythingLLM do not directly integrate with email or calendar at this tier. Users copy-paste content.
- **Internet connectivity** — The MSP service does not include internet service. The customer's existing internet is used only for MDM management traffic and model updates (which are small and infrequent).
- **Cloud backup** — Local document files are the customer's responsibility to back up. The MSP can recommend Time Machine or a local NAS solution at additional cost.
- **Phone support outside SLA hours** — The 4-hour SLA applies during business hours. After-hours support is available as an add-on.
- **Multiple simultaneous models** — Tier S runs one model at a time. Switching between the general assistant and coding model takes approximately 30 seconds.

---

## Upgrade Path

When your Tier S deployment shows any of these signals, it's time to discuss Tier M:

- More than 3–4 people regularly trying to use AI at the same time
- Need for separate workspaces or user accounts for different team members
- Document corpus growing beyond 500 files with slower retrieval
- Adding a 32B model for higher-quality analysis (requires 48GB hardware)
- Joining a group practice or firm where shared AI history is valuable

See `tier-M.md` for the next tier.
