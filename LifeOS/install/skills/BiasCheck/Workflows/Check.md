# Check Workflow

Run structured three-layer bias analysis on a source.

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Check workflow in the BiasCheck skill to audit the source"}' \
  > /dev/null 2>&1 &
```

Output:
```
Running the **Check** workflow in the **BiasCheck** skill to audit the source...
```

## Step 0 — Sufficiency Check (Algorithm v6.7.0)

Before fetching anything, verify the input is workable:

1. **Is there a source?** A URL, file path, or substantive text body (≥ ~50 words) must be present. A bare claim with no source attached ("is the moon landing fake biased?") fails this gate — ask for a source or redirect.
2. **Is it the right tool?** Pure opinion piece with no empirical scaffolding → redirect to `_CRITICAL_ANALYSIS`. Pure claim about a person's character → redirect to `_OSINT` or Research. A study, dataset, survey, statistical claim, or article reporting any of those → proceed.
3. **Ambiguity threshold:** if the input is one URL with no further context, proceed (default interpretation: audit it). If the input is two URLs without a stated relationship, ask one question — are these (a) one analyzes the other, or (b) two separate sources to compare? Then proceed.

If sufficient, run the workflow. If not, emit ≤3 questions with a `proceed` override and halt.

## Step 1 — Parse the Input

Inputs can be:

| Shape | Handling |
|-------|----------|
| Single URL | `WebFetch` the URL, extract content + any cited sources |
| File path | `Read` the file; if PDF, use `Read` with `pages:` param for large PDFs |
| Raw text paste | Use directly |
| Mixed (URL + commentary) | Treat URL as primary source; treat commentary as context, not as an additional source |
| Two URLs | Confirm intent first (see Step 0); then audit both |

Always normalize to: **primary content (what was given) + sources cited within (to fetch in Step 2)**.

## Step 2 — Fetch the Primary Source (CRITICAL)

If the primary input is journalism, commentary, or a secondary citation of a study/report/dataset/paper, you MUST attempt to fetch the underlying primary source. This is the single most-violated step in bias analysis.

**Identification heuristics:**

- Phrases like "according to a study by X," "X's research found," "a new survey from X," "X report shows," "data from X"
- Linked PDFs, vendor research landing pages, press releases
- Specific named statistics ("99% of CEOs say...") that imply a survey
- Academic citations (DOI, arXiv ID, journal name)

**Fetch order:**

1. Try the direct link if one is given. `WebFetch` first.
2. If the link is a landing page or table-of-contents, follow it and try to surface the actual report or methodology PDF.
3. If no direct link exists, use `WebSearch` to find the primary source by name + author + topic.
4. If after one round of WebSearch you cannot locate it, that becomes a finding — "primary source not publicly accessible" goes in the methodology section as publication-availability bias.

**Stop after one round of search.** Don't go down a rabbit hole. The deliverable is the bias analysis; documenting unavailability IS valid output.

## Step 3 — Capture the Methodology Facts

For the primary source (or the article itself if there is no separate primary), extract these facts as best you can:

- **Sample frame** — who was surveyed/measured (population, role, geography, recruitment method)
- **Sample size** — N total, plus any meaningful sub-N (e.g., US executive subset)
- **Dates** — when fieldwork ran; when the report was published
- **Funding/source** — who paid for the work; who produced it; what they sell
- **Instrument availability** — is the full question set / dataset publicly accessible, or only topline numbers
- **Methodology type** — survey, observational, RCT, retrospective, cross-sectional, longitudinal

If any of these are not stated, list it as "not disclosed" — non-disclosure is itself information.

## Step 4 — Three-Layer Analysis

Use the bias taxonomy at `BiasTaxonomy.md` as the catalog of categories. Load it with `Read {{LIFEOS_ROOT}}/skills/BiasCheck/BiasTaxonomy.md`. Apply selectively — not every category fires for every source.

### Layer 1 — Biases inside the data

Audit the underlying study/dataset. Categories include:

- Source/funding bias (who paid)
- Sampling bias (recruitment, response rate, representativeness)
- Question-design bias (leading wording, scale design, social-desirability cues)
- Demand characteristics
- Self-report vs behavior gap
- Causal inflation (correlational data dressed as causal)
- No-benchmark fallacy (no comparison group, no baseline)
- Publication / availability bias (methodology not public)
- Survivorship bias
- Cross-sectional confounds (when comparing snapshots across time)

For each that fires, write 2–4 sentences anchored to a specific fact about this study. No generic "vendor research has bias" — name the specific tell.

### Layer 2 — Source-organization biases

Audit the org that produced or funded the work:

- What does the org sell?
- Does this conclusion drive their pipeline?
- Are there past reports from the same org reaching convergent conclusions (motivated consistency)?
- Is the org's relationship to the conclusion disclosed in the artifact itself?

Be specific. Mercer sells AI workforce consulting; their conclusion that companies need AI workforce consulting is structurally compromised — but the data may still be useful. Note the multiplier on the analysis, don't reflexively disqualify.

### Layer 3 — Biases added by the journalism/commentary

Audit what the reporter or commentator added on top:

- **Headline-to-source distortion** — does the headline match the article body and the source's actual claims? (Often the single most consequential journalism bias.)
- **Frame escalation** — does the body inflate the study's claims (e.g., "factor in workforce planning" → "planning mass layoffs")?
- **Echo-chain amplification** — is this a third-hand citation (vendor PR → trade pub → mainstream article)? Each hop strips context.
- **Causal framing on correlational data** — does the article assert X causes Y when the study only shows X correlates with Y?
- **Confound omission** — are obvious alternative explanations addressed or ignored?
- **Selective quoting** — does the article cite only the topline number and skip the methodology caveats the source provided?

If the input IS the primary source (no journalism layer), skip Layer 3 and say so.

## Step 5 — Write the Supported-vs-Editorialized Split

This is the deliverable's core. Two short lists:

- **What the data actually supports.** Charitable reading. What can be concluded directly from the methodology, sample, and findings as reported? Be generous here; the goal is to surface a defensible version of the claim.
- **What the data does NOT support.** Claims made by the source or implied by the framing that the data cannot carry. Each item should pair with one of the Layer-1/2/3 findings above.

This split is what makes the output actionable. The reader can use it to write a corrected version of the original claim.

## Step 6 — Bottom Line + Sources

Two-to-three sentence summary: in plain language, what is this source, what's the honest version of its claim, and what's the multiplier on top of the data?

Then a **Sources** list with URLs for every primary, secondary, and methodology document fetched.

## Output Format

```markdown
# Bias Analysis: {short topic-based title}

