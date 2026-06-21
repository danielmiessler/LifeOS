# Seed Workflow

Bootstrap a draft project ISA from an existing repository's README, code structure, recent commits, and any pre-existing PRD-shaped artifacts. Used when a project predates the ISA framework and needs to be brought into the system without inventing fiction.

## When to invoke

- The Algorithm at OBSERVE on a project that has no `<project>/ISA.md` and the task is non-trivial: `Skill("ISA", "seed <project-path>")`
- User directly when onboarding a project: `Skill("ISA", "seed ~/Projects/<repo>")`
- Lazy-seed migration: a project's first task triggers Seed before any other workflow.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| project_path | yes | Repository root (where the new `ISA.md` will be written) |
| name | no | Project name; defaults to basename of project_path |
| tier | no | Default E3 (the project ISA minimum). Override to E4/E5 for fully-fleshed bootstrap. |
| dry_run | no | Default false. If true, emit the proposed ISA to stdout instead of writing. |

## Output

A new file at `<project_path>/ISA.md` populated with draft content sourced from the repository. Status report:

```yaml
status: created | dry_run | exists
path: <project_path>/ISA.md
sources_consulted:
  - README.md
  - package.json
  - tsconfig.json
  - last 30 git commits
  - existing PRD.md / SPEC.md / acceptance.yaml (if found)
sections_drafted: [Problem, Vision, Out of Scope, Constraints, Goal, Criteria, Test Strategy, Features]
sections_skipped: [Principles, Decisions, Changelog, Verification]   # left for user to author
isc_count: 18
review_required: true
```

## Procedure

### Step 2 — Refuse if ISA already exists

If `<project_path>/ISA.md` exists, abort and emit `status: exists`. Seed never overwrites — the user uses Interview or Scaffold to deepen an existing project ISA.

### Step 3 — Inventory the repository

Read in this priority order:

1. `README.md` — primary signal for Vision, Goal, sometimes Problem.
2. `package.json` — name, description, dependencies (informs Constraints — runtime, frameworks).
3. `tsconfig.json` / `bun.lockb` / `wrangler.toml` / `vite.config.*` — Constraints (runtime, deploy target).
4. Recent 30 git commits — informs Features (what's actively being built).
5. Pre-existing PRD-shaped artifacts: `PRD.md`, `SPEC.md`, `SPECS.md`, `acceptance.yaml`, `acceptance.ts`, `requirements.md`. These become source material; cite them in Decisions.
6. Top-level directory structure — informs Features (auth/, ui/, api/, etc. → feature units).

### Step 4 — Draft Problem (from README + repository signals)

If the README has a "Why" or "Motivation" section, lift it. Otherwise, infer from the README intro: "What does this repo solve that wasn't solved before?" Keep it 1–3 sentences.

### Step 5 — Draft Vision (from README)

Lift the README's headline pitch + any "What it feels like to use this" prose. If the README is dry, leave Vision as a stub with a comment: `<!-- TODO: author Vision — what does euphoric surprise look like for this project? -->`

### Step 6 — Draft Out of Scope

Mine for explicit "this is NOT" / "out of scope" / "we don't" / "non-goals" in README and PRD-shaped artifacts. If nothing found, leave a stub with a TODO comment.

### Step 7 — Draft Constraints

Inferred from package.json, tsconfig, deploy configs:
- Runtime constraints (Bun-only, Node-compatible, etc.)
- Framework constraints (Hono, Astro, VitePress)
- Deploy constraints (Cloudflare Workers, GitHub Pages)
- Dependency constraints (zero deps, specific dep versions)

### Step 8 — Draft Goal

If the project has a clear deliverable (a CLI, a website, an app), state it as 1–3 sentences. Otherwise, lift the README headline.

### Step 9 — Draft Criteria from existing test files / acceptance criteria

If the repo has `*.test.ts` files, walk them; each test name is a candidate ISC source. Convert to atomic ISCs preserving the granularity rule. Apply Splitting Test.

If there's a `acceptance.yaml` or pre-existing checklist, port each entry to an ISC.

If there is **no test suite or acceptance file**, draft 6–10 conservative ISCs covering build/deploy/typecheck plus the most obvious functional outcomes from README. Mark these `[ ]` and add a Decisions entry: "ISCs ISC-1..N seeded from README. To be refined by the user."

Always include at least one anti-criterion derived from Out of Scope.

### Step 10 — Draft Test Strategy

For each ISC that has an obvious probe (build command, type-check, deploy command), populate the Test Strategy entry. Leave others as `# TODO` markers.

### Step 11 — Draft Features from directory structure + recent commits

For each top-level subdirectory of `src/` or main project directory, propose a Feature. Cross-reference recent commit messages to identify active features. Set `satisfies:` from ISCs that match each feature, `depends_on:` from inferable dependencies.

### Step 12 — Skip Principles, Decisions, Changelog, Verification

These are author-driven. Leave them out (Bitter Pill — empty sections never appear). Add a final TODO note in Decisions: "Seed-generated draft. Run `Skill('ISA', 'interview me on <path>')` to fill Principles, refine Vision and Goal, audit Criteria."

### Step 13 — Write the file

Write `<project_path>/ISA.md` with the drafted sections. Frontmatter:

```yaml
---
project: <name>
task: "Project ISA — <name>"
effort: <tier>
effort_source: explicit
phase: observe
progress: 0/<isc-count>
mode: interactive
started: <ISO-8601>
updated: <ISO-8601>
---
```

### Step 14 — Surface the review reminder

Emit `review_required: true` in the report. Seed is a **draft** — the human-author pass is mandatory before the ISA is treated as authoritative. The user's first Algorithm task on the project should run Interview to refine.

## What Seed does NOT do

- **Does not invent fiction.** If the README is empty, the Vision section is empty. Don't fabricate to make the doc look complete.
- **Does not score AI-generated content.** Seed produces stubs; Interview produces depth.
- **Does not run CheckCompleteness.** Seeded ISAs are explicitly partial; running CheckCompleteness against a seeded ISA at E4 will fail by design.
- **Does not commit.** Seed writes the file; the user decides when to commit.

## Failure modes

- **No README:** abort with error. Seed needs at least one prose source. The user can manually create a stub README or run Scaffold from a prompt instead.
- **Repository is too large:** if `git log --oneline | wc -l` > 5000, sample the most recent 100 commits for Features inference rather than walking everything.
- **Pre-existing ISA detected:** abort with `status: exists`. Refuse to overwrite. Suggest Interview instead.
