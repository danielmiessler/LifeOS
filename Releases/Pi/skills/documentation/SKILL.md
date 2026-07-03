---
name: documentation
description: Code documentation generation and README authoring. API docs, inline comments, README structure, changelog conventions, architecture decision records, and docstring standards. USE WHEN document, README, API docs, documentation, write docs, changelog, docstring, user guide, technical writing.
metadata:
  author: pai
  version: 1.0.0
---

# Documentation — Authoring

## README Structure

1. **Title & Description** — One-liner + 2-3 sentence overview
2. **Quick Start** — Install, configure, run in 3 steps
3. **Usage** — Code examples for common tasks
4. **API Reference** — Functions, classes, parameters (auto-generated)
5. **Configuration** — Environment variables, config files
6. **Architecture** — High-level system overview (optional)
7. **Contributing** — How to build, test, submit PRs
8. **License** — SPDX identifier

## Docstring Standards

### Function/Method
```
Description of what the function does.
Args:
    param_name: Description of param
Returns:
    Description of return value
Raises:
    ErrorType: When this happens
```

### Class
```
Description of the class purpose and usage.
Attributes:
    attr_name: Description of attribute
```

## Changelog

```
## [1.1.0] — 2025-03-15
### Added
- New feature X
### Changed
- Updated Y behavior
### Fixed
- Bug in Z
```

## Documentation Principles

- **Audience-aware**: Adjust for users vs. contributors vs. operators
- **Executable**: Examples should be copy-pasteable
- **Minimal**: Every word earns its place
- **Maintained**: Outdated docs are worse than no docs
