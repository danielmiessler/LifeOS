# Apple Silicon AI Software Stack
### MSP Reference Architecture for Regulated SMBs

---

## Section 1: Architecture Overview

The MSP AI stack is organized into four functional layers. Each layer has a single, well-defined responsibility. Layers communicate through open, standardized interfaces — specifically the OpenAI-compatible REST API, which has become the de facto standard for local AI infrastructure.

### The Four Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER ACCESS LAYER                            │
│   Web Browser (any device on local network)                     │
│   → Open WebUI  (https://ai.internal / port 3000)              │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP / OpenAI API
┌─────────────────────────▼───────────────────────────────────────┐
│                  APPLICATION LAYER                               │
│   AnythingLLM  (document intelligence, RAG, workspaces)         │
│   → manages document ingestion, vector search, chat context     │
└──────────────┬──────────────────────────┬───────────────────────┘
               │ OpenAI API               │ Vector store API
               │ (port 1234)              │
┌──────────────▼───────────────┐  ┌───────▼───────────────────────┐
│      INFERENCE LAYER         │  │       DATA LAYER               │
│  LM Studio (model server)    │  │  ChromaDB / LanceDB / pgvector │
│  MLX backend (Apple GPU)     │  │  (embeddings + document store) │
│  → loads + serves LLMs       │  │  Embedding model (local)       │
└──────────────────────────────┘  └───────────────────────────────┘
                          ▲
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                  MANAGEMENT LAYER                                │
│   Mosyle Business / Jamf Pro + Apple Business Manager (ABM)     │
│   → MDM enrollment, config profiles, software deployment,       │
│     OS updates, security compliance reporting                    │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: User Query with Document RAG

```
User types question in browser (Open WebUI)
    │
    ▼
AnythingLLM receives query
    │
    ├─► Embedding model converts query to vector
    │       │
    │       ▼
    │   ChromaDB searches for similar document chunks
    │       │
    │       ▼
    │   Returns top N relevant passages
    │
    ▼
AnythingLLM constructs prompt:
  [System prompt] + [Retrieved document chunks] + [User question]
    │
    ▼
LM Studio receives prompt via OpenAI API (port 1234)
    │
    ▼
MLX framework executes inference on Apple Silicon GPU
    │
    ▼
Response streams back through AnythingLLM → Open WebUI → User browser

NOTE: At no point in this pipeline does any data leave the local network.
```

### Interface Standards

Every inter-layer communication in this stack uses the **OpenAI-compatible REST API** (POST `/v1/chat/completions`, GET `/v1/models`). This is deliberate. It means:

- Any future inference backend that supports this API can replace LM Studio without changing the application layer
- AnythingLLM and Open WebUI are not locked to any specific inference engine
- Custom integrations (practice management systems, document management systems) can connect using standard OpenAI client libraries already familiar to developers

---

## Section 2: LLM Inference — MLX + LM Studio

### MLX: Apple's Native AI Framework

MLX is an open-source machine learning framework developed by Apple's machine learning research team, released in late 2023. It is designed from the ground up for Apple Silicon's unified memory architecture.

**Key technical characteristics:**

- **Native Metal GPU acceleration**: MLX uses Apple's Metal compute shaders directly, without CUDA translation layers or cross-platform abstraction overhead
- **Lazy evaluation**: MLX only materializes computations when results are actually needed, reducing unnecessary memory operations
- **Unified memory awareness**: MLX treats the CPU and GPU as sharing the same memory, enabling zero-copy operations that would require explicit PCIe transfers on discrete GPU hardware
- **Python + Swift bindings**: MLX provides both Python and Swift interfaces, with the Python interface being primary for inference tooling

**Performance vs. alternatives:**

| Framework | Inference Speed (relative) | Apple Silicon Optimization |
|-----------|---------------------------|---------------------------|
| MLX | Baseline (fastest) | Native — purpose-built |
| llama.cpp (Metal) | 70-80% of MLX | Good — manually optimized Metal kernels |
| Transformers (PyTorch/MPS) | 40-60% of MLX | Partial — MPS backend has gaps |
| llama.cpp (CPU only) | 20-30% of MLX | None |

MLX is 30-50% faster than llama.cpp for inference on Apple Silicon for the model families used in this stack (Llama, Qwen, Mistral). This directly translates to higher concurrent user capacity from the same hardware.

### LM Studio: The Production-Ready Interface

LM Studio is a cross-platform desktop application that provides:

1. **Model library browser**: discover, download, and manage models from Hugging Face directly from a GUI
2. **MLX backend**: on Apple Silicon, LM Studio uses MLX as its primary inference backend (llama.cpp as fallback for models without MLX versions)
3. **Local API server**: starts an OpenAI-compatible REST API on `localhost:1234` — the same interface as the OpenAI API, accessible to any OpenAI-compatible client on the network
4. **Chat interface**: built-in chat UI for testing models and configuring system prompts before exposing to users
5. **Model parameter control**: temperature, context length, top-p, and other inference parameters configurable per model

**MSP Deployment Configuration:**

LM Studio is configured to run as a background service on the inference Mac, starting automatically on boot:

1. Set "Start server on app launch" in LM Studio preferences
2. Configure "Start minimized to menu bar" for unattended operation
3. Set server to listen on `0.0.0.0` (all interfaces) rather than `127.0.0.1` (localhost only) to allow network clients to connect
4. Configure macOS Login Items to launch LM Studio at startup
5. Set "Keep model loaded" to prevent model eviction between requests during business hours

> **Security Note:** The LM Studio API server has no built-in authentication. Network-level access control is mandatory — the inference Mac should only be reachable from trusted internal VLAN segments. Do not expose port 1234 to the internet or untrusted network segments under any circumstances.

### Why Not OpenClaw / Ollama

Per MSP design decision, this stack uses MLX + LM Studio rather than OpenClaw (treated in this document as a reference to Ollama or equivalent container-based inference tools).

The MLX + LM Studio combination provides equivalent or superior functionality with the following advantages on Apple Silicon:

- Native MLX backend delivers 30-50% better inference performance than llama.cpp-based alternatives
- LM Studio's GUI provides a better onboarding experience for MSP staff and reduces support burden
- The combination requires no containerization, reducing system complexity for SMB deployments
- LM Studio's model management interface simplifies model updates and rollbacks

---

## Section 3: RAG and Document Intelligence — AnythingLLM

### What AnythingLLM Does

AnythingLLM is an open-source, self-hosted document intelligence platform that transforms static documents into queryable AI knowledge bases. It is the component that makes "ask the AI about your documents" actually work reliably and securely.

Core capabilities:

- **Document ingestion**: PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), plain text, Markdown, web URLs, YouTube transcripts
- **Chunking and embedding**: automatically splits documents into semantically meaningful chunks, embeds each chunk as a vector using a local embedding model
- **Workspace isolation**: each workspace maintains its own document library and vector store — a medical group can have a separate workspace for clinical protocols vs. billing documentation, with no cross-contamination
- **OpenAI-compatible backend**: AnythingLLM connects to LM Studio's API on port 1234, making it model-agnostic
- **Multi-user support**: user accounts with per-workspace permissions, conversation history, and admin controls

