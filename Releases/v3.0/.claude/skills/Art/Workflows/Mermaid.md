# Mermaid-Style Technical Diagrams with Excalidraw Aesthetic

**Hand-drawn technical diagrams combining Mermaid structure with Excalidraw sketchy aesthetic and UL color scheme.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Mermaid workflow in the Art skill to create diagrams"}' \
  > /dev/null 2>&1 &
```

Running **Mermaid** in **Art**...

---

Creates **EXCALIDRAW-STYLE MERMAID DIAGRAMS** — flowcharts, sequence diagrams, state machines, and other technical diagrams with whiteboard hand-drawn feel, derived from content via story explanation.

---

## Purpose

The Mermaid workflow creates structured technical diagrams (like Mermaid.js generates) but with a **hand-drawn whiteboard aesthetic** (like Excalidraw) while maintaining **UL editorial color scheme**. Unlike generic technical diagrams, these follow specific diagram grammar (flowcharts, sequences, states, etc.) and are derived from content analysis, not hand-specified.

**Use this workflow for:**
- Flowcharts showing decision logic and process flows
- Sequence diagrams showing interactions over time
- State diagrams showing state transitions
- Class diagrams showing object relationships
- ER diagrams showing data models
- Git graphs showing branching/merging
- Any diagram where Mermaid structure + hand-drawn aesthetic is ideal

**This is NOT for:**
- Freeform architecture diagrams (use technical-diagrams.md)
- Abstract conceptual metaphors (use editorial-illustration.md)
- Data visualizations (use visualize.md)

---

## Mermaid Diagram Types Supported

### 1. Flowcharts
**When:** Decision trees, algorithmic logic, process flows with conditions
```
Start → Decision? → [Yes] → Action → End
                 → [No] → Different Action → End
```

### 2. Sequence Diagrams
**When:** Interactions between entities/actors over time
```
User → API: Request
API → Database: Query
Database → API: Results
API → User: Response
```

### 3. State Diagrams
**When:** State machines, status transitions, lifecycle flows
```
[Idle] → (trigger) → [Processing] → (complete) → [Done]
                                  → (error) → [Failed]
