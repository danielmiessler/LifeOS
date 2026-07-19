---
name: ExtractWisdom
version: 1.1.15
description: "Content-adaptive wisdom extraction that reads content first, detects which wisdom domains are present, and builds custom sections around them, with five depth levels and mandatory contrarian takes; pulls YouTube via fabric and articles via WebFetch. USE WHEN extract wisdom, analyze video, analyze podcast, extract insights, key takeaways, summarize interview, distill content. NOT FOR static Fabric extract_wisdom pattern (use Fabric)."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/ExtractWisdom/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# ExtractWisdom — Dynamic Content Extraction

## What It Does

Pulls the best ideas out of videos, podcasts, interviews, and articles. It reads the content first, detects what kinds of wisdom are actually in there, then builds custom sections around what it finds instead of forcing the same headers every time. Five depth levels from Instant to Comprehensive. Output always ends with a one-sentence takeaway, an "If You Only Have 2 Minutes" list, and references worth following.

## The Problem

Static extraction templates force every piece of content into the same boxes — IDEAS, QUOTES, HABITS, FACTS — so a security talk and a business podcast come out looking identical and the real gems get flattened into generic bullets. The output reads like a book report, not like a smart friend telling you the parts that made them stop. This skill adapts its sections to the content and writes the points the way you'd actually say them out loud, so the contrarian takes and first-time revelations survive instead of getting watered down.

## How It Works

Instead of static sections (IDEAS, QUOTES, HABITS...), this skill detects what wisdom domains actually exist in the content and builds custom sections around them.

A programming interview gets "Programming Philosophy" and "Developer Workflow Tips." A business podcast gets "Contrarian Business Takes" and "Money Philosophy." A security talk gets "Threat Model Insights" and "Defense Strategies." The sections adapt because the content dictates them.

## When to Use

- Analyzing YouTube videos, podcasts, interviews, articles
- User says "extract wisdom", "what's interesting in this", "key takeaways"
- Processing any content where you want to capture the best stuff
- When standard extraction patterns miss the gems

## Depth Levels

Extract at different depths depending on need. Default is **Full** if no level is specified.

| Level | Sections | Bullets/Section | Closing Sections | When |
|-------|----------|----------------|-----------------|------|
| **Instant** | 1 | 8 | None | Quick hit. One killer section. |
| **Fast** | 3 | 3 | None | Skim in 30 seconds. |
| **Basic** | 3 | 5 | One-Sentence Takeaway only | Solid overview without the deep cuts. |
| **Full** | 5-12 | 3-15 | All three | The default. Complete extraction. |
| **Comprehensive** | 10-15 | 8-15 | All three + Themes & Connections | Maximum depth. Nothing left behind. |

**How to invoke:** "extract wisdom (fast)" or "extract wisdom at comprehensive level" or just "extract wisdom" for Full.

**Comprehensive extras:**
- **Themes & Connections** closing section: identify 3-5 throughlines that connect multiple sections. Not summaries — the deeper patterns the speaker may not even realize they're revealing.
- Prioritize breadth. Every significant wisdom domain gets its own section.
- No merging sections to save space. If the content supports 15 sections, use 15.

**All levels use the same voice, tone rules, and quality standards.** The only thing that changes is structure. An Instant extraction should hit just as hard per-bullet as a Comprehensive one.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Extract** | "extract wisdom from", "analyze this", YouTube URL | `Workflows/Extract.md` |

## Tone Rules (CRITICAL)

**Canonical voice reference: `LIFEOS/USER/PRINCIPAL/WRITINGSTYLE.md`** — read this file for the full voice definition. The bullets should sound like the user telling a friend about it over coffee. Not compressed info nuggets. Not clever one-liners. Actual spoken observations.

**THREE LEVELS — we're aiming for Level 3:**

**Level 1 (BAD — documentation):**
- The speaker discussed the importance of self-modifying software in the context of agentic AI development
- It was noted that financial success has diminishing returns beyond a certain threshold
- The distinction between "vibe coding" and "agentic engineering" was emphasized as meaningful

**Level 2 (BETTER — but still "smart bullet points"):**
- He built self-modifying software basically by accident — just made the agent aware of its own source code
- Money has diminishing returns. A cheeseburger is a cheeseburger no matter how rich you are.
- "Vibe coding is a slur" — he calls it agentic engineering, and only does vibe coding after 3am

