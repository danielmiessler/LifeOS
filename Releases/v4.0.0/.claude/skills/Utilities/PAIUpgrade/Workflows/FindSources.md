# Find Sources

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the FindSources workflow in the PAIUpgrade skill to discover sources"}' \
  > /dev/null 2>&1 &
```

Running the **FindSources** workflow in the **PAIUpgrade** skill to discover sources...

Discover and evaluate new sources to add to upgrade monitoring.

**Trigger:** "find upgrade sources", "find new sources", "discover channels", "expand monitoring"

---

## Overview

This workflow helps identify new sources worth monitoring for PAI-relevant updates:
- YouTube channels creating relevant content
- Blogs and newsletters covering AI development
- GitHub repositories with useful patterns
- Community resources and forums

---

## Process

### Step 1: Define Search Criteria

Clarify what type of sources to find:

| Category | Examples |
|----------|----------|
| **AI Development** | Claude tutorials, AI coding workflows |
| **Agent Patterns** | Multi-agent systems, orchestration |
| **Tool Building** | CLI tools, MCP servers, integrations |
| **Security** | AI security, prompt injection, safety |
| **Productivity** | Developer workflows, automation |

---

### Step 2: Search for YouTube Channels

Use web search to find relevant channels:

```
Search: "Claude Code tutorial YouTube channel"
Search: "AI agent development YouTube"
Search: "MCP server tutorial YouTube"
```

For each discovered channel, evaluate:
- Content relevance to PAI infrastructure
- Update frequency (active vs dormant)
- Content quality and depth
- Unique perspective or expertise

---

### Step 3: Search for Blogs/Newsletters

Look for written content sources:

```
Search: "Claude Code blog posts"
Search: "AI development newsletter"
Search: "LLM engineering blog"
```

Evaluate each source for:
- Relevance to PAI goals
- Technical depth
- Update frequency
- Signal-to-noise ratio

---

### Step 4: Search for GitHub Repositories

Find repositories with useful patterns:

```
Search: site:github.com "Claude Code" examples
Search: site:github.com MCP server typescript
Search: site:github.com AI agent framework
```

Look for:
- Active maintenance
- Good documentation
- Patterns applicable to PAI
- TypeScript preferred (stack alignment)

---

### Step 5: Evaluate and Rank Sources

For each potential source, score:

| Criterion | Weight | Score (1-5) |
|-----------|--------|-------------|
| Relevance to PAI | 30% | |
| Content Quality | 25% | |
| Update Frequency | 20% | |
| Unique Value | 15% | |
| Stack Alignment | 10% | |

**Priority Assignment:**
- Score ≥ 4.0 → 🔥 HIGH - Add immediately
- Score 3.0-3.9 → 📌 MEDIUM - Consider adding
- Score < 3.0 → 💡 LOW - Monitor occasionally

---

### Step 6: Output Recommendations

```markdown
# New Source Recommendations
**Discovery Date:** [date]

## 🔥 HIGH PRIORITY (Add Now)

### [Source Name]
**Type:** YouTube / Blog / GitHub / Other
**URL:** [url]
**Relevance:** [Why this matters for PAI]
**Content Focus:** [What they cover]
**Update Frequency:** [How often they post]

**To Add:**
```json
{
  "name": "[Source Name]",
  "url": "[url]",
  "priority": "HIGH",
  "description": "[What this source covers]"
}
```

---

## 📌 MEDIUM PRIORITY (Consider)

[Similar format]

---

## 💡 LOW PRIORITY (Optional)

[Similar format]

---

## How to Add Sources

### For YouTube Channels:
Edit `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PAIUpgrade/youtube-channels.json`

### For Other Sources:
Currently, non-YouTube sources are monitored via the base `sources.json`.
To request additions to base Anthropic monitoring, note them for next PAI release.
```

---

### Step 7: Offer to Add

If user approves recommendations:

```bash
# Read current user config
cat ~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PAIUpgrade/youtube-channels.json

# Add new channels (merge with existing)
# Update the channels array with new entries
```

---

## Discovery Strategies

### Follow the Experts
- Find who Anthropic engineers follow/reference
- Check who creates content cited in official docs
- Look at conference speaker lists

### Community Mining
- Search Discord/Slack for recommended resources
- Check Reddit threads for learning resources
- Look at "awesome" lists on GitHub

### Algorithm Surfing
- Start from known good channels, explore recommendations
- Check related channels on YouTube
- Follow citation chains in blog posts

---

## Examples

**General discovery:**
```
User: "find new upgrade sources"
→ Search for relevant YouTube channels
→ Search for AI development blogs
→ Evaluate and rank findings
→ Output recommendations with add instructions
```

**Specific category:**
```
User: "find YouTube channels about MCP servers"
→ Focused search on MCP content
→ Evaluate MCP-specific channels
→ Recommend best MCP resources
```

**Add recommended source:**
```
User: "add that channel"
→ Read current user config
→ Add new channel entry
→ Confirm addition
```

---

## Integration

**With Other Workflows:**
- **Upgrade** - New sources feed into monitoring
- **ResearchUpgrade** - Discovered sources can be researched

**With USER Customization:**
- Sources are added to USER directory, not base skill
- Personal monitoring preferences stay private
