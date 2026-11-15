# ExecutePattern

**Contents:** Ideal State · Anti-criteria · Inputs · Safety gates · Tool contract · Output format · References

Runs a Fabric pattern natively from local storage: the model reads the pattern's system.md and applies it to the content, with the fabric CLI used only for YouTube transcripts and blocked URLs.

## Ideal State

- The pattern applied is the one the request named explicitly, or otherwise the top pick `Tools/SuggestPattern.ts` returns for the request's wording from the pattern catalog, shown to the user before it runs.
- When that pattern is in § Ported patterns, its intent runs instead and the upstream system.md is never used as the prompt; this intent applies only to patterns with no port.
- Except for YouTube (`fabric -y`) and blocked-URL (`fabric -u`) runs, the output is the local `Patterns/<name>/system.md` applied by the model directly to the provided content, following its STEPS and OUTPUT INSTRUCTIONS; the fabric CLI ran only in those two cases: a YouTube URL, or a URL whose native fetch failed.
- The returned output preserves the format the pattern's OUTPUT INSTRUCTIONS specify.
- When a summarize-family pattern runs on a URL or on raw text of 200 characters or more and a harvest/knowledge-ingestion skill is installed, harvest ran on the same input in the background, and its result block (KNOWLEDGE path or duplicate status, or its error as a warning block) is surfaced alongside the summary.
- A missing pattern or missing content is answered with the matching Error Handling message.

## Anti-criteria

- Harvest errors never suppress the summary or replace summary output with the error, and are never swallowed; summary errors never block harvest.
- This intent never writes to `MEMORY/KNOWLEDGE/` directly and never re-implements the harvest writer.
- Harvest auth never introduces a new token path or env var.
- Harvest never fires on raw text under 200 characters.

## Inputs

Pattern selection reads the generated catalog `Patterns/catalog.yaml` (one entry per pattern: purpose, triggers, input, output, ported intent; built by `Tools/PatternCatalog.ts`), merged at read time with the install's local catalog at `<configRoot>/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Fabric/catalog.yaml`.

**If pattern is explicitly named:** Use that pattern directly (e.g., "use extract_article_wisdom" -> `extract_article_wisdom`), unless § Ported patterns lists it. A named pattern or ported intent never goes through the suggester and costs no model call.

**Otherwise:** run `Tools/SuggestPattern.ts` on the request (§ Tool contract) and take its first pick; its second and third are the alternatives offered with the pick. Any summarize-family pattern also fires the auto-harvest side-effect (Tool contract, Trigger).

### Ported patterns

Every pattern below runs as its intent in `skills/Fabric/Intents/<Intent>.md`, whether it was named or reached through the table or the keyword rule. The intent owns the output format and its own Assay suite. The upstream system.md stays in `Patterns/` for reference only.

<!-- ported-patterns:start -->
| Pattern | Runs |
|---------|------|
| `create_5_sentence_summary` | WordSummary |
| `analyze_threat_report` | AnalyzeThreatReport |
| `analyze_threat_report_cmds` | AnalyzeThreatReport |
| `analyze_threat_report_trends` | AnalyzeThreatReport |
| `create_threat_scenarios` | ThreatScenarios |
| `create_report_finding` | ReportFinding |
| `improve_report_finding` | ReportFinding |
| `analyze_logs` | AnalyzeLogs |
| `analyze_malware` | AnalyzeMalware |
| `analyze_incident` | AnalyzeIncident |
| `create_cyber_summary` | CyberSummary |
| `write_semgrep_rule` | SemgrepRule |
| `ask_secure_by_design_questions` | SecureByDesignQuestions |
| `create_sigma_rules` | SigmaRules |
| `analyze_email_headers` | EmailHeaders |
| `write_nuclei_template_rule` | NucleiTemplate |
| `create_network_threat_landscape` | NetworkThreatLandscape |
| `extract_poc` | ExtractPoc |
| `analyze_terraform_plan` | TerraformPlan |
| `analyze_claims` | AnalyzeClaims |
| `find_logical_fallacies` | LogicalFallacies |
| `check_falsifiability` | CheckFalsifiability |
| `extract_ethical_framework` | EthicalFramework |
| `check_agreement` | CheckAgreement |
| `audit_transparency` | AuditTransparency |
| `audit_consent` | AuditConsent |
| `detect_mind_virus` | MindVirus |
| `analyze_bill` | AnalyzeBill |
| `compare_and_contrast` | CompareAndContrast |
| `analyze_risk` | AnalyzeRisk |
| `lens_rhetorical` | RhetoricalLens |
| `lens_stoic` | StoicLens |
| `extract_predictions` | ExtractPredictions |
| `analyze_paper` | AnalyzePaper |
| `summarize_paper` | AnalyzePaper |
| `analyze_paper_simple` | AnalyzePaper |
| `extract_insights` | ExtractInsights |
| `extract_patterns` | ExtractPatterns |
| `summarize` | Summarize |
| `extract_ideas` | ExtractIdeas |
| `apply_ul_tags` | UlTags |
| `summarize_meeting` | SummarizeMeeting |
| `extract_business_ideas` | BusinessIdeas |
| `extract_recommendations` | ExtractRecommendations |
| `summarize_debate` | SummarizeDebate |
| `analyze_comments` | AnalyzeComments |
| `create_design_document` | DesignDocument |
| `explain_code` | ExplainCode |
| `review_design` | ReviewDesign |
| `write_pull-request` | PullRequest |
| `explain_docs` | ExplainDocs |
| `explain_terms` | ExplainTerms |
| `generate_code_rules` | CodeRules |
| `analyze_prose` | AnalyzeProse |
| `analyze_prose_pinker` | AnalyzeProse |
| `create_show_intro` | ShowIntro |
| `create_golden_rules` | GoldenRules |
<!-- ported-patterns:end -->

