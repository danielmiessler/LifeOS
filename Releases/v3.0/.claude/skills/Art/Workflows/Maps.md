# Conceptual Maps & Landscapes Workflow

**Hand-drawn conceptual maps showing idea territories and domain landscapes using UL aesthetic.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Maps workflow in the Art skill to create conceptual maps"}' \
  > /dev/null 2>&1 &
```

Running **Maps** in **Art**...

---

Creates **CONCEPTUAL MAPS** — illustrated maps of idea territories, not geographic locations, with editorial hand-drawn style.

---

## Purpose

Conceptual maps visualize abstract territories, domains, and relationships as illustrated landscapes. These are **metaphorical maps** showing where ideas, concepts, or domains exist in relation to each other.

**Use this workflow for:**
- "The Landscape of AI Safety"
- "Map of Cybersecurity Domains"
- "Territory of Human Capabilities"
- Domain overviews showing relationships
- Conceptual geography of a field
- Orientation guides for complex topics

---

## Visual Aesthetic: Illustrated Cartography

**Think:** Hand-drawn fantasy map, but for conceptual territories

### Core Characteristics
1. **Map structure** — Islands, continents, rivers, mountains representing ideas
2. **Cartographic elements** — Borders, labels, landmarks
3. **Hand-drawn** — Imperfect coastlines, wobbly borders, human quality
4. **Metaphorical geography** — Physical features represent conceptual relationships
5. **Labeled territories** — Clear naming of domains/concepts
6. **Editorial style** — Flat colors, black linework, UL aesthetic
7. **Navigable** — Helps understand the "lay of the land" in a field

---

## Color System for Conceptual Maps

### Land/Territory
```
Black #000000 — All coastlines, borders, terrain features
Light fills — Very subtle cream/beige for different territories
```

### Domain Differentiation
```
Deep Purple #4A148C — Primary domain or "optimal" territory
Deep Teal #00796B — Secondary domain or adjacent territory
Charcoal #2D2D2D — All labels and annotations
```

### Background (Water/Space)
```
Light Cream #F5E6D3 — Warm neutral "ocean"
OR
White #FFFFFF — Clean empty space around territories
```

### Color Strategy
- Coastlines/borders all black linework
- Territories subtly differentiated by color (purple, teal, or just labeled)
- Background as "ocean" or empty space
- Text all charcoal for readability

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Define Conceptual Geography

**Identify the territories:**

1. **What domain are you mapping?**
   - Subject area (e.g., AI capabilities, security landscape)
   - What are the major territories/concepts

2. **What are the territories?**
   - List 4-8 major domains/concepts
   - How do they relate spatially

3. **What metaphors represent relationships?**
   - Close territories = related concepts
   - Ocean between = very different domains
   - Mountains = barriers or challenges
   - Rivers = connections or flows
   - Bridges = integrations

**Output:**
```
MAP SUBJECT: "The [Domain] Landscape"

TERRITORIES (Major Domains):
1. [Territory name] — [What it represents]
2. [Territory name] — [What it represents]
3. [Territory name] — [What it represents]
...

SPATIAL RELATIONSHIPS:
- [Territory A] and [Territory B]: Adjacent (related concepts)
- [Territory C]: Island (isolated domain)
- Ocean between [X] and [Y]: Very different domains
- Mountain range along [Z]: Barrier/challenge

METAPHORICAL FEATURES:
- Rivers: [What they represent, e.g., "data flows"]
- Mountains: [What they represent, e.g., "technical barriers"]
- Bridges: [What they represent, e.g., "integration points"]
```

---

### Step 2: Design Map Layout

**Plan the cartography:**

1. **Map orientation:**
   - North-up traditional
   - Centered around key territory
   - Horizontal spread
   - Vertical layers

2. **Territory shapes:**
   - Continents (large connected domains)
   - Islands (isolated concepts)
   - Archipelagos (related cluster)
   - Peninsulas (partially connected)

3. **Features to include:**
   - Coastlines/borders
   - Landmarks (mountains, rivers)
   - Labels for territories
   - Legend or compass rose

**Output:**
```
MAP ORIENTATION: [North-up / Centered / Horizontal]

TERRITORY LAYOUT:
[Describe the spatial arrangement, e.g.:]
- Center: Large continent of [Primary Domain] (purple)
- East: Island of [Domain 2] (teal)
- West: Peninsula of [Domain 3] connected to center
- North: Mountain range representing [Barrier]
- South: Ocean of [Unknown Territory]

FEATURES:
- Coastlines: All hand-drawn, wobbly, imperfect
- Rivers: [Number] rivers showing [connections]
- Mountains: Along [borders] representing [challenges]
- Bridges: Connecting [Territory A] to [Territory B]

