# Service Tiers, SLA, and Pricing Model

**Version:** 1.0 | **Audience:** Sales, Operations, Finance  
**Purpose:** Defines the three MSP service tiers, SLA commitments, pricing structure, and unit economics.

---

## Core Pricing Philosophy

This MSP sells **managed compliance posture + AI productivity** — not hardware and not software. The monthly fee is positioned against risk exposure, not feature count. A single HIPAA breach fine averages $1.2M. A lost CMMC certification means losing a DoD contract. The MSP monthly fee is insurance with a productivity dividend.

Hardware is sold at margin, but it is not the business. **Recurring revenue is the business.**

---

## Service Tier Definitions

### Bronze — Essential Managed AI

**Target:** Solo professionals and micro businesses (Tier S deployments, 1–4 users)  
**Monthly fee:** $299/device/month  
**Setup fee:** $500 (one-time)  
**Minimum term:** 12 months  

**Included:**

| Category | What's Covered |
|----------|---------------|
| **MDM Management** | Apple Business Manager enrollment, Mosyle configuration profiles, FileVault enforcement, recovery key escrow |
| **OS Updates** | macOS updates tested by MSP and pushed monthly during maintenance window |
| **AI Model Updates** | Quarterly model evaluation — MSP tests new releases, deploys if quality improves |
| **Compliance Reporting** | Monthly MDM compliance email report (FileVault ✓, OS version ✓, app inventory) |
| **Support** | Email support, 8-business-hour response SLA |
| **Check-In** | Annual check-in call (60 minutes) |

**Not included:** On-site visits, 24/7 monitoring, HIPAA/CMMC documentation assistance, custom model evaluation, LDAP/SSO integration, multi-user workspaces beyond initial setup.

---

### Silver — Professional Managed AI

**Target:** Small teams (Tier M deployments, 5–25 users), the core product-market fit tier  
**Monthly fee:** $599/node/month + $99/user/month (capped at 25 users per node)  
**Maximum monthly per node:** $599 + $2,475 = $3,074/node  
**Setup fee:** $1,500–$3,000 depending on complexity  
**Minimum term:** 12 months  

**Included (all Bronze, plus):**

| Category | What's Covered |
|----------|---------------|
| **24/7 Monitoring** | Service health monitoring (LM Studio API, Open WebUI, AnythingLLM) with automated alerts to MSP on-call |
| **Response SLA** | 2-hour for critical (service down), 4-hour for non-critical (business hours) |
| **Model Updates** | Monthly model evaluation — MSP proactively upgrades when quality improves meaningfully |
| **Capacity Planning** | Alert + recommendation if approaching resource limits (RAM, storage, concurrent load) |
| **QBR** | Quarterly Business Review — 60-minute video call covering usage, performance, model roadmap |
| **Compliance Assist** | Annual HIPAA risk analysis update support or CMMC SSP annual review |
| **On-Site (optional)** | 1 annual on-site visit for sites within 50 miles of MSP base; remote video equivalent otherwise |
| **Workspaces** | Up to 10 AnythingLLM workspaces managed and maintained |
| **User Management** | Add/remove user accounts in Open WebUI within 1 business day of request |

**Not included:** Custom model fine-tuning, C3PAO assessment preparation, multi-site architecture, API integrations with third-party software.

---

### Gold — Enterprise Managed AI

**Target:** Mid-to-large organizations (Tier L/XL deployments, 25–200+ users), multi-site, or organizations with complex compliance requirements  
**Monthly fee:** Negotiated, typically $1,299–$4,999/month depending on nodes, users, and complexity  
**Setup fee:** $5,000–$15,000  
**Minimum term:** 24 months  

**Included (all Silver, plus):**