### Workspaces: The Compliance-Critical Feature

> **Compliance Design Principle:** Documents in one workspace are invisible to queries in another workspace. A personal injury matter workspace cannot surface documents from a corporate litigation workspace, even if both are on the same AnythingLLM instance. This is enforced at the vector store query level, not just at the UI level.

For regulated industries, workspace design is a first-order architectural decision:

**Law firms:** one workspace per practice area (litigation, corporate, real estate, family law), or one workspace per active matter for high-sensitivity cases

**Medical practices:** one workspace per clinical protocol library, separate workspace for payer policies, separate workspace for billing/coding references — never mix clinical and administrative content in the same workspace

**Accounting firms:** one workspace per engagement type (tax, audit, advisory), client-specific workspaces for ongoing engagements with sensitive financial data

**CMMC contractors:** workspaces segregated by CUI classification level; operational security procedures workspace separate from general HR/admin content

### Vector Store Configuration by Tier

| Tier | Recommended Vector Store | Configuration |
|------|-------------------------|---------------|
| Tier S (1-10 users) | Embedded ChromaDB | Default AnythingLLM config, no additional setup |
| Tier M (10-25 users) | Embedded ChromaDB | Sufficient; monitor performance |
| Tier L (25-100 users) | External LanceDB | Separate process, better concurrent query performance |
| Tier XL (100+ users) | pgvector (PostgreSQL) | Full ACID compliance, backup integration, enterprise ops |

### Embedding Models

Document embedding uses a separate, smaller model than the main LLM — its only job is converting text to numerical vectors for similarity search. Embeddings run locally via LM Studio.

