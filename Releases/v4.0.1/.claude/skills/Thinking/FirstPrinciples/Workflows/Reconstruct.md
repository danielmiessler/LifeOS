# Reconstruct Workflow

**Purpose**: Build an optimal solution from scratch using only the fundamental truths and hard constraints identified through Deconstruct and Challenge.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Reconstruct workflow in the FirstPrinciples skill to build optimal solution"}' \
  > /dev/null 2>&1 &
```

Running the **Reconstruct** workflow in the **FirstPrinciples** skill to build optimal solution...

---

**When to Use**:
- After completing Deconstruct and Challenge workflows
- When existing solutions are clearly suboptimal
- When you need to escape local maxima
- To generate innovative alternatives to conventional approaches

---

## Core Principle

> "If we knew nothing about how this is currently done, and only knew the fundamental truths, what would we build?"

This is about optimizing **function** (what you're trying to accomplish) rather than **form** (how it's traditionally done).

---

## Process

### Step 1: State Only the Hard Constraints

From your Challenge analysis, list ONLY the hard constraints:
- Laws of physics
- Mathematical requirements
- Verified empirical facts
- True immutable requirements

**Exclude**:
- Soft constraints (choices that could change)
- Assumptions (unvalidated beliefs)
- "How it's always been done"
- Industry conventions

**Write**: "The only things that MUST be true: [list]"

### Step 2: Define the Function

What is the actual outcome you need?

Not: "We need a database"
But: "We need to persist and retrieve user data reliably"

Not: "We need microservices"
But: "We need to deploy and scale components independently"

Not: "We need a mobile app"
But: "Users need to accomplish X from anywhere"

**Write**: "The function we're optimizing for: [outcome]"

### Step 3: Blank Slate Design

Pretend you've never seen the current solution. Ask:

- If an alien with perfect engineering knowledge landed today, what would they build?
- If we were starting a new company to solve just this problem, what would we do?
- What would a physicist build to satisfy these constraints?

**Generate 3+ approaches** without filtering for feasibility yet.

### Step 4: Cross-Domain Synthesis

Look for solutions in unrelated fields:

- What industry has solved an analogous problem?
- What technology from another domain could apply?
- What would [different field] do with this problem?

**The snowmobile insight**: Tank treads + Boat motor + Bicycle seat = New category

**Write**: "Analogous solutions from other domains: [list]"

### Step 5: Evaluate Against Function

For each potential solution:

| Solution | Satisfies Hard Constraints? | Achieves Function? | Simpler Than Current? |
|----------|----------------------------|--------------------|-----------------------|
| [A] | Yes/No | Yes/No | Yes/No |
| [B] | Yes/No | Yes/No | Yes/No |
| [C] | Yes/No | Yes/No | Yes/No |

**Best solution**: Satisfies constraints, achieves function, maximizes simplicity

### Step 6: Identify What Changes

Compare reconstructed solution to current approach:

- What gets eliminated? (Complexity that wasn't fundamental)
- What gets simplified? (Over-engineering based on soft constraints)
- What's new? (Approaches that weren't considered)
- What's the same? (Fundamentals that were actually correct)

---

## Output Template

```markdown
## Reconstruction: [Subject]

### Hard Constraints Only
1. [Immutable constraint 1]
2. [Immutable constraint 2]
3. [Immutable constraint 3]

