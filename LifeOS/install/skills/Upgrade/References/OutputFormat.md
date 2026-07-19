# Upgrade — Canonical Output Format

**This is the single source of truth for Upgrade output structure.** Both `SKILL.md` and `Workflows/Upgrade.md` reference this file rather than inlining their own copies.

## Section order (NON-NEGOTIABLE)

1. **✨ Discoveries** — what was found, ranked by interestingness
2. **🔥 Recommendations** — what to do, ranked by priority tier
3. **🎯 Technique Details** — full extraction with code/quotes
4. **🪞 Internal Reflections** — upgrade candidates from algorithm reflections (Thread 3)
5. **📊 Summary** — one-line totals
6. **⏭️ Skipped Content** — already-done / rejected with file:line evidence
7. **🔍 Sources Processed** — count footer

**Print only non-empty tiers** in Recommendations. If no CRITICAL items, omit that header entirely.

---

## Header

```markdown
# LifeOS Upgrade Report
**Generated:** [timestamp]
**Sources Processed:** [N] release notes | [N] videos | [N] docs | [N] GitHub queries
**Findings:** [N] techniques extracted | [N] skipped
```

---

## ✨ Discoveries

Ranked by interestingness, NOT implementation priority. A LOW-priority item can be Discovery #1 if it's the most "whoa" finding.

| # | Discovery | Source | Why It's Interesting | LifeOS Relevance |
|---|-----------|--------|----------------------|---------------|
| 1 | [name] | [source] | [≤2 sentences] | [≤1 sentence] |

---

## 🔥 Recommendations

Every row MUST carry a Prior Status tag with file:line evidence from Thread 0.

**Prior Status legend:**
- 🆕 **NEW** — no prior trace in Algorithm, PATTERNS.yaml, hooks, ISAs, KNOWLEDGE, or MEMORY
- 🔶 **PARTIAL** — partially implemented; row scopes only the missing delta
- 💬 **DISCUSSED** — appears in ISA/session/KNOWLEDGE but not shipped; confirm not deferred-by-decision
- 🚫 **REJECTED** — previously decided against; only re-surface if context changed (state what changed)
- ✅ **DONE** — already implemented; goes to Skipped Content with evidence, NOT here

### 🔴 CRITICAL — Integrate immediately
Fixes gaps, security issues, or unlocks capabilities LifeOS should already have.

| # | Recommendation | Prior Status | Evidence | LifeOS Relevance | Effort | Files Affected |
|---|---------------|-------------|----------|---------------|--------|----------------|

### 🟠 HIGH — Integrate this week
Significantly improves LifeOS capabilities or efficiency.

### 🟡 MEDIUM — Integrate when convenient
Useful capabilities or ecosystem alignment.

### 🟢 LOW — Awareness / future reference
Nice-to-know or will become relevant later.

(Emit only the tiers that have items.)

---

## 🎯 Technique Details

Numbered to match Recommendations. One block per technique.

```markdown
### From [Source Type]

#### [N]. [Technique Name]
**Source:** [exact source with version/timestamp]
**Priority:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW

**What It Is:** [≤2 sentences, concrete and specific — what the technique does, how it works, what capability it provides]

**How It Helps LifeOS:** [≤2 sentences, concrete and specific — which component improves, what gap it fills]

**The Technique:**
> [QUOTE or CODE BLOCK — actual content, not a summary]

**Applies To:** `[file path]`, [component name]
**Implementation:**
```[language]
// [Before/after or new code]
```
```

### From GitHub Trending Projects (variant)

```markdown
#### [N]. [Project Name] ([stars] ⭐)
**Source:** GitHub: [owner/repo] — [category query that found it]
**Priority:** 🔴 | 🟠 | 🟡 | 🟢

**What It Is:** [≤2 sentences]
**How It Helps LifeOS:** [≤2 sentences]

**Inspiration Techniques:**
> [Specific architectural pattern from README or code]

**Applies To:** `[LifeOS file path]`, [component]
**Potential Integration:** [key insight to borrow — not a full implementation]
```

---

## 🪞 Internal Reflections (Thread 3)

```markdown
**Source:** {{LIFEOS_DIR}}/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
**Entries analyzed:** [N] | **High-signal:** [N] (low sentiment, over-budget, or failed criteria)

### [Theme Name] ([N] occurrences, [HIGH/MEDIUM/LOW] signal)
**Root cause:** [structural issue]
**Proposed fix:** [concrete change]
**Target:** [LifeOS files affected]
**Evidence:**
- [timestamp] [task] — "[Q2 quote]"
```

If no reflections yet:
> No reflections found yet — they accumulate after Standard+ Algorithm runs.

---

## 📊 Summary

| # | Technique | Source | Priority | LifeOS Component | Effort |
|---|-----------|--------|----------|---------------|--------|

**Totals:** [N] Critical | [N] High | [N] Medium | [N] Low | [N] Skipped | [N] Internal

---

## ⏭️ Skipped Content

| Content | Source | Why Skipped | Evidence |
|---------|--------|-------------|----------|

**Already-done items MUST appear here with file:line evidence**, never in Recommendations. This is how the skill proves the Prior-Work Audit (Thread 0) ran.

---

## 🔍 Sources Processed

One-line digest of source counts and routing.

---

## Hard rules

1. **Discoveries first, recommendations second, details third** — never reorder.
2. **Discoveries ≠ Recommendations** — different orderings (interestingness vs priority).
3. **LifeOS Relevance is primary** in both Discoveries and Recommendations — explain WHY this matters for LifeOS.
4. **Every Recommendation has a Prior Status tag with file:line evidence.** No exceptions.
5. **Quote the source.** Every technique includes actual quoted content or code.
6. **Map to LifeOS.** Every technique names a specific LifeOS file or component.
7. **No watch/read recommendations.** Extract the technique; don't point to content.
8. **Skip boldly.** Content with no extractable technique → Skipped, not diluted.
9. **Numbered cross-references** are consistent across Discoveries, Recommendations, and Technique Details.
10. **Print only non-empty tiers.** Empty tier headers are noise.
