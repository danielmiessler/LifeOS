---
name: Sales
version: 1.0.25
description: "Transforms product documentation into sales-ready packages — a story explanation, charcoal gestural sketch art, and talking points — via a narrative-arc pipeline. USE WHEN sales, proposal, pitch deck, value proposition, sales narrative, sales deck, sales package, turn this into a pitch, create a sales story, sales materials, product pitch, transform docs to sales, sales script. NOT FOR Hormozi $100M frameworks, value equation, irresistible offer, or VOC mining (use _SALESHORMOZI), standalone diagrams or illustrations (use Art), or platform social posts (use _SOCIALPOST)."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/Sales/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Sales skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Sales** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Sales Skill

## What It Does

Turns product documentation into a sales-ready package: a story narrative that captures the value proposition, a charcoal gestural sketch that conveys the concept visually, and clear talking points. It reads the real value out of technical docs and reframes it as something a sales team can actually use in a pitch.

## The Problem

Product docs explain what a thing does. Sales needs to explain why it matters — and the gap between the two is where most pitches die. Hand a sales team a feature list and they read off bullet points; the buyer feels nothing and forgets it. The translation from "here's what it does" to "here's the story you'll remember" usually takes a writer and a designer and a few days, so it doesn't happen, and the product gets sold flat. This skill does that translation: it pulls the narrative arc out of the docs, finds the emotional register, and generates the narrative plus a matching visual tied directly to what's being sold.

## How It Works

The pipeline runs in four steps, from raw docs to a finished package:

```
PRODUCT DOCUMENTATION
        ↓
[1] STORY EXPLANATION — Extract the narrative arc (what's the real value?)
        ↓
[2] EMOTIONAL REGISTER — What feeling should this evoke? (wonder, determination, hope, etc.)
        ↓
[3] VISUAL CONCEPT — Derive scene from narrative + emotion
        ↓
[4] GENERATE ASSETS — Create visual + narrative package
        ↓
SALES-READY OUTPUT
```

It produces three things: sales narratives (story explanations that capture the value proposition), visual assets (charcoal sketch art that conveys the concept), and scripts (clear, succinct messaging tied to what you're selling). Internally it leans on the story-explanation narrative engine and the Art essay-art workflow for the visual.

---


## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **CreateSalesPackage** | Full sales package — "create a sales package", product docs in, narrative + charcoal sketch + key talking points out | `Workflows/CreateSalesPackage.md` |
| **CreateNarrative** | Sales narrative only — "turn this into a pitch", "create a sales story", technical docs to compelling narrative | `Workflows/CreateNarrative.md` |
| **CreateVisual** | Visual asset only — "create a visual for this sales story", charcoal sketch for an existing narrative | `Workflows/CreateVisual.md` |

---

## Output Format

### Sales Narrative
- 8-24 point story explanation
- First person, conversational
- Captures the "why this matters" not just "what it does"
- Ready for sales scripts, presentations, pitches

### Visual Asset
- Charcoal gestural sketch aesthetic
- Minimalist composition with breathing space
- Transparent background for versatility
- Captures the emotional core of the value proposition

---

## Example

**Input:** Technical documentation about AI code review tool

**Output:**
- **Narrative:** "This tool doesn't just find bugs—it understands your codebase like a senior engineer who's been there for years. It catches the subtle issues that slip through PR reviews..."
- **Visual:** Gestural sketch of human developer and AI figure collaborating, both examining the same code output
- **Talking Points:**
  1. Senior engineer understanding, not just pattern matching
  2. Catches what humans miss in PR reviews
  3. Learns your specific codebase patterns

---

## Integration

This skill combines:
- **storyexplanation skill** - For narrative extraction
- **art skill (essay-art workflow)** - For visual generation
- **Sales-specific framing** - Value proposition focus

---

**The goal:** Sales teams get materials that are highly tied to what they're selling, clear, succinct, and effective.

---

## Examples

**Example 1: Full sales package from docs**
```
User: "create a sales package for this product" [provides docs]
→ Extracts narrative arc using storyexplanation
→ Determines emotional register (wonder, determination, hope)
→ Generates charcoal sketch visual + narrative + talking points
```

**Example 2: Sales narrative only**
```
User: "turn this technical doc into a sales pitch"
→ Reads documentation and extracts value proposition
→ Creates 8-24 point story explanation in first person
→ Returns conversational narrative ready for sales scripts
```

**Example 3: Visual asset for existing narrative**
```
User: "create a visual for this sales story"
→ Analyzes narrative for emotional core
→ Derives scene concept from story + emotion
→ Generates charcoal gestural sketch with transparent background
```

## Gotchas

- **Charcoal sketch art is the visual style for sales assets.** Don't use other art styles unless explicitly asked.
- **Pitch decks must tell a STORY, not list features.** Narrative arc matters more than bullet points.
- **NOT for Hormozi frameworks** — use _SALESHORMOZI for $100M Offers/Leads methodology.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Sales","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> $LIFEOS_DIR/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
