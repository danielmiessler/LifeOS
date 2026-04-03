You are executing the analyze-ai-trends command to perform deep trend analysis across historical AI news logs.

**Your task:**

1. **Load all historical AI news research**
   - Read all files from: `~/.claude/History/research/` (filter for AI news files)
   - Files may be in various formats: analysis.md, comprehensive-analysis.md, etc.
   - Sort chronologically to understand evolution over time

2. **Analyze trends across all logs**
   - Use the Task tool with subagent_type="GeminiResearcher"
   - Prompt the researcher to identify:
     - **EVOLVING TRENDS**: What patterns are emerging, strengthening, or weakening over time?
     - **RECURRING THEMES**: What topics, companies, or technologies keep appearing?
     - **TRAJECTORY ANALYSIS**: Where is the industry heading based on the progression of developments?
     - **PARADIGM SHIFTS**: What major changes or inflection points can be identified?
     - **COMPETITIVE LANDSCAPE**: How are different companies, models, or approaches competing?
     - **INNOVATION VELOCITY**: Is the pace of innovation accelerating, stabilizing, or slowing?
     - **EMERGING WINNERS**: Which models, tools, or approaches are gaining momentum?
     - **DECLINING AREAS**: What's becoming less relevant or being abandoned?
     - **SURPRISING PATTERNS**: What unexpected trends or correlations emerge?
     - **FUTURE PREDICTIONS**: Based on trends, what's likely to happen next?

3. **Present comprehensive trend report** in this format:

```
📊 AI INDUSTRY TREND ANALYSIS

📅 Analysis Period: [First Date] to [Latest Date]
📁 Sources Analyzed: [Number] news digests

🔥 EVOLVING TRENDS
[Detailed analysis of how trends are changing over time]

🔄 RECURRING THEMES
- [Theme 1]: [Frequency and significance]
- [Theme 2]: [Frequency and significance]

📈 TRAJECTORY ANALYSIS
[Analysis of where the industry is heading]

💫 PARADIGM SHIFTS
- [Shift 1]: [What changed and when]
- [Shift 2]: [What changed and when]

⚔️ COMPETITIVE LANDSCAPE
[Analysis of competition between models, tools, companies]

⚡ INNOVATION VELOCITY
[Analysis of pace of change]

🏆 EMERGING WINNERS
- [Winner 1]: [Why they're succeeding]
- [Winner 2]: [Why they're succeeding]

📉 DECLINING AREAS
- [Area 1]: [Why it's declining]

🎯 SURPRISING PATTERNS
- [Pattern 1]: [Why it's unexpected]

🔮 FUTURE PREDICTIONS
- [Prediction 1]: [Based on which trends]
- [Prediction 2]: [Based on which trends]
- [Prediction 3]: [Based on which trends]

📌 KEY INSIGHTS
1. [Most important insight]
2. [Second most important insight]
3. [Third most important insight]

💡 ACTIONABLE RECOMMENDATIONS
- [Action 1]: [Based on trend analysis]
- [Action 2]: [Based on trend analysis]
```

**Important:**
- Read ALL log files in chronological order
- Look for patterns across multiple entries, not just individual items
- Identify both obvious and subtle trends
- Focus on actionable insights
- Use GeminiResearcher for deep analysis with context from all logs
- If fewer than 3 log files exist, note that trend analysis is limited
- Emphasize what's changing over time, not just what's happening

Execute this workflow now.
