# Full Cycle Workflow

**Level 3 Science - Research-grade methodology for macro-scale problems**

For problems spanning weeks to months, requiring statistical rigor, stakeholder review, or external publication. This is the complete scientific method with all safeguards.

---

## When to Use

- Product strategy or architectural decisions
- Research for publication or sharing
- Multi-stakeholder decisions requiring documented methodology
- Long-running experiments (A/B tests, pilot programs)
- When you need to convince skeptics with rigorous evidence
- Anything where getting it wrong is very expensive

## Anti-Triggers (Don't Use When)

- Problem can be solved in a day
- Quick iteration is more valuable than rigor
- Premature formalism would delay learning
- The stakes don't justify the overhead

---

## The Complete Scientific Cycle

### Phase 0: Research Protocol Design

Before starting, document the methodology itself.

```markdown
# Research Protocol: [Project Name]

**Principal Investigator:** [Who owns this]
**Date:** [Start date]
**Expected Duration:** [Timeline]

## Research Question
[The fundamental question we're trying to answer]

## Significance
[Why this matters - what decisions hinge on the answer?]

## Methodology Overview
[High-level approach]

## Ethical Considerations
[Any concerns about how we're testing]

## Peer Review
[Who will review methodology before execution?]

## Version History
| Version | Date | Changes |
|---------|------|---------|
| 1.0     | Date | Initial protocol |
```

### Phase 1: Goal Definition with Pre-Registration

**Pre-commit to success criteria before gathering evidence.**

This prevents moving goalposts and confirmation bias.

```markdown
## Pre-Registered Goal Specification

**Primary Outcome:**
[The main thing we're measuring]

**Success Criteria (PRE-REGISTERED - cannot change post-hoc):**
- [ ] [Quantitative criterion 1 with exact threshold]
- [ ] [Quantitative criterion 2 with exact threshold]
- [ ] [Qualitative criterion with clear rubric]

**Secondary Outcomes:**
- [Exploratory measurement 1]
- [Exploratory measurement 2]

**Statistical Significance Threshold:**
[e.g., p < 0.05, or Bayesian equivalent]

**Minimum Effect Size:**
[What delta matters practically, not just statistically?]

**Stopping Rules:**
- Stop early if: [condition]
- Continue until: [condition]

**Pre-Registration Timestamp:** [When this was locked]
**Pre-Registration Witness:** [Who reviewed before data collection]
```

### Phase 2: Comprehensive Context Gathering

**Literature review and baseline establishment.**

```markdown
## Context Report

### Literature Review
| Source | Key Finding | Relevance | Quality |
|--------|-------------|-----------|---------|
| [Ref]  | [Finding]   | [How it applies] | [High/Med/Low] |

### Prior Art
- [What exists in this space]
- [What has been tried before]
- [Why previous attempts succeeded/failed]

### Baseline Measurements
| Metric | Current Value | Collection Method | Confidence |
|--------|---------------|-------------------|------------|
| [Name] | [Value ± error] | [How measured] | [High/Med/Low] |

### Stakeholder Map
| Stakeholder | Interest | Influence | Concerns |
|-------------|----------|-----------|----------|
| [Name]      | [What they care about] | [High/Med/Low] | [Worries] |

### Constraints Analysis
- **Time:** [Hard deadline or flexible?]
- **Budget:** [Resource limits]
- **Technical:** [System constraints]
- **Political:** [Organizational dynamics]
- **Ethical:** [Boundaries we won't cross]
```

### Phase 3: Hypothesis Generation with Devil's Advocate

**Multiple hypotheses with active attempts to disprove each.**

```markdown
## Hypothesis Set

### Hypothesis 1: [Name]

**Claim:** [Precise, testable statement]

**Theoretical Basis:** [Why might this be true?]

**Supporting Evidence:**
1. [Evidence point 1]
2. [Evidence point 2]

**Challenging Evidence (Devil's Advocate):**
1. [Counter-evidence 1]
2. [Counter-evidence 2]

**Falsification Criteria:**
- This hypothesis is FALSE if: [specific observable outcome]

**Bayesian Prior:** [Initial probability estimate before testing]

**Competing Hypotheses:** [Which other hypotheses conflict with this one?]

---
[Repeat for minimum 5 hypotheses]
```

**Hypothesis Quality Checklist:**
- [ ] Is it specific enough to be testable?
- [ ] Is it falsifiable (could evidence prove it wrong)?
- [ ] Have we seriously considered counter-evidence?
- [ ] Is it distinct from other hypotheses?
- [ ] Would confirming it actually tell us what to do?

### Phase 4: Experiment Design with Controls

**Rigorous experimental design.**

```markdown
## Experiment Design: [Name]

### Variables
**Independent Variable (what we're changing):**
[Precise definition]

**Dependent Variable (what we're measuring):**
[Precise definition]

**Control Variables (what we're holding constant):**
- [Variable 1]: held at [value]
- [Variable 2]: held at [value]

**Confounding Variables (what might skew results):**
- [Confounder 1]: mitigated by [strategy]
- [Confounder 2]: mitigated by [strategy]

### Control Group
**Design:** [How we're establishing baseline]
**Size:** [N required for statistical power]

### Treatment Group(s)
**Design:** [What intervention/change]
**Size:** [N required]

### Randomization
[How subjects/cases are assigned to groups]

### Blinding
- Single-blind: [who is blinded]
- Double-blind: [if applicable]

### Power Analysis
**Effect size expected:** [Minimum delta to detect]
**Sample size required:** [N]
**Power:** [e.g., 80%]

### Data Collection Protocol
1. [Step 1 - exactly how to collect]
2. [Step 2]
3. [Step 3]

### Analysis Plan (PRE-REGISTERED)
[Exactly what statistical tests will be run]
[How will we handle missing data?]
[What corrections for multiple comparisons?]
```

