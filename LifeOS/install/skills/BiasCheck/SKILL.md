---
name: BiasCheck
version: 1.0.2
description: "Three-layer bias analysis on any URL, file, or text — auto-fetches the content and any cited study, then audits data-level biases, source conflicts of interest, and journalism-added distortions, separating what the data supports from what's editorialized. USE WHEN bias analysis, analyze bias, bias check, check this study, who funded this, is this source biased, fact-check article, methodological flaws, source credibility, what's wrong with this claim. NOT FOR psychological author analysis (use _CRITICAL_ANALYSIS), research synthesis (use Research), entity due diligence (use _OSINT)."
disallowed-tools: Edit, Write, NotebookEdit
---

## Customization

**Before executing, check for user customizations at:**
`$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/BiasCheck/`

If this directory exists, load and apply any `PREFERENCES.md` or additional reference files found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# BiasCheck

## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the Check workflow in the BiasCheck skill to audit the source"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **Check** workflow in the **BiasCheck** skill to audit the source...
   ```

## What It Does

Runs a three-layer bias audit on any source — a URL, a file path, or raw text. It fetches the content plus any study it cites, then checks (1) biases inside the data, (2) conflicts of interest in the source organization, and (3) distortions the journalism added on top. The output separates what the data actually supports from what got editorialized.

## The Problem

Most "this is biased" arguments are vibes — a feeling about a source, with nothing concrete underneath. They're not repeatable and they don't tell you where the distortion lives. The other failure is analyzing an article without ever reaching the study it cites, so you critique the headline and never see that the underlying data was fine (or that it was junk). A fixed taxonomy and a fixed output shape fix both: the analysis is repeatable, the gaps are visible, and every claim ties to a specific tell.

## How It Works

The skill operates on three layers:

1. **The data itself** — biases inside the underlying study, paper, or dataset (funding, sampling, instrument design, demand characteristics, self-report distance from behavior, causal inflation, missing benchmark, publication availability)
2. **The source organization** — who paid for or produced the work, what they sell, what conclusion would be inconvenient
3. **The journalism on top** — what the reporter/commentator added: headline-to-source distortion, frame escalation, echo-chain amplification, causal claims layered over correlational data

Output cleanly separates **what the data actually supports** from **what was editorialized on top**. Confidence is anchored to specifics — no vibes-based "this seems biased."

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Check** | "bias check", "analyze bias on", "check this study/source/article" | `Workflows/Check.md` |

## Quick Reference

- **Input:** one argument — URL, file path, raw text, or any combination.
- **Always tries to find the primary source.** If the input is journalism citing a study, the skill fetches the study itself, not just the article. If the primary source can't be located, that's a finding.
- **Three-layer output** — never collapse layers; the distortion usually lives in the layer the source is least transparent about.
- **Hard separation between supported and editorialized** — this is the deliverable shape.
- **Bias taxonomy reference:** `BiasTaxonomy.md` (load on demand for the full category catalog with definitions and tells).

## Examples

**Example 1: Article citing a vendor study**
```
User: "bias check https://futurism.com/some-article-citing-a-mercer-survey"
→ Invokes Check workflow
→ Fetches the article, identifies the cited Mercer study, fetches Mercer's source
→ Runs three-layer audit: vendor conflict-of-interest, sample/question-design biases, journalism's headline-vs-source swap
→ Returns structured bias report + supported-vs-editorialized split
```

**Example 2: Raw paste of a study abstract**
```
User: "bias check this abstract: [pastes 4 paragraphs from a paper]"
→ Invokes Check workflow
→ Skips Layer 3 (no journalism on top — input IS the primary source)
→ Audits Layers 1 + 2 only: funding disclosure, sample, methodology, conflict-of-interest
→ Notes if abstract is insufficient to assess methodology (publication availability bias)
```

**Example 3: File path**
```
User: "bias check ~/Downloads/some-report.pdf"
→ Invokes Check workflow
→ Reads file
→ Identifies if report cites further upstream sources; fetches what it can
→ Three-layer audit with specifics
```

## Output Requirements

- **Format:** Markdown with the fixed section structure defined in `Workflows/Check.md`.
- **Length:** Scales with source complexity. A single-claim tweet gets ~200 words; a vendor-funded study + viral article gets 800–1500.
- **Tone:** Plain. Specific. No vibes. Every bias claim ties to a concrete tell — a quoted phrase, a sample-frame fact, a missing disclosure.
- **Must Include:** Methodology line (sample, dates, instrument availability), the three layers, the supported-vs-editorialized split, a one-paragraph bottom line, sources list with URLs.
- **Must Avoid:** Hedging ("could potentially be biased"). Diagnose or don't. The reader gets to disagree — but they should know what the analyst actually thinks.

## Gotchas

- **Always try to find the primary source.** The single biggest failure mode is analyzing an article without ever reaching the underlying study. If the input cites a study/report/paper/dataset, the skill MUST attempt to fetch it. Inability to locate the primary source is itself a finding (publication availability bias) and goes in the output.
- **An impossibly high consensus number is a tell about the question.** When a survey claims 95%+ agreement on a substantive question, that almost always means the question was a low-bar yes/no. Note it explicitly even when the instrument is hidden.
- **Vendor research is research; treat it that way.** Don't dismiss a Mercer/McKinsey/PwC/Gartner report because they sell consulting. Their funding bias is a multiplier on the analysis, not an automatic disqualifier. Specific finding > generic "vendor bias."
- **Don't conflate Layer 1 and Layer 3.** A bad headline doesn't make the underlying data bad. A flawed study doesn't make the journalism dishonest. Keep them separate even when both have problems.
- **Headlines travel; bodies don't.** Most readers see only the headline. A headline-to-source mismatch is the most consequential journalism bias and should always be flagged when present.
- **"Charitable reading" is required.** Before concluding the source is misleading, articulate what the data DOES support. This anchors the critique in specifics.
- **Don't go beyond the source you fetched.** No drive-by claims about Mercer's other reports if you only read one. No "they always do X" — stick to what's in the artifact.
- **Pure opinion piece with no data?** This skill is the wrong tool — redirect to `_CRITICAL_ANALYSIS` for psychological author read. BiasCheck needs claims with empirical scaffolding.
- **Author background is out of scope.** This skill audits the source artifact, not the author's biography. If you need "who is this writer and what's their track record," use Research or _OSINT.

## Execution Log

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"BiasCheck","workflow":"Check","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> $LIFEOS_DIR/MEMORY/SKILLS/execution.jsonl
```