| Category | What's Covered |
|----------|---------------|
| **Critical Response** | 1-hour response SLA for critical issues, 24/7/365 |
| **Dedicated CSM** | Named Customer Success Manager with direct phone/Slack access |
| **Monthly Reviews** | Monthly operational review (video or on-site, customer choice) |
| **Custom Model Evaluation** | Dedicated model testing for customer's specific document types and use cases; fine-tuning consultation |
| **CMMC Assessment Prep** | Assist with C3PAO readiness: documentation review, gap analysis, remediation guidance |
| **Multi-Site** | Hub-and-spoke architecture support across up to 5 locations |
| **API Integrations** | Integration with customer's existing systems (document management, ticketing, AD/LDAP SSO) |
| **Priority Updates** | Gold customers receive tested model upgrades before Silver/Bronze |
| **Unlimited Workspaces** | Unlimited AnythingLLM workspaces, organized by practice area or clearance level |

---

## SLA Summary

| Metric | Bronze | Silver | Gold |
|--------|--------|--------|------|
| **Critical response** | 8hr business | 2hr 24/7 | 1hr 24/7 |
| **Non-critical response** | Next business day | 4hr business | 2hr business |
| **Model updates** | Quarterly | Monthly | Priority monthly |
| **Monitoring** | Business hours | 24/7 automated | 24/7 + proactive |
| **Compliance documentation** | Report only | Annual assist | Full support |
| **Quarterly Business Review** | No (annual only) | Yes (quarterly) | Monthly review |
| **On-site visits** | Not included | 1/year (in-range) | Per agreement |
| **Uptime SLA** | 95% | 99% | 99.5% |
| **User account changes** | 3 business days | 1 business day | Same day |

**Uptime definition:** "Uptime" means the LM Studio inference API returns valid responses at least 99% of measured minutes in the calendar month, excluding scheduled maintenance windows (communicated ≥48 hours in advance) and customer-caused outages (power loss, network changes not coordinated with MSP).

**Downtime credits:** Bronze: none. Silver: 5% monthly fee credit per 1% uptime below SLA. Gold: 10% credit per 0.5% below SLA, maximum 30% monthly credit.

---

## Hardware Pricing

The MSP sells Apple hardware at a margin above retail. At launch, without Apple reseller authorization, standard consumer pricing applies with a service and configuration margin.

| Device | Apple Retail | MSP Price | Margin |
|--------|-------------|-----------|--------|
| Mac Mini M4 Pro 24GB | $1,399 | $1,699 | ~21% |
| Mac Mini M4 Pro 48GB | $1,799 | $2,150 | ~20% |
| Mac Studio M4 Max 36GB | $1,999 | $2,400 | ~20% |
| Mac Studio M4 Max 64GB | $2,399 | $2,900 | ~21% |
| Mac Studio M4 Ultra 192GB | $4,999 | $5,999 | ~20% |
| Mac Pro M4 Max | $6,999+ | $8,500+ | ~21% |

> **Note:** Pursuing Apple Authorized Reseller status is a Year 1–2 business goal. At the SMB tier, Apple provides 3–8% reseller margin; MSP adds configuration/provisioning margin on top.

**Accessories (at cost + 15%):**
- 2TB Thunderbolt external SSD (model storage): ~$200 retail → $230 MSP
- UPS for server node: ~$150 retail → $175 MSP
- 2.5GbE USB-C adapter (if needed): ~$30 retail → $35 MSP

---

## Pricing Examples

### Example 1: Solo Attorney — Bronze Tier
- Hardware: Mac Mini M4 Pro 24GB → $1,699 (one-time)
- Monthly: $299/month
- Setup fee: $500 (one-time)
- **Year 1 total:** $1,699 + $500 + ($299 × 12) = **$5,787**
- **Ongoing ARR:** $3,588

### Example 2: 10-Person Medical Practice — Silver Tier
- Hardware: Mac Mini M4 Pro 48GB → $2,150 (one-time)
- Monthly: $599 (node) + $99 × 10 (users) = **$1,589/month**
- Setup fee: $2,000
- **Year 1 total:** $2,150 + $2,000 + ($1,589 × 12) = **$23,218**
- **Ongoing ARR:** $19,068

