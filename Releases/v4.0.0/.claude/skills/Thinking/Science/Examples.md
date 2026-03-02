# Science Examples

Worked examples showing the scientific method at different scales.

---

## Example 1: Quick Debug (Micro-Scale, 5 minutes)

**Problem:** App throws 500 error on login. Users can't log in.

**Goal:** Users can log in without 500 error

**Hypotheses (60 seconds):**
```
H1: Database connection issue - 500s often mean backend failure
H2: Recent deploy broke something - worked yesterday
H3: Auth service down - login specifically fails
H4: Rate limiting triggered - traffic spike possible
```

**Test Order:** H1 (fastest), H3 (fast), H4 (medium), H2 (slow)

**Test H1:**
```bash
$ psql -c "SELECT 1"  # Connection timeout
$ docker ps | grep postgres  # Empty - container stopped!
```

**Root Cause:** PostgreSQL container stopped.

**Fix:** `docker-compose up -d postgres`

**Verify:** `curl -I /api/login` returns 200

**Total Time:** 5 minutes vs 30+ minutes of random flailing

**Key Insight:** 2 minutes of structured thinking saved 25+ minutes.

---

## Example 2: TDD Cycle (Micro-Scale, 10 minutes)

**Goal:** Function `isValidEmail(email: string): boolean` that validates emails

**Hypotheses (implementation approaches):**
- H1: Simple regex
- H2: Library (email-validator)
- H3: Step-by-step parsing

**Test H1 (TDD Red-Green-Refactor):**

```typescript
// RED: Write failing test
test('returns true for valid email', () => {
  expect(isValidEmail('user@example.com')).toBe(true);
});
// FAILS - function doesn't exist

// GREEN: Minimal code to pass
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
// PASSES

// Continue adding edge case tests...
// All pass - H1 CONFIRMED
```

**Results:** 6 tests pass, 100% coverage

**Analysis:** H1 (simple regex) confirmed - works for our needs

**Outcome:** Ship simple solution, refactor with JSDoc

---

## Example 3: Feature Experiment (Meso-Scale, 2 weeks)

**Problem:** 40% cart abandonment rate. Need to reduce to under 25%.

**Goal:**
- Abandonment < 25%
- No conversion regression
- No complaint increase

**Hypotheses:**
| # | Claim | Test Cost |
|---|-------|-----------|
| H1 | Security badges reduce anxiety | Low |
| H2 | Fewer steps (4 to 2) helps | High |
| H3 | Mobile optimization helps | Medium |
| H4 | Visible discount field helps | Low |

**Experiment (A/B Test H1):**
- Control: Current checkout
- Treatment: + Security badges
- N: 5,000 per group
- Duration: 7 days

**Results:**
| Group | Abandonment |
|-------|-------------|
| Control | 40.0% |
| Treatment | 36.0% |

**H1 CONFIRMED** - 4 point reduction, p=0.0003

**Iteration 2:** Test H4 on treatment group
**Iteration 3:** Test H3 on combined

**Final Outcome (3 iterations):**
| Iteration | Cumulative Rate |
|-----------|-----------------|
| Baseline | 40% |
| +Badges | 36% |
| +Discount | 32% |
| +Mobile | 24% |

**Goal Achieved:** 24% < 25%

---

## Example 4: Prompt Iteration (Meso-Scale, 2 hours)

**Problem:** Summarization prompt produces inconsistent results.

**Goal:**
- Length: 100-150 words (currently 50-300)
- Key points: >90% captured (currently ~70%)
- Format: 100% bullets (currently ~60%)
- Eval score: >85% (baseline: 62%)

**Baseline Prompt:**
```
Summarize the following document:
{document}
```

**Hypotheses:**
- H1: Add explicit length constraint
- H2: Specify exact format (3-5 bullets)
- H3: Add key point extraction guidance
- H4: Few-shot examples

**Experiment (Evals):**

| Variant | Length | KeyPts | Format | Overall |
|---------|--------|--------|--------|---------|
| Control | 42% | 68% | 58% | 62% |
| A (H1) | 85% | 65% | 55% | 68% |
| B (H2) | 48% | 62% | 95% | 72% |
| C (H3) | 45% | 88% | 60% | 78% |
| D (all) | 82% | 85% | 92% | 88% |
| E (few-shot) | 78% | 80% | 88% | 85% |

**Winner:** D (combined constraints) at 88%

**Iteration 2:** Add stronger enforcement

**Final Prompt:**
```
Summarize the following document.

Requirements:
- Length: 100-150 words
- Format: 3-5 bullet points, each 20-30 words
- You MUST use bullet points. No paragraphs allowed.
- Content: Identify main argument, key evidence, conclusion
- Verify: main claim, supporting evidence, implications

Document:
{document}
```

**Final Score:** 93% (from 62% baseline)

**Key Learning:** Combined constraints outperform few-shot examples.

---

## Scale Summary

| Scale | Time | Example | Protocol |
|-------|------|---------|----------|
| Micro | Minutes | TDD, Quick Debug | Implicit |
| Meso | Hours-Days | Feature A/B, Prompt Eval | Explicit |
| Macro | Weeks | Product MVP | Documented |