```

### 4. Class Diagrams
**When:** Object relationships, inheritance, composition
```
User ──has many──> Posts
User ──belongs to──> Organization
Post ──has many──> Comments
```

### 5. Entity Relationship Diagrams
**When:** Database schemas, data models, table relationships
```
Customer ||──o{ Order : places
Order ||──o{ LineItem : contains
Product ||──o{ LineItem : ordered_in
```

### 6. Gantt Charts
**When:** Project timelines, task dependencies, schedules
```
Task 1: Jan 1 - Jan 15
Task 2: Jan 10 - Jan 30 (depends on Task 1)
Task 3: Jan 20 - Feb 10
```

### 7. Git Graphs
**When:** Branching strategies, merge flows, version control
```
main ──> feature branch ──> merged back ──> main
     └──> hotfix ──────────> merged ──────> main
```

---

## Excalidraw Aesthetic Principles

**Think:** Whiteboard sketch, not polished Visio diagram

### Visual Characteristics
1. **Wobbly boxes** — Rectangles with rough, hand-drawn edges (not perfect)
2. **Sketchy arrows** — Arrows with slight wobble, not ruler-straight
3. **Rough edges** — Everything has organic imperfection
4. **Hand-lettered text** — Labels look handwritten, not typed
5. **Whiteboard feel** — Looks like someone drew this on a whiteboard
6. **Variable line weight** — Heavier for boxes, lighter for arrows
7. **Crossing-out style** — Double-line or rough crossing for connections

### What This Looks Like
- Diamond decision boxes with wobbly edges
- Arrows that curve slightly even when "straight"
- Rectangles that aren't quite rectangular
- Text that's imperfectly aligned
- Circles that are slightly oval
- Lines that overlap at connections with organic joins

### AVOID
- Perfect geometric shapes
- Ruler-straight arrows
- Digital precision
- Smooth curves (too polished)
- Perfect alignment
- Vector crispness

---

## Color System for Mermaid Diagrams

### Structure
```
Black #000000 — All primary linework (boxes, arrows, decision diamonds)
```

### Flow Emphasis
```
Deep Purple #4A148C — Critical path, main flow, important states
Deep Teal #00796B — Alternative paths, secondary flows, supporting states
Charcoal #2D2D2D — All text labels and annotations
```

### Background
```
Light Cream #F5E6D3 — Whiteboard/sketch paper feel
OR
White #FFFFFF — Clean background
```

### Color Strategy for Diagram Types

**Flowcharts:**
- Main path boxes: Purple outlines
- Alternative branches: Teal outlines
- Decision diamonds: Black outlines
- All connecting arrows: Black

**Sequence Diagrams:**
- Critical actor/entity: Purple box
- Secondary actors: Teal boxes
- All messages/arrows: Black
- Activation boxes: Purple fills (subtle)

**State Diagrams:**
- Active/important states: Purple
- Transition states: Teal
- Terminal states: Black
- Arrows: Black with labels

**Class/ER Diagrams:**
- Key entities: Purple boxes
- Related entities: Teal boxes
- Relationships: Black arrows with labels
- Inheritance: Black with different arrow style

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Run Story Explanation on Content (MANDATORY)

**🎯 CRITICAL: You MUST use /cse (Create Story Explanation) with 24-item length.**

This extracts the full narrative arc and identifies the STRUCTURE that needs to be diagrammed.

```bash
/cse [content or URL]
```

The 24-item output reveals:
- Process flows and sequences
- Decision points and conditions
- State transitions and triggers
- Entity relationships and interactions
- Temporal ordering and dependencies

**Do NOT skip this step. Do NOT manually derive diagram structure without running /cse first.**

**Output from CSE Analysis:**
```
24-ITEM STORY EXPLANATION:
1. [Item 1]
2. [Item 2]
...
24. [Item 24]

STRUCTURAL ELEMENTS IDENTIFIED:
- Processes: [List of distinct processes/actions]
- Decisions: [List of decision points with conditions]
- States: [List of distinct states]
- Entities: [List of actors/objects/components]
- Flows: [List of connections and sequences]
- Conditions: [List of triggers and transitions]
```

---

### Step 2: Determine Optimal Mermaid Diagram Type

**Based on CSE analysis, identify the best diagram type:**

#### Decision Framework

**Choose FLOWCHART when:**
- Content describes process with decision points
- "If/then/else" logic is present
- Multiple paths based on conditions
- Algorithm or procedure being explained
- Clear start and end points

**Choose SEQUENCE DIAGRAM when:**
- Content describes interactions between entities over time
- Request/response patterns present
- Multiple actors communicating
- Temporal ordering is critical
- API calls, messaging, or protocols

**Choose STATE DIAGRAM when:**
- Content describes states and transitions
- Status changes are central
- Lifecycle or workflow states
- Event-driven transitions
- System can be in discrete states

**Choose CLASS/ER DIAGRAM when:**
- Content describes relationships between objects/entities
- Data structures or models
- Inheritance or composition patterns
- Database schemas
- Object hierarchies

**Choose GANTT CHART when:**
- Content describes project timeline
- Task dependencies and schedules
- Milestones and deadlines
- Parallel and sequential tasks

**Choose GIT GRAPH when:**
- Content describes version control workflow
- Branching strategies
- Merge patterns
- Release flows

**Multiple diagram types possible?**
- Choose the PRIMARY type that captures the main structure
- Can note that alternative representations exist
- Focus on the most illuminating visualization

**Output from Type Selection:**
```
DIAGRAM TYPE: [Flowchart / Sequence / State / Class / ER / Gantt / Git Graph]

RATIONALE: [Why this type best represents the content]

ALTERNATIVE TYPES CONSIDERED: [If any, and why not chosen]
```

---

### Step 3: Extract Diagram Structure from CSE

**Map the 24-item story explanation to diagram components:**

#### For Flowcharts
Identify:
- **Start node:** Where does the process begin?
- **Process nodes:** What actions happen? (rectangles)
- **Decision nodes:** What choices are made? (diamonds)
- **End nodes:** Where does it terminate? (rounded rectangles)
- **Flows:** How do nodes connect? (arrows with labels)

#### For Sequence Diagrams
Identify:
- **Actors/Entities:** Who/what participates? (boxes at top)
- **Messages:** What communications occur? (arrows between lifelines)
- **Temporal order:** What sequence? (top to bottom)
- **Activations:** When are entities active? (vertical bars)

#### For State Diagrams
Identify:
- **States:** What are the distinct states? (rounded boxes)
- **Initial state:** Where does it start? (filled circle)
- **Final state:** Where does it end? (double circle)
- **Transitions:** What triggers state changes? (arrows with conditions)
- **Events:** What causes transitions?

#### For Class/ER Diagrams
Identify:
- **Entities/Classes:** What objects exist? (boxes)
- **Attributes:** What properties? (inside boxes)
- **Relationships:** How do they relate? (arrows with cardinality)
- **Inheritance:** What hierarchies? (special arrows)

**Output from Structure Extraction:**
```
DIAGRAM COMPONENTS:

[For Flowchart Example:]
NODES:
- Start: [Label]
- Process 1: [Action description] (rectangle, purple)
- Decision 1: [Question] (diamond, black)
- Process 2a: [Action if yes] (rectangle, purple)
- Process 2b: [Action if no] (rectangle, teal)
- End: [Terminal state] (rounded, black)

FLOWS:
- Start → Process 1: (black arrow)
- Process 1 → Decision 1: (black arrow)
- Decision 1 → Process 2a: "Yes" (black arrow)
- Decision 1 → Process 2b: "No" (black arrow)
- Process 2a → End: (black arrow)
- Process 2b → End: (black arrow)

CRITICAL PATH: [Start → Process 1 → Decision 1 → Process 2a → End]
(This path highlighted with purple boxes)
```

---

### Step 4: Design Excalidraw-Style Layout

**Plan the whiteboard sketch aesthetic:**

#### A. Spatial Arrangement
- **Flowcharts:** Top-to-bottom or left-to-right flow
- **Sequence diagrams:** Actors across top, interactions descending
- **State diagrams:** Circular or network layout
- **Class diagrams:** Hierarchical tree or interconnected network
- **ER diagrams:** Entities spread out with relationships between
- **Gantt:** Horizontal timeline with tasks stacked vertically
- **Git graph:** Branching tree structure

#### B. Hand-Drawn Styling
Each node type gets Excalidraw treatment:

**Rectangles (Process boxes):**
```
Instead of: ┌──────────┐
This:       ╱──────────╲  (wobbly, not perfect)
           │  Process  │  (slightly tilted)
           ╲──────────╱  (organic edges)
```

**Diamonds (Decisions):**
```
Instead of: ◇
This:       ◊  (wobbly, asymmetric, hand-drawn diamond)
```

**Arrows:**
```
Instead of: ────────→
This:       ∼∼∼∼∼∼∼→  (slightly wavy, organic curve)
```

**Text:**
```
Instead of: Arial 12pt
This:       Hand-lettered appearance, slight slant, imperfect
```

#### C. Visual Hierarchy
- **Primary path/flow:** Purple boxes, thicker lines
- **Secondary paths:** Teal boxes, standard lines
- **Structure/framework:** Black lines and shapes
- **Labels/text:** Charcoal, hand-lettered style

**Output from Layout Design:**
```
SPATIAL LAYOUT: [Top-to-bottom flow / Left-to-right / Circular / etc.]

EXCALIDRAW STYLING NOTES:
- All boxes: Wobbly rectangles, slightly tilted
- Arrows: Gentle curves even when "straight"
- Diamonds: Asymmetric, hand-drawn feel
- Circles: Slightly oval, imperfect
- Text: Hand-lettered, natural slant

NODE POSITIONING:
[Describe relative positions, e.g.:]
- Start node: Top center
- Process 1: Below start, slightly left
- Decision 1: Below process 1, centered
- Process 2a: Bottom left (Yes branch)
- Process 2b: Bottom right (No branch)
- End nodes: Bottom (two endpoints merge)

CONNECTION PATHS:
[Describe arrow routes with organic curves]
```

---

### Step 5: Construct Comprehensive Prompt

**Build the generation prompt with Excalidraw + Mermaid + UL aesthetic:**

### Prompt Template

```
Hand-drawn Mermaid [DIAGRAM TYPE] in Excalidraw whiteboard sketch style.

STYLE REFERENCE: Excalidraw whiteboard diagram, hand-drawn flowchart, sketchy technical diagram

BACKGROUND: [Light Cream #F5E6D3 / White #FFFFFF] — whiteboard/sketch paper feel

AESTHETIC:
- Excalidraw hand-drawn style (wobbly, sketchy, organic)
- Whiteboard sketch quality (looks hand-drawn, not digital)
- Rough edges on all shapes (rectangles not perfect, circles slightly oval)
- Sketchy arrows (gentle curves, slight wobble, not ruler-straight)
- Hand-lettered text labels (imperfect alignment, natural slant)
- Variable line weight (boxes thicker, arrows medium, details thinner)
- Organic connections (lines join naturally, small overlaps at nodes)
- NO digital precision, NO perfect geometry, NO smooth vectors

DIAGRAM TYPE: [Flowchart / Sequence Diagram / State Diagram / etc.]

OVERALL STRUCTURE:
[Describe the complete diagram flow, e.g.:]
- [DIAGRAM TYPE] showing [what it represents]
- Layout: [Top-to-bottom / Left-to-right / etc.]
- [Number] main nodes/states/entities
- Critical path highlighted in purple
- Alternative paths in teal

TYPOGRAPHY SYSTEM (4-FONT HIERARCHY):

TIER 1 - DIAGRAM HEADER & SUBTITLE (Valkyrie Two-Part System):
Header (Main Title):
- "[Header Text]"
- Font: Valkyrie serif italic (elegant, sophisticated)
- Size: Large - 3-4x body text (prominent, commanding attention) (refined, not overwhelming)
- Style: Italicized, sentence case or title case (NOT all-caps)
- Color: Black #000000 (or Purple #4A148C for emphasis)
- Position: Top-left with margin
- Example: "User Authentication Flow"

Subtitle (Clarifying Detail):
- "[Subtitle Text]"
- Font: Valkyrie serif regular (warm, readable)
- Size: Small - 1-1.5x body text (noticeably smaller than header, supportive)
- Style: Regular (NOT italicized), sentence case (first letter capitalized, rest lowercase except proper nouns)
- Color: Black #000000 or Charcoal #2D2D2D
- Position: Small gap below header, aligned left
- Example: "Security Validation Process"

TIER 2 - NODE LABELS & DESCRIPTIONS (Concourse T3 + Valkyrie):
Technical Node Labels — Concourse T3:
- Labels inside boxes/nodes for technical identifiers
- Font: Concourse T3 geometric sans, functional, precise
- Size: Medium readable
- Color: Charcoal #2D2D2D
- Style: Hand-drawn interpretation, slightly imperfect
- Examples: "Auth Service", "Database", "API Gateway"

Human/Process Descriptions — Valkyrie serif:
- Process descriptions, human-readable actions
- Font: Valkyrie serif, warm, narrative
- Size: Medium (same as Concourse T3)
- Color: Charcoal #2D2D2D
- Style: Natural, readable, explanatory
- Examples: "Validate credentials", "Check permissions", "Send confirmation"

TIER 3 - EDGE LABELS & ANNOTATIONS (Advocate Italic + Valkyrie):
Edge Labels/Conditions — Advocate Condensed (or Valkyrie):
- Labels on arrows/connections, conditions
- Font: Advocate condensed (voice) or Valkyrie (neutral)
- Size: 60% of Tier 2
- Color: Charcoal #2D2D2D
- Style: Hand-written notes along arrows
- Examples: "Yes", "No", "timeout", "success", "error"

Insights/Commentary — Advocate Italic:
- Critical observations, editorial voice
- Font: Advocate condensed italic
- Size: 60% of Tier 2
- Color: Purple #4A148C or Teal #00796B
- Examples: "*this is where it breaks*", "*performance bottleneck*"

DIAGRAM COMPONENTS (Excalidraw Style):

[LIST EACH NODE/COMPONENT:]

NODE 1: [Type - e.g., START NODE]
- Shape: [Rounded rectangle / Circle / etc.]
- Label: "[Label text]"
- Style: Wobbly hand-drawn edges, slightly asymmetric
- Color: Black (#000000) outline, no fill OR subtle cream fill
- Size: [Relative size]
- Position: [Location in layout]

NODE 2: [Type - e.g., PROCESS BOX]
- Shape: Rectangle with rough edges
- Label: "[Action description]"
- Style: Wobbly lines, slightly tilted, hand-drawn imperfection
- Color: Purple (#4A148C) outline — CRITICAL PATH
- Fill: Light cream or transparent
- Size: [Relative size]
- Position: [Below Node 1]

NODE 3: [Type - e.g., DECISION DIAMOND]
- Shape: Diamond/rhombus with wobbly edges
- Label: "[Question?]"
- Style: Hand-drawn, asymmetric diamond, organic edges
- Color: Black (#000000) outline
- Fill: Transparent or very light cream
- Size: [Relative size]
- Position: [Below Node 2, centered]

NODE 4: [Type - e.g., PROCESS BOX - ALTERNATIVE PATH]
- Shape: Rectangle with rough edges
- Label: "[Alternative action]"
- Style: Wobbly lines, slightly tilted
- Color: Teal (#00796B) outline — SECONDARY PATH
- Fill: Light cream or transparent
- Size: [Relative size]
- Position: [To the side, alternative branch]

NODE 5: [Type - e.g., END NODE]
- Shape: Rounded rectangle or double circle
- Label: "[Terminal state]"
- Style: Hand-drawn, organic curves
- Color: Black (#000000) outline
- Fill: Subtle fill or transparent
- Size: [Relative size]
- Position: [Bottom of diagram]

[Continue for all nodes...]

CONNECTIONS (Sketchy Arrows):

ARROW 1: [Node A] → [Node B]
- Style: Sketchy hand-drawn arrow, slight curve even if "straight"
- Path: [Describe route, e.g., "curves gently from Node 1 down to Node 2"]
- Color: Black (#000000)
- Label: [Optional label text, e.g., "process" or condition]
- Arrowhead: Hand-drawn triangle, slightly asymmetric

ARROW 2: [Node C] → [Node D]
- Style: Sketchy arrow with organic wobble
- Path: [Describe route]
- Color: Black (#000000)
- Label: "[Yes]" in small hand-written style
- Arrowhead: Rough triangle

[Continue for all arrows/connections...]

SPECIAL ELEMENTS (if applicable):

[For Sequence Diagrams:]
- Actor boxes: Hand-drawn rectangles at top
- Lifelines: Dashed vertical lines (hand-drawn, wobbly)
- Activation boxes: Rectangles on lifelines (purple for key)
- Messages: Arrows between lifelines with labels

[For State Diagrams:]
- Initial state: Filled circle (hand-drawn)
- Final state: Double circle (wobbly concentric circles)
- State boxes: Rounded rectangles with rough edges
- Transition arrows: Curved arrows with condition labels

[For Class/ER Diagrams:]
- Class boxes: Three-section rectangles (wobbly dividers)
- Relationship lines: Different arrow styles for different relationships
- Cardinality labels: Hand-written "1", "*", "0..1", etc.

COLOR USAGE (Strategic, UL Palette):
- Black (#000000): All primary structure (most boxes, all arrows)
- Deep Purple (#4A148C): Critical path nodes, main flow, key entities (10-20% of nodes)
- Deep Teal (#00796B): Alternative paths, secondary entities (5-10% of nodes)
- Charcoal (#2D2D2D): All text labels (node labels, arrow labels)
- Background: Light Cream (#F5E6D3) OR White (#FFFFFF)

CRITICAL REQUIREMENTS:
- Excalidraw hand-drawn aesthetic (wobbly, sketchy, organic)
- Mermaid diagram structure ([chosen type] grammar)
- UL color scheme (purple for critical, teal for secondary, black structure)
- 3-tier typography (title, node labels, edge labels)
- Whiteboard sketch feel (not polished, not digital)
- All shapes imperfect (rectangles wobbly, circles oval, arrows curved)
- Variable line weight (thicker boxes, medium arrows, thin details)
- Hand-lettered text (natural slant, imperfect alignment)
- Strategic color (not everything colored, mostly black structure)
- Readable and clear despite sketch style
- Follows [Mermaid diagram type] conventions

VALIDATION CHECKPOINTS:
- Does it look hand-drawn on a whiteboard (not digital)?
- Are all geometric shapes imperfect (wobbly edges)?
- Is the diagram type structure clear (flowchart/sequence/state/etc.)?
- Can you follow the flow/logic/sequence easily?
- Is the critical path obvious (purple highlights)?
- Are labels readable despite hand-lettered style?
- Does it maintain UL aesthetic (flat colors, no gradients)?

Optional: Sign small in bottom right corner in charcoal (#2D2D2D).
```

---

### Step 6: Determine Aspect Ratio

**Based on diagram type and complexity:**

| Diagram Type | Typical Aspect Ratio | Reasoning |
|--------------|---------------------|-----------|
| Flowchart (vertical) | 9:16 or 4:3 | Top-to-bottom flow |
| Flowchart (horizontal) | 16:9 or 21:9 | Left-to-right flow |
| Sequence diagram | 16:9 | Actors across, time down |
| State diagram | 1:1 | Circular/network layout |
| Class diagram | 1:1 or 4:3 | Tree or network |
| ER diagram | 16:9 or 1:1 | Entity spread |
| Gantt chart | 16:9 or 21:9 | Timeline horizontal |
| Git graph | 16:9 | Branching horizontal |

**Default: 16:9** — Works for most diagram types

---

### Step 7: Generate with Nano Banana Pro

**Execute with optimal model for text-heavy diagrams:**

```bash
bun run ~/.claude/skills/art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[YOUR COMPREHENSIVE PROMPT]" \
  --size 2K \
  --aspect-ratio [chosen ratio] \
  --output /path/to/mermaid-diagram.png
```

**Why Nano Banana Pro:**
- Best text rendering (critical for labels on nodes and arrows)
- Handles complex multi-element compositions
- Can render hand-drawn aesthetic while maintaining readability
- Excellent for technical diagrams with lots of labels

**Background rules based on use case:**
```
ONE-OFF / QUICK PREVIEW: Keep white background (#FFFFFF)
GOING INTO BLOG/WEBSITE: Remove background for transparency
```

**For blog/website use** — use the **Images skill** for background removal:

```bash
bun ~/.claude/skills/PAI/Tools/RemoveBg.ts /path/to/mermaid-diagram.png
```

**See:** `~/.claude/skills/Images/Workflows/BackgroundRemoval.md` for full documentation.

**Immediately open:**
```bash
open /path/to/mermaid-diagram.png
```

---

### Step 8: Comprehensive Validation (MANDATORY)

**Validate across all dimensions:**

#### Diagram Correctness
- [ ] **Structure accurate:** Diagram follows [type] conventions
- [ ] **Logic clear:** Flow/sequence/states make sense
- [ ] **Complete:** All elements from CSE represented
- [ ] **Connections correct:** Arrows point to right places
- [ ] **Labels accurate:** Node and edge labels match content

#### Excalidraw Aesthetic
- [ ] **Hand-drawn feel:** Looks sketched on whiteboard
- [ ] **Wobbly shapes:** No perfect rectangles/circles
- [ ] **Sketchy arrows:** Organic curves, not ruler-straight
- [ ] **Imperfect text:** Hand-lettered, natural slant
- [ ] **Variable line weight:** Thicker boxes, thinner details
- [ ] **Organic joins:** Connections look natural

#### UL Editorial Style
- [ ] **Color strategic:** Purple on critical (10-20%), teal on secondary (5-10%)
- [ ] **Black dominant:** Most structure in black
- [ ] **Typography hierarchy:** 3 tiers clear
- [ ] **No gradients:** Flat colors maintained
- [ ] **Signature:** Present in corner (optional)

#### Readability & Clarity
- [ ] **Labels readable:** All text legible despite hand-drawn style
- [ ] **Flow obvious:** Can follow the diagram easily
- [ ] **Critical path clear:** Purple highlights guide eye
- [ ] **Not cluttered:** Spacing adequate, not cramped
- [ ] **Scale works:** Readable at thumbnail and full-size

#### If Validation Fails

**Common issues and fixes:**

| Problem | Diagnosis | Fix |
|---------|-----------|-----|
| **Too polished/digital** | Missing Excalidraw aesthetic | Emphasize: "Wobbly rectangles, sketchy arrows, hand-drawn on whiteboard, imperfect shapes" |
| **Perfect geometry** | Shapes too clean | "All rectangles with rough edges, circles slightly oval, organic imperfection throughout" |
| **Can't follow flow** | Unclear structure | Strengthen arrow directions, add labels, clarify critical path with purple |
| **Labels unreadable** | Text too sketchy or small | Increase label size, simplify hand-lettering: "Readable hand-lettered style" |
| **Wrong diagram type** | Doesn't match content | Return to Step 2, reconsider diagram type based on CSE |
| **Missing Mermaid structure** | Doesn't follow conventions | Add proper diagram grammar: decision diamonds for flowcharts, lifelines for sequence, etc. |
| **Color overload** | Too much purple/teal | Limit: "Purple on 2-3 critical nodes only, teal on 1-2 secondary, rest black" |
| **Looks generic** | Missing UL or Excalidraw style | Combine both: "Excalidraw wobbly whiteboard sketch + UL purple/teal strategic accents" |

**Regeneration Process:**
1. Identify specific validation failures
2. Update prompt with targeted fixes from table
3. Regenerate with refined prompt
4. Re-validate against all checkpoints
5. Repeat until ALL validation criteria pass

**CRITICAL: Do not declare completion until validation passes.**

---

## Diagram Type Deep Dives

### Flowchart Specifics

**Node Types:**
- **Start/End:** Rounded rectangles (wobbly ovals)
- **Process:** Rectangles with rough edges
- **Decision:** Diamonds (asymmetric, hand-drawn)
- **Input/Output:** Parallelograms (tilted, wobbly)
- **Predefined Process:** Rectangles with double side lines

**Flow Rules:**
- Always flows one direction (typically top-down or left-right)
- Arrows never cross if avoidable
- Decision diamonds have exactly 2 exits (Yes/No or True/False)
- Loops back with curved arrows

**Color Strategy:**
- Purple: Main success/happy path
- Teal: Error handling or alternative paths
- Black: All decision nodes and structure

---

### Sequence Diagram Specifics

**Components:**
- **Actors/Entities:** Boxes at top (wobbly rectangles)
- **Lifelines:** Vertical dashed lines (hand-drawn, imperfect)
- **Messages:** Horizontal arrows between lifelines
- **Activations:** Vertical bars on lifelines (when entity is active)
- **Return messages:** Dashed arrows going back

**Temporal Flow:**
- Always top to bottom (time flows down)
- Left to right is actor/entity ordering
- Synchronous: Solid arrow
- Asynchronous: Open arrow
- Return: Dashed arrow

**Color Strategy:**
- Purple: Critical actor/main entity
- Teal: Secondary actors
- Black: All messages/arrows
- Purple fill: Activation bars for critical entity

---

### State Diagram Specifics

**Components:**
- **States:** Rounded rectangles (wobbly)
- **Initial state:** Filled circle (hand-drawn blob)
- **Final state:** Double circle (concentric wobbly circles)
- **Transitions:** Arrows with event labels
- **Conditions:** Guards in brackets on arrows

**State Rules:**
- Each state is distinct and named
- Transitions show event/condition
- Initial state has only outgoing arrows
- Final state has only incoming arrows

**Color Strategy:**
- Purple: Active/current/important states
- Teal: Intermediate states
- Black: Terminal and error states
- All transitions: Black arrows

---

### Class/ER Diagram Specifics

**Components:**
- **Classes/Entities:** Three-section boxes (name, attributes, methods)
- **Relationships:** Arrows with labels
- **Cardinality:** 1, *, 0..1, 1..* on relationship lines
- **Inheritance:** Triangle arrow pointing to parent
- **Composition:** Diamond on containing class

**Relationship Types:**
- Association: Plain arrow
- Inheritance: Arrow with triangle head
- Composition: Arrow with filled diamond
- Aggregation: Arrow with open diamond

**Color Strategy:**
- Purple: Core/important entities
- Teal: Related entities
- Black: All relationship lines
- Charcoal: All attribute/method text

---

## Example Scenarios

### Example 1: Flowchart for Authentication Flow
**Content:** Blog post about user authentication process
**CSE Result:** 24-item story showing login attempt → credential check → success/failure paths
**Diagram Type:** Flowchart
**Structure:** Start → Enter Credentials → Valid? → [Yes] → Generate Token → Success
                                                   → [No] → Retry Limit? → [Yes] → Lock Account
                                                                         → [No] → Return to Enter
**Color:** Purple on success path, Teal on error handling
**Aspect:** 9:16 vertical

### Example 2: Sequence Diagram for API Call
**Content:** Technical article about microservices communication
**CSE Result:** 24-item story showing User → API Gateway → Auth Service → Database → Response chain
**Diagram Type:** Sequence Diagram
**Structure:** 4 actors (User, Gateway, Auth, DB) with message arrows showing request/response flow
**Color:** Purple on Gateway (critical), Teal on Auth (secondary)
**Aspect:** 16:9 horizontal

### Example 3: State Diagram for Order Lifecycle
**Content:** E-commerce order processing explanation
**CSE Result:** 24-item story showing order states: Pending → Processing → Shipped → Delivered (with error states)
**Diagram Type:** State Diagram
**Structure:** Initial → Pending → Processing → Shipped → Delivered → Final
                               → (error) → Cancelled
**Color:** Purple on happy path states, Teal on processing, Black on cancelled
**Aspect:** 1:1 square

### Example 4: ER Diagram for Database Schema
**Content:** Data modeling article about blog platform
**CSE Result:** 24-item story revealing entities: Users, Posts, Comments, Categories with relationships
**Diagram Type:** Entity Relationship Diagram
**Structure:** User 1──* Post, Post 1──* Comment, Post *──* Category (many-to-many)
**Color:** Purple on User and Post (core), Teal on Comment and Category
**Aspect:** 16:9 horizontal

---

## Quick Reference

### When to Use Mermaid Workflow
- Content has inherent diagram structure (flow, sequence, states)
- Need structured technical diagram (not freeform architecture)
- Want hand-drawn whiteboard aesthetic (Excalidraw style)
- Deriving diagram from content analysis (not manually specified)

### Mermaid vs Technical Diagrams
- **Mermaid:** Structured diagram types (flowchart, sequence, etc.), Excalidraw sketchy aesthetic
- **Technical:** Freeform architecture diagrams, cleaner hand-drawn style

### Process Summary
```
1. Run /cse (24-item story explanation) ← MANDATORY
2. Determine diagram type (flowchart, sequence, state, etc.)
3. Extract structure from CSE (nodes, edges, flows)
4. Design Excalidraw layout (wobbly, sketchy, whiteboard)
5. Construct comprehensive prompt
6. Choose aspect ratio (based on diagram type)
7. Generate with nano-banana-pro
8. Validate thoroughly (structure + aesthetic + UL + readability)
```

### Core Principles
1. **CSE-driven:** Always derive from content analysis, never manually specify
2. **Mermaid grammar:** Follow proper diagram type conventions
3. **Excalidraw aesthetic:** Hand-drawn whiteboard sketch feel
4. **UL color scheme:** Strategic purple/teal, black structure
5. **Readable imperfection:** Sketchy but clear

---

**The workflow: /cse → Diagram Type → Structure → Excalidraw Design → Prompt → Generate → Validate → Complete**

**The synthesis: Mermaid structure + Excalidraw aesthetic + UL editorial style = Technical diagrams that feel like smart sketches on a whiteboard.**
