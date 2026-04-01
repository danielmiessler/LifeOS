# Test Cases: Visual Design Enhancement

**Date:** 2026-04-01
**Feature:** Conditional loading of visual-design-guide.md for web-agent
**Branch:** feature/visual-design-enhancement

## Test Case 1: Design Creation (Should Load Guide)

**Prompt:** "Create a premium landing page for a luxury real estate company"

**Expected Behavior:**
1. Web-agent recognizes this as Workflow 5 (Design Creation)
2. Reads `~/.claude/includes/visual-design-guide.md`
3. Identifies "premium" as matching "Persona 2: Premium & Sleek"
4. Declares aesthetic direction BEFORE writing CSS:
   - Aesthetic: Premium & Sleek
   - Typography: Cormorant (display), Jost (body)
   - Dominant color: Deep navy or charcoal
   - Accent: Champagne/gold
5. Applies design persona consistently:
   - Serif headings with light weights
   - Generous whitespace (64-96px sections)
   - Multi-layer subtle shadows
   - Slow, refined transitions (400ms+)
6. Avoids banned patterns (no Inter, no purple gradients)
7. Uses CSS custom properties for all colors

**Pass Criteria:** Design output matches Premium & Sleek persona parameters and avoids distributional convergence patterns.

---

## Test Case 2: Audit Task (Should NOT Load Guide)

**Prompt:** "Audit this website for accessibility issues: https://example.com"

**Expected Behavior:**
1. Web-agent recognizes this as Workflow 1 (Full Audit)
2. Does NOT read visual-design-guide.md (not needed for audits)
3. Performs standard audit using core web-agent.md workflows
4. Produces audit report with WCAG compliance findings

**Pass Criteria:** Task completes successfully without loading visual design guide. No visual design recommendations appear in the audit (audit focuses on compliance, not aesthetics).

---

## Test Case 3: Content Modification (Should NOT Load Guide)

**Prompt:** "Remove the 'Services' section from the homepage"

**Expected Behavior:**
1. Web-agent recognizes this as Workflow 3 (Content Modification)
2. Does NOT read visual-design-guide.md (not creating new design)
3. Performs blast radius analysis
4. Removes section while preserving surrounding layout

**Pass Criteria:** Content modification completes without loading visual design guide. No new visual design work performed.

---

## Test Case 4: Design with Mood Description (Should Load Guide)

**Prompt:** "Design a playful, colorful landing page for a children's app"

**Expected Behavior:**
1. Web-agent recognizes Workflow 5 with mood description
2. Reads visual-design-guide.md
3. Maps "playful, colorful" to "Persona 1: Expressive & Fun"
4. Declares aesthetic direction:
   - Aesthetic: Expressive & Fun
   - Typography: Nunito or Quicksand (rounded sans)
   - Colors: Saturated warm palette with multiple accents
   - Motion: Spring easing, bounce effects
5. Applies consistent playful aesthetic across all elements
6. Avoids convergence to typical "children's app" patterns

**Pass Criteria:** Design output matches Expressive & Fun persona and demonstrates intentional differentiation from generic patterns.

---

## Test Case 5: Layout Fix (Should NOT Load Guide)

**Prompt:** "Fix the spacing issues in the hero section - the padding looks inconsistent"

**Expected Behavior:**
1. Web-agent recognizes this as Workflow 4 (Layout & Spacing Fix)
2. Does NOT read visual-design-guide.md (fixing existing layout, not creating new design)
3. Identifies spacing system (8pt grid)
4. Corrects padding values to match grid rhythm

**Pass Criteria:** Spacing fix completes without loading visual design guide. Corrections maintain existing design system.

---

## Test Case 6: Anti-Convergence Verification

**Prompt 1:** "Create a modern SaaS landing page"
**Prompt 2:** "Create a startup homepage with clean design"
**Prompt 3:** "Design a tech company landing page"

**Expected Behavior:**
For each prompt, the web-agent should:
1. Read visual-design-guide.md
2. Recognize the anti-convergence mandate
3. Produce designs that differ in at least 2 dimensions:
   - Different font pairings across all three
   - Different color palettes (no repeated blue-purple schemes)
   - Different layout compositions
4. Explicitly document differences from previous outputs

**Example Expected Output:**
- **Design 1:** Cabinet Grotesk + DM Sans, teal/orange palette, asymmetric hero
- **Design 2:** Source Sans 3 + IBM Plex Serif, green/amber palette, full-bleed sections
- **Design 3:** Bricolage Grotesque + Outfit, burgundy/gold palette, overlapping cards

**Pass Criteria:** Three distinct designs with no repeated font combinations or color schemes. Each design consciously differs from the others.

---

## Smoke Test Results

### File Validation
- [x] visual-design-guide.md created (382 lines, 15KB)
- [x] web-agent.md modified to include conditional loading instruction
- [x] No markdown syntax errors
- [x] Balanced code blocks (8 opening/closing pairs)
- [x] Files readable and complete
- [x] Heading structure valid

### Loading Logic Verification
- [x] Conditional loading instruction added at line 439 of web-agent.md
- [x] Instruction clearly states WHEN to load (Workflow 5 only)
- [x] Instruction clearly states WHEN NOT to load (audits, content mods, validation)
- [x] Reference matches existing pattern (similar to static-site-work.md loading)

### Content Verification
- [x] Anti-convergence rules included (banned patterns, variety mandate, declare-before-coding)
- [x] Typography reference included (font recommendations by aesthetic, pairing principles)
- [x] Design vocabulary mapping included (buzzword-to-parameter translation table)
- [x] Color generation guide included (dominant with sharp accents, token architecture)
- [x] Five core design personas included (Expressive, Premium, Futuristic, Minimal, Bold)
- [x] Motion choreography guide included (page load patterns, timing reference)
- [x] Background atmosphere guide included (techniques and when to use/not use)
- [x] Self-critique checklist included
- [x] Integration notes explain when to load and relationship to core agent

---

## Integration Test Notes

These test cases document expected behavior. Actual integration testing would require:
1. Running web-agent with these prompts in a live Claude Code session
2. Verifying guide is loaded/not loaded as expected
3. Comparing design outputs to persona parameters
4. Checking for anti-convergence across multiple design prompts

**Recommendation:** User should test with real prompts in Claude Code to verify conditional loading works as designed.

---

## Summary

**Smoke Tests:** PASSED
**Expected Behavior:** Documented in 6 test cases
**File Integrity:** Verified
**Next Step:** Create draft PR and comprehensive implementation report
