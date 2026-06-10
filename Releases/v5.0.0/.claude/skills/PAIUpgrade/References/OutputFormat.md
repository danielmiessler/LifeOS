# PAIUpgrade — Canonical Output Format

**This is the single source of truth for PAIUpgrade output structure.** Both `SKILL.md` and `Workflows/Upgrade.md` reference this file rather than inlining their own copies.

## Section order (NON-NEGOTIABLE)

1. **✨ Discoveries** — what was found, ranked by interestingness
2. **🔥 Recommendations** — what to do, ranked by priority tier
3. **🎯 Technique Details** — full extraction with code/quotes
4. **⚠️ Interactions & Sequencing** — cross-recommendation interference matrix (MANDATORY when >10 recommendations; see Workflows/Upgrade.md Step 6b)
5. **🪞 Internal Reflections** — upgrade candidates from algorithm reflections (Thread 3)
6. **📊 Summary** — one-line totals
7. **⏭️ Skipped Content** — already-done / rejected with file:line evidence
8. **🔍 Sources Processed** — count footer

**Print only non-empty tiers** in Recommendations. If no CRITICAL items, omit that header entirely.

---

## Header

```markdown
# PAI Upgrade Report
**Generated:** [timestamp]
**Sources Processed:** [N] release notes | [N] videos | [N] docs | [N] GitHub queries
**Findings:** [N] techniques extracted | [N] skipped
```

---

## ✨ Discoveries

Ranked by interestingness, NOT implementation priority. A LOW-priority item can be Discovery #1 if it's the most "whoa" finding.

| # | Discovery | Source | Why It's Interesting | PAI Relevance |
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
Fixes gaps, security issues, or unlocks capabilities PAI should already have.

| # | Recommendation | Prior Status | Evidence | PAI Relevance | Effort | Files Affected |
|---|---------------|-------------|----------|---------------|--------|----------------|

### 🟠 HIGH — Integrate this week
Significantly improves PAI capabilities or efficiency.

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

**How It Helps PAI:** [≤2 sentences, concrete and specific — which component improves, what gap it fills]

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
**How It Helps PAI:** [≤2 sentences]

**Inspiration Techniques:**
> [Specific architectural pattern from README or code]

**Applies To:** `[PAI file path]`, [component]
**Potential Integration:** [key insight to borrow — not a full implementation]
```

---

## ⚠️ Interactions & Sequencing

Mandatory when the report carries more than 10 recommendations (Step 6b in Upgrade.md); at ≤10, the section reduces to a single line: "interference: none found across N recs".

```markdown
Pairwise interference analysis across R1-RN, adversarially verified by a second agent (different model family when available).

| # | Pair | Mechanism | Guard |
|---|------|-----------|-------|
| C1 | Rx↔Ry | [how they interfere — confound / same-file / dependency / bundling] | [sequencing rule, design guard, or precondition] |

**Wave sequence:** W0 [conflict-free now] → W1 [deadline-ordered] → … → Wn [independent anytime].

**Synergies:** [pairs that reinforce each other, worth implementing together]
```

**Hard sub-rules:**
- Every conflict row has a non-empty Guard cell — a conflict without a resolution blocks the report.
- The matrix must survive an adversarial pass by a second agent; disputes resolve by probing ground truth, not by model preference.
- Recommendation rows involved in any conflict are tagged so readers hit the warning before implementing.

---

## 🪞 Internal Reflections (Thread 3)

```markdown
**Source:** ~/.claude/PAI/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
**Entries analyzed:** [N] | **High-signal:** [N] (low sentiment, over-budget, or failed criteria)

### [Theme Name] ([N] occurrences, [HIGH/MEDIUM/LOW] signal)
**Root cause:** [structural issue]
**Proposed fix:** [concrete change]
**Target:** [PAI files affected]
**Evidence:**
- [timestamp] [task] — "[Q2 quote]"
```

If no reflections yet:
> No reflections found yet — they accumulate after Standard+ Algorithm runs.

---

## 📊 Summary

| # | Technique | Source | Priority | PAI Component | Effort |
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
3. **PAI Relevance is primary** in both Discoveries and Recommendations — explain WHY this matters for PAI.
4. **Every Recommendation has a Prior Status tag with file:line evidence.** No exceptions.
5. **Quote the source.** Every technique includes actual quoted content or code.
6. **Map to PAI.** Every technique names a specific PAI file or component.
7. **No watch/read recommendations.** Extract the technique; don't point to content.
8. **Skip boldly.** Content with no extractable technique → Skipped, not diluted.
9. **Numbered cross-references** are consistent across Discoveries, Recommendations, and Technique Details.
10. **Print only non-empty tiers.** Empty tier headers are noise.
11. **Interference gate.** >10 recommendations → the Interactions & Sequencing section is mandatory, adversarially verified, and every conflict pair carries a guard. Prior-Status gates against the past; this gates against each other.
