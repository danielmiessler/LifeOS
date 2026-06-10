---
name: PAIUpgrade
description: "Generate prioritized PAI upgrade recommendations via 4 parallel threads: Thread 0 (prior-work audit — reads current Algorithm, PATTERNS.yaml, hooks, settings, recent ISAs, and KNOWLEDGE to assign Prior Status tags), Thread 1 (user context — TELOS goals, active projects, PAI system state), Thread 2 (source collection — Anthropic releases, YouTube channels, GitHub trending, custom sources), Thread 3 (internal reflections — Algorithm execution Q1/Q2 patterns). Output format: Discoveries table ranked by interestingness, then tiered Recommendations (CRITICAL/HIGH/MEDIUM/LOW) each with Prior Status (NEW/PARTIAL/DISCUSSED/REJECTED/DONE), then full Technique Details with before/after code. Every recommendation cites file:line evidence from Thread 0 — already-implemented items go to Skipped, never re-surfaced. Workflows: Upgrade, MineReflections, AlgorithmUpgrade, ResearchUpgrade, FindSources, TwitterBookmarks. USE WHEN upgrade, system upgrade, check Anthropic, new Claude features, algorithm upgrade, PAI upgrade, check bookmarks, scan bookmarks, twitter bookmarks, X bookmarks, bookmarks for upgrades, what have I bookmarked, mine reflections."
effort: high
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PAIUpgrade/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification:**
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the PAIUpgrade skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```
2. **Output text notification:**
   ```
   Running the **WorkflowName** workflow in the **PAIUpgrade** skill to ACTION...
   ```

# PAIUpgrade

**Primary Purpose:** Generate prioritized upgrade recommendations for PAI by understanding the user's context and discovering what's new in the ecosystem.

The skill runs **four parallel agent threads** that converge into personalized recommendations:

- **Thread 0** — Prior-Work Audit (Algorithm, PATTERNS.yaml, hooks, skills, recent ISAs, KNOWLEDGE, feedback memory)
- **Thread 1** — User Context (TELOS, projects, recent work, PAI state)
- **Thread 2** — Source Collection (Anthropic, YouTube, custom sources, GitHub trending)
- **Thread 3** — Internal Reflections (algorithm-reflections.jsonl)

**Thread 0 is the guard rail against recommending what's already implemented, already researched-and-deferred, or already decided against.** Synthesis MUST filter every candidate recommendation through Thread 0's state inventory — never emit a recommendation without a Prior Status assignment.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Upgrade** | "check for upgrades", "check sources", "any updates", "check Anthropic", "check YouTube", "upgrade", "pai upgrade" | `Workflows/Upgrade.md` |
| **MineReflections** | "mine reflections", "check reflections", "what have we learned", "internal improvements", "reflection insights" | `Workflows/MineReflections.md` |
| **AlgorithmUpgrade** | "algorithm upgrade", "upgrade algorithm", "improve the algorithm", "algorithm improvements", "fix the algorithm" | `Workflows/AlgorithmUpgrade.md` |
| **ResearchUpgrade** | "research this upgrade", "deep dive on [feature]", "further research" | `Workflows/ResearchUpgrade.md` |
| **FindSources** | "find upgrade sources", "find new sources", "discover channels" | `Workflows/FindSources.md` |
| **TwitterBookmarks** | "check bookmarks", "scan bookmarks", "twitter bookmarks", "X bookmarks", "bookmarks for upgrades", "what have I bookmarked" | `Workflows/TwitterBookmarks.md` |

**Default workflow:** If user says "upgrade" or "check for upgrades" without specifics, run the **Upgrade** workflow (which includes Thread 3 reflection mining).

## Output Format

**Canonical spec:** `References/OutputFormat.md` — single source of truth for section order, Prior Status legend, table columns, and hard rules. Both this skill and `Workflows/Upgrade.md` reference that file rather than inlining their own copies.

Section order: Discoveries → Recommendations → Technique Details → Interactions & Sequencing (mandatory >10 recs) → Internal Reflections → Summary → Skipped → Sources Processed.

**Print only non-empty Recommendation tiers** (no empty `🟡 MEDIUM` headers).

## Extraction Rules

**Extract, don't summarize. Techniques, not recommendations. Verify prior state before recommending.**

1. **Every output item is a TECHNIQUE** — a specific pattern, code snippet, configuration, or approach.
2. **Quote or code-block the actual content** — show exactly what was said/written.
3. **Map to PAI components** — every technique connects to a specific file, skill, workflow, or system component.
4. **Verify Prior State (Thread 0 gate)** — Before emitting ANY recommendation, confirm against Thread 0 inventory: is it already in Algorithm / PATTERNS.yaml / hooks / SKILL files / KNOWLEDGE / prior ISAs? Assign a Prior Status emoji and cite evidence. Items that are ✅ DONE go to Skipped, not Recommendations.
   - **Cross-reference recommendations against EACH OTHER (Step 6b gate)** — when the report exceeds 10 recommendations, run the interference analysis (measurement confounds, same-file collisions, input dependencies, doctrine bundling), adversarially verified by a second agent, and emit the Interactions & Sequencing section. Prior Status gates against the past; this gates against the set itself.
5. **Two mandatory description fields, ≤2 sentences each, concrete and specific:**
   - **What It Is:** the technique itself — what it does, how it works, what capability it provides
   - **How It Helps PAI:** the specific benefit — which component improves, what gap it fills
6. **Provide implementation** — show before/after code or specific steps.
7. **Skip, don't dilute** — if content has no extractable technique, put it in Skipped Content with reason.

**Source Type Labels:**

| Label | Meaning |
|-------|---------|
| `GitHub: claude-code vX.Y.Z` | Specific version release notes |
| `YouTube: Creator @ MM:SS` | Video with timestamp |
| `Docs: Section Name` | Documentation section |
| `Blog: Post Title` | Blog post |

## Configuration

**Skill Files:**
- `sources.json` — Anthropic sources config (30+ sources)
- `youtube-channels.json` — Base YouTube channels (empty by default)
- `State/last-check.json` — Anthropic state
- `State/youtube-videos.json` — YouTube state
- `State/github-trending.json` — GitHub trending state (seen repos)
- `State/twitter-bookmarks-seen.json` — Previously processed bookmark URLs

**User Customizations** (`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PAIUpgrade/`):
- `EXTEND.yaml` — Extension manifest
- `youtube-channels.json` — User's personal YouTube channels
- `user-sources.json` — Additional source definitions (e.g., `github_trending` block)

## Tool Reference

| Tool | Purpose |
|------|---------|
| `Tools/Anthropic.ts` | Check 30+ Anthropic sources (blogs, GitHub repos, changelogs, docs) for updates |

## Key Principles

1. **Extract, Don't Summarize** — pull specific techniques, never just link to sources.
2. **Quote the Source** — actual code, doc quotes, or transcript excerpts.
3. **PAI-Contextualized** — every technique maps to a specific PAI file, skill, or component.
4. **Explain "Why You"** — "this helps because your [X] currently [Y]".
5. **TELOS-Connected** — reference user's goals and challenges when explaining relevance.
6. **Skip Boldly** — if content has no extractable technique, skip it entirely.
7. **Implementation-Ready** — provide actual code changes, not vague recommendations.
8. **Claude Code Freshness via claude-code-guide** — when discoveries involve Claude Code internals (hooks, settings, slash commands, MCP, agent types, keybindings, Agent SDK, Claude API), spawn `Agent(subagent_type="claude-code-guide")` to verify PAI's current references match the latest API surface.

## Anti-Patterns (What NOT to Output)

These output patterns are **FAILURES**:

| ❌ Bad Output | Why It's Wrong | ✅ Correct Output |
|---------------|----------------|-------------------|
| "Check out R Amjad's video on Claude Code" | Points to content instead of extracting it | "@ 5:42, R Amjad shows this technique: [quote]" |
| "v2.1.16 has task management improvements" | Vague summary, no technique | "v2.1.16 adds `addBlockedBy` parameter: [code example]" |
| "Consider looking into MCP updates" | Recommendation without extraction | "MCP now supports [specific feature]: [docs quote]" |
| "This could be useful for your workflows" | Vague relevance | "This improves your Browser skill because [specific gap it fills]" |
| "Several videos covered AI agents" | Count without content | "[N] videos skipped — no extractable techniques" |
| "This helps because it improves things" | Vague benefit | "How It Helps PAI: SecurityValidator currently only blocks commands. additionalContext enables reasoning context before tool execution, making decisions more nuanced." |
| "A new hook feature" | No description of what it IS | "What It Is: PreToolUse hooks can return additionalContext that gets injected into the model's context before execution, enabling reasoning-based decisions rather than binary blocks." |
| "Top 3 Actions" or flat recommendation list | No priority tiers | Recommendations section with 🔴/🟠/🟡/🟢 tiers, each with PAI Relevance column |
| Recommendations at the bottom | Actionable items buried after technique dump | 🔥 Recommendations section appears SECOND, technique details third |
| **Recommending something already implemented** | Wastes user trust | Move to Skipped with file:line evidence |
| **Re-surfacing rejected ideas without new context** | Drift from prior decisions | Only re-recommend if reason has changed; say what changed |
| **Missing Prior Status column** | Bypasses Thread 0 gate | Every recommendation row cites evidence from Thread 0's inventory |

**The test:** if you can say "show me the technique" and there's nothing to show, you've failed.

## Workflows

- **Upgrade.md** — primary workflow; full four-thread analysis with prioritized recommendations
- **MineReflections.md** — Thread 3 standalone (deep reflection mining)
- **AlgorithmUpgrade.md** — Algorithm-version-bump-focused upgrade flow
- **ResearchUpgrade.md** — deep dive on a specific upgrade opportunity
- **FindSources.md** — discover and evaluate new sources to monitor

## Gotchas

- **A large recommendation set is itself a system — analyze it as one.** A 44-recommendation report once shipped with every row Prior-Status-gated but zero pairwise analysis; the retrofit found two high-severity measurement confounds (a fallback setting and a safety-routing behavior each silently swapping the model under an A/B eval) plus six same-file collisions. Step 6b (interference matrix + adversarial pass) is mandatory at >10 recs.
- **Check ALL sources in parallel** — Anthropic blog, changelog, YouTube channels, GitHub releases. Don't check sequentially.
- **Upgrades must not break existing skills or workflows.** Verify backward compatibility before applying.
- **Full upgrade check can take 5-7 minutes.** Use `run_in_background: true` for the outer agent.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"PAIUpgrade","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