### Function to Optimize
[What we're actually trying to accomplish - outcome, not method]

### Blank Slate Solutions

**Option A: [Name]**
- Approach: [Description]
- How it satisfies constraints: [Explanation]
- Pros: [Benefits]
- Cons: [Drawbacks]

**Option B: [Name]**
- Approach: [Description]
- How it satisfies constraints: [Explanation]
- Pros: [Benefits]
- Cons: [Drawbacks]

**Option C: [Name]**
- Approach: [Description]
- How it satisfies constraints: [Explanation]
- Pros: [Benefits]
- Cons: [Drawbacks]

### Cross-Domain Insights
- From [Field 1]: [Applicable concept]
- From [Field 2]: [Applicable concept]

### Recommended Solution
**[Option X]** because [reasoning]

### Comparison to Current Approach

| Aspect | Current | Reconstructed | Delta |
|--------|---------|---------------|-------|
| Complexity | [X] | [Y] | [Simpler/Same/More] |
| Cost | [X] | [Y] | [Lower/Same/Higher] |
| Performance | [X] | [Y] | [Better/Same/Worse] |
| Flexibility | [X] | [Y] | [More/Same/Less] |

### What We're Eliminating
- [Thing that wasn't fundamental]
- [Complexity from soft constraints]

### What We're Adding
- [New approach from first principles]
- [Cross-domain technique]

### Implementation Path
1. [First step to move toward reconstructed solution]
2. [Second step]
3. [Third step]
```

---

## Example: Reconstructing "File Storage System"

### Hard Constraints Only
1. Must durably persist bytes (physics: data must survive power loss)
2. Must be retrievable by identifier (math: need addressing scheme)
3. Must handle N bytes total capacity (requirement: known data volume)

### Function to Optimize
"Durably store and retrieve files for a web application"

### Blank Slate Solutions

**Option A: Object Storage (S3-style)**
- Approach: Flat namespace, HTTP API, eventual consistency
- Satisfies constraints: Yes - durable, addressable, scalable
- Pros: Infinitely scalable, cheap at scale, no servers to manage
- Cons: Latency, eventual consistency

**Option B: SQLite + Backups**
- Approach: Single file database, blob storage, periodic backup to cloud
- Satisfies constraints: Yes - durable (with backups), addressable (by key), handles capacity
- Pros: Dead simple, single file, ACID, fast reads
- Cons: Single machine limit, backup complexity

**Option C: Content-Addressed Storage**
- Approach: Hash-based addressing, deduplication, distributed
- Satisfies constraints: Yes - immutable = durable, hash = address, scales horizontally
- Pros: Deduplication, integrity verification, cacheable everywhere
- Cons: More complex, no in-place updates

### Cross-Domain Insights
- From Git: Content-addressed storage is brilliant for integrity
- From CDNs: Edge caching solves latency, not origin storage
- From Databases: Sometimes ACID matters more than scale

### Recommended Solution
**For most web apps: Option B (SQLite + Backups)**

Why: 90% of applications never exceed single-machine capacity. SQLite is simpler, faster for reads, requires no infrastructure. Only reconstruct to Option A/C when you actually hit limits.

### Comparison to Current Approach

| Aspect | Current (S3 + CDN) | Reconstructed (SQLite) | Delta |
|--------|-------------------|------------------------|-------|
| Complexity | High (3 services) | Low (1 file) | Much simpler |
| Cost | $500/mo | $0 + backup ($5/mo) | 99% reduction |
| Performance | 50ms p50 | 1ms p50 | 50x faster |
| Flexibility | High | Medium | Slightly less |

### What We're Eliminating
- S3 configuration and IAM complexity
- CDN setup and cache invalidation logic
- Network latency for every file operation
- $495/month in unnecessary infrastructure

### What We're Adding
- Simple backup script to cloud storage
- Monitoring for file size approaching limits
- Migration path document for when we actually need to scale

---

## Common Reconstruction Patterns

### Pattern: "Do We Even Need This?"
Often the reconstructed solution eliminates entire components:
- "We need a message queue" → Direct function calls work fine at our scale
- "We need Kubernetes" → A single server handles our load
- "We need a SPA framework" → Server-rendered HTML is simpler and faster

### Pattern: "Different Technology, Same Function"
The function stays, but the form changes completely:
- "Web app" → "CLI tool" (if users are technical)
- "Mobile app" → "PWA" (if native features aren't needed)
- "Custom solution" → "Spreadsheet" (if that's actually sufficient)

### Pattern: "Combine Steps"
Removing soft constraints often allows combining what were separate steps:
- "Microservices" → "Modular monolith" (one deployment, multiple modules)
- "ETL pipeline" → "Query on read" (if data volume permits)
- "Async workflow" → "Synchronous" (if latency isn't critical)

---

## Integration Notes

**Full First Principles Flow**:
```
Deconstruct → Challenge → Reconstruct
     ↓            ↓            ↓
  (Parts)    (Classify)    (Build new)
```

**Standalone Use**:
Can use Reconstruct directly if you already know the hard constraints:
```
→ FirstPrinciples/Reconstruct given constraints [X, Y, Z]
```

**With Other Skills**:
- Architect invokes after Challenge to generate alternatives
- Engineer invokes when stuck to escape local maxima
- RedTeam invokes to construct counter-proposals