**Recommended embedding models:**
- **nomic-embed-text-v2**: 137M parameter model, extremely fast, good multilingual support. Recommended for Tiers S/M.
- **mxbai-embed-large**: 335M parameter model, higher-quality embeddings for complex technical documents. Recommended for Tiers L/XL with medical or legal content.

Embedding models consume minimal compute and memory (2-4GB) and can run simultaneously with the main LLM on the same inference Mac without meaningful performance impact.

### The Document Pipeline in Detail

```
1. User uploads document to AnythingLLM workspace
   (PDF, Word, Excel — via web UI or folder watch)
        │
        ▼
2. AnythingLLM preprocesses document
   (OCR if scanned PDF, text extraction, metadata capture)
        │
        ▼
3. Document split into chunks
   (default: 1,000 tokens per chunk, 200-token overlap)
        │
        ▼
4. Each chunk sent to embedding model via LM Studio API
   (nomic-embed-text or mxbai-embed-large)
        │
        ▼
5. Embedding vectors stored in ChromaDB/LanceDB
   (alongside original chunk text and document metadata)
        │
        ▼
6. User submits query in AnythingLLM chat
        │
        ▼
7. Query embedded using same embedding model
        │
        ▼
8. Vector similarity search finds top-K relevant chunks
   (typically top 5-10 chunks, configurable per workspace)
        │
        ▼
9. Retrieved chunks + user query assembled into LLM prompt
        │
        ▼
10. Prompt sent to LM Studio (main LLM) for answer generation
        │
        ▼
11. Response returned to user with source citations
    (AnythingLLM shows which document/page each fact came from)

DATA SOVEREIGNTY: Steps 1-11 execute entirely on-premises.
No document content, query text, or response content leaves the network.
```

### Deployment Notes

