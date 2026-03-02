# Fabric Workflow

Intelligent pattern selection for Fabric CLI. Automatically selects the right pattern from 242+ specialized prompts based on your intent - threat modeling, analysis, summarization, content creation, extraction, and more. USE WHEN processing content, analyzing data, creating summaries, threat modeling, or transforming text.

## 🎯 Load Full PAI Context

**Before starting any task with this skill, load complete PAI context:**

`read ~/.claude/PAI/SKILL.md`

This provides access to:
- Complete contact list (Angela, Bunny, Saša, Greg, team members)
- Stack preferences (TypeScript>Python, bun>npm, uv>pip)
- Security rules and repository safety protocols
- Response format requirements (structured emoji format)
- Voice IDs for agent routing (ElevenLabs)
- Personal preferences and operating instructions

## Primary Skill Reference

**The Fabric skill has moved to a dedicated skill directory.**

**Primary Skill:** `~/.claude/skills/Fabric/SKILL.md`
**Patterns Location:** `~/.claude/skills/Fabric/Patterns/`

For pattern updates, use: "update fabric patterns" → invokes Fabric skill's UpdatePatterns workflow.

## When to Activate This Skill

**Primary Use Cases:**
- "Create a threat model for..."
- "Summarize this article/video/paper..."
- "Extract wisdom/insights from..."
- "Analyze this [code/malware/claims/debate]..."
- "Improve my writing/code/prompt..."
- "Create a [visualization/summary/report]..."
- "Rate/review/judge this content..."

**The Goal:** Select the RIGHT pattern from 242+ available patterns based on what you're trying to accomplish.

## 🎯 Pattern Selection Strategy

When a user requests Fabric processing, follow this decision tree:

### 1. Identify Intent Category

**Threat Modeling & Security:**
- Threat model → `create_threat_model` or `create_stride_threat_model`
- Threat scenarios → `create_threat_scenarios`
- Security update → `create_security_update`
- Security rules → `create_sigma_rules`, `write_nuclei_template_rule`, `write_semgrep_rule`
- Threat analysis → `analyze_threat_report`, `analyze_threat_report_trends`

**Summarization:**
- General summary → `summarize`
- 5-sentence summary → `create_5_sentence_summary`
- Micro summary → `create_micro_summary` or `summarize_micro`
- Meeting → `summarize_meeting`
- Paper/research → `summarize_paper`
- Video/YouTube → `youtube_summary`
- Newsletter → `summarize_newsletter`
- Code changes → `summarize_git_changes` or `summarize_git_diff`

**Wisdom Extraction:**
- General wisdom → `extract_wisdom`
- Article wisdom → `extract_article_wisdom`
- Book ideas → `extract_book_ideas`
- Insights → `extract_insights` or `extract_insights_dm`
- Main idea → `extract_main_idea`
- Recommendations → `extract_recommendations`
- Controversial ideas → `extract_controversial_ideas`

**Analysis:**
- Malware → `analyze_malware`
- Code → `analyze_code` or `review_code`
- Claims → `analyze_claims`
- Debate → `analyze_debate`
- Logs → `analyze_logs`
- Paper → `analyze_paper`
- Threat report → `analyze_threat_report`
- Product feedback → `analyze_product_feedback`
- Sales call → `analyze_sales_call`

**Content Creation:**
- PRD → `create_prd`
- Design document → `create_design_document`
- User story → `create_user_story`
- Visualization → `create_visualization`, `create_mermaid_visualization`, `create_markmap_visualization`
- Essay → `write_essay`
- Report finding → `create_report_finding`
- Newsletter entry → `create_newsletter_entry`

**Improvement:**
- Writing → `improve_writing`
- Academic writing → `improve_academic_writing`
- Prompt → `improve_prompt`
- Report finding → `improve_report_finding`
- Code → `review_code`

**Rating/Evaluation:**
- AI response → `rate_ai_response`
- Content quality → `rate_content`
- Value assessment → `rate_value`
- General judgment → `judge_output`

### 2. Execute Pattern

```bash
# Basic format
fabric [input] -p [selected_pattern]

# From URL
fabric -u "URL" -p [pattern]

# From YouTube
fabric -y "YOUTUBE_URL" -p [pattern]

# From file
cat file.txt | fabric -p [pattern]

# Direct text
fabric "your text here" -p [pattern]
```

## 📚 Pattern Categories (242 Total)

