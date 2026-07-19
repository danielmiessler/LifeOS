---
name: Webdesign
version: 1.2.0
description: "Design and integrate web interfaces via three paths: DirectDesign (write design inline with Anthropic frontend-design philosophy — the default workhorse), native /design + /design-sync Claude Code commands (preferred for code integration and design-system sync), or ClaudeDesign (drive claude.ai/design through Interceptor — experimental visual-review fallback). USE WHEN web design, UI design, create prototype, design system, design sync, redesign site, mockup, landing page, dashboard design, design-to-code, frontend design, polish UI, design audit, brutalist/editorial/retro UI. NOT FOR illustrations/logos (use Art) or video (use Remotion)."
license: Complete terms in LICENSE.txt
effort: medium
---

## Voice Notification (REQUIRED FIRST ACTION)

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Webdesign skill", "voice_enabled": true}' > /dev/null
```

## What It Does

Designs and integrates web interfaces via two paths. ClaudeDesign drives Anthropic's `claude.ai/design` product through the Interceptor skill, then folds the result into your codebase. DirectDesign writes the design inline using Anthropic's open-source frontend-design philosophy, loaded from a local reference. Default routing: short, ad-hoc, in-codebase work goes to DirectDesign; multi-page or shareable prototypes go to ClaudeDesign.

## The Problem

Producing good web UI usually means either fighting a visual tool that can't touch your real codebase, or hand-coding from scratch and landing on the same generic defaults every time. The two failure modes pull in opposite directions: visual-first tools give you polish but a handoff gap, while writing code directly gives you integration but flat aesthetics. This skill gives you both routes under one roof — a visual round-trip through claude.ai/design when review matters, or inline design with a real aesthetic doctrine loaded when speed and in-codebase iteration matter — and routes to the right one based on the ask.

## How It Works

Webdesign covers three paths for producing web UI. **Pick the path that fits; surface options by name when intent is ambiguous.** We always drive whatever version of Claude Design is live — there is no version to pin.

### Path 1 — DirectDesign (default workhorse; {{DA_NAME}} writes the design inline)

{{DA_NAME}} writes the design directly with Anthropic's open-source `frontend-design` aesthetic doctrine loaded inline. The load-bearing prompt content is mirrored from `github.com/anthropics/skills/tree/main/skills/frontend-design` (MIT-licensed) into `References/FrontendDesignPhilosophy.md` — register list, anti-default rules, type pair recipes, motion vocabulary, color discipline. Self-contained: no runtime dependency, no browser, no auth. This is the path that has actually shipped every real design this skill has produced. Workflow: `DirectDesign`.

### Path 2 — Native Claude Design CLI (preferred for code integration + design-system sync)

Anthropic shipped first-party `/design` and `/design-sync` commands inside Claude Code (June 2026, GA on Pro/Max/Team/Enterprise — official: support.claude.com/en/articles/14604416). `/design-sync` pulls a codebase's real design system into Claude Design and pushes built changes back; `/design` creates and edits designs from the terminal. These are the deterministic, first-party replacement for the hand-rolled Interceptor handoff-bundle apparatus — prefer them for anything code-bound. Workflow: `NativeDesignSync`.

### Path 3 — ClaudeDesign via Interceptor (EXPERIMENTAL visual-review fallback)

⚠️ Unverified and currently non-functional. This path drives the `claude.ai/design` web canvas through the Interceptor skill for visual-first review. It requires an authenticated claude.ai session in the `interceptor-test` Chrome profile, which is **not currently logged in**, and it has **never been run end-to-end** (every real run of this skill used DirectDesign). Use only when you specifically want the visual web canvas AND have set up the login first. Workflows: `CreatePrototype`, `ExtractDesignSystem`, `RefinePrototype`, `WebsiteToRedesign`, `ExportToCode`, `IntegrateIntoApp`, `DeployDesign`. Tool: `DriveClaudeDesign.ts`.

### Routing rule

When the user asks for "a nice design" / "design something" without naming a path:

- **Default to DirectDesign** for short, ad-hoc, in-codebase work — speed and in-context iteration.
- **Use the native CLI (`/design-sync`)** when the job is to sync a real codebase design system or do code-bound design work and the commands are available.
- **Reach for ClaudeDesign (Path 3) only** when visual web-canvas review is explicitly wanted, and remember it needs the one-time login and is unproven.

## Integration-Aware Operation (CRITICAL)

This skill is frequently called as a **sub-step of larger site work** — writing a blog post, building an admin dashboard, shipping a marketing page. When invoked from a parent context, the skill:

- Accepts existing-project context as input: framework, token file, component directory, deployment target.
- Produces output as **diffs / patches against the existing app**, not isolated HTML files.
- Respects existing design tokens and component patterns — does NOT overwrite them unless the user requests a full redesign.
- Routes integration work through `Workflows/IntegrateIntoApp.md`.

When invoked standalone for a greenfield design, the skill produces a self-contained prototype and optionally scaffolds a new app.

## Customization

User-specific design preferences (color palette, typography, spacing grid, animation timing, framework defaults) live at:

```
$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/Webdesign/
├── PREFERENCES.md     # Design tokens, preferred frameworks
├── README.md
└── EXTEND.yaml
```

The skill reads PREFERENCES.md if present and passes those tokens into Claude Design's brief and any downstream handoff bundle. Without a customization layer, the skill defaults to Claude Design's own system-extraction output.

## Workflow Routing

**When executing a workflow, output this notification:**

```
Running **WorkflowName** in **Webdesign**...
```

| Workflow | Trigger | File |
|----------|---------|------|
| **DirectDesign** *(Path 1 — default, {{DA_NAME}} writes inline)* | "make a nice design", "design this directly", "do the design yourself", "design something cool", "frontend aesthetics", "brutalist/editorial/retro/maximalist UI", any short ad-hoc design ask without "prototype" / "mockup" / "claude design" | `Workflows/DirectDesign.md` |
| **NativeDesignSync** *(Path 2 — preferred for code work)* | "/design", "/design-sync", "design sync", "sync design system", "pull design system into Claude Design", "push code back to Claude Design", "native design command" | `Workflows/NativeDesignSync.md` |
| **CreatePrototype** *(Path 3 — experimental, drives claude.ai/design)* | "design a prototype", "create prototype", "mockup", "build a design", "claude design", "use claude.ai/design" | `Workflows/CreatePrototype.md` |
| **ExtractDesignSystem** *(Path 3)* | "extract design system", "pull tokens from", "extract brand" | `Workflows/ExtractDesignSystem.md` |
| **RefinePrototype** *(Path 3)* | "iterate on", "refine", "adjust spacing", "change color" | `Workflows/RefinePrototype.md` |
| **WebsiteToRedesign** *(Path 3)* | "redesign this site", "rebuild this URL", "modernize" | `Workflows/WebsiteToRedesign.md` |
| **ExportToCode** *(Path 3 fallback — prefer `/design-sync`)* | "export to code", "ship to code", "send to Claude Code", "process handoff" | `Workflows/ExportToCode.md` |
| **IntegrateIntoApp** *(Path 3 fallback — prefer `/design-sync`)* | "integrate this into", "patch into the app", "land in existing codebase" | `Workflows/IntegrateIntoApp.md` |
| **DeployDesign** *(Path 3)* | "deploy the design", "ship to production" | `Workflows/DeployDesign.md` |

For code-bound work (export, integration, design-system extraction/sync), **prefer Path 2 (`NativeDesignSync` → `/design-sync`)**. The Path 3 bundle workflows above remain as a documented fallback for when you're working from the web canvas, but they are unproven and need the test-profile login.

## Prerequisites (PREFLIGHT)

Path 1 (DirectDesign) needs nothing — no browser, no auth. Path 2 (native CLI) needs only a Claude subscription that includes Claude Design and a current Claude Code (`/update` if the commands don't show). **The checks below apply ONLY to Path 3 (ClaudeDesign via Interceptor):**

1. **Interceptor skill available** — `which interceptor` returns a path. If not, instruct user to invoke `Skill("Interceptor")` setup first.
2. **Authenticated claude.ai session** — the `interceptor-test` Chrome profile must be logged into claude.ai. ⚠️ It is NOT currently logged in (verified 2026-06-25 — the profile hits the marketing wall, not the app). A one-time headed login is required before any Path 3 workflow can run.
3. **Claude Design access** — the Claude subscription must include Claude Design (Pro, Max, Team, or Enterprise with admin opt-in).
4. **For `IntegrateIntoApp`**: parent-project path + framework identifier (next, astro, vitepress, vite-react, vue, vanilla) passed in context.

Missing prerequisites → halt with a clear remediation step. Never silently fall back.

## Gotchas

Accumulate lessons here. Information density is highest in gotchas.

- **Two paths, one skill.** ClaudeDesign (CreatePrototype et al.) drives `claude.ai/design`; DirectDesign has {{DA_NAME}} write the design inline using `References/FrontendDesignPhilosophy.md`. Don't conflate them. When the user's intent is ambiguous, surface both as named choices and let them pick — never silently route.
- **Native-first — code and tokens are the source of truth, Figma is not a dependency.** Import a design system by linking the repo (Claude Design reads real components and tokens from code) or uploading token/component files, never a `.fig` export. Do NOT add a Figma round-trip in either direction (design → `.fig`, or code → editable Figma frames). The bet is that design lives in the codebase, not an external interchange file. If a no-repo visual-review need ever comes up, solve it with a URL/screenshot share, not by coupling the skill to Figma.
- **DirectDesign is self-contained.** The aesthetic doctrine lives in `References/FrontendDesignPhilosophy.md` (mirrored from anthropics/skills MIT source). No runtime dependency on the upstream `frontend-design` Claude Code plugin being installed — DirectDesign works in any LifeOS environment.
- **Native `/design` + `/design-sync` are the code-bound path now (CONFIRMED).** Anthropic's official docs (support.claude.com/en/articles/14604416) document both commands, GA on Pro/Max/Team/Enterprise as of June 2026. `/design-sync` does bidirectional codebase↔design-system sync — use it instead of the Interceptor handoff-bundle apparatus for anything code-bound. Still no public REST API or MCP server; the CLI commands are the programmatic surface. If they don't show up, run `/update`.
- **The ClaudeDesign/Interceptor path (Path 3) is unproven and currently blocked.** It has never run end-to-end — every real run of this skill used DirectDesign. The `interceptor-test` profile is not logged into claude.ai, so `DriveClaudeDesign.ts` reaches the marketing wall, not the app. The tool targets controls by accessibility-tree heuristics (composer by `role=textbox`/contenteditable, send by `/send|submit/`, export by `/export/`), so a moved button is NOT the blocker — the missing auth and the native-CLI supersession are. Before trusting Path 3: log the test profile into claude.ai once, then do a single supervised run.
- **Real Chrome required.** Use the Interceptor skill — it is the only sanctioned browser automation in LifeOS. Claude Design's UI depends on claude.ai's full session state; CDP-based automation trips bot detection and drops session cookies.
- **Handoff bundles are directories, not single files.** A bundle contains `PROMPT.md`, optional `tokens.json`, `components/`, `assets/`, and framework-specific scaffolding. Treat the whole directory as the unit.
- **`frontend-design` plugin auto-activates.** When the handoff bundle is fed to Claude Code, the plugin (already installed in the official marketplace) picks up the frontend work automatically — do NOT manually invoke it.
- **Claude Design's design-system extraction runs during onboarding.** For a new codebase you want Claude Design to understand, run `ExtractDesignSystem` FIRST before `CreatePrototype` — otherwise Claude Design uses generic defaults and overrides your tokens.
- **Integration ≠ overwrite.** `IntegrateIntoApp` produces diffs on top of existing code. If the user wants a full redesign that replaces existing UI, explicitly flag this and get confirmation.
- **Canva exports are editable.** If the user wants a non-developer (marketer, founder) to refine the design, route through `Workflows/ExportToCode.md` with `--format canva`.
- **No real-time collab.** Claude Design does not support multiplayer editing like Figma. Share via URL export for async review.
- **Enterprise gate.** Enterprise accounts need an admin to enable Claude Design in Organization settings before the palette icon appears in claude.ai.
- **Session quotas.** Claude Design generation is token-heavy. As of the June 2026 update its usage shares one pool with claude.ai chat, Claude Code, and Cowork — no longer a separate quota. Pro is thin for sustained design work; Max recommended.
- **Design-system-first is the token fix.** The biggest token sink is re-inferring your brand on every pass and then correcting it. Run `ExtractDesignSystem` once so the system is a fixed reusable reference; every later generation reuses it instead of guessing. Fewer correction cycles = far fewer tokens over a project's life. This is the single highest-leverage move against quota burn.
- **Output fidelity ≠ production-ready.** Claude Design produces polished visuals, but hand-off code often needs a verification + a11y pass. Run `Tools/VerifyDesign.ts` post-integration.
- **Vision doesn't guess.** If the prompt doesn't specify responsive breakpoints, contrast requirements, or dark-mode behavior, Claude Design picks defaults that may not match the target app. Be explicit in the brief.

## Examples

**Example 1: Create a prototype from a brief**
```
User: "Design a pricing page for an AI security startup — editorial aesthetic, dark only"
→ Invokes CreatePrototype workflow
→ Preflight: Interceptor + authenticated claude.ai session
→ Composes brief with explicit aesthetic, constraints, differentiation
→ Drives claude.ai/design via Tools/DriveClaudeDesign.ts
→ Screenshots output, verifies a11y via Tools/VerifyDesign.ts
→ Returns bundle path + preview URL
```

**Example 2: Land a Claude Design prototype inside an existing Astro app**
```
User: "Integrate this prototype into ~/Projects/landing — it's an Astro site"
→ Invokes IntegrateIntoApp workflow
→ Audits target project (framework, tokens, components)
→ Runs ExtractDesignSystem first to prime Claude Design with app's real tokens
→ Translates prototype to Astro conventions via frontend-design plugin
→ Produces unified diff against the working tree
→ Pauses for human review before applying
→ Applies patch on a branch, runs tests, screenshots in-context
```

**Example 3: Redesign an existing live site**
```
User: "Redesign example.com — modernize, keep the copy, make it brutalist"
→ Invokes WebsiteToRedesign workflow
→ Captures current state (screenshot + HTML + tokens)
→ Writes critique (what works, what's dated, what to preserve)
→ Composes rebuild brief with explicit aesthetic and preserve list
→ Drives Claude Design with critique + original screenshot as input
→ Iterates via RefinePrototype until satisfied
→ Hands off to IntegrateIntoApp or ExportToCode
```

## File Organization

```
skills/Webdesign/
├── SKILL.md                          # This file — routing + gotchas
├── README.md                         # Public-facing intro
├── Workflows/
│   ├── DirectDesign.md               # Path 2 — {{DA_NAME}} writes inline (no claude.ai round-trip)
│   ├── CreatePrototype.md            # Path 1 — drives claude.ai/design
│   ├── ExtractDesignSystem.md
│   ├── RefinePrototype.md
│   ├── WebsiteToRedesign.md
│   ├── ExportToCode.md
│   ├── IntegrateIntoApp.md
│   └── DeployDesign.md
├── Tools/
│   ├── DriveClaudeDesign.ts          # Interceptor wrapper for claude.ai/design
│   ├── ProcessHandoffBundle.ts       # Parse bundle → structured brief
│   └── VerifyDesign.ts               # Screenshot + a11y probe
└── References/
    ├── FrontendDesignPhilosophy.md   # Aesthetic doctrine — load-bearing for DirectDesign (MIT-attributed mirror)
    ├── ClaudeDesignCapabilities.md   # What Claude Design does / doesn't do
    ├── InputFormats.md               # Prompt patterns, codebase prep
    ├── ExportFormats.md              # html / pdf / pptx / canva / url / bundle
    └── HandoffBundleSpec.md          # Bundle structure for Claude Code handoff
```

## Execution Log


```json
{"ts":"ISO8601","workflow":"CreatePrototype","brief":"one-line","outputs":["path1","path2"],"duration_s":42}
```

This log is read-only metadata; it is not part of the public skill distribution.
