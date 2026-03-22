# Indexical Grounding Detection Framework v0.1

**Purpose:** Detect linguistically fluent but experientially ungrounded AI output.

**Core Principle:** Authentic text carries indexical signals across place, group membership, experience, access rights, embodiment, and time. Failure = loss, distortion, or fabrication of those signals.

**Product term:** Indexical grounding (academic backing: sociolinguistics, forensic linguistics)
**Internal term:** Provenance markers

---

## 10 Layers

### Layer 1 - Formulaic Integrity [AUTOMATED] [HIGH]
Correct retrieval of fixed linguistic units: idioms, collocations, jargon, titles.
Failure: near-miss substitution, semantic approximation, phrase hybridization.
Test: Does any phrase feel "almost right" but off?

### Layer 2 - Regional/Identity Grounding [AUTOMATED] [HIGH]
Text anchors to a real social location: regional vocabulary, cadence, cultural references.
Failure: neutralized "global English," incorrect regional mixing, absence of expected markers.
Test: Could this have been written from anywhere?

### Layer 3 - Community-of-Practice [MANUAL] [HIGH]
Language matches how a specific group actually speaks: shorthand, taboos, status rituals.
Failure: technically correct but socially wrong phrasing, outsider framing inside insider context.
Test: Would an insider say it this way?

### Layer 4 - Register Fit [AUTOMATED] [MEDIUM-HIGH]
Appropriateness of tone, hierarchy, and interaction context: email vs LinkedIn vs Slack.
Failure: over-formalization (AI default), mismatched tone, flattened emotional stance.
Test: Is this the right way to say it, not just a correct way?

### Layer 5 - Embodied Detail [AUTOMATED] [MEDIUM]
Presence of real sensory/physical/experiential detail vs generic placeholders.
Failure: "heart racing," "game changer," "the room went silent" - narrative filler, not lived experience.
Test: Can you visualize a real moment, or is it filler?

### Layer 6 - Temporal Integrity [AUTOMATED] [MEDIUM]
Accuracy and fidelity of time, sequence, and duration.
Failure: narrative compression, clean arcs replacing messy timelines, vague sequencing.
Test: Are time references precise or story-shaped?

### Layer 7 - Provenance Safety [MANUAL] [CRITICAL]
Information used in context-appropriate way: private vs public, insider vs publishable.
Failure: leaking private call content, using privileged info for persuasion.
Test: Where did this information come from? Should the audience have access?

### Layer 8 - Cross-Layer Consistency [MANUAL] [HIGH]
All signals point to the same type of person: regional + cultural + professional coherence.
Failure: mixed identities, inconsistent voice, conflicting experience signals.
Test: Does this sound like one coherent human?

### Layer 9 - Narrative vs Truth [MANUAL] [HIGH]
Storytelling not overriding factual accuracy.
Failure: "better story" replacing real data, smoothing contradictions, premature conclusions.
Test: Does this feel too clean? Were facts verified or inferred?

### Layer 10 - Stance Authenticity [MANUAL] [MEDIUM]
Emotional/intellectual stance matches a real human position.
Failure: sanitized emotion, artificial confidence, loss of tension/uncertainty.
Test: Does this feel like a real person taking a position?

---

## Scoring (Automated Layers)

Per layer: 0 = grounded, deductions for each flag detected.
Composite: weighted average across automated layers.
Pass threshold: 70/100.

---

## Integration

| Tool | What it checks | Gate |
|------|---------------|------|
| voice-score | Style conformance (how Rob writes) | Gate 1 - Local |
| prufrock | Indexical grounding (where Rob's from) | Gate 1 - Local |
| moser-check | AI detection (ZeroGPT statistical) | Gate 2 - External |

All three should pass before high-stakes content ships.

---

## Academic Backing

- Indexicality and enregisterment (sociolinguistics)
- Idiolect and authorship analysis (forensic linguistics)
- Formulaic sequences / multi-word expressions (psycholinguistics)
- Source monitoring (cognitive psychology)
- Sociopragmatic competence (computational linguistics)
- LLM confabulation and narrative coherence (ACL 2024, Nature 2024)

---

## Origin

Discovered 2026-03-20 during LinkedIn post drafting session.
Rob identified mangled idioms as identity markers, not vocabulary errors.
CeeCee and Archie expanded to 13 failure modes.
Mirror and Gemmy provided academic grounding and taxonomy.
Named "Prufrock" by Rob. We didn't ask why.

Last updated: 2026-03-20
