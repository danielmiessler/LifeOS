---
name: RootCauseAnalysis
description: "Structured incident investigation grounded in Toyota Production System, Kaoru Ishikawa, James Reason's Swiss Cheese model, Dean Gano's Apollo method, and Google SRE blameless-postmortem culture. Five workflows: FiveWhys (linear/branching causal chain, single-thread incidents), Fishbone/Ishikawa (6 M's or 4 P's category mapping, multiple suspected areas), Postmortem (blameless timeline + contributing factors + action items, wraps other methods), FaultTree (AND/OR gate logic, safety-critical multi-path failures), KepnerTregoe IS/IS-NOT (distinction analysis, subtle hard-to-reproduce defects). Context files: Foundation.md (Toyoda, Ishikawa, Reason, Gano, Google SRE; canonical methods), MethodSelection.md (decision flow for workflow selection). Core axiom: proximate cause is where analysis starts, not ends. Humans are never root causes — if a human could make the mistake, the system allowed it. A cause is \"root enough\" when it's actionable. Also supports FMEA-style pre-launch risk inversion (what could fail before it does). Integrates with Science (hypothesis generation during investigation) and RedTeam (stress-test remediations). NOT FOR structural/systemic loops and feedback archetypes (use SystemsThinking) or axiom decomposition (use FirstPrinciples). USE WHEN root cause, RCA, 5 whys, fishbone, postmortem, incident analysis, why did this happen, fault tree, what really caused this, why does this keep failing, blameless, defect investigation, recurring bug, pre-launch risk."
effort: high
context: fork
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/RootCauseAnalysis/`

If this directory exists, load and apply any `PREFERENCES.md`, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# RootCauseAnalysis Skill

Structured investigation of *why* something failed — beyond the proximate cause, down to the contributing factors and latent conditions that actually made the failure possible. Grounded in Toyota Production System (Sakichi Toyoda), Kaoru Ishikawa, James Reason's Swiss Cheese model, Dean Gano's Apollo method, and Google SRE / Etsy blameless-postmortem culture.

The goal is not to find "the" root cause — that framing is almost always wrong. The goal is to identify **contributing factors** that are **actionable**. A good RCA ends with changes that prevent a class of failure, not just the specific incident.

## Core Concept

Five axioms this skill operates on:

1. **Proximate cause ≠ root cause.** "The deploy failed because X crashed" is usually where real analysis *starts*, not where it ends.
2. **There is rarely one cause.** Incidents typically have multiple contributing factors — active failures (what a human did) and latent conditions (what the system allowed). James Reason's Swiss Cheese model.
3. **Humans are not root causes.** "Operator error" is a stop sign for analysis, not a conclusion. If a human could make the mistake, the system allowed it. Go deeper.
4. **Actionability is the stop condition.** A cause is "root enough" when it points to a change you can actually make. Go too shallow and you miss the fix; go too deep ("physics") and you can't act on it.
5. **RCA is a bias-fight.** Hindsight bias, confirmation bias, single-cause bias, and outcome bias all actively corrupt investigations. Structure exists to resist them.

## Use / Win

**When to use:**

- **Any incident or outage** — production failure, security event, deploy gone bad.
- **Recurring defects** — bugs of the same shape keep appearing despite fixes.
- **Quality problems** — metrics drifting, users reporting the same class of issue.
- **Postmortems** — structured, blameless review of an incident's causal chain.
- **Pre-launch risk analysis** — inverting RCA with FMEA to catch failure modes before they happen.
- **Security investigations** — chain of events, contributing controls, latent conditions.
- **Process failures** — a person or team consistently missing a mark. Structure is probably the cause.

**What you win:**

- **Actionable contributing factors** (plural) rather than a single blame target.
- **Latent conditions surfaced** — the Swiss cheese holes lining up that nobody knew were there.
- **Durable fixes** — structural changes, not patches to the specific failure.
- **Blame-free analysis** — the team can be honest about what happened without self-protective omissions.
- **Cross-incident pattern recognition** — after a few RCAs, the repeated latent conditions become visible.
- **Discipline against bias** — structured methods force you past the first plausible story.

**Default mental model:** If the same failure class could happen again tomorrow, you haven't done RCA — you've done triage.

## Workflow Routing

Route to the appropriate workflow based on the request.

| Workflow | Trigger | File |
|----------|---------|------|
| **FiveWhys** | "5 whys", "five whys", quick causal chain, ask why until root | `Workflows/FiveWhys.md` |
| **Fishbone** | "fishbone", "ishikawa", categorized cause map, 6 M's / 4 P's / 8 M's | `Workflows/Fishbone.md` |
| **Postmortem** | "postmortem", "incident review", "blameless postmortem", production incident | `Workflows/Postmortem.md` |
| **FaultTree** | "fault tree", "fta", top-down deductive, safety-critical, AND/OR logic | `Workflows/FaultTree.md` |
| **KepnerTregoe** | "kepner tregoe", "is/is-not", "what changed", distinction analysis, subtle defects | `Workflows/KepnerTregoe.md` |

## Quick Reference

- **5 workflows** — FiveWhys, Fishbone, Postmortem, FaultTree, KepnerTregoe
- **5 Whys:** Linear/branching causal chain. Best for simple, single-thread incidents.
- **Fishbone:** 6 M's (Manpower, Machine, Method, Material, Measurement, Mother-Nature) for manufacturing; 4 P's (People, Process, Policies, Procedures) for service. Use when multiple category causes are suspected.
- **Postmortem:** Timeline + contributing factors + action items. Blameless framing mandatory.
- **Fault Tree:** AND/OR gate logic, deductive, top-down. Best for safety-critical and complex multi-path failures.
- **Kepner-Tregoe IS/IS-NOT:** Identify distinctions between where the problem occurred and where it did not. Best for subtle, hard-to-reproduce defects.

**Context files (loaded on demand):**
- `Foundation.md` — Toyoda, Ishikawa, Reason, Gano, Google SRE; canonical methods
- `MethodSelection.md` — decision flow for which workflow to use

## Method Selection Guide

| Situation | Preferred workflow |
|-----------|---------------------|
| Single-thread incident, one clear failure point | **FiveWhys** |
| Multiple suspected categories (people, process, tools) | **Fishbone** |
| Production outage or security incident, needs formal review | **Postmortem** |
| Complex multi-path failure, safety-critical, need Boolean logic | **FaultTree** |
| Subtle defect, hard to reproduce, "why here and not there?" | **KepnerTregoe** |

For non-trivial incidents: **Postmortem wraps the others.** Start with a Postmortem structure, use 5 Whys / Fishbone / FTA inside it as investigation tools.

## Integration

**Depends on:** nothing — standalone analytical skill.

**Works well with:**
- **SystemsThinking** — RCA stops at contributing factors; SystemsThinking continues down to structure and mental models. Pair them when patterns repeat across incidents.
- **FirstPrinciples** — decompose a contributing factor to its fundamental truths before fixing.
- **RedTeam** — "how would we cause this again?" is adversarial RCA. Use RedTeam to stress-test remediations.
- **Science** — RCA *is* the scientific method applied to failures. Use Science for hypothesis generation during investigation.

## Examples

**Example 1: Production outage**
```
User: "the payments service went down for 14 minutes last night"
→ Postmortem workflow
→ Timeline: deploy at 23:47 → health check passed → traffic shift 23:49 → p99 latency spike 23:51 → auto-rollback 00:01
→ 5 Whys inside: Why did p99 spike? Cold cache. Why cold? New pod group. Why no warm? No warm-up in deploy script. Why? Not in checklist. Why? Template predates the caching layer.
→ Contributing factors: deploy template stale (latent); no warm-up step (active); no cache-cold canary (latent)
→ Remediation: update deploy template, add warm-up step, add cold-cache canary gate
```

**Example 2: Recurring defect**
```
User: "users keep reporting the same kind of auth failure, we've fixed it 3 times"
→ Fishbone workflow
→ 6 M's expansion: People (ops auth rotates keys without notifying infra), Method (no key-rotation runbook), Machine (secret cache TTL exceeds rotation window), Material (shared key instead of per-service), Measurement (no key-expiry dashboard), Mother-Nature (none)
→ Root causes (multiple): Method + Material + Measurement all contribute. Single-point fix won't hold.
```

**Example 3: Subtle defect**
```
User: "this flaky test only fails in CI, not locally"
→ KepnerTregoe workflow
→ IS/IS-NOT table: fails on CI / passes locally; fails Tuesdays / not other days; fails on shared runners / not dedicated; fails with parallel test workers / not serial
→ Distinctions point to: time-zone + concurrency + shared file system
→ Hypothesis: test relies on local timezone assumption + race condition on shared /tmp — both only triggered in CI's environment.
```

## Best Practices

1. **Always blameless.** The framing is "what system allowed this" not "who screwed up." Non-negotiable; corrupts the analysis otherwise.
2. **Multiple causes, always.** Single-root-cause conclusions are almost always wrong. Name at least three contributing factors before stopping.
3. **Actionability test every cause.** Can you change it? If no — go shallower. If yes — go one level deeper to make sure you've found the lever.
4. **Timelines before theories.** Reconstruct what happened before hypothesizing why. Hindsight bias compresses the timeline.
5. **Ask "who else could make this mistake?"** If the answer is "anyone on the team," it's a systemic cause, not individual error.
6. **Separate investigation from judgment.** Never let the incident review drift into performance conversations. Separate meeting.

## Gotchas

- **"Human error" is a starting point, not a root cause.** It's where the investigation begins. Every human error sits on top of a system that made the error possible or probable.
- **The first plausible cause is almost never the only one.** Confirmation bias loves RCA. Keep going after you find one.
- **Stopping at proximate cause is failure.** "X crashed because Y returned null." Why did Y return null? Why wasn't null handled? Why wasn't that tested? Go down.
- **Going too deep ≠ good RCA.** "The fundamental cause is the second law of thermodynamics" is not actionable. Stop at the deepest actionable level.
- **Asking "why" more than ~5 times often means you switched causal chains.** Re-draw as a tree, not a line.
- **Don't confuse correlation with cause.** Two things happening together is a hypothesis to test, not a conclusion.
- **Outcome bias is sneaky.** Decisions that turn out badly get judged harshly even if they were right given the information at the time. Separate process quality from outcome.

---

**Attribution:** Frameworks drawn from Sakichi Toyoda (5 Whys, Toyota Production System), Kaoru Ishikawa (*Guide to Quality Control*, 1968; Fishbone diagram), James Reason (*Human Error*, 1990; Swiss Cheese model), Dean Gano (*Apollo Root Cause Analysis*, 2008), Charles Kepner & Benjamin Tregoe (*The Rational Manager*, 1965), Google SRE book, Etsy blameless postmortem culture (John Allspaw).

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"RootCauseAnalysis","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```
