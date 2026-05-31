---
name: pai-world-threat-model
description: "Long-horizon risk assessment: stress-tests ideas/strategies/investments against 11 time horizons from 6 months to 50 years. 3 execution tiers (Fast/Standard/Deep). Orchestrates RedTeam, FirstPrinciples, and Council internally for multi-method coverage. USE WHEN evaluating decisions with multi-year implications — identifying systemic risks, cascade effects, and black-swan scenarios across 11 time horizons. NOT FOR short-term operational risk, personal safety assessment, or tactical decision-making."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, thinking, threat-model, risk, long-horizon, strategy, forecasting]
    related_skills: [pai-red-team, pai-pai-first-principles, pai-systems-thinking, pai-council]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-world-threat-model skill"}' \
  > /dev/null 2>&1 &
```


# World Threat Model — Long-Horizon Stress-Testing

## Overview

Stress-test any decision, plan, or strategy against 11 discrete time horizons spanning 6 months to 50 years. Each horizon surfaces different risk classes — operational failures in the short term, existential shifts in the long term. Three tiers allow proportional investment based on stakes.

**Core insight:** A strategy that survives at all 11 time horizons is robust. One that only works at a single horizon is fragile.

## When to Use

| Signal | Example |
|--------|---------|
| Decision with multi-year implications | "We're making a bet that will play out over 5+ years" |
| Strategy needs stress-testing | "Will this strategy still work in 10 years?" |
| Need to surface long-tail risks | "What could kill us that we're not thinking about?" |
| Investment decisions | "Should we invest in this technology/company/approach?" |
| Building something intended to last | "We want this to be relevant for decades" |

## Routing Table

| Input Pattern | Route |
|---------------|-------|
| "Threat-model this strategy" | Standard tier by default |
| "Quick risk check" | Fast tier |
| "Full existential analysis" | Deep tier |
| "How will this look in 10 years?" | Single-horizon analysis (10yr) |
| "Comprehensive long-term robustness" | Deep tier |

## 11 Time Horizons

| # | Horizon | Risk Focus | Typical Questions |
|---|---------|------------|-------------------|
| 1 | 6 months | Execution risk, operational failure | "Can we ship?" |
| 2 | 1 year | Market response, competitor reaction | "Will the market accept this?" |
| 3 | 2 years | Growth scaling, team/culture | "Can we scale?" |
| 4 | 3 years | Competitive dynamics, tech evolution | "Will competitors catch up?" |
| 5 | 5 years | Industry shifts, business model viability | "Will the industry still work this way?" |
| 6 | 7 years | Technology transitions, regulatory shifts | "What new technologies disrupt this?" |
| 7 | 10 years | Demographic/societal change | "How will the world change?" |
| 8 | 15 years | Generational shifts, value changes | "Will the next generation care about this?" |
| 9 | 20 years | Structural economic change | "What industries emerge/die?" |
| 10 | 30 years | Geopolitical/planetary change | "What's the world order?" |
| 11 | 50 years | Existential/civilization-scale change | "What still matters?" |

## 3 Tiers

### Tier 1: Fast (10-15 minutes)

**Purpose:** Quick risk scan for surface-level vulnerabilities.

**Procedure:**

```
For each of the 11 horizons, ask ONE question:
  "What is the single biggest risk to this strategy at [horizon]?"

Output: 11 risks (one per horizon), no remediation.
```

**When to use:** Initial screening, low-stakes decisions, time pressure.

### Tier 2: Standard (30-60 minutes)

**Purpose:** Thorough risk identification with basic remediation.

**Procedure:**

```
For each horizon:
1. Identify primary risk
2. Identify secondary/adjacent risk
3. Assess likelihood (Low/Medium/High)
4. Assess impact (Low/Medium/High/Critical)
5. Propose one remediation per risk

After all 11 horizons:
6. Identify risks that appear at multiple horizons (systemic risks)
7. Rank overall risk profile

