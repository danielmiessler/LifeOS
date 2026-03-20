---
name: telos
description: "Life OS and project analysis — goals, dependencies, beliefs, wisdom, books, movies, narrative points, interview extraction, McKinsey reports, and project dashboards. USE WHEN Telos, life goals, projects, dependencies, books, movies, beliefs, wisdom, update TELOS, narrative points, interview extraction, write report, McKinsey report, project analysis, dashboard, n=24."
---

# Telos

**TELOS** (Telic Evolution and Life Operating System) has two applications:

1. **Personal TELOS** — {PRINCIPAL.NAME}'s life context (beliefs, goals, lessons, wisdom) at `~/.claude/PAI/USER/TELOS/`
2. **Project TELOS** — Analysis framework for organizations/projects (relationships, dependencies, goals, progress)

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Update** | "add to TELOS", "update my goals", "add book to TELOS" | `Workflows/Update.md` |
| **InterviewExtraction** | "extract content", "extract interviews", "analyze interviews" | `Workflows/InterviewExtraction.md` |
| **CreateNarrativePoints** | "create narrative", "narrative points", "TELOS report", "n=24" | `Workflows/CreateNarrativePoints.md` |
| **WriteReport** | "write report", "McKinsey report", "create TELOS report" | `Workflows/WriteReport.md` |

For general project analysis, dashboards, and dependency mapping — handle directly without a separate workflow file.

## Context Detection

| User Request | Context | Location |
|--------------|---------|----------|
| "my TELOS", "my goals", "my beliefs", "add to TELOS" | Personal | `~/.claude/PAI/USER/TELOS/` |
| "analyze [project]", "dashboard for [X]", project names | Project | User-specified directory |

---

## Personal TELOS

**Path:** `~/.claude/PAI/USER/TELOS/`

**Core Philosophy:** TELOS.md, MISSION.md, BELIEFS.md, WISDOM.md
**Life Data:** BOOKS.md, MOVIES.md, LEARNED.md, WRONG.md
**Mental Models:** FRAMES.md, MODELS.md, NARRATIVES.md, STRATEGIES.md
**Goals & Challenges:** GOALS.md, PROJECTS.md, PROBLEMS.md, CHALLENGES.md, PREDICTIONS.md, TRAUMAS.md
**Change Tracking:** updates.md

**CRITICAL:** Never manually edit personal TELOS. Use the Update workflow (automatic backups, change logging, version history).

---

## Project TELOS

For any project directory, TELOS provides:
- **Relationship Discovery** — how files/entities connect
- **Dependency Mapping** — what depends on what
- **Goal Extraction** — stated and implied objectives
- **Progress Analysis** — advancement and metrics
- **Narrative Generation** — executive summaries
- **Visual Dashboards** — interactive UIs with data

### Analysis Steps

1. **Scan** — Find all `.md` and `.csv` files in target directory
2. **Index** — Extract entities, relationships, cross-references, headings, CSV schema
3. **Analyze** — Build relationship graph, trace dependency chains (PROBLEMS → GOALS → STRATEGIES → PROJECTS)
4. **Generate** — Output as markdown report, web dashboard, JSON, or executive summary

**Validation checkpoint:** Verify dependency chains are complete (no orphaned nodes) before generating output.

### Dashboard Builds

**Tech stack:** Next.js 14 + TypeScript, shadcn/ui, Aceternity UI, Tailwind CSS, Tokyo Night Day theme.

Launch up to 16 parallel engineers via Task calls:
- Structure/layout, overview page, projects page, teams page, issues page, timeline, data parsing, shared components, design polish, integration/testing

---

## Examples

**Update personal TELOS:**
```
User: "add Project Hail Mary to my TELOS books"
--> Update workflow: backup BOOKS.md, add entry, log change in updates.md
```

**Analyze project:**
```
User: "analyze ~/Projects/MyApp with TELOS"
--> Scan .md/.csv files, extract entities/relationships/dependencies
--> Return analysis with dependency chains and progress metrics
```

**Generate narrative points:**
```
User: "create TELOS narrative for Acme Corp, n=24"
--> Analyze context (situation, problems, recommendations)
--> Return 24 crisp bullet points (8-12 words each), slide-ready
```

**McKinsey-style report:**
```
User: "write a TELOS report for Acme Corp"
--> Run CreateNarrativePoints first
--> Generate web report at {project_dir}/report (run `bun dev` to view)
--> Cover page, executive summary, findings, recommendations, roadmap
```

---

## Security & Privacy

- **Personal TELOS:** NEVER commit to public repos, never share publicly, always backup before changes
- **Project TELOS:** May contain sensitive data — ask before sharing externally, redact in examples

---

## Key Principles

1. **Dual Context** — personal (`~/.claude/PAI/USER/TELOS/`) and project (user-specified) seamlessly
2. **Auto-Detection** — determines context from user's question
3. **Flexible Discovery** — finds files regardless of directory structure
4. **Parallel Execution** — up to 16 engineers for dashboard builds
5. **Privacy-Aware** — respects sensitive data boundaries
