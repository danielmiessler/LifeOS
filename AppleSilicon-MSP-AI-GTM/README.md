# Apple Silicon MSP AI — Go-To-Market Business Plan

**Status:** Living Document | **Created:** April 2026 | **Version:** 1.0

---

## The One-Paragraph Summary

We are building a Managed Service Provider that deploys locally-hosted AI on Apple Silicon hardware — Mac Mini, Mac Studio, and Mac Pro — to highly regulated small and mid-size businesses. Our customers are law firms, medical practices, accounting firms, and defense contractors who need the productivity gains of modern AI but cannot risk their clients' confidential data, patients' PHI, or government CUI leaving their premises. We manage the entire system remotely, like a utility. The customer pays a monthly fee, their staff uses AI through a browser that looks like ChatGPT, and their data never leaves their building. Apple Silicon makes this possible because a $1,400 Mac Mini now has enough memory bandwidth and capacity to run state-of-the-art AI models locally. We are the enterprise delivery mechanism for Apple's biggest hardware bet.

---

## Strategic Context: "Apple Just Positioned Itself for the Next Trillion Dollars"

Apple has embedded AI inference capability directly into its Silicon architecture — the M4 Neural Engine, 400+ GB/s unified memory bandwidth, and support for 70B+ parameter models on a single device. This is not an accident. Apple's entire silicon roadmap is oriented toward local AI: private by design, on-device by default, no internet required.

The same philosophy that made iPhone privacy a brand differentiator ("what happens on your iPhone, stays on your iPhone") is now being extended to enterprise AI. Our MSP is the delivery mechanism that makes this capability accessible to professional service firms that cannot afford to use cloud AI — not for policy reasons, but for professional liability reasons.

This is the right business to build right now. The hardware is capable. The regulations are tightening. The buying triggers are imminent. The managed service model creates durable, hardware-anchored recurring revenue.

---

## Target Customers

| Vertical | Primary Driver | Compliance Framework | Urgency |
|----------|---------------|---------------------|---------|
| Law firms (5–75 attorneys) | Bar ethics, client confidentiality | ABA Rules 1.1, 1.6; state bar guidance | Growing — state bars issuing AI guidance |
| Medical/healthcare practices | HIPAA, patient trust | HIPAA Technical Safeguards, BAA requirements | High — HHS OCR enforcement active |
| Accounting/CPA firms | Client confidentiality, state board ethics | State CPA board rules, engagement letter obligations | Moderate — client demand-driven |
| Defense contractors (CMMC) | Contract compliance, DoD flow-down | CMMC Level 2 (NIST SP 800-171) | **Critical — Phase 2 enforcement November 2026** |

---

## Solution Architecture (One Page)

```
┌─────────────────────────────────────────────────────┐
│                CUSTOMER'S OFFICE                     │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │          Apple Silicon Inference Node        │    │
│  │  Mac Mini M4 Pro / Mac Studio M4 Max         │    │
│  │                                               │    │
│  │  ┌─────────────┐  ┌──────────────────────┐  │    │
│  │  │  LM Studio   │  │    AnythingLLM       │  │    │
│  │  │  (MLX/Metal) │  │    (RAG + Docs)      │  │    │
│  │  │  Qwen2.5-32B │  │    ChromaDB/Lance    │  │    │
│  │  │  Llama-3.3-70B│  │    Document Store   │  │    │
│  │  └──────┬──────┘  └──────────┬───────────┘  │    │
│  │         │  OpenAI-compatible API             │    │
│  │         └──────────┬─────────┘              │    │
│  │               ┌────┴─────┐                  │    │
│  │               │ Open WebUI│                  │    │
│  │               │(Chat UI) │                  │    │
│  │               └────┬─────┘                  │    │
│  └────────────────────┼────────────────────────┘    │
│                        │ LAN only (HTTPS)             │
│  ┌─────────────────────┴─────────────────────────┐   │
│  │  Staff Workstations (any browser, any device) │   │
│  └───────────────────────────────────────────────┘   │
│                                                       │
│  Managed remotely by MSP via MDM (Mosyle/Jamf + ABM) │
│  Data never leaves this boundary ──────────────────▶ │
└─────────────────────────────────────────────────────┘
```