### Phase 5: Execution with Audit Trail

**Run experiments with complete documentation.**

```markdown
## Execution Log

### Experiment: [Name]
**Started:** [Timestamp]
**Ended:** [Timestamp]
**Executed By:** [Who]

### Protocol Deviations
| Date | Deviation | Reason | Impact Assessment |
|------|-----------|--------|-------------------|
| [Date] | [What changed] | [Why] | [How it affects validity] |

### Data Collection Log
| Timestamp | Data Point | Value | Collector | Notes |
|-----------|-----------|-------|-----------|-------|
| [Time]    | [Metric]  | [Value] | [Who] | [Context] |

### Anomalies Observed
- [Unexpected event 1]: [Description and impact]
- [Unexpected event 2]: [Description and impact]

### Raw Data Location
[Path to preserved raw data - never modify raw data]
```

### Phase 6: Statistical Analysis

**Rigorous analysis with appropriate methods.**

```markdown
## Statistical Analysis

### Descriptive Statistics
| Group | N | Mean | SD | Median | Range |
|-------|---|------|----|---------| ------|
| Control | [N] | [M] | [SD] | [Med] | [Min-Max] |
| Treatment | [N] | [M] | [SD] | [Med] | [Min-Max] |

### Inferential Statistics
**Test Used:** [Name of test and justification]
**Results:**
- Test statistic: [Value]
- p-value: [Value]
- Confidence interval: [Range]
- Effect size: [Value and interpretation]

### Assumption Checks
- Normality: [Met/Violated] - [How addressed]
- Homogeneity of variance: [Met/Violated] - [How addressed]
- Independence: [Met/Violated] - [How addressed]

### Bayesian Analysis (if applicable)
**Prior:** [Distribution]
**Posterior:** [Updated distribution]
**Bayes Factor:** [Value and interpretation]

### Sensitivity Analysis
[How robust are results to different assumptions?]
```

### Phase 7: Analysis Against Pre-Registered Goals

**Honest comparison - no moving goalposts.**

```markdown
## Results vs. Pre-Registered Criteria

### Primary Outcome
| Pre-Registered Criterion | Required | Achieved | Status |
|-------------------------|----------|----------|--------|
| [Criterion 1]           | [Value]  | [Value]  | ✅/❌  |
| [Criterion 2]           | [Value]  | [Value]  | ✅/❌  |

### Hypothesis Verdicts
| Hypothesis | Prior | Posterior | Verdict | Confidence |
|------------|-------|-----------|---------|------------|
| H1         | [%]   | [%]       | CONFIRMED/REFUTED | [High/Med/Low] |
| H2         | [%]   | [%]       | CONFIRMED/REFUTED | [High/Med/Low] |

### Unexpected Findings
[Results that emerged but weren't pre-registered]
*Note: These are exploratory and require replication*

### Limitations
1. [Methodological limitation 1]
2. [Methodological limitation 2]
3. [Generalizability concerns]

### Alternative Interpretations
[What other explanations for results are possible?]
```

### Phase 8: Iteration Planning

**Based on findings, plan next steps.**

```markdown
## Iteration Plan

### If Primary Goal Met
- [ ] Document methodology for future reference
- [ ] Communicate findings to stakeholders
- [ ] Implement winning approach
- [ ] Set up ongoing monitoring

### If Primary Goal Not Met
- [ ] Analyze why hypotheses failed
- [ ] Generate new hypotheses based on learnings
- [ ] Design next cycle experiments
- [ ] Consider paradigm shift (is the whole frame wrong?)

### Knowledge Transfer
**Key Learnings:**
1. [Generalizable insight 1]
2. [Generalizable insight 2]

**Methodology Improvements for Next Time:**
1. [Process improvement 1]
2. [Process improvement 2]

**Follow-Up Research Questions:**
1. [New question emerged 1]
2. [New question emerged 2]
```

---

## Artifacts Produced

A Full Cycle produces these documentation artifacts:

1. **Research Protocol** - Pre-registered methodology
2. **Context Report** - Literature review and baseline
3. **Hypothesis Document** - All hypotheses with priors
4. **Experiment Design** - Detailed methodology
5. **Execution Log** - Complete audit trail
6. **Statistical Report** - Analysis results
7. **Findings Report** - Conclusions and recommendations
8. **Iteration Plan** - Next steps

---

## Peer Review Checkpoints

| Phase | Review Required | Reviewer(s) |
|-------|-----------------|-------------|
| Protocol Design | Methodology approval | Domain expert |
| Pre-Registration | Goal lock | Stakeholder |
| Experiment Design | Validity check | Statistician |
| Analysis | Results verification | Independent analyst |
| Conclusions | Interpretation review | Diverse perspectives |

---

## When to Pivot or Stop

**Pivot the entire approach when:**
- Fundamental assumption proves false
- Environment changed significantly
- Better opportunity emerged
- Stakeholder priorities shifted

**Stop early when:**
- Clear failure with no recovery path
- Resources better spent elsewhere
- Ethical concerns emerged
- Goal achieved early

**Document the decision:** Even pivots and stops generate learnings.