### Threat Modeling & Security (15 patterns)
- `create_threat_model` - General threat modeling
- `create_stride_threat_model` - STRIDE methodology
- `create_threat_scenarios` - Threat scenario generation
- `create_security_update` - Security update documentation
- `create_sigma_rules` - SIGMA detection rules
- `write_nuclei_template_rule` - Nuclei scanner templates
- `write_semgrep_rule` - Semgrep static analysis rules
- `analyze_threat_report` - Threat report analysis
- `analyze_threat_report_cmds` - Extract commands from threat reports
- `analyze_threat_report_trends` - Identify threat trends
- `t_threat_model_plans` - Threat model for plans
- `ask_secure_by_design_questions` - Secure by design questions
- `create_network_threat_landscape` - Network threat landscape
- `analyze_incident` - Incident analysis
- `analyze_risk` - Risk analysis

### Summarization (20 patterns)
- `summarize` - General summarization
- `create_5_sentence_summary` - Ultra-concise 5-line summary
- `create_micro_summary` - Micro summary
- `create_summary` - Detailed summary
- `summarize_micro` - Micro summarization
- `summarize_meeting` - Meeting notes summary
- `summarize_paper` - Academic paper summary
- `summarize_lecture` - Lecture summary
- `summarize_newsletter` - Newsletter summary
- `summarize_debate` - Debate summary
- `summarize_legislation` - Legislation summary
- `summarize_rpg_session` - RPG session summary
- `summarize_board_meeting` - Board meeting summary
- `summarize_git_changes` - Git changes summary
- `summarize_git_diff` - Git diff summary
- `summarize_pull-requests` - PR summary
- `summarize_prompt` - Prompt summary
- `youtube_summary` - YouTube video summary
- `create_business_summary` - {YOUR_BUSINESS_NAME} summary
- `create_cyber_summary` - Cybersecurity summary

### Extraction (30+ patterns)
- `extract_wisdom` - General wisdom extraction
- `extract_article_wisdom` - Article-specific wisdom
- `extract_book_ideas` - Book ideas
- `extract_insights` - General insights
- `extract_insights_dm` - Deep mode insights
- `extract_main_idea` - Core message
- `extract_recommendations` - Recommendations
- `extract_ideas` - Ideas from content
- `extract_questions` - Questions raised
- `extract_predictions` - Predictions made
- `extract_controversial_ideas` - Controversial points
- `extract_business_ideas` - Business opportunities
- `extract_skills` - Skills mentioned
- `extract_patterns` - Patterns identified
- `extract_sponsors` - Sponsor mentions
- `extract_references` - References cited
- `extract_instructions` - Instructions from content
- `extract_jokes` - Humor extraction
- `extract_primary_problem` - Main problem
- `extract_primary_solution` - Main solution
- `extract_product_features` - Product features
- `extract_core_message` - Core message
- `extract_algorithm_update_recommendations` - Algorithm recommendations
- `extract_extraordinary_claims` - Extraordinary claims
- `extract_most_redeeming_thing` - Most valuable aspect

### Analysis (35+ patterns)
- `analyze_claims` - Claim analysis
- `analyze_malware` - Malware analysis
- `analyze_code` - Code analysis
- `analyze_paper` - Paper analysis
- `analyze_logs` - Log analysis
- `analyze_debate` - Debate analysis
- `analyze_incident` - Incident analysis
- `analyze_comments` - Comment analysis
- `analyze_answers` - Answer analysis
- `analyze_email_headers` - Email header analysis
- `analyze_military_strategy` - Military strategy
- `analyze_mistakes` - Mistake analysis
- `analyze_personality` - Personality analysis
- `analyze_presentation` - Presentation analysis
- `analyze_product_feedback` - Product feedback
- `analyze_proposition` - Proposition analysis
- `analyze_prose` - Prose analysis
- `analyze_risk` - Risk analysis
- `analyze_sales_call` - Sales call analysis
- `analyze_spiritual_text` - Spiritual text analysis
- `analyze_tech_impact` - Tech impact analysis
- `analyze_threat_report` - Threat report analysis
- `analyze_bill` - Legislation analysis
- `analyze_candidates` - Candidate analysis
- `analyze_cfp_submission` - CFP submission analysis
- `analyze_terraform_plan` - Terraform plan analysis
- `analyze_interviewer_techniques` - Interviewer technique analysis

### Creation (50+ patterns)
- `create_prd` - Product Requirements Document
- `create_design_document` - Design documentation
- `create_user_story` - User stories
- `create_coding_project` - Coding project
- `create_coding_feature` - Code features
- `create_mermaid_visualization` - Mermaid diagrams
- `create_markmap_visualization` - Markmap mindmaps
- `create_visualization` - General visualizations
- `create_threat_model` - Threat models
- `create_stride_threat_model` - STRIDE threat models
- `create_threat_scenarios` - Threat scenarios
- `create_report_finding` - Report findings
- `create_newsletter_entry` - Newsletter content
- `create_keynote` - Keynote presentations
- `create_academic_paper` - Academic papers
- `create_flash_cards` - Study flashcards
- `create_quiz` - Quizzes
- `create_graph_from_input` - Graphs
- `create_tags` - Content tags
- `create_art_prompt` - Art generation prompts
- `create_command` - CLI commands
- `create_pattern` - Fabric patterns
- `create_logo` - Logo designs
- `create_podcast_image` - Podcast imagery
- `create_sigma_rules` - SIGMA rules
- `create_video_chapters` - Video chapters
- `create_upgrade_pack` - Upgrade documentation