LABELS:
- Territory names inside borders (Tier 2)
- Feature labels for mountains, rivers (Tier 3)
- Map title at top (Tier 1)

COLOR CODING:
- [Primary territory]: Purple (#4A148C) subtle fill
- [Secondary territory]: Teal (#00796B) subtle fill
- Other territories: Light cream or white
- All borders/coastlines: Black
```

---

### Step 3: Construct Prompt

### Prompt Template

```
Hand-drawn conceptual map in editorial cartography style.

STYLE REFERENCE: Fantasy map, hand-drawn cartography, illustrated territory map

BACKGROUND: [Light Cream #F5E6D3 / White #FFFFFF] — represents ocean/empty space

AESTHETIC:
- Hand-drawn map (wobbly coastlines, imperfect borders)
- Cartographic elements (territories, features, labels)
- Variable stroke weight (coastlines thicker, details thinner)
- Editorial flat color with strategic purple/teal territories
- Sketch quality, not polished digital map

MAP SUBJECT: "[The X Landscape]" or "[Map of Y Domains]"

CARTOGRAPHIC STRUCTURE:
[Describe the overall map, e.g.:]
- Central large landmass: [Primary Domain]
- Surrounding islands and territories representing related concepts
- Ocean/empty space between distant domains
- Physical features (mountains, rivers, bridges) showing relationships

TYPOGRAPHY SYSTEM (3-TIER):

TIER 1 - MAP HEADER & SUBTITLE (Valkyrie Two-Part System):
Header (Main Title):
- "[Header Text]" — Left-justified at top
- Font: Valkyrie serif italic (elegant, sophisticated)
- Size: Large - 3-4x body text (prominent, commanding attention)
- Style: Italicized, sentence case or title case (NOT all-caps)
- Color: Black #000000 (or Purple #4A148C for emphasis)
- Position: Top-left with margin
- Example: "The Landscape of Artificial Intelligence"

Subtitle (Clarifying Detail):
- "[Subtitle Text]" — Below header
- Font: Valkyrie serif regular (warm, readable)
- Size: Small - 1-1.5x body text (noticeably smaller than header, supportive)
- Style: Regular (NOT italicized), sentence case (first letter capitalized, rest lowercase except proper nouns)
- Color: Black #000000 or Charcoal #2D2D2D
- Position: Small gap below header, aligned left
- Example: "Domains, Territories, and Frontiers"

TIER 2 - TERRITORY NAMES (Concourse Sans):
- Territory labels: "[Domain 1]", "[Domain 2]", etc.
- Font: Concourse geometric sans-serif
- Size: Medium readable
- Color: Charcoal #2D2D2D
- Position: Inside territory borders or nearby

TIER 3 - FEATURE LABELS (Advocate Condensed Italic):
- Geographic features: "*mountains of complexity*", "*river of data*"
- Font: Advocate condensed italic
- Size: 60% of Tier 2
- Color: Charcoal #2D2D2D
- Position: Near relevant features

TERRITORIES TO MAP:
[List each territory with details, e.g.:]

CENTRAL TERRITORY: [Primary Domain Name]
- Shape: Large irregular continent in center of map
- Coastline: Hand-drawn wobbly black line
- Fill: Subtle Purple (#4A148C) tint (very light, not solid)
- Features: [Mountains / Rivers / Landmarks within]
- Label: "[Domain name]" in Concourse sans
- Represents: [Core concept]

EASTERN TERRITORY: [Secondary Domain Name]
- Shape: Medium island separated by ocean from center
- Coastline: Hand-drawn irregular outline
- Fill: Subtle Teal (#00796B) tint
- Features: [Specific landmarks]
- Label: "[Domain name]"
- Represents: [Related but distinct concept]

WESTERN TERRITORY: [Domain Name]
- Shape: Peninsula connected to central continent
- Coastline: Wobbly black line
- Fill: Light cream or white (minimal color)
- Connection: Narrow land bridge to center
- Label: "[Domain name]"
- Represents: [Partially connected concept]

[Continue for all territories...]

GEOGRAPHIC FEATURES:
- Mountain range: Hand-drawn peaks along [border/territory]
  - Represents: [Barrier or challenge]
  - Color: Black (#000000) linework
  - Label: "*mountains of [X]*" in italic

- Rivers: Wobbly flowing lines connecting territories
  - Represents: [Connections or data flows]
  - Color: Black (#000000) or Teal (#00796B)
  - Label: "*river of [Y]*"

- Bridges: Small illustrated bridges connecting islands/territories
  - Represents: [Integration points]
  - Color: Black (#000000)

- Compass rose: Small decorative compass in corner (optional)
  - Hand-drawn, simple
  - Purple (#4A148C) north arrow

OCEAN/EMPTY SPACE:
- Background: Light cream or white
- Represents: Unknown territory or very different domains
- Blank areas between distant territories

COLOR USAGE:
- Black (#000000) for ALL coastlines, borders, geographic features
- Deep Purple (#4A148C) subtle fill on [primary territory]
- Deep Teal (#00796B) subtle fill on [secondary territory]
- Light cream/white fills on other territories
- Charcoal (#2D2D2D) for all text labels

CRITICAL REQUIREMENTS:
- Hand-drawn cartographic style (wobbly lines, imperfect shapes)
- Clear territory labels in 3-tier typography
- Physical features represent conceptual relationships
- Strategic color on 1-2 key territories (subtle fills, not solid)
- No gradients, flat colors only
- Navigable and understandable as conceptual geography
- Editorial illustration aesthetic maintained

Optional: Sign small in bottom corner in charcoal (#2D2D2D).
```

---

### Step 4: Determine Aspect Ratio

| Map Type | Aspect Ratio | Reasoning |
|----------|--------------|-----------|
| Wide horizontal landscape | 16:9 or 21:9 | Spread-out territories |
| Balanced map | 1:1 | Symmetric territory distribution |
| Vertical territories | 9:16 or 4:3 | Stacked or layered domains |
| Poster map | 4:3 | Classic map proportions |

**Default: 16:9 (horizontal)** — Classic map orientation

---

### Step 5: Execute Generation

```bash
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR PROMPT]" \
  --size 2K \
  --aspect-ratio 16:9 \
  --output /path/to/conceptual-map.png
```

**Model Recommendation:** nano-banana-pro (best for territory labels) or flux (stylistic variety)

**Immediately Open:**
```bash
open /path/to/conceptual-map.png
```

---

### Step 6: Validation (MANDATORY)

#### Must Have
- [ ] **Map structure clear** — Territories, coastlines, borders obvious
- [ ] **Conceptual geography** — Physical features represent ideas
- [ ] **Readable labels** — Territory names and feature labels legible
- [ ] **Hand-drawn** — Wobbly coastlines, imperfect borders, human quality
- [ ] **Strategic color** — Purple/teal on key territories (subtle fills)
- [ ] **Navigable** — Helps understand relationships between concepts
- [ ] **Editorial aesthetic** — Maintains UL flat color, black linework

#### Must NOT Have
- [ ] Perfect digital map (too clean)
- [ ] Realistic geographic features
- [ ] Illegible territory names
- [ ] Color chaos (too many territory colors)
- [ ] Confusing metaphors (features don't represent concepts clearly)
- [ ] Gradients or shadows

#### If Validation Fails

| Problem | Fix |
|---------|-----|
| Too precise/digital | "Hand-drawn wobbly coastlines, imperfect irregular borders, sketch quality" |
| Unclear metaphors | Strengthen feature descriptions: "mountains represent [specific barrier]" |
| Labels unreadable | Increase label sizes, clearer placement inside territories |
| Too complex | Reduce to 4-6 major territories, simplify features |
| Looks like real map | "Conceptual geography, metaphorical territories, abstract cartography" |
| Missing relationships | Add rivers/bridges showing connections: "river connecting [A] to [B]" |

---

## Example Use Cases

### Example 1: "The AI Capabilities Landscape"
- **Territories:** Reasoning (center, purple), Creativity (island, teal), Perception (west peninsula), Action (east island)
- **Features:** Mountains of complexity, Rivers of data, Bridges of integration
- **Aspect:** 16:9

### Example 2: "Cybersecurity Domain Map"
- **Territories:** Offensive (red island), Defensive (center continent), Governance (north peninsula), Human Layer (south)
- **Features:** Ocean of unknown threats, Mountain range of technical barriers
- **Aspect:** 16:9

### Example 3: "The TELOS Territory"
- **Territories:** Questions (center), Context (surrounding), Blockers (west mountains), Constraints (north), Solutions (east coast)
- **Features:** Rivers connecting domains, Bridges from problems to solutions
- **Aspect:** 1:1

---

## Quick Reference

**Conceptual Map Formula:**
```
1. Define conceptual geography (territories, relationships, metaphors)
2. Design map layout (orientation, shapes, features)
3. Construct prompt with cartographic structure
4. Choose aspect ratio for map type
5. Generate with nano-banana-pro
6. Validate for clarity and navigability
```

**Color Strategy:**
- Coastlines/borders: Black
- Primary territory: Purple (subtle fill)
- Secondary territory: Teal (subtle fill)
- Other territories: Light/white
- Labels: Charcoal

**Metaphor Key:**
- Physical proximity = conceptual relationship
- Ocean = very different domains
- Mountains = barriers/challenges
- Rivers = connections/flows
- Bridges = integration points

---

**The workflow: Define → Design → Construct → Generate → Validate → Complete**
