# Challenge Workflow

**Purpose**: Systematically challenge every assumption and constraint, classifying each as hard constraint (physics), soft constraint (choice), or unvalidated assumption.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Challenge workflow in the FirstPrinciples skill to test assumptions"}' \
  > /dev/null 2>&1 &
```

Running the **Challenge** workflow in the **FirstPrinciples** skill to test assumptions...

---

**When to Use**:
- After Deconstruct, to evaluate what's actually fixed
- When requirements feel overly restrictive
- When "we can't do X" is stated without evidence
- For adversarial analysis (RedTeam, pentesting)
- Before major architecture or strategy decisions

---

## The Core Question

For every stated constraint, ask:

> "Is this a law of physics, or is it a choice someone made?"

If it's a choice, it can be changed.

---

## Process

### Step 1: List All Stated Constraints

Gather everything that's been presented as a constraint:
- Requirements documents
- "We have to..." statements
- Industry best practices
- Historical decisions
- Budget/timeline limits
- Technical limitations
- Policy requirements

**Write**: List every constraint without filtering

### Step 2: Classify Each Constraint

For each constraint, determine its type:

| Type | Definition | Test | Examples |
|------|------------|------|----------|
| **HARD** | Physics/math/reality | Would violating this break laws of nature? | Speed of light, thermodynamics, gravity |
| **SOFT** | Policy/choice/convention | Could a decision-maker change this? | "We use AWS", "REST APIs only", budget limits |
| **ASSUMPTION** | Unvalidated belief | Has this been tested? What's the evidence? | "Users won't accept that", "Too expensive" |

### Step 3: Challenge Each Non-Hard Constraint

For SOFT constraints, ask:
- Who made this decision and why?
- What would happen if we violated it?
- What's the cost of keeping vs. removing it?
- Is the original reason still valid?

For ASSUMPTIONS, ask:
- What evidence supports this?
- Has anyone tested the opposite?
- What would prove this wrong?
- Are we confusing correlation with causation?

### Step 4: The "Remove It" Test

For each soft constraint and assumption:

> "If we removed this constraint entirely, what would become possible?"

If removing it unlocks significant value, it's worth challenging.

### Step 5: Find the Hidden Assumptions

Look for implicit constraints that weren't even stated:
- "Of course we need a database" - Do we?
- "Obviously this needs authentication" - Does it?
- "Users expect a web interface" - Do they?

The most dangerous constraints are the ones so assumed they're never stated.

---

## Output Template

```markdown
## Constraint Analysis: [Subject]

### All Stated Constraints
1. [Constraint 1]
2. [Constraint 2]
3. [Constraint 3]
...

### Classification

#### HARD Constraints (Physics/Reality)
| Constraint | Why It's Hard | Cannot Be Changed Because |
|------------|---------------|---------------------------|
| [X] | [Physics law] | [Would violate reality] |