Use delegate_task for parallel horizon analysis (batch into 3-4 groups)
```

**Output:** Risk matrix (11 × 2 risks) with likelihood, impact, remediation, and systemic risk identification.

### Tier 3: Deep (2-4 hours)

**Purpose:** Exhaustive risk analysis with full countermeasure design.

**Procedure:**

```
For each horizon:

Phase A — Risk Identification:
1. Deploy Red Team agents specialized for this time horizon
   (use delegate_task for 3-5 expert persona per horizon)
2. Apply First Principles decomposition to the strategy
3. Identify hard vs. soft constraints at this time scale
4. Map causal loops that could amplify or mitigate risks

Phase B — Scenario Generation:
5. Generate 3 scenarios per horizon:
   - Nominal: Expected evolution
   - Worst case: Everything that could go wrong
   - Wild card: Low-probability, high-impact event

Phase C — Cross-Horizon Analysis:
After all 11 horizons:
6. Identify systemic risks (appearing in 3+ horizons)
7. Identify risk cascades (risk at horizon 2 enables risk at horizon 5)
8. Build integrated risk tree
9. Design countermeasures for top 10 risks
10. Design monitoring signals (what to watch to detect each risk early)

Use delegate_task for:
- Parallel horizon analysis (3-4 horizons per agent)
- Scenario generation per horizon
- Countermeasure design
- Use web_search for external context (regulatory trends, tech forecasts)
```

**Output:** Full risk report with horizon-specific analysis, scenarios, cross-horizon cascades, ranked countermeasures, and monitoring signals.

## Cross-Horizon Analysis

### Systemic Risk Detection

After all horizons are analyzed:

```
1. Scan for risk themes that appear in 3+ horizons
2. Classify each systemic risk:
   - Structural: Built into the system's design
   - Environmental: External factor affecting all horizons
   - Compounding: Gets worse over time
3. Prioritize systemic risks above single-horizon risks
```

### Risk Cascades

```
Identify chains where a risk at an earlier horizon enables/amplifies a later risk:

Example:
  2yr: Talent exodus → 5yr: Innovation stall → 10yr: Market irrelevance

Document each cascade with:
- Trigger event (what starts it)
- Propagation path (how it spreads across horizons)
- Break points (where intervention could stop it)
```

## Hermes Tools Integration

| Tier | Tool | Usage |
|------|------|-------|
| Fast | `terminal` | Quick horizon scan |
| Standard | `delegate_task` | Parallel horizon analysis |
| Deep | `delegate_task`, `web_search` | Agent deployment, external research |
| Deep | `read_file`, `write_file` | Reference docs, report generation |
| All tiers | `terminal` | Risk matrix, file management |

## Gotchas / Pitfalls

### 1. Near-Term Bias
**Problem:** Focusing on 6mo-2yr risks and giving short shrift to 10-50yr horizons.
**Fix:** Allocate equal analytical effort to each horizon. The long-term horizons are where existential risks live.

### 2. Prediction Overconfidence
**Problem:** Treating 30-50 year analysis as "prediction" rather than scenario exploration.
**Fix:** Always frame as "scenarios" not "predictions." The value is in preparedness, not accuracy.

### 3. Horizon Collapse
**Problem:** Treating adjacent horizons as essentially the same.
**Fix:** Each horizon has distinct characteristics. 20yr is NOT "like 15yr but more." Different forces dominate.

### 4. Neglecting Wild Cards
**Problem:** Only analyzing nominal and worst-case scenarios.
**Fix:** Wild cards (black swans) are the most important to consider because they're the most ignored.

### 5. Remediation Over-Engineering
**Problem:** Designing complex countermeasures for low-probability risks.
**Fix:** Match countermeasure investment to (probability × impact). Some risks are best monitored, not mitigated.

### 6. Tier Selection Error
**Problem:** Using Fast tier for high-stakes decisions.
**Fix:** Rule of thumb: If failure cost exceeds 10× the analysis cost, use the next tier up.

## Execution Log

After every invocation:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-world-threat-model","tier":"fast|standard|deep","horizons":11,"status":"ok","duration_s":SECONDS}' >> ~/.hermes/profiles/dev/pai/MEMORY/SKILLS/execution.jsonl
```
