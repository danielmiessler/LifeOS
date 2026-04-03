# Iterative Depth — Scientific Foundation

> The practice of examining the same problem from multiple structured angles to extract deeper understanding is one of the most widely validated techniques across human inquiry.

## The Core Insight

"Iterative Depth" is not a single named technique — it is a **meta-pattern** that appears independently across virtually every serious domain of inquiry. The fact that cognitive scientists, AI researchers, requirements engineers, designers, and philosophers all independently converged on this pattern is itself strong evidence of its validity.

The pattern: **Examining the same phenomenon N times, each from a systematically different angle, yields understanding that no single examination can achieve.**

---

## Validated Techniques by Domain

### Cognitive Science & Epistemology

**1. Hermeneutic Circle** (Hans-Georg Gadamer, 1960)
Understanding emerges through iterative cycles between parts and whole. Each pass through a text refines pre-understanding, which changes what the next pass reveals. Understanding is "always on the way" — never complete from a single reading.
- *Source: Truth and Method (1960); Stanford Encyclopedia of Philosophy*
- *Maps to: Each iteration refines the "pre-understanding" of what the user wants*

**2. Triangulation** (Norman Denzin, 1970)
Using multiple methods, investigators, theories, or data sources to study the same phenomenon. Four types: method triangulation, investigator triangulation, theory triangulation, data source triangulation. Overcomes single-method bias.
- *Source: The Research Act (1970); PMC: Principles, Scope, and Limitations of Methodological Triangulation*
- *Maps to: Each iteration IS a different "method" applied to the same problem*

**3. Cognitive Flexibility Theory** (Rand Spiro et al., 1988)
Revisiting the same material from multiple perspectives at different times aids transfer to new situations and deeper understanding. "Criss-crossing the landscape" of a concept from different directions.
- *Source: Cognition and Instruction, 1988*
- *Maps to: Each lens is a different "crossing" of the problem landscape*

**4. Dialectical Thinking** (Hegel, refined by many)
Thesis-antithesis-synthesis cycles. Examining a proposition, then its negation, then integrating both into a higher understanding. Each cycle deepens the analysis.
- *Maps to: Constraint inversion and failure lenses as structured antithesis*

**5. Reflective Equilibrium** (John Rawls, 1971; Nelson Goodman, 1955)
Justified belief emerges from working back and forth between particular judgments and general principles, adjusting each in light of the other until coherence is achieved. Explicitly iterative, with no fixed endpoint.
- *Source: A Theory of Justice (1971); Fact, Fiction, and Forecast (1955); Stanford Encyclopedia of Philosophy*
- *Maps to: Each pass tests emerging understanding against a new angle, revising until the ISC model coheres*

**6. Equilibration** (Jean Piaget, 1975)
Cognitive development proceeds through cycles of disequilibrium and equilibrium. New information conflicting with existing schemas forces accommodation — restructuring mental models. This is THE driver of cognitive growth.
- *Source: The Equilibration of Cognitive Structures (1975)*
- *Maps to: Each new lens creates productive disequilibrium that forces genuine understanding forward*

**7. Abductive Reasoning** (Charles Sanders Peirce, 1903)
Generating hypotheses to explain surprising observations, then iteratively testing and revising them. Peirce characterized this as inherently provisional. Different outputs from the same prompt are different abductive hypotheses.
- *Source: Harvard Lectures on Pragmatism (1903); Stanford Encyclopedia of Philosophy*
- *Maps to: Non-determinism in AI is not noise — it's abductive hypothesis generation. A FEATURE, not a defect.*

**8. Progressive Refinement of Mental Models** (Gentner & Stevens, 1983)
Mental models develop through iterative elaboration: each pass adds detail, corrects errors, integrates new information. Early passes establish rough structure; later passes add precision and catch edge cases.
- *Source: Mental Models (1983); Johnson-Laird, Mental Models (1983)*
- *Maps to: The cognitive mechanism for WHY each successive lens pass produces deeper understanding*

**9. Multiple External Representations / DeFT Framework** (Shaaron Ainsworth, 2006)
Learning with multiple representations of the same content supports deeper understanding through complementing (different aspects), constraining (limiting errors), and constructing (building abstraction). Critically, representations must be sufficiently different — too similar wastes cycles, too different loses coherence.
- *Source: Learning and Instruction, 16(3), 183-198 (2006)*
- *Maps to: Directly validates the 2-8 pass range as well-calibrated. Also validates that lenses must be structurally different (not just re-runs)*

**10. Perspectivism** (Friedrich Nietzsche, 1887; Ronald Giere, 2006)
"The more eyes, different eyes, we train on the same matter, the more complete will our concept of it be." Giere extended this to scientific modeling — all models are irreducibly perspectival and partial.
- *Source: On the Genealogy of Morals (1887); Scientific Perspectivism (2006)*
- *Maps to: Each pass is a different "eye" — objectivity comes from accumulating partial views, not from a view from nowhere*

