---
name: pai-red-team
description: "Adversarial stress-testing via 32 parallel expert agents across 8 categories. Two workflows: ParallelAnalysis (5-phase: Recon -> Attack -> Escalate -> Persist -> Report) and AdversarialValidation. Ranked findings with remediation paths. USE WHEN stress-testing an idea, strategy, plan, or system against adversarial attack — identifying vulnerabilities, weaknesses, and blind spots through multi-agent red teaming. NOT FOR standard code review, friendly feedback, or building consensus."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, thinking, red-team, adversarial, stress-test, security, validation]
    related_skills: [pai-council, pai-pai-first-principles, pai-world-threat-model]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-red-team skill"}' \
  > /dev/null 2>&1 &
```


# Red Team — Adversarial Analysis

## Overview

Stress-test any idea, plan, design, or strategy by simulating 32 parallel expert agents attacking it from every angle. Each agent has a distinct adversarial persona. Findings are ranked, cross-referenced, and equipped with remediation paths.

**Core principle:** The best way to find flaws is to have smart people trying to break things on purpose.

## When to Use

| Signal | Example |
|--------|---------|
| Need to find blind spots | "What haven't we thought of?" |
| High-stakes decision | "We're committing to this approach" |
| Before presenting to leadership | "What will they challenge?" |
| Complex technical design | "What could go wrong in production?" |
| Security or safety-critical | "What's the attack surface?" |

## Routing Table

| Input Pattern | Route |
|---------------|-------|
| "Stress-test this idea" | ParallelAnalysis (5-phase) |
| "Challenge my assumptions" | AdversarialValidation |
| "Find security flaws" | ParallelAnalysis with security-focused agents |
| "Review this design" | AdversarialValidation on design doc |
| "Full audit" | ParallelAnalysis + AdversarialValidation combined |

## Workflow 1: ParallelAnalysis (5-Phase)

**Purpose:** Comprehensive multi-angle attack on a target using 32 parallel expert agents.

**Phase 1: Reconnaissance** — Map the target

```
Procedure:
1. Read and understand the target (read_file, web_search)
2. Decompose into components, assumptions, and claims
3. Assign each component to the relevant agent types
4. Use delegate_task to create 32 parallel agents
```

**Expert Agent Personas (32):**
```
Security:    Pentester, Cryptographer, Social Engineer, Malware Analyst
Engineering: Systems Architect, Network Engineer, Database Admin, QA Lead
Business:    CFO, CEO, Marketing Director, Sales Rep
Technical:   Developer, Ops/SRE, Data Scientist, UX Designer
Legal:       Lawyer, Compliance Officer, Privacy Specialist, Ethicist
Strategic:   Competitor CEO, Investor, Threat Intel, Geopolitical Analyst
Academic:    Researcher, Statistician, Philosopher, Historian
Operational: Frontline Worker, Customer Support, Project Manager, Supply Chain Lead
```

**Phase 2: Attack** — Parallel exploitation

```
For each agent persona, delegate_task:
  "You are [Persona]. Your job is to attack [Target] from your perspective.
  Find weaknesses, assumptions, failure modes, and overlooked risks.
  Be specific and adversarial. Provide:
   1. Primary attack vector
   2. Supporting evidence/reasoning
   3. Impact severity (Critical/High/Medium/Low)
   4. Remediation recommendation"
```

**Phase 3: Escalate** — Chain attacks

```
After receiving 32 attack vectors:
1. Identify connections between findings
2. Combine related attacks into escalation paths
3. Look for compound effects: "If A is true AND B is true, then..."
4. Find the highest-severity exploit chains
```

**Phase 4: Persist** — Find systemic weaknesses

```
For each escalation chain, ask:
1. Is this a one-off or a systemic pattern?
2. What would it take to prevent this class of attack?
3. Are there root-cause patterns across multiple agents' findings?
```

**Phase 5: Report** — Ranked findings with remediation

```
Output format:
1. Executive summary (top 3-5 findings)
2. Ranked findings table:
   | Severity | Agent | Finding | Evidence | Remediation |
   |----------|-------|---------|----------|-------------|
   | Critical | Pentester | SQL injection on user input | Parameterized queries not used | Migrate to ORM |