### Improvement (10 patterns)
- `improve_writing` - General writing improvement
- `improve_academic_writing` - Academic writing
- `improve_prompt` - Prompt engineering
- `improve_report_finding` - Report findings
- `review_code` - Code review
- `review_design` - Design review
- `refine_design_document` - Design refinement
- `humanize` - Humanize AI text
- `enrich_blog_post` - Blog enhancement
- `clean_text` - Text cleanup

### Rating/Judgment (8 patterns)
- `rate_ai_response` - Rate AI outputs
- `rate_ai_result` - Rate AI results
- `rate_content` - Rate content quality
- `rate_value` - Rate value proposition
- `judge_output` - General judgment
- `label_and_rate` - Label and rate
- `check_agreement` - Agreement checking
- `arbiter-evaluate-quality` - Quality evaluation

## Updating Patterns

Patterns are managed by the Fabric skill at `~/.claude/skills/Fabric/`.

**To update patterns:**

Say: "update fabric patterns" → invokes Fabric skill's UpdatePatterns workflow

**To see all available patterns:**

```bash
ls ~/.claude/skills/Fabric/Patterns/
```

## 💡 Usage Examples

**Threat Modeling:**
```bash
# User: "Create a threat model for our new API"
fabric "API that handles user authentication and payment processing" -p create_threat_model
```

**Summarization:**
```bash
# User: "Summarize this blog post"
fabric -u "https://example.com/blog-post" -p summarize

# User: "Give me a 5-sentence summary"
fabric -u "https://example.com/article" -p create_5_sentence_summary
```

**Wisdom Extraction:**
```bash
# User: "Extract wisdom from this video"
fabric -y "https://youtube.com/watch?v=..." -p extract_wisdom

# User: "What are the main ideas?"
fabric -u "URL" -p extract_main_idea
```

**Analysis:**
```bash
# User: "Analyze this code for issues"
fabric "$(cat code.py)" -p analyze_code

# User: "Analyze these security claims"
fabric "security claims text" -p analyze_claims
```

## 🎯 Pattern Selection Decision Matrix

| User Request Contains | Likely Intent | Recommended Patterns |
|----------------------|---------------|----------------------|
| "threat model" | Security modeling | `create_threat_model`, `create_stride_threat_model` |
| "summarize", "summary" | Summarization | `summarize`, `create_5_sentence_summary` |
| "extract wisdom", "insights" | Wisdom extraction | `extract_wisdom`, `extract_insights` |
| "analyze [X]" | Analysis | `analyze_[X]` (match X to pattern) |
| "improve", "enhance" | Improvement | `improve_writing`, `improve_prompt` |
| "create [visualization]" | Visualization | `create_mermaid_visualization`, `create_markmap_visualization` |
| "rate", "judge", "evaluate" | Rating | `rate_content`, `judge_output` |
| "main idea", "core message" | Core extraction | `extract_main_idea`, `extract_core_message` |

## 🚀 Advanced Usage

**Pipe content through Fabric:**
```bash
cat article.txt | fabric -p extract_wisdom
pbpaste | fabric -p summarize
curl -s "https://..." | fabric -p analyze_claims
```

**Process YouTube videos:**
```bash
# Fabric handles download + transcription + processing
fabric -y "https://youtube.com/watch?v=..." -p youtube_summary
```

**Chain patterns (manual):**
```bash
# Extract then summarize
fabric -u "URL" -p extract_wisdom > wisdom.txt
cat wisdom.txt | fabric -p create_5_sentence_summary
```

## Supplementary Resources

**Full Pattern List:** `ls ~/.claude/skills/Fabric/Patterns/`
**Fabric Skill:** `~/.claude/skills/Fabric/SKILL.md`
**Fabric Documentation:** https://github.com/danielmiessler/fabric
**Pattern Templates:** See `~/.claude/skills/Fabric/Patterns/official_pattern_template/`

## 🔑 Key Insight

**The skill's value is in selecting the RIGHT pattern for the task.**

When user says "Create a threat model using Fabric", your job is to:
1. Recognize "threat model" intent
2. Know available options: `create_threat_model`, `create_stride_threat_model`, `create_threat_scenarios`
3. Select the best match (usually `create_threat_model` unless STRIDE specified)
4. Execute: `fabric "[content]" -p create_threat_model`

**Not:** "Here are the patterns, pick one"
**Instead:** "I'll use `create_threat_model` for this" → execute immediately