**Source(s) examined**
- Reporting source: {URL or file path}
- Underlying primary source: {URL, citation, or "not publicly accessible"}

**Methodology of the underlying study**
- Sample frame: {description}
- Sample size: {N}
- Fieldwork dates: {dates}
- Funding/producer: {org + what they sell, if relevant}
- Instrument availability: {public / topline-only / not disclosed}
- Methodology type: {survey/observational/etc}

---

## Layer 1 — Biases inside the data

- **{Category name}.** {2–4 sentence specific finding tied to this study.}
- **{Category name}.** {finding}
- ...

## Layer 2 — Source-organization biases

- **{Category name}.** {finding}
- ...

## Layer 3 — Biases added by the journalism/commentary

- **{Category name}.** {finding}
- ...

*(Skip Layer 3 entirely with a one-line note if the input IS the primary source.)*

---

## What the data actually supports

- {Defensible claim 1}
- {Defensible claim 2}
- ...

## What the data does NOT support

- {Overclaim 1, tied to a Layer 1/2/3 finding}
- {Overclaim 2}
- ...

---

## Bottom line

{2–3 sentences. Honest reframe in plain language.}

**Sources**
- [Reporting source]({URL})
- [Primary source]({URL or note about unavailability})
- [Additional context]({URL})
```

## Quality Check

Before delivering, verify:

- [ ] Methodology line filled out (or "not disclosed" stated explicitly)
- [ ] Primary source either fetched OR documented as unavailable (no silent skip)
- [ ] Every bias claim ties to a specific tell from the artifact (no generic vibes)
- [ ] Layers 1, 2, 3 are clearly separated; layer-3 is skipped only when input IS the primary source
- [ ] Supported-vs-not-supported split is present and concrete
- [ ] Bottom line states what the source actually is, not just what's wrong with it
- [ ] Sources list includes URLs
- [ ] No hedging vocabulary ("could potentially," "may suggest"); diagnose or don't

## Execution Log

After completing, append:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"BiasCheck","workflow":"Check","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```
