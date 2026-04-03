---
name: Telos
pack-id: danielmiessler-telos-v1.0.0
version: 1.0.0
author: danielmiessler
description: Life OS and project analysis — goals, dependencies, beliefs, wisdom, books, movies, narrative points, interview extraction, McKinsey reports, and project dashboards
type: skill
purpose-type: [life-os, project-analysis, personal-context, dashboards]
platform: claude-code
dependencies: []
keywords: [telos, life-os, goals, beliefs, projects, dependencies, narrative-points, interview-extraction, McKinsey-report, dashboard, wisdom, books, movies]
---

# Telos

> Telic Evolution and Life Operating System -- a dual-purpose framework for personal life context and organizational project analysis with narrative generation, dashboards, and McKinsey-style reporting.

---

## The Problem

People accumulate goals, beliefs, lessons, and project knowledge over years, but this context is scattered across notebooks, documents, and memory. AI assistants start every session with zero understanding of who you are and what matters to you. Meanwhile, organizations have project data spread across markdown files and spreadsheets with no structured way to extract insights. You end up:

- **Re-explaining yourself** -- telling the AI your goals, beliefs, and priorities every time you want thoughtful advice
- **Losing life lessons** -- wisdom from books, experiences, and mistakes never gets captured in a queryable format
- **Drowning in project data** -- markdown files and CSVs full of project context but no way to see the big picture
- **Missing dependencies** -- not seeing how problems connect to goals connect to strategies connect to projects
- **Manual reporting** -- spending hours building executive summaries and dashboards that could be generated from structured data

The fundamental issue: your life context and your project context are both rich but unstructured. There is no system that captures both and turns them into actionable intelligence.

---

## The Solution

TELOS (Telic Evolution and Life Operating System) is a comprehensive context-gathering system with two applications:

**Personal TELOS** -- Your life context system stored at `~/.claude/PAI/USER/TELOS/`:
- Core philosophy: mission, beliefs, wisdom, mental models, frames, narratives, strategies
- Life data: books, movies, lessons learned, things you were wrong about
- Goals and challenges: goals, projects, problems, challenges, predictions, traumas
- Change tracking: timestamped update log with automatic backups

**Project TELOS** -- Analysis framework for any organization or project directory:
- Relationship discovery across all markdown and CSV files
- Dependency mapping: problems to goals to strategies to projects
- Progress tracking with metrics and KPIs
- Narrative generation for presentations (configurable bullet count with n= parameter)
- McKinsey-style report generation with professional web-based output
- Interactive dashboards built with Next.js, shadcn/ui, and Aceternity

Four dedicated workflows handle structured operations:

1. **Update** -- Add to personal TELOS with automatic backups and change logging
2. **InterviewExtraction** -- Extract structured content from interview transcripts
3. **CreateNarrativePoints** -- Generate slide-ready bullet points from TELOS context
4. **WriteReport** -- Produce McKinsey-style web reports with cover pages, executive summaries, findings, and roadmaps

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill router | `src/SKILL.md` | Top-level TELOS skill with routing, context detection, and analysis methodology |
| Update workflow | `src/Workflows/Update.md` | Add entries to personal TELOS files with backup and change logging |
| InterviewExtraction workflow | `src/Workflows/InterviewExtraction.md` | Extract structured data from interview transcripts |
| CreateNarrativePoints workflow | `src/Workflows/CreateNarrativePoints.md` | Generate slide-ready narrative bullet points |
| WriteReport workflow | `src/Workflows/WriteReport.md` | Generate McKinsey-style web reports |
| UpdateTelos tool | `src/Tools/UpdateTelos.ts` | TypeScript tool for TELOS file updates |
| Dashboard template | `src/DashboardTemplate/` | Full Next.js dashboard application with shadcn/ui components, API routes, sidebar navigation, and pages for overview, teams, progress, and vulnerabilities |
| Report template | `src/ReportTemplate/` | Next.js report application with cover page, sections, findings, recommendations, timeline, and professional typography (custom fonts included) |

**Summary:**
- **Workflows:** 4 (Update, InterviewExtraction, CreateNarrativePoints, WriteReport)
- **Tools:** 1 TypeScript tool
- **Templates:** 2 full Next.js applications (Dashboard, Report)
- **Dependencies:** None for core skill; bun/npm for dashboard and report template builds

---

## What Makes This Different

This sounds similar to a note-taking system or a project management dashboard. What makes this approach different?

TELOS is not a static note system -- it is a structured context layer that your AI reads to understand your life and your projects. When you add a book to TELOS, the AI can later reference it when giving you advice. When you point TELOS at a project directory, it does not just list files -- it discovers relationships, traces dependency chains, identifies bottlenecks, and generates executive-quality narratives. The dashboard and report templates are not wireframes; they are complete Next.js applications ready to run.

