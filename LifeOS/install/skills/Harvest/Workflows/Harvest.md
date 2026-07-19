# Harvest Workflow

**Goal:** Turn one piece of content into a ranked, honest list of what LifeOS should take from it, then preserve the source in the Knowledge Archive. System adoption is report-only; KB ingestion always happens.

## Step 1 — Detect input type

Classify the argument:

- `youtu.be/…` or `youtube.com/…` → **YouTube**
- Any other `http(s)://…` → **Article/URL**
- A path that exists on disk → **File**
- Anything else → **Raw text**

## Step 2 — Fetch the content

| Type | How |
|------|-----|
| YouTube | `fabric -y "<url>"` → transcript. Never scrape the page HTML. |
| Article/URL | `WebFetch` the URL for the body. If it's blocked or thin, escalate to the Research skill. |
| File | `Read` the file. |
| Raw text | Use the provided text directly. |

If the fetch fails or returns almost nothing, stop and say so — don't analyze an empty transcript.

## Step 3 — Extract candidates

Read the whole thing. Pull out every concrete, transferable element:

- **Ideas / framings** — a way of thinking about a problem LifeOS already has.
- **Techniques / patterns** — an algorithm, a workflow shape, a verification method, an eval design.
- **Tools** — a library, a CLI, an API, a service worth wiring in.
- **Prompts / phrasings** — a prompt structure or instruction that beats what we do now.
- **Warnings** — a failure mode or anti-pattern we should guard against.

Keep candidates concrete. "Be more rigorous" is not a candidate. "Use property-based tests where an ISC is a universal claim" is.

## Step 4 — Judge each candidate against LifeOS

For every candidate, answer three things:

1. **Where does it map?** Name the exact surface: an Algorithm phase or gate, a specific hook (`hooks/*.hook.ts`), a specific skill, the memory system, Pulse, routing / `EFFORT_MODEL`, ISA, or a doctrine file (system prompt, CLAUDE.md, OPERATIONAL_RULES). If you can't name a surface, it's not a hit — drop it.
2. **Prior Status** — be honest and check before claiming novelty:
   - **NEW** — LifeOS doesn't do this.
   - **PARTIAL** — we have something close; this sharpens or extends it.
   - **DONE** — already implemented (name where).
   - **REJECTED** — we've considered and declined this (name why, if known).
   Cross-check by recalling recent work and, when cheap, grepping `skills/`, `hooks/`, and the Algorithm.
3. **How would we use it?** One concrete sentence: the actual change we'd make.

## Step 5 — Rank

Score each surviving candidate by **usefulness × novelty × (inverse) effort**. High usefulness, genuinely NEW or a strong PARTIAL upgrade, low-to-moderate effort floats to the top. DONE and REJECTED items drop to a short "already covered" note, not the main table.

## Step 6 — Report

Output this shape:

```
## Harvest: <source>

<one line: what the content is, and the headline verdict — rich / thin / nothing>

| # | Candidate | Maps to | How we'd use it | Prior status | Recommended action |
|---|-----------|---------|-----------------|--------------|--------------------|
| 1 | …         | …       | …               | NEW/PARTIAL  | …                  |

**Already covered:** <one line each for DONE/REJECTED hits, if any>

**Verdict:** <the honest bottom line — what, if anything, is worth doing next>
```

Rules for the report:

- Lead with the verdict. If nothing is worth adopting, the table can be empty and the verdict says so.
- Every row names a real surface and a real action. No vague usefulness.
- Recommend, don't do. Adoption of any item is a separate step that needs {{PRINCIPAL_NAME}}'s explicit go-ahead.
- Keep it tight. A harvest is a filter, not an essay.

## Step 7 — Ingest into the Knowledge Archive (ALWAYS the final step)

Every harvest ends by preserving the source as a KNOWLEDGE note, regardless of how thin the mining verdict was:

```bash
bun $LIFEOS_ROOT/skills/_HARVEST/Tools/harvest.ts "<original input>"
```

- Runs the canonical Arbol pipeline (`_F_HARVEST` classify → `HarvestExecutor.ts` write). Never write to `MEMORY/KNOWLEDGE/` by hand.
- A `duplicate` result is success — the note already exists; say so.
- On failure (Arbol down, classifier error, dead API key), report the failure explicitly in the final response and name the blocked item id. A harvest is not complete until the note is written or the failure is surfaced.
- Append the note path (or the failure) to the report under a final `**Knowledge Archive:**` line.
