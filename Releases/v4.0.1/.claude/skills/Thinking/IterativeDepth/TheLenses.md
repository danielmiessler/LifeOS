# The 8 Lenses of Iterative Depth

Each lens is a structured perspective that forces exploration of a problem from a fundamentally different angle. They are ordered from most concrete to most abstract, and from most commonly useful to most specialized.

---

## Lens 1: LITERAL (Surface Requirements)
**Question:** "What did they explicitly say? What are the concrete, stated requirements?"
**Grounded in:** Requirements elicitation fundamentals
**Focus:** Parse the exact words. Identify every stated requirement, constraint, preference. No interpretation — only what was said.
**ISC Output:** Criteria for every explicitly stated requirement.
**Example prompt variation:** "List every concrete, testable requirement explicitly stated in this request. Do not infer — only extract."

---

## Lens 2: STAKEHOLDER (Who Else Cares?)
**Question:** "Who are all the people, systems, and entities affected by this? What does each need?"
**Grounded in:** Viewpoint-Oriented RE (Finkelstein & Nuseibeh), Triangulation (Denzin)
**Focus:** Identify every stakeholder beyond the requester. End users, maintainers, administrators, downstream systems, future developers. What does each need that wasn't stated?
**ISC Output:** Criteria for stakeholder needs not in the original request.
**Example prompt variation:** "Identify every stakeholder affected by this work. For each, what requirement would THEY add that the requester didn't mention?"

---

## Lens 3: FAILURE (What Goes Wrong?)
**Question:** "What could fail? What would an adversary exploit? What are the edge cases?"
**Grounded in:** Misuse Cases (Sindre & Opdahl), Pre-Mortem (Klein), STRIDE Threat Modeling
**Focus:** Assume the solution exists. Now break it. Error states, race conditions, security holes, data corruption, user confusion, performance under load. Every way this could go wrong.
**ISC Output:** Anti-criteria (what must NOT happen) and defensive criteria.
**Example prompt variation:** "This solution ships tomorrow. List every way it fails in the first week. Be adversarial."

---

## Lens 4: TEMPORAL (Past, Present, Future)
**Question:** "How does this change over time? What's the history? What happens in 6 months?"
**Grounded in:** Causal Layered Analysis (Inayatullah), Progressive Elaboration (PMBOK)
**Focus:** Why does this problem exist now? What was tried before? What changes in the future that would break this solution? Migration paths, backwards compatibility, scale changes.
**ISC Output:** Criteria for durability, migration, and future-proofing.
**Example prompt variation:** "What context created this request? What will change in 3-12 months that could invalidate this solution?"

---

## Lens 5: EXPERIENTIAL (How Should It Feel?)
**Question:** "When this works perfectly, how does the user FEEL? What's the experience?"
**Grounded in:** Appreciative Inquiry (Cooperrider), de Bono Red Hat (emotions)
**Focus:** Beyond functional correctness — the qualitative experience. Speed, elegance, surprise, delight, confidence, trust. What's the difference between "works" and "works beautifully"?
**ISC Output:** Quality-of-experience criteria that elevate from functional to euphoric.
**Example prompt variation:** "Describe the perfect user experience of this solution. What makes someone say 'this is exactly what I wanted' vs. 'this technically works'?"

---

## Lens 6: CONSTRAINT INVERSION (What If?)
**Question:** "What if we removed all constraints? What if we added extreme ones?"
**Grounded in:** TRIZ (Altshuller), Lateral Thinking (de Bono), Reframing (Dorst)
**Focus:** Remove assumed constraints — what would we build with infinite time/resources? Then add extreme constraints — what if it had to work offline, in 100ms, with zero dependencies? Both directions reveal hidden assumptions.
**ISC Output:** Criteria that challenge assumptions and reveal what's truly essential.
**Example prompt variation:** "What constraints are we assuming that weren't stated? Remove them — what changes? Now impose extreme constraints — what's truly essential?"

---

## Lens 7: ANALOGICAL (What Patterns Apply?)
**Question:** "What similar problems have been solved before? What patterns from other domains apply?"
**Grounded in:** Cognitive Flexibility Theory (Spiro), Cross-Domain Transfer
**Focus:** This problem isn't unique. What similar problems exist in other codebases, other industries, other fields? What patterns emerged there? What mistakes were made?
**ISC Output:** Criteria derived from proven patterns and lessons from analogous solutions.
**Example prompt variation:** "What are 3-5 analogous problems in other domains? What solutions worked there? What criteria would those solutions imply here?"

---

## Lens 8: META (Is This the Right Question?)
**Question:** "Are we solving the right problem? Is the framing itself correct?"
**Grounded in:** Hermeneutic Circle (Gadamer), Double-Loop Learning (Argyris), Soft Systems Methodology (Checkland)
**Focus:** Step outside the problem entirely. Is the request a symptom of a deeper issue? Is there a reframing that dissolves the problem instead of solving it? Would a different question yield a better outcome?
**ISC Output:** Criteria that reframe or expand the problem definition itself.
**Example prompt variation:** "Forget the specific request. What is the UNDERLYING need? Is there a reframing that produces a better outcome than what was asked for?"

---

## SLA-Based Lens Selection

| SLA | Lenses Used | Which Ones | Time Budget |
|-----|-------------|------------|-------------|
| **Instant** | 0 | Skip IterativeDepth entirely | 0s |
| **Fast** | 2 | Literal + Failure | <30s |
| **Standard** | 4 | Literal + Stakeholder + Failure + Experiential | <2min |
| **Deep** | 8 | All 8 lenses | <5min |

At **Fast** SLA, the two most commonly productive lenses (surface requirements + what goes wrong) run as brief internal thought exercises — not spawned agents.

At **Standard**, 4 lenses run. These can be parallelized as 2 pairs of background agents.

At **Deep**, all 8 lenses run. These can be parallelized as 4 pairs or 8 individual agents for maximum coverage.

---

## Lens Selection for Custom Depth

When invoked with a specific count (e.g., "do 3 passes"), select lenses in order from Lens 1 through Lens N. The ordering is designed so that earlier lenses are more universally applicable.

For specialized domains, the Algorithm can override lens selection:
- **Security-focused task:** Prioritize Failure, Stakeholder, Temporal
- **UX-focused task:** Prioritize Experiential, Stakeholder, Literal
- **Architecture task:** Prioritize Temporal, Constraint Inversion, Analogical
- **Ambiguous request:** Prioritize Meta, Stakeholder, Literal