- Personal and project analysis in one unified skill
- Context auto-detection: "my goals" routes to personal TELOS, "analyze this project" routes to project analysis
- Narrative generation with configurable bullet count (n=24, n=12, etc.) for presentations
- McKinsey-style reports generated as running web applications, not static PDFs
- Dashboard builds use up to 16 parallel engineers for fast generation
- All personal TELOS updates are backed up with timestamps before modification

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "add Project Hail Mary to my TELOS books" | Routes to Update workflow, creates backup, adds book entry, logs change |
| "update my goals" | Routes to Update workflow for GOALS.md |
| "what are my beliefs?" | Reads personal TELOS BELIEFS.md and presents contents |
| "analyze ~/Projects/MyApp with TELOS" | Scans directory for .md and .csv files, runs relationship and dependency analysis |
| "build a dashboard for TELOSAPP" | Launches parallel engineers to build Next.js dashboard from project data |
| "create TELOS narrative for Acme Corp, n=24" | Routes to CreateNarrativePoints, generates 24 slide-ready bullet points |
| "write a TELOS report for Acme Corp" | Routes to WriteReport, generates McKinsey-style web report |
| "extract interviews from transcripts" | Routes to InterviewExtraction workflow |

---

## Example Usage

### Updating Personal TELOS

```
User: add "The Three-Body Problem" to my TELOS books

AI responds:
Running the Update workflow in the Telos skill to add a book entry...

[Creates timestamped backup of BOOKS.md]
[Adds formatted book entry with metadata]
[Logs change in updates.md with timestamp]

Done. Added "The Three-Body Problem" to your TELOS books.
Previous version backed up.
```

### Project Analysis

```
User: analyze ~/Projects/Acme with TELOS

AI responds:
Running TELOS project analysis on ~/Projects/Acme...

[Scans all .md and .csv files in directory tree]
[Extracts entities, relationships, and dependencies]
[Maps: PROBLEMS --> GOALS --> STRATEGIES --> PROJECTS]

Analysis:
- 23 entities discovered across 14 files
- 3 critical dependency chains identified
- 2 bottlenecks blocking progress on strategic goals
- 78% of projects aligned with stated objectives
- 4 risk areas: overdue items in Q2 roadmap
```

### Narrative Generation

```
User: create TELOS narrative for Acme Corp, n=24

AI responds:
Running the CreateNarrativePoints workflow in the Telos skill...

[Analyzes TELOS context: situation, problems, recommendations]
[Generates 24 crisp bullet points, 8-12 words each]

Narrative Points (24):
1. Revenue growth stalled at 12% due to market saturation
2. Engineering team capacity stretched across too many initiatives
3. ...
[24 slide-ready bullet points]
```

### McKinsey-Style Report

```
User: write a TELOS report for Acme Corp

AI responds:
Running the WriteReport workflow in the Telos skill...

[Generates narrative points first]
[Maps to McKinsey report structure]
[Builds web-based report with professional styling]

Report generated at ~/Projects/Acme/report/
Run `bun dev` to view. Includes:
- Cover page with executive framing
- Executive summary
- Key findings with severity ratings
- Recommendations with implementation timeline
- Strategic roadmap
```

---

## Configuration

No configuration required for project analysis.

Personal TELOS requires the TELOS files to exist at `~/.claude/PAI/USER/TELOS/`. These are created as part of PAI setup, not by this skill pack.

| Configuration | Location | Purpose |
|--------------|----------|---------|
| Personal TELOS files | `~/.claude/PAI/USER/TELOS/` | Life context: beliefs, goals, books, wisdom, etc. |
| Dashboard theme | `DashboardTemplate/` config files | Modify Tokyo Night Day color scheme |
| Report typography | `ReportTemplate/Public/Fonts/` | Custom fonts for McKinsey-style reports |
| Skill customizations | `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Telos/` | Per-user preferences and overrides |

---

## Customization

### Recommended Customization

No customization needed -- the skill works as-is for both personal and project analysis.

### Optional Customization

| Customization | Location | Impact |
|--------------|----------|--------|
| Dashboard color scheme | `DashboardTemplate/App/globals.css` | Change from Tokyo Night Day theme |
| Report fonts | `ReportTemplate/Public/Fonts/` | Swap professional typography |
| Report structure | `Workflows/WriteReport.md` | Modify McKinsey report sections |
| Narrative point count | n= parameter at invocation time | Default varies; specify explicitly for control |
| Add TELOS file types | `SKILL.md` valid files list | Track additional life dimensions |

---

## Credits

- **Original concept:** Daniel Miessler -- developed as part of the [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) system
- **Inspired by:** The desire to give AI persistent understanding of a person's life context and to bring structured analysis to organizational data

---

## Related Work

- **PAI USER Directory** -- The `~/.claude/PAI/USER/TELOS/` directory where personal TELOS files live
- **PAI Algorithm** -- The structured workflow system that coordinates multi-phase analysis and report generation

---

## Works Well With

- **Thinking Pack** -- Council debates and First Principles analysis complement TELOS project analysis
- **Security Pack** -- Security sub-domains (Recon, WebAssessment) provide data that TELOS can map into organizational dashboards

---

## Changelog

### 1.0.0 - 2026-03-15
- Initial release
- Dual-purpose skill: personal life OS and project analysis
- Four workflows: Update, InterviewExtraction, CreateNarrativePoints, WriteReport
- Full Next.js dashboard template with shadcn/ui and Aceternity
- Full Next.js report template with professional typography
- Automatic backup and change logging for personal TELOS updates
- Dependency chain mapping and bottleneck detection for projects
- Configurable narrative point generation for presentations