AnythingLLM is deployed as a Docker container on the inference Mac (one of the few cases where Docker is appropriate — AnythingLLM's own packaging uses it, and at this layer the performance overhead is negligible since compute-intensive work happens in LM Studio via MLX).

Alternatively, AnythingLLM Desktop provides a native macOS application that avoids Docker entirely — recommended for Tier S/M deployments where simplicity is preferred over operational flexibility.

---

## Section 4: Chat Interface — Open WebUI

### What Open WebUI Provides

Open WebUI is a self-hosted web application that provides a polished, ChatGPT-like interface for staff to interact with local AI models. It connects to LM Studio's OpenAI-compatible API and adds multi-user management, conversation history, and administrative controls.

The key value proposition: **staff access AI through a web browser on any device — no software installation required on user devices.** A paralegal on a Windows laptop, an attorney on an iPhone, and an admin on a shared iMac all get identical access through the browser.

### Access and Network Configuration

Open WebUI runs on the inference Mac (or a dedicated Mac on the same network segment) on port 3000. Staff access it at `http://ai.internal` or `http://[inference-mac-ip]:3000`.

**DNS recommendation:** Configure an internal DNS record (e.g., `ai.yourfirmname.internal`) pointing to the inference Mac's static IP. This avoids IP address dependency and provides a professional user experience. Most MSP-managed routers support local DNS records; alternatively, add the record to a Pi-hole or Unbound instance running on the network.

### User-Facing Features

- **Conversation interface**: identical UX to ChatGPT — messages, streaming responses, conversation history
- **Conversation history**: each user's conversations are saved locally; users can browse, search, and resume previous sessions
- **Model switching**: if multiple models are loaded in LM Studio, users can switch between them from a dropdown
- **Image input**: supports vision-capable models for document scanning, whiteboard photos, medical imaging (where appropriate and compliant)
- **System prompt customization**: users can set personal system prompts (e.g., "You are a legal research assistant. Always cite your sources.")
- **File upload**: document upload directly in chat (processed via the configured RAG pipeline)
- **Markdown rendering**: responses with formatted lists, tables, and code blocks render cleanly

### Administrative Controls

The Open WebUI admin panel provides:

| Control | Capability |
|---------|-----------|
| User management | Create accounts, assign roles (admin/user), disable access |
| Default model | Set the model all users see on first load |
| System prompt locking | Enforce an organization-wide system prompt users cannot override |
| Usage limits | Cap daily message counts per user or user group |
| Community sharing | Disable — should always be disabled for regulated deployments |
| Conversation sharing | Control whether users can share conversations with colleagues |
| Web search | Enable/disable access to web search (disabled by default for data sovereignty) |

> **HIPAA / CMMC Configuration Requirement:** Disable all external data transmission features in Open WebUI admin settings: web search, image generation via external APIs, and any telemetry or analytics. Verify these are disabled in the initial deployment checklist before go-live.

### Data Storage

Open WebUI stores conversation history in a local SQLite database (default) or PostgreSQL (recommended for Tier L/XL). Both options store data exclusively on the inference Mac — no conversation data is transmitted externally.

**Backup requirement:** Include the Open WebUI database directory in the scheduled backup configuration managed via MDM. Conversation history represents potentially privileged or sensitive content; loss of this data may have regulatory implications in some jurisdictions.

---

## Section 5: MDM and Remote Management — Mosyle / Jamf + ABM

### Apple Business Manager (ABM): The Foundation

Apple Business Manager is a free, web-based portal from Apple for organizations. It is the prerequisite for everything else in this section.

ABM provides three critical capabilities for MSP operations:

1. **Device enrollment**: when a new Mac is powered on for the first time, it checks ABM and automatically enrolls in the organization's MDM — no manual configuration, no imaging, no technician on-site. The device arrives at the customer's office, powers on, and within 15 minutes has all required software, security configurations, and AI infrastructure deployed.

2. **Managed Apple IDs**: organizational Apple IDs that the MSP and customer IT can manage and reset, separate from personal Apple IDs

3. **Volume purchasing and app licensing**: deploy App Store apps silently without requiring end-user Apple IDs

**ABM enrollment requirement:** All customer hardware must be purchased through an Apple Authorized Reseller with ABM enrollment enabled, or through Apple Direct with ABM enrollment. Consumer-channel Macs (purchased at Best Buy or from an individual) cannot be enrolled in ABM without wiping and re-provisioning the device.

### Mosyle Business — Recommended for Tier S/M

Mosyle Business is an Apple-native MDM platform purpose-built for organizations deploying Apple hardware.

**Pricing:** Approximately $4/device/month (Mosyle Business plan as of 2025; verify current pricing)

**MSP-relevant capabilities:**

| Capability | How MSP Uses It |
|-----------|----------------|
| Configuration profiles | Deploy network settings, VPN config, certificate trust, FileVault encryption keys |
| Software deployment | Push LM Studio, AnythingLLM Desktop, Open WebUI, monitoring agents silently |
| OS update management | Stage macOS updates, enforce minimum OS versions, schedule update windows |
| Patch management | Monitor and enforce application version compliance |
| Compliance reporting | Generate HIPAA/CMMC-relevant security posture reports |
| Remote wipe | Wipe and re-enroll lost or stolen inference nodes immediately |
| Screen lock enforcement | Require password after idle timeout; enforce FileVault |
| Firewall policy | Push macOS Application Firewall settings to block unauthorized inbound connections |

**MSP Business Model Note:** At $4/device/month, Mosyle cost for a 3-device deployment (one inference Mac, one backup node, one management Mac) is $12/month — a trivially small component of the monthly managed services fee.

### Jamf Pro — Recommended for Tier L/XL

Jamf Pro is the enterprise standard for Apple MDM, appropriate for larger deployments or customers who have existing Jamf relationships.

**Pricing:** Approximately $15/device/year+ (Jamf Pro; verify current pricing — Jamf pricing has multiple tiers)

**Additional capabilities over Mosyle:**

- **Smart Groups**: dynamic device groupings based on attributes (hardware model, OS version, installed software) enabling sophisticated deployment targeting
- **Policies and Scripts**: more granular automation — run shell scripts on remote devices, enforce configuration drift correction automatically
- **Jamf Connect**: SSO integration with identity providers (Okta, Azure AD, Google Workspace) for unified login
- **Reporting and auditing**: enterprise-grade audit logs appropriate for formal compliance programs (SOC 2, HIPAA, CMMC)
- **Patch Management Pro**: automated third-party application patching beyond what Mosyle covers

**Recommendation matrix:**
- Tier S/M with no existing MDM: Mosyle Business
- Tier L/XL or customer with existing Jamf relationship: Jamf Pro
- Customer with CMMC Level 2+ requirements: Jamf Pro (audit trail depth)

### What the MSP Manages Remotely

A complete list of what the MSP handles via MDM without requiring on-site visits:

**Security:**
- FileVault disk encryption enforcement and recovery key escrow
- macOS Application Firewall configuration
- Login security policies (password complexity, screen lock timeout)
- Gatekeeper settings (control which software can run)
- Certificate deployment (internal CA, VPN certificates)

**Software:**
- LM Studio: deploy new versions, push updated configurations
- AnythingLLM: update Docker image or Desktop app
- Open WebUI: update container or application
- MLX model updates: push shell scripts that download updated model files to external storage
- Monitoring agents: deploy and maintain endpoint monitoring

**Operations:**
- macOS updates: stage and schedule major and minor OS updates during maintenance windows
- Scheduled backups: configure and monitor Time Machine or dedicated backup software
- Alerting: deploy monitoring agents that notify the MSP NOC of inference node offline, storage capacity warnings, OS compliance drift

> **Customer Expectation Setting:** Customers should understand that the inference Mac is MSP-managed infrastructure, similar to a managed firewall or managed switch. The customer does not manage OS updates, software versions, or security configurations — the MSP does, under the managed services agreement. This is a feature, not a constraint.

---

## Section 6: Model Catalog for Regulated Industries

All models listed here are open-source with permissive licenses. There are no per-inference licensing fees. The MSP and customer pay nothing to model providers for usage — inference costs are the hardware investment described in the hardware selection guide.

> **Licensing Verification Requirement:** The MSP must verify the specific license for each model version before customer deployment. Model licenses can change between versions. The table below reflects license information as of Q2 2026; verify against the model card on Hugging Face for the specific version being deployed.

### Primary Model Catalog

| Model | Size | Best For | Min Unified Memory | License | Approx. Speed (M4 Pro 48GB) |
|-------|------|---------|-------------------|---------|---------------------------|
| Qwen2.5-14B-Instruct | 14B | General assistant, drafting, Q&A | 16GB | Apache 2.0 | 40-55 tok/s |
| Qwen2.5-32B-Instruct | 32B | Document analysis, complex reasoning | 32GB | Apache 2.0 | 25-35 tok/s |
| Llama-3.3-70B-Instruct | 70B | Highest quality, legal/medical analysis | 48GB | Llama Community | 18-28 tok/s (M4 Max) |
| Qwen2.5-72B-Instruct | 72B | Alternative to Llama-3.3-70B | 48GB | Apache 2.0 | 15-25 tok/s (M4 Max) |
| Mistral-Nemo-12B | 12B | Fast responses, SMB general use | 14GB | Apache 2.0 | 50-70 tok/s |
| nomic-embed-text-v2 | ~137M | Document embeddings for RAG | 2GB | Apache 2.0 | N/A (embedding) |
| mxbai-embed-large | ~335M | Higher-quality embeddings for complex docs | 4GB | Apache 2.0 | N/A (embedding) |

### Model Selection by Customer Type

**Solo/small law firm (Tier S):** Deploy Qwen2.5-14B-Instruct as the primary model. It is fast enough for responsive single-user interaction and handles legal Q&A, contract drafting assistance, and document summarization competently. Upgrade to Qwen2.5-32B on the M4 Pro when the practice scales beyond 5 staff.

**Medical practice (Tier M):** Qwen2.5-32B-Instruct on the M4 Pro 48GB is the recommended configuration. It handles clinical documentation assistance, coding guidance, and protocol Q&A with appropriate reasoning depth. Llama-3.3-70B is available for complex clinical case analysis on M4 Max hardware.

**Accounting firm (Tier M/L):** Qwen2.5-32B for general use; Qwen2.5-72B or Llama-3.3-70B on M4 Max hardware for complex tax analysis and multi-entity accounting work requiring sustained analytical depth.

**CMMC contractor (Tier L/XL):** Llama-3.3-70B on M4 Max hardware. The higher model quality is justified by the complexity of CMMC compliance documentation, RFP response drafting, and technical proposal work. Meta's Llama Community License permits commercial use — verify that the contractor's specific deployment context is covered.

### Model Quantization Reference

Models are distributed in quantized versions to reduce memory requirements. This is the practical tradeoff:

| Quantization | Memory vs. Full | Quality vs. Full | Recommended Use |
|-------------|----------------|-----------------|-----------------|
| Q8 | ~50% | ~99% | Highest quality, use when memory allows |
| Q4_K_M | ~25% | ~97% | Standard production recommendation |
| Q3_K_M | ~19% | ~93% | Memory-constrained deployments |
| Q2_K | ~13% | ~85% | Last resort; noticeable quality degradation |

The MSP standard recommendation is **Q4_K_M** quantization for all production deployments. It provides near-full-precision quality while halving memory requirements, enabling larger models on a given hardware configuration. LM Studio's model library provides Q4_K_M versions for all catalog models.

---

## Section 7: What We Don't Use and Why

This section documents deliberate technology exclusions and the rationale for each.

### OpenClaw / Ollama

**Excluded** per MSP design decision.

Ollama (treated as the "OpenClaw" reference in this document) is a capable inference tool, and many AI practitioners use it successfully. The decision to use MLX + LM Studio instead is based on:

- **Performance**: MLX provides 30-50% better inference throughput on Apple Silicon vs. llama.cpp-based tools like Ollama. For a multi-user production deployment, this directly increases concurrent user capacity from the same hardware investment.
- **Apple Silicon optimization**: MLX is designed by Apple's own ML research team for Apple Silicon. It will continue to receive first-class optimization as M5 and future generations ship.
- **GUI management**: LM Studio provides a model management GUI that reduces support burden for the MSP and enables non-technical customer staff to understand what is running. Ollama is a CLI-first tool.
- **MSP stack consistency**: standardizing on one inference backend simplifies MSP operations, documentation, training, and troubleshooting across all customer deployments.

### Cloud AI APIs (OpenAI, Anthropic, Google, etc.)

**Excluded** — incompatible with data sovereignty requirement.

Cloud AI APIs transmit query content, document content, and response data to third-party servers. For regulated SMBs:

- **Law firms**: client communications and legal strategy sent to a cloud AI provider may constitute a waiver of attorney-client privilege in some jurisdictions. State bar guidance on AI tool use is evolving but consistently emphasizes client data protection.
- **Medical practices**: PHI transmitted to a cloud AI API violates HIPAA unless a Business Associate Agreement is in place AND the provider's infrastructure meets HIPAA security requirements. Most general-purpose AI APIs explicitly disclaim HIPAA compliance.
- **CMMC contractors**: CUI (Controlled Unclassified Information) cannot be processed by systems that have not been assessed and authorized under the CMMC framework. Commercial cloud AI APIs are not CMMC-authorized.
- **Accounting firms**: client financial data transmitted to cloud AI providers may trigger data protection obligations under state financial privacy laws and GLBA (Gramm-Leach-Bliley Act).

The on-premises Apple Silicon stack eliminates these risks by design. Data sovereignty is enforced by physics: the data never reaches a network segment with external routing.

### Windows / Linux Inference Servers

**Excluded** — inferior on all relevant dimensions for this use case.

Windows and Linux x86 servers running llama.cpp, vLLM, or similar inference tools were evaluated against Apple Silicon and excluded for regulated SMB deployments:

- **Memory architecture**: discrete GPU VRAM limits (24GB for RTX 4090) vs. Apple unified memory (up to 192GB) is not a competitive comparison for 32B-70B model deployment
- **Power and noise**: x86 GPU servers consume 400W+ and require active cooling. Not appropriate for law offices, medical exam rooms, or small professional environments.
- **Management ecosystem**: macOS + ABM + Mosyle/Jamf provides a unified, proven MDM ecosystem for Apple hardware. Equivalent Linux server management requires bespoke tooling with substantially higher MSP operational overhead.
- **Total cost**: equivalent capability on x86/Linux hardware costs more in hardware, more in power, more in cooling infrastructure, and more in MSP management time.

The single scenario where Windows/Linux inference would be reconsidered: a Tier XL customer with existing rack infrastructure, datacenter facilities, and IT staff who have strong Linux/Windows operational capabilities. This is not the regulated SMB market this stack is designed for.

### Docker Containers for Inference (on macOS)

**Not recommended** for the inference layer specifically.

Docker on macOS runs containers inside a Linux virtual machine (Docker Desktop's VM layer). This means:

- MLX cannot access Apple Silicon Metal GPU from within a Docker container — the virtualization layer blocks direct hardware access
- llama.cpp in Docker on macOS falls back to CPU inference or emulated GPU, losing the performance advantage of Apple Silicon entirely
- Container overhead adds latency and reduces throughput in ways that directly impact concurrent user capacity

**Exception:** AnythingLLM and Open WebUI run acceptably in Docker on macOS because they do not perform GPU-intensive operations — they are web application servers that delegate inference work to LM Studio (which runs natively). The performance penalty for these containerized workloads is acceptable. For Tier S/M deployments, AnythingLLM Desktop (native app) is preferred over Docker to eliminate this complexity entirely.

> **Deployment Principle:** Run inference natively. Run applications in Docker or as native apps per convenience. Never run the inference backend (LM Studio + MLX) inside a container on macOS.