3. Escalation chains (compound attacks)
4. Systemic patterns (root issues behind multiple findings)
5. Top remediation priorities (ordered by impact/effort)
```

### Parallel Agent Deployment

Use `delegate_task` to run agents in parallel:

```python
# Pseudocode for 32-agent deployment
agent_personas = [
    {"id": "pentester", "persona": "You are a penetration tester..."},
    {"id": "cryptographer", "persona": "You are a cryptographer..."},
    # ... 30 more
]

# Deploy in batches of 8 (or whatever concurrency limit)
for batch in chunks(agent_personas, 8):
    results = delegate_task(
        tasks=[build_task(p) for p in batch],
        tools=["terminal", "read_file", "web_search"]
    )
    collect_findings(results)
```

## Workflow 2: AdversarialValidation

**Purpose:** Faster, targeted challenge of specific claims or decisions.

**Procedure:**

1. **Extract key claims** from the target document/idea
2. **For each claim, generate adversarial counter-arguments:**
   ```
   Claim: [Statement]

   Challenge 1: What's the opposite of this claim?
   Challenge 2: What would need to be true for this to fail?
   Challenge 3: What data would disprove this?
   Challenge 4: Who would disagree and why?
   Challenge 5: If this is wrong, what's the cost?
   ```

3. **Stress-test with extreme scenarios:**
   ```
   - Best case: What if everything goes perfectly? (identify over-optimism)
   - Worst case: What if everything goes wrong? (identify fragility)
   - Black swan: What unlikely event would break this?
   ```

4. **Rate each claim's robustness:**
   ```
   5 - Survives all challenges (rock solid)
   4 - Survives most, minor concerns
   3 - Significant counter-arguments exist
   2 - Multiple serious challenges unanswered
   1 - Claim is likely wrong
   ```

5. **Provide actionable strengthening recommendations.**

**Output:** Claim robustness scores + recommended improvements.

## Hermes Tools Integration

| Phase | Tool | Usage |
|-------|------|-------|
| Recon | `read_file`, `web_search` | Understand target |
| Attack | `delegate_task` | Deploy 32 parallel agents |
| Escalate | `terminal`, `write_file` | Chain analysis |
| Persist | `read_file` | Cross-reference findings |
| Report | `write_file` | Generate report |
| Validate | `web_search` | Verify factual claims |

## Gotchas / Pitfalls

### 1. Agent Collusion
**Problem:** Agents converge on similar criticism rather than providing diverse perspectives.
**Fix:** Use different system prompts per agent. Distinguish their knowledge bases and incentive structures.

### 2. Shallow Attacks
**Problem:** Agents produce generic criticism instead of deep, specific analysis.
**Fix:** Require agents to provide specific evidence or logical reasoning, not just opinion. If they can't, flag as low confidence.

### 3. Overwhelming Volume
**Problem:** 32 findings flooding the context window, causing prioritization failure.
**Fix:** Always phase: collect → aggregate → rank → report. Don't process findings in the same context you receive them.

### 4. False Positives
**Problem:** Agents flag issues that are actually non-issues.
**Fix:** For Critical findings, require secondary verification before reporting. A "critical" finding from one agent should be validated by at least one other.

### 5. Remediation Over-Zealousness
**Problem:** Recommendations that are worse than the original problem.
**Fix:** Add a "cost vs. risk" assessment to every remediation. Not every finding needs fixing.

## Execution Log

After every invocation:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-red-team","workflow":"ParallelAnalysis|AdversarialValidation","agents":32,"status":"ok","duration_s":SECONDS}' >> ~/.hermes/pai/MEMORY/SKILLS/execution.jsonl
```
