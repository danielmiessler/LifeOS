# The Nine Articles of Development

## Preamble

Each article binds an agent only when that article is explicitly cited by the agent's system prompt, a skill workflow it runs, or the task it receives. Loading this file is not binding; citation is. Adapted from [GitHub Spec Kit](https://github.com/github/spec-kit).

## Core Articles

### I. Library-First Principle

Every feature MUST begin its existence as a standalone library. No feature shall be implemented directly within application code without first being abstracted into a reusable library component.

This principle enforces modular design from inception. Libraries must be self-contained, independently testable, and documented. A clear purpose is required — no organisational-only libraries.

### II. CLI Interface Mandate

Every library MUST expose its functionality through a command-line interface. CLI interfaces MUST:

- Accept text as input (via stdin, arguments, or files)
- Produce text as output (via stdout); errors via stderr
- Support JSON format for structured data exchange
- Support a human-readable format for direct user inspection

This principle enforces observability and testability by making functionality accessible through text-based interfaces.

### III. Test-First Imperative (NON-NEGOTIABLE)

This is NON-NEGOTIABLE. All implementation MUST follow strict Test-Driven Development. No implementation code shall be written before:

1. Unit tests are written
2. Tests are validated and approved by the user
3. Tests are confirmed to FAIL (Red phase)

Only after these three gates pass does implementation begin.

### IV. Integration Testing

Implementation MUST be exercised by integration tests at the points where contracts and boundaries actually live. Focus areas requiring integration tests:

- New library contract tests
- Contract changes (additions, removals, signature changes)
- Inter-service communication boundaries
- Shared schemas and data formats

### V. Observability

Code MUST be debuggable and observable from the outside.

- The text I/O protocol established by Article II provides one observability channel — text streams are inherently inspectable
- Structured logging is required for non-trivial workflows
- State transitions, decisions, and errors MUST be recoverable from logs or output

### VI. Versioning & Breaking Changes

Library releases MUST declare a version following MAJOR.MINOR.PATCH semantics. Breaking changes require an explicit MAJOR bump and a documented migration plan.

- MAJOR — incompatible interface changes
- MINOR — additive, non-breaking changes
- PATCH — fixes, clarifications, internal refactoring

Internal modules and untagged components MAY use looser conventions; external interfaces MUST declare a version.

### VII. Simplicity Gate

Implementation MUST start with the minimum: maximum 3 projects for initial implementation. Additional projects require documented justification. No future-proofing. Start simple.

Justifications MUST be specific — a named requirement, a measurable scaling threshold, a verified user need. Aesthetic preferences do NOT meet the bar.

### VIII. Anti-Abstraction Gate

Use framework features directly rather than wrapping them in unnecessary layers. Trust the framework. When the framework provides a primitive, use the primitive — do not introduce a wrapper unless the wrapper resolves a documented constraint.

Overrides MUST document which primitive is wrapped and why.

### IX. Integration-First Testing

Tests MUST use realistic environments:

- Prefer real databases over mocks
- Use actual service instances over stubs
- Contract tests are mandatory before implementation

## Governance

1. **Article precedence.** Where an agent's prompt and an Article's intent conflict on work covered by the agent's explicit reference to these Articles, intent wins.

2. **Implementation override.** Agent prompts and skill workflows MAY refine the *implementation* of any Article. Refinements MUST preserve intent.

3. **Attribution.** Adapted from [GitHub Spec Kit](https://github.com/github/spec-kit) (MIT-licensed). The Articles' wording draws from spec-kit's `spec-driven.md` and `templates/constitution-template.md`.