## Safety gates

Harvest and summary fail independently (Anti-criteria): a non-zero harvest exit prints the summary as normal plus the harvest error as a warning block, because harvest is the persistence layer.

- Auth comes from `~/.config/workflows/config.yaml`. Do not introduce a new token path or env var.
- The single canonical `MEMORY/KNOWLEDGE/` writer is the harvest skill's executor (`LIFEOS/TOOLS/HarvestExecutor.ts` — public issue #1991, @xmasyx).

## Tool contract

When the request names no pattern, pick one first:

```bash
bun ~/.claude/skills/Fabric/Tools/SuggestPattern.ts "<the request, verbatim>"
```

Pass the request's wording only, never the content it is applied to: the wording goes to the Assay judgment layer, and the tool sends at most its first 500 characters.

It prints three lines, `N. <name> [runs <Intent>] (<reason>)`, and always exits 0. A pick marked `[runs <Intent>]` runs that intent (§ Ported patterns), never the upstream system.md.

### Intent-to-Flag Mapping

| Situation | Flag |
|-----------|------|
| default: shipped catalog plus the install's local catalog | (none) |
| the full result as JSON (picks, purposes, scores, engine status) | `--json` |
| leave the install's local patterns out | `--no-user` |
| the judgment layer must not be asked | `LIFEOS_GLANCE_DISABLED=1` in the environment |

Read the pattern's system.md file:

```bash
PATTERN_NAME="[selected_pattern]"
CONFIG_ROOT="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
PATTERN_PATH="$CONFIG_ROOT/skills/Fabric/Patterns/$PATTERN_NAME/system.md"
LOCAL_PATH="$CONFIG_ROOT/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Fabric/Patterns/$PATTERN_NAME/system.md"

if [ -f "$PATTERN_PATH" ]; then
  cat "$PATTERN_PATH"
elif [ -f "$LOCAL_PATH" ]; then
  cat "$LOCAL_PATH"
else
  echo "Pattern not found: $PATTERN_NAME"
  echo "Available patterns:"
  ls "$CONFIG_ROOT/skills/Fabric/Patterns/" | head -20
fi
```

The install's own patterns (the principal's local-only ones, which never ship) live in `<configRoot>/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Fabric/Patterns/<name>/system.md` and are read only when the skill's `Patterns/` has no pattern of that name, so an upstream pattern always wins.

**Native Execution (Preferred):** each system.md is laid out as IDENTITY AND PURPOSE, STEPS and OUTPUT INSTRUCTIONS.

Both CLI cases need the fabric binary, which builds from the `cmd/fabric` package (per the upstream README checked 2026-10-10):
```bash
go install github.com/danielmiessler/fabric/cmd/fabric@latest
```

**YouTube URLs:**
```bash
fabric -y "YOUTUBE_URL" -p [pattern_name]
```
The `-y` flag extracts the transcript automatically.

**URLs the native fetch cannot extract (heavy client-side rendering):**
```bash
fabric -u "URL" -p [pattern_name]
```
Use when native URL fetching returns no usable page content. A site that blocks automated access (CAPTCHA, bot challenge, robots or terms refusal) is respected and not retried through another path.

**Trigger:** When the selected pattern is a member of the **summarize-family** and the input is either a URL or text ≥200 characters, fire the knowledge-ingestion (harvest) skill on the same input as a side-effect of the summary, only if that skill is installed. Two outputs from one action: the summary in chat, the KNOWLEDGE note on disk.

