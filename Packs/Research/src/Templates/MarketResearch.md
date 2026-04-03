# Market Research Domain Template

Domain-specific configuration for the Deep Investigation workflow applied to market analysis.

---

## Entity Categories

| Category | Description | Target Count |
|----------|-------------|-------------|
| **Companies** | Businesses operating in this market (startups, incumbents, adjacent) | 8-15 |
| **Products** | Key products/services/platforms in the market | 5-10 |
| **People** | Founders, executives, investors, analysts shaping the market | 5-10 |
| **Technologies** | Core technologies, frameworks, standards enabling the market | 3-8 |
| **Trends** | Market movements, shifts, emerging patterns | 3-6 |
| **Investors** | VCs, firms, and funding sources active in this market | 3-8 |

---

## Evaluation Criteria (What Makes Something CRITICAL?)

**Companies:**
- CRITICAL: Market leaders with >10% share, category creators, companies everyone references
- HIGH: Well-funded challengers, companies with unique approaches, acquisition targets
- MEDIUM: Niche players with specialized focus
- LOW: Early-stage with unproven traction

**Products:**
- CRITICAL: Category-defining products, industry standards
- HIGH: Strong adoption, innovative approaches, frequently compared
- MEDIUM: Solid but not differentiated
- LOW: New/unproven or declining

**People:**
- CRITICAL: Founders of CRITICAL companies, top analysts whose opinions move markets
- HIGH: Influential voices, repeat founders, key investors
- MEDIUM: Notable contributors, rising figures
- LOW: Peripheral involvement

**Technologies:**
- CRITICAL: Foundational tech that enables the entire market
- HIGH: Widely adopted frameworks/standards
- MEDIUM: Emerging tech with growing adoption
- LOW: Experimental, limited adoption

---

## Search Strategies

**For landscape (Step 1):**
- "[market] market size 2025 2026"
- "[market] competitive landscape analysis"
- "[market] industry report key players"
- "[market] venture funding trends"
- "Gartner|Forrester|IDC [market] analysis"

**For entity discovery (Step 3):**
- "[market] startups to watch"
- "[market] top companies list"
- "[market] funding rounds recent"
- "[market] key executives leaders"
- "[market] technology stack overview"

**For deep investigation (Step 4):**
- "[entity name] funding history crunchbase"
- "[entity name] product review comparison"
- "[entity name] CEO interview podcast"
- "[entity name] revenue customers case study"
- "[entity name] competitors alternative"

---

## Profile Templates

### Company Profile

```markdown
# {Company Name}

## Overview
- **Founded:** {year}
- **HQ:** {location}
- **Stage:** {Seed/Series A/B/C/Public/Acquired}
- **Employees:** {count or range}
- **Website:** {url}

## What They Do
[2-3 sentences: what the company does, who it serves, core value prop]

## Funding & Financials
- **Total Raised:** {amount}
- **Last Round:** {amount, date, lead investor}
- **Key Investors:** {list}
- **Revenue Indicators:** {public info, estimates, growth signals}

## Product & Technology
- **Core Product:** {name, description}
- **Technology:** {tech stack, key innovations}
- **Target Market:** {customer segment, use case}
- **Pricing Model:** {pricing approach}

## Competitive Position
- **Strengths:** {2-3 bullets}
- **Weaknesses:** {2-3 bullets}
- **Key Differentiator:** {what sets them apart}
- **Primary Competitors:** [links to other profiles]

## Leadership
- **CEO/Founder:** {name, background}
- **Key Executives:** {notable hires}

## Recent Developments
- {date}: {development}
- {date}: {development}

## Market Significance
[Why this company matters in the landscape. 2-3 sentences.]

## Sources
[Verified URLs only]
```

### Product Profile

```markdown
# {Product Name}

## Overview
- **Company:** [link to company profile]
- **Category:** {product category}
- **Launched:** {year}
- **Pricing:** {model and range}

## Core Capabilities
- {capability 1}
- {capability 2}
- {capability 3}

## Target Users
[Who uses this and why]

## Competitive Comparison
| Feature | {This Product} | {Competitor 1} | {Competitor 2} |
|---------|---------------|----------------|----------------|
| {feature} | {status} | {status} | {status} |

## Adoption & Traction
- **Users/Customers:** {numbers or indicators}
- **Notable Customers:** {names}
- **Growth Signals:** {evidence}

## Strengths & Weaknesses
- **Strengths:** {bullets}
- **Weaknesses:** {bullets}

## Sources
[Verified URLs only]
```

### Person Profile

```markdown
# {Person Name}

## Overview
- **Current Role:** {title at company} [link to company profile]
- **Background:** {1-sentence career summary}
- **Location:** {city}

## Career History
- {year-present}: {role at company}
- {year-year}: {previous role}
- {year-year}: {earlier role}

## Significance
[Why this person matters in the market. What influence do they have?]

## Thought Leadership
- {topic}: {where they've published/spoken}
- Notable takes: {key positions or predictions}

## Connections
- Companies: [links to related company profiles]
- Other People: [links to related person profiles]

## Sources
[Verified URLs only]
```

### Technology Profile

```markdown
# {Technology Name}

## Overview
- **Type:** {framework/protocol/standard/platform}
- **Created by:** {origin}
- **Maturity:** {experimental/emerging/mainstream/legacy}

## What It Does
[2-3 sentences explaining the technology]

## Adoption
- **Key Users:** {companies, products using it}
- **Market Penetration:** {adoption indicators}

## Significance
[Why this technology matters for the market]

## Alternatives
- {alternative 1}: {how it compares}
- {alternative 2}: {how it compares}

## Sources
[Verified URLs only]
```

### Trend Profile

```markdown
# {Trend Name}

## Overview
[What is this trend? 2-3 sentences]

## Evidence
- {data point or signal 1}
- {data point or signal 2}
- {data point or signal 3}

## Drivers
[What's causing this trend?]

## Impact
- **Winners:** {who benefits}
- **Losers:** {who's disrupted}
- **Timeline:** {when does this play out}

## Connected Entities
- Companies: [links to related profiles]
- Technologies: [links to related profiles]

## Sources
[Verified URLs only]
```

### Investor Profile

```markdown
# {Investor/Firm Name}

## Overview
- **Type:** {VC/PE/Corporate/Angel}
- **AUM:** {assets under management if public}
- **Focus Areas:** {investment thesis areas}

## Portfolio in This Market
- {company 1}: {round, amount} [link to company profile]
- {company 2}: {round, amount}

## Investment Thesis
[What do they look for in this market? What's their angle?]

## Key Partners
- {partner name}: {focus, background}

## Significance
[Why this investor matters for the market landscape]

## Sources
[Verified URLs only]
```