### AI/ML & Prompt Engineering

**11. Self-Consistency** (Wang et al., 2022)
Sample multiple diverse reasoning paths for the same problem, select the most consistent answer. Achieved +17.9% on GSM8K, +11.0% on SVAMP, +12.2% on AQuA over single-path chain-of-thought.
- *Source: arXiv:2203.11171*
- *Maps to: Multiple reasoning paths = multiple lenses on the same ISC extraction*

**12. Multi-Agent Debate** (Du et al., 2023)
Multiple AI agents examine the same problem, debate their findings, and converge on better answers through structured disagreement.
- *Source: arXiv:2305.14325*
- *Maps to: Each iteration could be a different "agent perspective"*

**13. Ensemble Methods** (Breiman, Schapire, Freund)
Combining multiple models/runs yields accuracy no single model achieves. Bagging, boosting, and random forests all exploit diverse perspectives on the same data.
- *Maps to: Combining multiple ISC extraction passes = ensemble of requirements*

**14. DiVeRSe (Diverse Verifier on Reasoning Step)** (Li et al., 2023)
Generating diverse prompts for the same problem and verifying each reasoning step. Structural diversity in prompting yields better coverage.
- *Maps to: Structurally different lenses = diverse prompt engineering*

### Requirements Engineering

**15. Viewpoint-Oriented Requirements Engineering** (Finkelstein & Nuseibeh, 1992)
Organizing requirements elicitation through multiple stakeholder viewpoints, each encapsulating partial knowledge. Inconsistencies between viewpoints reveal hidden requirements.
- *Source: Requirements Engineering Journal; IEEE Conf on RE*
- *Maps to: Each iteration adopts a different stakeholder viewpoint*

**16. Misuse Cases** (Sindre & Opdahl, 2005)
Examining the same system from an adversary's perspective to uncover security and safety requirements invisible from the user's viewpoint.
- *Maps to: The Failure/Adversarial lens*

**17. Progressive Elaboration** (PMBOK/PMI)
Iterative refinement of project understanding over time. Each pass adds detail and precision to requirements that were initially vague.
- *Maps to: Each iteration adds precision to ISC criteria*

### Design Thinking & Problem Solving

**18. Six Thinking Hats** (Edward de Bono, 1985)
Six structured perspectives (facts, emotions, risks, benefits, creativity, process) applied sequentially to the same problem. Forces systematic multi-angle examination.
- *Source: Six Thinking Hats (1985)*
- *Maps to: The direct inspiration for our 8 lenses*

**19. Causal Layered Analysis** (Sohail Inayatullah, 1998)
Examining the same phenomenon at four depth layers: litany (surface data), social/structural causes, worldview/discourse, and myth/metaphor (deep archetypes).
- *Source: Futures, 1998; metafuture.org*
- *Maps to: Progressive depth through iterations, not just different angles*

**20. Soft Systems Methodology** (Peter Checkland, 1981)
Building multiple "root definitions" of the same situation, each from a different worldview. The CATWOE analysis forces systematic perspective shifts.
- *Maps to: Each iteration builds a different "root definition" of ideal state*

---

## Key Distinction: CS Iterative Deepening vs. Iterative Depth

| Aspect | CS Iterative Deepening (IDDFS) | Iterative Depth (this technique) |
|--------|-------------------------------|----------------------------------|
| **Domain** | Graph/tree search algorithms | Problem understanding & requirements |
| **What iterates** | Depth limit of search | Perspective/angle of exploration |
| **Same path?** | Yes, revisits same nodes | No, structurally different each time |
| **Purpose** | Find optimal path in state space | Extract complete understanding |
| **Invented by** | Korf (1985) | Meta-pattern across many fields |
| **Output** | Single solution path | Enriched set of requirements/criteria |

The CS technique searches the SAME TREE deeper each time. Our technique searches the SAME PROBLEM from DIFFERENT ANGLES each time. Related in spirit (both benefit from re-examination), fundamentally different in mechanism.

---

## Why It Works: Three Mechanisms

1. **Perspective Blindness Compensation** — Any single viewpoint has blind spots. Structured rotation through viewpoints covers gaps that no individual pass catches.

2. **Productive Non-Determinism** — Even with the same lens, AI non-determinism means each pass surfaces slightly different aspects. Combined with structural variation, this becomes a feature, not a bug.

3. **Progressive Pre-Understanding** — Each iteration updates the analyst's "pre-understanding" (Gadamer), making subsequent iterations more perceptive. Pass 5 sees things Pass 1 couldn't, because Passes 2-4 changed what the analyst knows to look for.