**Summarize-family patterns** (extend as new ones land):

- `summarize`
- `create_5_sentence_summary`
- `create_micro_summary`
- `summarize_paper`
- `summarize_lecture`
- `summarize_meeting`
- `summarize_debate`
- `youtube_summary`

**Invocation** — invoke the harvest/knowledge-ingestion skill on the same input, run in the background so it does not block the summary. Its CLI handles source detection (URL / YouTube / text), body fetch, classification, and note-writing, so the writer is never re-implemented here. Skip this step silently if no such skill is installed.

**Input-type gate:**

- URL (article or YouTube) → fire harvest.
- Raw text ≥200 characters → fire harvest with `--type text`.
- Raw text <200 characters → skip harvest (too thin for a KNOWLEDGE note).

**Idempotency:** re-running summarize on the same URL returns `workflows.status: duplicate` from the harvest CLI; no second KNOWLEDGE note is created. Surface the duplicate status to the user so they know the source was already captured.

## Output format

When the request named no pattern, the pick is shown on one line before the pattern runs, with the suggester's reason:

```
Pattern: <name> (<reason>)
```

The pattern output follows that pattern's own OUTPUT INSTRUCTIONS (for example extract_wisdom's SUMMARY, IDEAS, INSIGHTS, QUOTES, HABITS, FACTS, REFERENCES and RECOMMENDATIONS sections); this file does not restate them.

**Output reporting** — alongside the summary, surface the harvest result block:

```
--- HARVEST ---
workflows.id:   <id>
classification: <ideas|research|people|companies>
KNOWLEDGE path: MEMORY/KNOWLEDGE/<Type>/<slug>.md   (or "duplicate — not re-written")
```

### Error Handling

**Pattern not found:**
```
Pattern '[name]' not found in ~/.claude/skills/Fabric/Patterns/ or the install's local Patterns/

Similar patterns:
- [suggestion 1]
- [suggestion 2]

Run 'update fabric' to sync latest patterns.
```

**No content provided:**
```
No content provided for pattern execution.
Please provide:
- Text directly
- URL to fetch
- YouTube URL (use fabric -y)
- File path to read
```

## References

- `Patterns/catalog.yaml`: the generated catalog SuggestPattern ranks from; `Patterns/pattern_explanations.md`: the upstream one-line list its purposes come from.

Pattern categories (the full set is `Patterns/pattern_explanations.md`):

### Extraction (30+)
`extract_wisdom`, `extract_insights`, `extract_main_idea`, `extract_recommendations`, `extract_article_wisdom`, `extract_book_ideas`, `extract_predictions`, `extract_questions`, `extract_controversial_ideas`, `extract_business_ideas`, `extract_skills`, `extract_patterns`, `extract_references`, `extract_instructions`, `extract_primary_problem`, `extract_primary_solution`, `extract_product_features`, `extract_core_message`

### Summarization (20+)
`summarize`, `create_5_sentence_summary`, `create_micro_summary`, `summarize_meeting`, `summarize_paper`, `summarize_lecture`, `summarize_debate`, `youtube_summary`, `summarize_git_changes`, `summarize_git_diff`

### Analysis (35+)
`analyze_claims`, `analyze_malware`, `analyze_paper`, `analyze_logs`, `analyze_debate`, `analyze_incident`, `analyze_comments`, `analyze_email_headers`, `analyze_personality`, `analyze_presentation`, `analyze_product_feedback`, `analyze_prose`, `analyze_risk`, `analyze_sales_call`, `analyze_threat_report`, `analyze_bill`, `analyze_candidates`

### Creation (50+)
`create_threat_model`, `create_stride_threat_model`, `create_prd`, `create_design_document`, `create_user_story`, `create_mermaid_visualization`, `create_markmap_visualization`, `create_visualization`, `create_sigma_rules`, `create_report_finding`, `create_keynote`, `create_academic_paper`, `create_flash_cards`, `create_quiz`, `create_art_prompt`, `create_command`, `create_pattern`

### Improvement (10+)
`improve_writing`, `improve_academic_writing`, `improve_prompt`, `improve_report_finding`, `review_code`, `review_design`, `refine_design_document`, `humanize`, `enrich_blog_post`, `clean_text`

### Security (15)
`create_threat_model`, `create_stride_threat_model`, `create_threat_scenarios`, `create_security_update`, `create_sigma_rules`, `write_nuclei_template_rule`, `write_semgrep_rule`, `analyze_threat_report`, `analyze_malware`, `analyze_incident`, `analyze_risk`

### Rating/Evaluation (8)
`rate_ai_response`, `rate_content`, `rate_value`, `judge_output`, `label_and_rate`, `check_agreement`