### Example 3: 40-Person Law Firm — Silver Tier
- Hardware: Mac Studio M4 Max 64GB → $2,900 (one-time)
- Monthly: $599 (node) + $99 × 40 (users) = **$4,559/month**
- Setup fee: $3,000
- **Year 1 total:** $2,900 + $3,000 + ($4,559 × 12) = **$60,608**
- **Ongoing ARR:** $54,708

### Example 4: Defense Contractor (15 users, CMMC L2) — Silver + Compliance Package
- Hardware: Mac Mini M4 Pro 48GB → $2,150 (one-time)
- Monthly: $599 + ($99 × 15) = **$2,084/month**
- Setup fee: $3,000 (includes SSP documentation package)
- **Year 1 total:** $2,150 + $3,000 + ($2,084 × 12) = **$30,158**
- **Ongoing ARR:** $25,008

---

## MSP Unit Economics

### Customer Acquisition Cost (CAC) Estimate
- Sales cycle: 30–90 days for Silver (longer for CMMC/Gold)
- CAC: primarily MSP founder time (Year 1); budget $500–$2,000 per customer for referral fees, marketing materials, event sponsorship
- Target: CAC < 3 months MRR (payback in first quarter)

### Gross Margin
- Hardware margin: ~20% gross margin
- Service margin: ~70–80% gross margin (once tooling is amortized — MDM subscriptions, monitoring tools, are fixed overhead)
- Blended Year 1 margin: ~55–65% (hardware heavier in Year 1); Year 2+: ~70%+

### Churn
- Hardware-anchored managed services have structural low churn: customer bought the hardware, data is on-premises, switching requires new vendor + rehardware + retraining
- Target gross annual churn: < 8%
- Key churn driver: staff changes, practice acquisition, or closure — not competitive switching

### Growth Model

| Year | Customers | Mix | ARR | Hardware Rev |
|------|-----------|-----|-----|-------------|
| Year 1 | 15–20 | 60% Bronze, 40% Silver | $200K–$400K | $25K–$50K |
| Year 2 | 35–50 | 40% Bronze, 50% Silver, 10% Gold | $600K–$1.2M | $60K–$100K |
| Year 3 | 75–100 | 25% Bronze, 55% Silver, 20% Gold | $1.5M–$3M | $100K–$200K |

> **Staffing note:** 1 MSP engineer can manage 50–80 Bronze/Silver accounts with good MDM tooling. First hire at ~30 customers. Second at ~60 customers.

---

## Quarterly Business Review (QBR) Framework

Every Silver and Gold customer receives a QBR. Agenda:

1. **Usage metrics** (15 min) — queries per day trend, peak hours, top users, most-queried documents
2. **Performance report** (10 min) — uptime report, average response latency, any incidents
3. **Compliance status** (10 min) — MDM compliance score, any findings, documentation currency
4. **Model performance** (10 min) — user satisfaction feedback, any quality issues, upgrade recommendation
5. **Roadmap** (10 min) — upcoming model updates, software updates, MSP new capabilities
6. **Expansion discussion** (15 min) — has team grown? Usage patterns suggesting tier upgrade? New use cases?

**QBR deliverable:** A 1-page "QBR Summary" sent within 48 hours of the call, documenting key metrics and any action items with owners and dates.

---

## MSP Staffing Model

| Stage | Customer Count | Team |
|-------|---------------|------|
| Launch | 0–20 | 1 technical founder (handles sales, deployment, support) |
| Growth | 20–50 | Add 1 support engineer ($75K–$90K); founder focuses on sales + Gold |
| Scale | 50–100 | Add 1 customer success manager ($70K–$85K) for Gold accounts |
| Mature | 100+ | Technical manager + 2–3 engineers + 1 CSM + dedicated sales |

**Tools that keep the team lean:**
- Mosyle/Jamf: 1 engineer manages 50+ devices remotely
- MDM automation: model updates, OS patches, user provisioning all scripted
- Standardized tiers: no custom snowflake deployments — everything maps to S/M/L/XL + Bronze/Silver/Gold
- Self-service knowledge base: well-documented Quick Reference guides reduce Tier 1 support volume
