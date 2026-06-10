# Upgrade Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Upgrade workflow in the PAIUpgrade skill to check for upgrades"}' \
  > /dev/null 2>&1 &
```

Running the **Upgrade** workflow in the **PAIUpgrade** skill to check for upgrades...

**Primary workflow for PAIUpgrade skill.** Generates prioritized upgrade recommendations by running four parallel agent threads: prior-work audit, user context analysis, source collection, and internal reflection mining.

**Trigger:** "check for upgrades", "upgrade", "any updates", "check Anthropic", "check YouTube", "pai upgrade"

---

## Overview

Four parallel threads, then synthesize:

0. **Thread 0 (MANDATORY):** Prior-Work Audit — inventory current Algorithm, PATTERNS.yaml, hooks, skills, recent ISAs, KNOWLEDGE, feedback memory.
1. **Thread 1:** User context (TELOS, projects, recent work, PAI state).
2. **Thread 2:** External sources (Anthropic, YouTube, custom, GitHub trending).
3. **Thread 3:** Internal reflections (algorithm-reflections.jsonl).
4. **Synthesize:** filter discoveries against Thread 0 inventory; assign Prior Status; emit deltas only.
5. **Output:** prioritized upgrade report — every recommendation row carries Prior Status with file:line evidence.

Thread 0 output gates synthesis. No recommendation may be emitted without a Prior Status tag citing evidence from Thread 0.

---

## Execution

### Step 0: Launch Thread 0 — Prior-Work Audit (MANDATORY)

Spawn 5 parallel agents (`subagent_type=Explore`) to inventory current PAI state. Each returns an inventory with file:line evidence.

**Agent 0a — Algorithm & Capabilities**
Read: `~/.claude/PAI/ALGORITHM/LATEST` + the file it points to, `~/.claude/PAI/ALGORITHM/capabilities.md`, `mode-detection.md`, `~/.claude/PAI/DOCUMENTATION/Algorithm/AlgorithmSystem.md`.
Extract: phase definitions and gates, verification doctrine (advisor rules, live-probe, conflict resolution), preflight gates, capabilities table, mode-detection triggers, browser-first / env-probe / feedback-memory-lookup / parallelization rules.
Return: state inventory with file:line evidence, ≤500 words.

**Agent 0b — Security Patterns & Inspectors**
Read: `~/.claude/PAI/USER/SECURITY/PATTERNS.yaml`, `~/.claude/hooks/SecurityPipeline.hook.ts`, `~/.claude/hooks/security/pipeline.ts`, `~/.claude/hooks/security/inspectors/*.ts`.
Extract: every pattern category (name + regex summary + action), inspector coverage (Pattern, Egress, Rules, Prompt, Injection), Bash bypass coverage (backslash-escaped flags, /dev/tcp/, /dev/udp/, env-var-prefixed commands, /proc/, git filter-branch, ptrace), deny/ask/allow precedence.
Return: inventory with file:line evidence; flag what's present AND what's missing.

**Agent 0c — Hooks & Settings**
Read: `~/.claude/settings.json` (hooks, env, permissions, pai sections); list `~/.claude/hooks/*.hook.ts`.
Extract: hook inventory by event (SessionStart, PreToolUse, PostToolUse, Stop, PreCompact, etc.), orphaned hooks (on disk but unwired), empty event arrays, notable env/permission/pai values.
Return: inventory with file:line evidence; flag wiring gaps.

**Agent 0d — Recent Decisions & Feedback Memory**
Scan: top 20 most-recent `~/.claude/PAI/MEMORY/WORK/` dirs (skim ISAs), `MEMORY/KNOWLEDGE/`, `MEMORY/LEARNING/`, `~/.claude/projects/-$(whoami)--claude/memory/feedback_*.md`, `project_*.md`.
Extract: recent decisions affecting upgrades (rejected/deferred/completed), relevant feedback entries, KNOWLEDGE entries that explicitly evaluated proposals.
Return: inventory with paths; flag anything that would DENY a future recommendation.

**Agent 0e — Skill Surface**
Scan: `~/.claude/skills/*/SKILL.md` (description fields), `~/.claude/skills/_PAI/TOOLS/*.ts`, `~/.claude/skills/CreateSkill/Tools/*.ts` (validators).
Extract: skill counts/categories, existence of Monitor/Advisor/PreCompact wrappers, CreateSkill description-length cap, ToolActivityTracker capture scope (diffs? stdout? git state?).
Return: inventory with file:line evidence.

**Output of Thread 0:** combined STATE INVENTORY with canonical file:line evidence per capability. Synthesis uses this to assign Prior Status.

### Step 1: Launch Thread 1 — User Context

Spawn 4 parallel agents (`subagent_type=general-purpose`):

**Agent 1 — TELOS:** read `~/.claude/PAI/USER/TELOS/*.md`. Extract current high-priority goals, active focus areas, key challenges, project themes.

**Agent 2 — Recent Work:** read `~/.claude/PAI/MEMORY/STATE/work.json` and recent `MEMORY/WORK/` dirs (last 7 days). Extract active projects, recurring patterns, open tasks, recent accomplishments.

**Agent 3 — PAI State:** list `~/.claude/skills/`, `~/.claude/hooks/`, read `~/.claude/settings.json`. Extract installed skills, active hooks, configuration highlights, obvious gaps or opportunities.

**Agent 4 — Tech Stack:** from PROJECTS.md and recent work, identify primary languages, frameworks, deployment targets, key integrations.

### Step 2: Launch Thread 2 — Source Collection

Spawn 4 parallel agents (`subagent_type=general-purpose`):

**Agent 1 — Anthropic Sources**
Run: `bun ${CLAUDE_SKILL_DIR}/Tools/Anthropic.ts`.
For each finding (release notes, GitHub commits, doc updates), extract specific techniques: exact syntax/API/configuration, quoted documentation showing usage, which PAI component this improves, before/after code where applicable. Skip findings with no concrete technique. Do NOT return vague "new release available" entries.

**Agent 2 — YouTube Channels**
1. Load channel config: `bun ~/.claude/PAI/TOOLS/LoadSkillConfig.ts ../youtube-channels.json`.
2. For each channel: `yt-dlp --flat-playlist --dump-json 'https://www.youtube.com/@channelhandle/videos' 2>/dev/null | head -5`.
3. Compare against `../State/youtube-videos.json`.
4. For new videos: `bun ~/.claude/PAI/TOOLS/GetTranscript.ts '<video-url>'`.
5. From each transcript, extract specific techniques: code patterns, configurations, command examples, with timestamps and exact quotes. Skip videos with no extractable techniques.

**Agent 3 — Custom Sources**
Check `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PAIUpgrade/` for additional source definitions beyond YouTube and GitHub trending. If sources exist, check them for updates. Return findings, or empty list with note "No custom sources configured".

**Agent 4 — GitHub Trending**
1. Load `github_trending` config from `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PAIUpgrade/user-sources.json`. If `enabled: false` or missing, return `{ github_trending: false, note: "disabled or not configured" }`.
2. `LOOKBACK_DATE = today - lookback_days` (default 14).
3. For each `query` in `github_trending.queries`:
   ```bash
   gh api 'search/repositories?q=QUERY+created:>LOOKBACK_DATE+stars:>MIN_STARS&sort=SORT&order=desc&per_page=RESULTS' \
     --jq '.items[] | {name, stars, description, url, topics, created, language}'
   ```
4. Dedup against `../State/github-trending.json`.
5. For each NEW repo, read README (`gh api 'repos/OWNER/REPO/readme' --jq '.content' | base64 -d | head -500`). Assess PAI relevance. Extract specific techniques/architectures/patterns. Skip forks, low-quality, irrelevant.
6. Save updated seen-list to `../State/github-trending.json`.
7. Focus on INSPIRATION (architectural decisions, novel approaches), not just repo names.

Return within 90s; reduce per_page to 3 if slow.

### Step 2a: Claude Code Freshness Check (parallel with Thread 2)

Spawn `Agent(subagent_type="claude-code-guide", run_in_background: true)`:

Verify PAI's Claude Code references against the latest API surface. Check: hook event types, slash commands, agent/subagent types, settings.json fields, MCP integration, Agent SDK, Claude API. For each area, return current features, recent additions, deprecated items, and PAI staleness risk (LOW/MEDIUM/HIGH). Focus on changes affecting hooks, skills, or Algorithm. Return within 90s.

Output feeds Step 5 (Filter and Score) as source type `Claude Code Guide` and is cross-referenced against current PAI files for staleness.

### Step 2b: Launch Thread 3 — Internal Reflection Mining

Spawn 1 parallel agent (`subagent_type=general-purpose`):

Read `~/.claude/PAI/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl`. Full methodology: `Workflows/MineReflections.md`. Quick summary:
1. Parse each line as JSON.
2. Prioritize entries with `implied_sentiment <= 5`, `within_budget: false`, or `criteria_failed > 0`.
3. Cluster Q2 answers (algorithm improvements) by similarity.
4. Cluster Q1 answers (execution patterns).
5. Themes with 2+ occurrences (or 1 if sentiment ≤ 4) become upgrade candidates.

Return: entries analyzed (N), date range, list of upgrade candidates (theme, frequency, signal HIGH/MEDIUM/LOW, root cause, proposed fix, target files, supporting Q2 quotes), execution warnings (recurring Q1 mistakes), aspirational insights (Q3 patterns).

If file is missing or empty: `{ entries_analyzed: 0, note: "No reflections found yet — they accumulate after Standard+ Algorithm runs" }`. Return within 60s.

### Step 3: Wait and Collect

Wait for all 14 agents (5 prior-work + 4 context + 4 source + 1 reflection). Thread 0's STATE INVENTORY is the canonical reference document for synthesis.

### Step 4: Synthesize User Context

Merge Thread 1 results into a unified context object covering: TELOS goals/focus/challenges, recent_work projects/patterns/open_tasks, pai_state skills/hooks/config, tech_stack languages/frameworks/deployment.

### Step 5: Filter, Score, Assign Prior Status

For each discovery from Thread 2 (and candidate from Thread 3):

**0. Prior State match (FIRST GATE)** — search Thread 0 inventory for the proposed concept/file/pattern/capability:
- Found with same semantics → ✅ **DONE** → Skipped Content with evidence.
- Subset present → 🔶 **PARTIAL** → scope to missing delta only.
- Deferred idea in ISA/KNOWLEDGE → 💬 **DISCUSSED** → only re-surface if reason changed; cite the change.
- Explicit rejection → 🚫 **REJECTED** → skip unless context warrants revisit; name what changed.
- Not found → 🆕 **NEW**.

**1. Relevance check** — does this relate to user's tech stack / goals / projects?
**2. Score relevance** (1-10), **impact** (1-10), **effort** (1-10, 10=easy).
**3. Priority** = (relevance × 2) + impact + effort.

Filter out relevance < 3. Filter out ✅ DONE (move to Skipped with file:line evidence).

**Mandatory before emitting:** every recommendation row has a Prior Status tag AND file:line evidence from Thread 0.

### Step 6: Generate Prioritized Recommendations

Sort by priority and tier:

- **🔴 CRITICAL** — score > 30, relevance > 8.
- **🟠 HIGH** — score 22-30, relevance > 6.
- **🟡 MEDIUM** — score 14-21, relevance > 4.
- **🟢 LOW** — score < 14, or relevance 3-4.

Each recommendation: short action name, PAI Relevance (primary framing — WHY it matters), effort (Low/Med/High), files affected.

### Step 6b: Cross-Recommendation Interference Analysis (MANDATORY when >10 recommendations)

Prior-Status gating checks each recommendation against the PAST; this step checks them against EACH OTHER. Skipping it on a large report invites measurement confounds, same-file collisions, and broken sequencing that surface only at implementation time.

**Gate:** runs whenever the recommendation count exceeds 10 — roughly where a reliable mental pairwise sweep ends (10 recommendations ≈ 45 pairs). At ≤10, the section reduces to a single line — "interference: none found across N recs" — so quick modes stay fast.

**1. Build the matrix.** Sweep all recommendation pairs for four interference classes:

| Class | What to look for | Example failure |
|-------|------------------|-----------------|
| **Measurement confound** | One rec changes the thing another rec measures (model substitution, effort/token recalibration, fallback routing, safety routing) | A fallback setting silently swaps the model under an A/B eval |
| **Same-file/surface collision** | Two recs edit the same file, hook, or invocation path | Two recs independently rewrite the same Stop hook |
| **Resource/input dependency** | One rec consumes or evicts what another rec reads | A memory-eviction rec archives the entries a mandatory-consult rec greps |
| **Doctrine/version bundling** | Multiple recs edit a single-versioned artifact (Algorithm doctrine, canonical spec) | Eight piecemeal edits to one doctrine file = eight version bumps |

**2. Adversarial verification (REQUIRED).** Hand the draft matrix plus the recommendation list to a second agent — ideally a different model family than the one that drafted it — instructed to (a) find missed pairs, (b) refute listed conflicts, (c) attack the sequencing. Resolve disputes by probing ground truth (read the actual source file), never by deferring to either model. If no second model family is available, run the pass with a fresh-context instance of the same model — adversarial framing still catches drafting blind spots — and note which reviewer ran.

**3. Every conflict gets a guard.** No identified pair ships without a named resolution: a sequencing rule, a design guard, a bundling instruction, or an explicit precondition. Conflicts without guards block the report.

**4. Emit the section.** Output as `⚠️ Interactions & Sequencing` per `../References/OutputFormat.md`: conflict table (Pair | Mechanism | Guard) + wave-ordered execution sequence + synergies worth exploiting. Tag affected recommendation rows so readers see interference before implementing.

> Origin: a 44-recommendation report shipped with every row Prior-Status-gated but zero pairwise analysis; the retrofit found two high-severity measurement confounds (a fallback setting and a safety-routing behavior each silently swapping the model under an A/B eval) plus six same-file collisions.

### Step 7: Output Report

**Canonical output format:** `../References/OutputFormat.md`. Reference example: `../References/ExampleReport.md`.

Section order: Discoveries → Recommendations → Technique Details → Interactions & Sequencing (when Step 6b ran) → Internal Reflections → Summary → Skipped → Sources Processed.

**Print only non-empty Recommendation tiers.** Empty tier headers are noise.

**Critical output rules:**
1. Discoveries first, recommendations second, details third.
2. Discoveries ≠ Recommendations — different orderings (interestingness vs priority).
3. PAI Relevance is primary in both tables.
4. Every Recommendation has a Prior Status tag with file:line evidence.
5. Quote the source (actual content or code).
6. Map every technique to a specific PAI file or component.
7. Numbered cross-references consistent across Discoveries → Recommendations → Technique Details.
8. No watch/read recommendations — extract, don't point.
9. Skip boldly — content with no technique → Skipped.
10. Two mandatory description fields, ≤2 sentences each: **What It Is** and **How It Helps PAI**.

### Step 8: Registry Update — Feed Discoveries into Algorithm

For each CRITICAL/HIGH recommendation, evaluate against the gate:

1. **Invokable** — concrete way to use it (tool call, slash command, behavioral pattern).
2. **Useful for Algorithm** — would change capability selection.
3. **Stable** — not experimental/alpha (or labeled as such).
4. **Distinct** — not duplicating an existing capability.
5. **Compact** — describable in one ~20-word table row.

| Discovery Type | Integration Target | Action |
|----------------|--------------------|--------|
| New Claude Code command/skill | Algorithm Platform Capabilities table | Propose new row |
| Enhancement to existing PAI skill | Relevant SKILL.md description | Propose updated description with workflow guidance |
| Useful behavioral pattern | Algorithm Platform Capabilities (Techniques section) | Propose new technique row |
| Major new capability | New PAI skill | Propose scaffold via CreateSkill |

Output:
```markdown
## 🔄 Registry Update Proposals

| Discovery | Gate Pass? | Integration Target | Proposed Change |
|-----------|-----------|--------------------|-----------------|
| [name] | ✅ All 5 | Algorithm table / SKILL.md | [specific text to add] |
```

If none pass: "No registry updates needed this cycle."

### Step 9: Update State

- `State/last-check.json` — updated by Anthropic.ts.
- `State/youtube-videos.json` — add newly processed video IDs.
- `State/github-trending.json` — add newly seen repo full_names.

### Step 10: Memory Redistribution & Cleanup

Scan `~/.claude/projects/-$(whoami)--claude/memory/MEMORY.md` and each referenced memory file. Triage:

| Condition | Action |
|-----------|--------|
| Redundant with system prompt or CLAUDE.md operational notes | Delete file, remove from MEMORY.md |
| Behavioral rule not yet in system prompt | Migrate to PAI_SYSTEM_PROMPT.md (constitutional) or CLAUDE.md (operational), then delete |
| Stale/resolved (problem fixed, project completed, info outdated) | Delete file, remove from MEMORY.md |
| Wrong paths or outdated references | Verify against filesystem; fix or delete |
| Valid project/user/reference, still current | Keep — update if needed |

**Version pointer check:**
- `settings.json pai.algorithmVersion` matches `Algorithm/LATEST`.
- `CLAUDE.md` Algorithm path matches `Algorithm/LATEST`.
- `SYSTEM-README.md` latest version reference matches `Algorithm/LATEST`.

Output:
```
🧹 MEMORY MAINTENANCE:
 Scanned: [N] memory files
 Deleted: [N] (redundant/stale/resolved)
 Migrated: [N] (moved to steering rules)
 Kept: [N] (still valid)
 Version pointers: [all consistent / fixed N mismatches]
```

---

## Quick Mode

If user says "check Anthropic only" or similar:
- Skip Thread 1 (use cached context if available).
- Run only the relevant Thread 2 agent.
- Lighter filtering.
- Abbreviated report.

## Error Handling

- Thread 1 fails → proceed with minimal context, note in output.
- Thread 2 fails → report which sources couldn't be checked.
- No discoveries → "No new updates found" with sources listed.
- All filtered → "Updates found but none relevant to current focus".

## Integration

- Triggered automatically (cron) or by user command.
- Discoveries feed `ResearchUpgrade` for deep dives.
- Recommendations can generate todos.
- Can trigger implementation workflows.

---

## Reference Example

See `../References/ExampleReport.md` for a complete worked example of the canonical output shape.

---

**This workflow implements the core PAIUpgrade value proposition: understanding YOU first, discovering what's new second, then connecting them into actionable, personalized upgrades.**
