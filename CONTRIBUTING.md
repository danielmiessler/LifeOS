# Contributing to PAI v5.0 Port

This fork ports the PAI v5.0 Life Operating System to Hermes Agent, Pi-mono, and OpenCode. Contributions are welcome.

## What Needs Help

| Area | Skills Needed | Difficulty |
|------|--------------|------------|
| **New skill packs** | Porting upstream PAI packs to Hermes SKILL.md format | Medium |
| **Pi-mono** | Expanding skill packs, testing with different LLM providers | Medium |
| **OpenCode** | Improving context files, testing with Codex CLI | Easy |
| **Documentation** | READMEs, examples, tutorials | Easy |
| **Testing** | Verifying skills work end-to-end | Medium |
| **Pulse daemon** | Building a lightweight Hermes-compatible Pulse | Hard |

## Porting a PAI Pack to Hermes

Each Hermes skill is a SKILL.md file in `targets/hermes/skills/<name>/`:

```markdown
---
name: pai-<name>
description: "What it does. USE WHEN <trigger conditions>. NOT FOR <exclusions>."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, <category>, <tags>]
    related_skills: [<related skills>]
---

# Skill Name

## Overview

Brief description.

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "action" | What to do |

## Procedure

### Step 1 — Voice notification
curl command to localhost:31337/notify

### Step N — Action
Step-by-step instructions using Hermes tools

## Gotchas

Known pitfalls.

## Execution Log

JSONL append command.
```

## Standards

- **Descriptions** must include `USE WHEN` and `NOT FOR`
- **All skills** need: Gotchas, Execution Log, voice notification curl
- **Frontmatter** must have: name, description, version, author, license, metadata
- **Version** is always `5.0.0`
- **Author** is always `PAI v5.0 → Hermes Port`
- **One concern per commit** — isolate fixes from features

## Pull Request Process

1. Fork the repo
2. Create a branch: `feat/<skill-name>` or `fix/<description>`
3. Run the CI checks locally: `bash .github/workflows/validate-port.yml` (or use `act`)
4. Open a PR against `main`
5. CI must pass before merge

## Spec / Documentation

Spec changes go in `spec/`. If you change behavior, update the parity matrix at `spec/port-complete/parity-matrix.md`.
