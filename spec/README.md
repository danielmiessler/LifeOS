# PAI v5.0 Spec — Reader's Guide

This directory defines the **Personal AI Infrastructure v5.0** — a Life Operating
System. The spec is technology-agnostic and targets three ports: Hermes Agent,
OpenCode (Codex CLI), and Pi-mono agent.

## How the Spec Is Organized

9 core documents (01–09) plus 3 supplementary files:

| File | What It Covers |
|------|----------------|
| **index.md** | Entry point — system overview, architecture layers (DA / PULSE / CORE), the 7-phase Algorithm, ISA primitive, skill system, memory tiers, and target systems |
| **01-functional-requirements.md** | Numbered features (FR-01..FR-N) — every capability the system must provide |
| **02-business-rules.md** | Business rules (BR-01..BR-N) — logic constraints and invariants |
| **03-data-model.md** | Entities, relationships, field definitions, and constraints |
| **04-api-contracts.md** | Endpoints, methods, request/response shapes |
| **05-flow-maps.md** | Mermaid sequence/flow diagrams for every major flow |
| **06-error-handling.md** | Error states, recovery strategies, and fallback behaviors |
| **07-config-deployment.md** | Config keys, environment variables, deployment topology, scaling |
| **08-edge-cases.md** | Boundary conditions, known quirks, and tricky states |
| **09-test-catalog.md** | Test cases that must still pass after porting |
| **port-plan.md** | Architecture definitions for each target (Hermes, OpenCode, Pi-mono) |
| **port-complete/parity-matrix.md** | FR-by-FR coverage matrix — which targets implement which features (PASS / PARTIAL / MISSING) |
| **port-complete/migration-guide.md** | Step-by-step setup instructions for each target |

## How to Navigate

1. **Start with index.md** — understand the three layers, the Algorithm, and the
   ISA before diving into details.
2. **FRs + Business Rules** — read 01 and 02 next for the what and the why.
3. **Data + APIs** — 03 and 04 give the structural contracts.
4. **Flows + Errors** — 05 and 06 show how it works at runtime and how it fails.
5. **Config + Edge Cases + Tests** — 07, 08, 09 are reference material for
   implementors.
6. **Port Plan + Parity Matrix** — consult when adapting to a specific target.

## Confidence Levels

Each spec document may annotate statements with a confidence level:

- **HIGH** — Derived directly from the reference source; stable and reliable.
- **MEDIUM** — Inferred from multiple sources or partial evidence; plausible but
  cross-check before implementing.
- **LOW** — Speculative or reconstructed from incomplete source; validate with
  the original PAI v5.0 codebase before treating as authoritative.

Confidence labels appear inline as `[HIGH]`, `[MEDIUM]`, or `[LOW]` markers.
When confidence is unstated, assume MEDIUM.

## Cross-References

Documents link to each other by document number (e.g., "see FR-12 in
01-functional-requirements.md"). The parity matrix maps every FR to its port
status. When in doubt about whether a feature exists in your target, check
the matrix first.