**Level 3 (YES — this is what we want — conversational, the user's voice):**
- He wasn't trying to build self-modifying software. He just let the agent see its own source code and it started fixing itself.
- Past a certain point, money stops mattering. A cheeseburger is a cheeseburger no matter how rich you are.
- He calls vibe coding a slur. What he does is agentic engineering. The vibe coding only happens after 3am, and he regrets it in the morning.

**The difference between Level 2 and 3:** Level 2 is compressed info with em-dashes. Level 3 is how you'd actually SAY it. Varied sentence lengths. Letting a thought breathe. Not trying to be clever — just being clear and direct and a little bit personal.

**Key signals of Level 3:**
- Reads naturally when spoken aloud
- Varied sentence lengths — some short, some longer
- Understated — lets the content carry the weight
- Uses periods, not em-dashes, to let ideas land
- Feels opinionated ("Past a certain point, money stops mattering") not just informational
- The reader should think "I want to watch this" not "I got the summary"

## Bullets — the voice contract

The one-line target: sections specific to the content, bullets that sound spoken, not summarized. The THREE LEVELS above are the standard — every bullet lands at Level 3. A good bullet exhibits these properties:

- **Spoken, not summarized.** Reads like you telling a friend what you just watched, not a press release or a compressed tweet.
- **Specific over vague.** Carries the actual detail, quote, or number — "a cheeseburger is a cheeseburger no matter how rich you are," not "he talked about money." Use the speaker's own words when they're already perfect.
- **Insight over inventory.** "He picked a language he doesn't even like because the ecosystem fits agents" beats "he uses Go for CLIs." A contradiction or reversal is the wisdom.
- **8-16 words, varied length.** Mix short and medium; periods between thoughts, not em-dashes. Verbatim quotes are exempt.
- **Human moments count.** Burnout, doubt, something that moved the speaker — that's wisdom too, even when it isn't "technical."

**Contrarian takes are mandatory.** If the speaker has a genuinely hot take ("screw MCPs", "X is dead", "Y is overhyped"), it MUST appear, undiluted. Spicy takes are the most memorable and shareable material — losing one is a failed extraction, including between drafts.

## Sections — adapt to the content

Sections are named for THIS content, not from a fixed list. A programming interview gets "Programming Philosophy"; a business podcast gets "Money Philosophy"; a security talk gets "Threat Model Insights." Name them like a magazine editor — "The Death of 80% of Apps," not "Technology Predictions." The name should make the reader curious.

- Section count follows the depth-level table.
- Every section needs at least 3 strong bullets (except Fast, where 3 tight bullets IS the section). Can't find 3? Merge it into a related section.
- Include "Quotes That Hit Different" when the content has quotable moments; include "First-Time Revelations" when there are genuinely new ideas.
- No inventory sections — a bare list of facts isn't wisdom. Go deeper on why the choices matter, or merge into a philosophy section.
- Don't split what belongs together. Don't drop your best material between drafts — a spicy take or stunning moment found in an early pass MUST survive to the final.

## Closing Sections

Which closing sections appear depends on depth level:

| Level | Closing Sections |
|-------|-----------------|
| **Instant** | None |
| **Fast** | None |
| **Basic** | One-Sentence Takeaway only |
| **Full** | One-Sentence Takeaway + If You Only Have 2 Minutes + References & Rabbit Holes |
| **Comprehensive** | All three above + Themes & Connections |

**One-Sentence Takeaway** — the single most important thing from the entire piece, in 15-20 words.

**If You Only Have 2 Minutes** — the 5-7 absolute must-know points. The cream of the cream.

**References & Rabbit Holes** — people, projects, books, tools, and ideas mentioned that are worth following up on, with brief context for each.

**Themes & Connections** (Comprehensive only) — 3-5 throughlines that connect multiple sections. The deeper patterns the speaker may not realize they're revealing. Synthesis, not summary.

## Output Format

```markdown
# EXTRACT WISDOM: {Content Title}
> {One-line description of what this is and who's talking}

---

## {Dynamic Section 1 Name}

- {bullet}
- {bullet}
- {bullet}

## {Dynamic Section 2 Name}

- {bullet}
- {bullet}

[... more dynamic sections ...]

---

## One-Sentence Takeaway

{15-20 word sentence}

## If You Only Have 2 Minutes

- {essential point 1}
- {essential point 2}
- {essential point 3}
- {essential point 4}
- {essential point 5}

## References & Rabbit Holes

- **{Name/Project}** — {one-line context of why it's worth looking into}
- **{Name/Project}** — {context}
```

## Quality Check

Before delivering output, verify:
- [ ] Sections are specific to THIS content, not generic
- [ ] No bullet sounds like it was written by a committee
- [ ] Every bullet has a specific detail, quote, or insight — not vague summaries
- [ ] Section names are conversational and headline-worthy (not category labels)
- [ ] Section count matches depth level (Instant=1, Fast/Basic=3, Full=5-12, Comprehensive=10-15)
- [ ] Closing sections match depth level (see Closing Sections table)
- [ ] No bullet starts with "The speaker" or "It was noted that"
- [ ] No more than 3 bullets per section start with "He" or the speaker's name
- [ ] No bullet exceeds 25 words
- [ ] No inventory sections (just listing facts without insight)
- [ ] "If You Only Have 2 Minutes" bullets are each under 20 words
- [ ] Reading the output makes you want to consume the original content

## Gotchas

- **Content-adaptive sections means output structure varies by input type.** Don't expect identical output format for a podcast vs an article.
- **YouTube extraction should use `fabric -y URL` first** to get the transcript before extracting wisdom.
- **Long content may need chunking.** Don't try to extract wisdom from a 3-hour podcast transcript in one pass.

## Examples

**Example 1: YouTube interview extraction**
```
User: "extract wisdom from this Marcus Hutchins interview"
→ Uses `fabric -y URL` to get transcript
→ Content-adaptive extraction (interview format)
→ Returns: key insights, surprising claims, actionable takeaways
→ ~45 seconds
```

**Example 2: Article extraction**
```
User: "extract the key insights from this blog post"
→ Fetches content via WebFetch
→ Adapts sections to article format
→ Returns distilled wisdom with source attribution
```

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"ExtractWisdom","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