#### SOFT Constraints (Policy/Choice)
| Constraint | Who Decided | Original Reason | Still Valid? | If Removed? |
|------------|-------------|-----------------|--------------|-------------|
| [X] | [Person/team] | [Why] | [Yes/No/Maybe] | [What's possible] |

#### ASSUMPTIONS (Unvalidated)
| Assumption | Evidence | Counter-Evidence | Test To Validate |
|------------|----------|------------------|------------------|
| [X] | [What supports it] | [What contradicts] | [How to prove/disprove] |

### Hidden Constraints Found
- [Implicit assumption 1 that was never stated]
- [Implicit assumption 2]

### Constraints Worth Challenging
1. **[Constraint]**: [Why it should be challenged, what becomes possible]
2. **[Constraint]**: [Why it should be challenged, what becomes possible]

### Recommended Actions
- [ ] Validate assumption: [X] by [method]
- [ ] Challenge soft constraint: [Y] with [stakeholder]
- [ ] Accept hard constraint: [Z] and design around it
```

---

## Challenge Questions Library

### For Technical Constraints
- Is this a language/framework limitation or a fundamental limitation?
- Could a different technology remove this constraint?
- Is this "impossible" or just "hard with current approach"?
- What would it take to make this possible?

### For Business Constraints
- Is this budget fixed or is it the budget for "the obvious solution"?
- Would a 10x better solution justify a different budget?
- Is this timeline real or arbitrary?
- What's the actual cost of missing this deadline?

### For Security Constraints
- Is this control preventing a real attack or a theoretical one?
- What's the actual threat model?
- Is this security or security theater?
- What would an attacker do if this control didn't exist?

### For User Experience Constraints
- Have we tested this with actual users?
- Is "users won't accept this" based on data or assumption?
- Are we confusing user needs with user habits?
- What if users are wrong about what they want?

### For Architectural Constraints
- Is this pattern required or just familiar?
- What would we build if we'd never seen the current solution?
- Is this complexity necessary or accumulated?
- Could a simpler solution work?

---

## Example: Challenging "Enterprise Software Requirements"

### Stated Constraints
1. Must support 10,000 concurrent users
2. Must have 99.99% uptime
3. Must integrate with SAP
4. Must pass SOC 2 audit
5. Must use approved vendor list
6. Must have 24/7 support
7. Must support IE11

### Classification

#### HARD Constraints
| Constraint | Why Hard | Cannot Change |
|------------|----------|---------------|
| (None identified) | - | - |

*Note: None of these are physics - all are choices*

#### SOFT Constraints
| Constraint | Who Decided | Original Reason | Still Valid? | If Removed? |
|------------|-------------|-----------------|--------------|-------------|
| 10k concurrent | Capacity planning | Peak load estimate | Maybe - check actual usage | Right-size infrastructure |
| 99.99% uptime | SLA template | Standard enterprise SLA | Maybe - check actual need | 99.9% = 10x cheaper |
| SAP integration | Finance team | Existing ERP | Yes - but scope negotiable | Simpler integration |
| SOC 2 | Security policy | Customer requirement | Yes - but scope matters | Focus on relevant controls |
| Approved vendors | Procurement | Risk management | Questionable | Better/cheaper options |
| 24/7 support | Sales promise | Customer expectation | Check contract | Business hours might suffice |
| IE11 support | Legacy policy | Old corporate standard | NO - IE11 is dead | Modern stack, 30% less effort |

#### ASSUMPTIONS
| Assumption | Evidence | Counter-Evidence | Test |
|------------|----------|------------------|------|
| "Need 10k concurrent" | Capacity doc | Actual peak: 847 | Check logs |
| "Customers require 99.99%" | Sales said so | No SLA penalties paid | Review contracts |
| "Must support IE11" | 2019 policy | IE11 EOL, 0.1% traffic | Check analytics |

### Constraints Worth Challenging
1. **IE11 Support**: Dead browser, removes 30% of frontend complexity
2. **10k Concurrent**: Actual usage is 847 peak - right-size saves $$$
3. **99.99% Uptime**: 99.9% is likely sufficient, 10x cost difference
4. **Approved Vendor List**: May exclude better solutions for no real risk reduction

---

## Integration with Other Skills

**RedTeam**: Use Challenge to attack the assumptions behind any idea
```
→ FirstPrinciples/Challenge on stated security controls
→ FirstPrinciples/Challenge on business model assumptions
```

**Pentester**: Use Challenge to find real vs. assumed security boundaries
```
→ FirstPrinciples/Challenge on "the firewall protects us"
→ FirstPrinciples/Challenge on trust boundaries
```

**Architect**: Use Challenge before accepting any requirement
```
→ FirstPrinciples/Challenge on NFRs (non-functional requirements)
→ FirstPrinciples/Challenge on technology choices
```

---

## After Challenge

Flow to:
- **Reconstruct** → Build solution using only hard constraints
- Back to requester with constraint analysis for decision-making