**No OpenClaw or similar tools in this stack.** Inference is handled by MLX (Apple's native ML framework) through LM Studio, providing superior Apple Silicon optimization without the third-party runtime dependency.

---

## T-Shirt Size Solution Tiers

| Tier | Name | Users | Hardware | Monthly MSP Fee | Setup |
|------|------|-------|----------|----------------|-------|
| **S** | Solo/Micro | 1–4 | Mac Mini M4 Pro 24GB ($1,399) | $299 | $500 |
| **M** | Team | 5–25 | Mac Mini M4 Pro 48GB ($1,799) | $599/node + $99/user | $1,500 |
| **L** | Department | 25–100 | Mac Studio M4 Max 64GB ($2,399) | $1,299/node + $99/user | $3,500 |
| **XL** | Enterprise | 100+ | Mac Studio M4 Ultra / Mac Pro cluster | $2,499–$4,999 | $7,500+ |

---

## Document Index

### 01 — Market Definition
| File | Contents |
|------|----------|
| [`01-Market-Definition/target-verticals.md`](01-Market-Definition/target-verticals.md) | Personas, pain points, buying triggers, and decision-maker maps for all four verticals |
| [`01-Market-Definition/market-sizing.md`](01-Market-Definition/market-sizing.md) | TAM/SAM/SOM estimates, unit economics, 3-year revenue model |
| [`01-Market-Definition/regulatory-landscape.md`](01-Market-Definition/regulatory-landscape.md) | HIPAA, CMMC L1/L2, NDAA Section 1513, state privacy laws, bar ethics — applicability by vertical |

### 02 — Solution Tiers
| File | Contents |
|------|----------|
| [`02-Solution-Tiers/overview.md`](02-Solution-Tiers/overview.md) | Comparison matrix, upgrade path, tier selection guide |
| [`02-Solution-Tiers/tier-S.md`](02-Solution-Tiers/tier-S.md) | Solo/Micro tier — hardware, software, models, pricing, use cases |
| [`02-Solution-Tiers/tier-M.md`](02-Solution-Tiers/tier-M.md) | Team tier — Mac Mini M4 Pro 48GB, multi-user configuration |
| [`02-Solution-Tiers/tier-L.md`](02-Solution-Tiers/tier-L.md) | Department tier — Mac Studio M4 Max, HA setup, SSO |
| [`02-Solution-Tiers/tier-XL.md`](02-Solution-Tiers/tier-XL.md) | Enterprise/multi-site — M4 Ultra or cluster, hub-and-spoke VPN |

### 03 — Apple Platform
| File | Contents |
|------|----------|
| [`03-Apple-Platform/hardware-selection.md`](03-Apple-Platform/hardware-selection.md) | Why Apple Silicon, device selection guide, concurrent user load tables, peripheral specs |
| [`03-Apple-Platform/software-stack.md`](03-Apple-Platform/software-stack.md) | MLX + LM Studio, AnythingLLM, Open WebUI, Mosyle/Jamf — architecture and deployment |

### 04 — Security & Compliance
| File | Contents |
|------|----------|
| [`04-Security-Compliance/security-architecture.md`](04-Security-Compliance/security-architecture.md) | Data sovereignty design, encryption standards, access control, audit logging, network segmentation |
| [`04-Security-Compliance/cmmc-mapping.md`](04-Security-Compliance/cmmc-mapping.md) | CMMC Level 2 control mapping (AC, IA, SC, CM, AU domains) with implementation evidence |
| [`04-Security-Compliance/hipaa-mapping.md`](04-Security-Compliance/hipaa-mapping.md) | HIPAA safeguard mapping (Administrative, Physical, Technical) + BAA scope |

### 05 — MSP Operations
| File | Contents |
|------|----------|
| [`05-MSP-Operations/remote-management.md`](05-MSP-Operations/remote-management.md) | Zero-touch MDM model, monitoring stack, model update workflow, remote support |
| [`05-MSP-Operations/onboarding-playbook.md`](05-MSP-Operations/onboarding-playbook.md) | Discovery → Deployment → Validation playbook with master checklist |
| [`05-MSP-Operations/service-tiers.md`](05-MSP-Operations/service-tiers.md) | Bronze/Silver/Gold SLA definitions, pricing model, unit economics, staffing model |

### 06 — GTM Messaging
| File | Contents |
|------|----------|
| [`06-GTM-Messaging/value-proposition.md`](06-GTM-Messaging/value-proposition.md) | Core value prop, Apple narrative, three differentiators, "why now," customer vignettes |
| [`06-GTM-Messaging/vertical-pitches.md`](06-GTM-Messaging/vertical-pitches.md) | 30-second and 2-minute pitches + objection handling for all four verticals |
| [`06-GTM-Messaging/competitive-positioning.md`](06-GTM-Messaging/competitive-positioning.md) | Head-to-head comparisons, positioning matrix, 12+ objection responses, scenario walkthroughs |

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM Runtime | MLX + LM Studio | Apple-native, 30-50% faster than alternatives; OpenClaw excluded per design |
| RAG Platform | AnythingLLM | Open source, local, workspace-based isolation, active development |
| Chat UI | Open WebUI | Self-hosted, OpenAI API-compatible, non-technical UX, multi-user |
| MDM (SMB) | Mosyle Business | Cost-effective, Apple-focused, ABM-integrated, ~$4/device/month |
| MDM (Enterprise) | Jamf Pro | Enterprise-grade, better for CMMC audit trail, Active Directory integration |
| Vector Store (S/M) | ChromaDB (embedded) | Simple, no external service needed, sufficient for 1-25 users |
| Vector Store (L/XL) | LanceDB or pgvector | Better multi-user concurrency, production-grade reliability |
| Hardware Baseline | Mac Mini M4 Pro 48GB | Best price/performance for team workloads; runs 32B models with headroom |
| Target Geography | US-first | CMMC is US-specific; HIPAA is US-specific; bar ethics guidance is US-specific |

---

## Open Questions / Next Steps

- [ ] **OpenClaw identity clarification:** Confirm exactly what product "OpenClaw" refers to — verify it is excluded from all documents and any alternatives are properly documented
- [ ] **Apple Authorized Reseller:** Research requirements and timeline for Apple VAR/reseller program — enables hardware margin at scale
- [ ] **CMMC C3PAO partner:** Identify a C3PAO assessment firm to partner with for Gold-tier customers — creates referral network
- [ ] **Insurance:** Research E&O and cyber liability insurance requirements for an AI MSP
- [ ] **Model licensing audit:** Confirm commercial inference licensing for each recommended model (Llama Community License, Apache 2.0, etc.)
- [ ] **Pilot customer:** Define the criteria for the first paid pilot customer — which vertical, what size, what compliance requirement
- [ ] **Financial model:** Build a detailed P&L model for Year 1 using the unit economics in `05-MSP-Operations/service-tiers.md`
- [ ] **Legal structure:** Consult attorney on LLC/S-Corp structure, MSP agreement template, BAA template

---

## Quick Reference: The Core Message

> **"We put AI inside your office. It runs on Apple hardware. Your data never leaves. We manage everything. You use it."**

For regulated professionals who need AI productivity without the compliance exposure that comes with cloud AI — this is the only managed solution built for them from the ground up.
