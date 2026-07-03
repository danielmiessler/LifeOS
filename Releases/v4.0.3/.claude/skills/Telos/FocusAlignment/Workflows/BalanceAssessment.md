# BalanceAssessment Workflow

Rate {PRINCIPAL.NAME}'s investment across all TELOS goal areas. Best used during review periods or when feeling off-balance.

## Process

1. **Load TELOS context:**
   - Read `~/.claude/PAI/USER/TELOS/GOALS.md` — all goal categories
   - Read `~/.claude/PAI/USER/TELOS/PROJECTS.md` — current project allocation
   - Read `~/.claude/PAI/USER/TELOS/CHALLENGES.md` — where energy is going
   - Read `~/.claude/PAI/USER/TELOS/MISSION.md` — overarching purpose

2. **Rate each goal area (1-5) on recent investment:**

   | Goal Area | Investment (1-5) | Notes |
   |-----------|------------------|-------|
   | [from GOALS.md] | [rating] | [evidence] |

3. **Analyze the pattern:**
   - Which areas are over-invested? (4-5)
   - Which are under-invested? (1-2)
   - Does the distribution align with stated priorities?
   - Are there areas that SHOULD be low-priority right now (seasonal)?

4. **Provide honest assessment:**
   - Name the imbalances directly
   - Distinguish intentional focus from accidental neglect
   - Suggest rebalancing if needed — specific, actionable

## Output

Balance matrix table + narrative assessment + top 3 rebalancing recommendations.
