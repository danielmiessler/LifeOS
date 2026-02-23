# PAI Actions

Atomic, composable units of work with typed inputs and outputs.

## Philosophy

Actions follow Unix philosophy:
- **Do one thing well** - Each action has a single responsibility
- **Communicate via JSON** - stdin/stdout JSON streams
- **Compose freely** - `pai action X | pai action Y | pai action Z`
- **Pipelines ARE actions** - Same interface, composable at any level

## Directory Structure

```
ACTIONS/
├── lib/
│   ├── types.ts      # Core ActionSpec interface, Zod schemas
│   └── runner.ts     # Local execution engine
├── pai.ts            # CLI entry point
├── blog/
│   ├── write-draft.action.ts   # Generate blog post draft
│   ├── proofread.action.ts     # Fix spelling/grammar only
│   ├── validate.action.ts      # Check structure, links, length
│   └── enhance.action.ts       # Add SEO and social metadata
├── extract/
│   ├── knowledge.action.ts     # Extract insights from content
│   └── youtube.action.ts       # Extract YouTube transcripts
├── format/
│   └── markdown.action.ts      # Format to markdown
├── parse/
│   └── topic.action.ts         # Parse topic to structure
├── search/
│   └── (coming soon)
├── social/
│   ├── adapt.action.ts         # Adapt content per platform
│   └── post.action.ts          # Post to social platforms
└── transform/
    └── summarize.action.ts     # Summarize text
```

## Usage

```bash
# Run an action with --input
bun pai.ts action parse/topic --input '{"text":"quantum computing"}'

# Pipe JSON through actions
echo '{"text":"AI safety"}' | bun pai.ts action parse/topic

# Chain actions together
bun pai.ts action parse/topic --input '{"text":"ML"}' | bun pai.ts action format/markdown --template list

# List available actions
bun pai.ts actions

# Show action details
bun pai.ts info parse/topic
```

## Creating an Action

```typescript
// myaction.action.ts
import { defineAction, z } from "../lib/types";

export default defineAction({
  name: "category/myaction",
  version: "1.0.0",
  description: "What this action does",

  inputSchema: z.object({
    text: z.string(),
  }),

  outputSchema: z.object({
    result: z.string(),
  }),

  async execute(input, ctx) {
    // Do work
    return { result: "done" };
  },
});
```

## Action Categories

| Category | Purpose | Actions |
|----------|---------|---------|
| `blog/` | Blog post lifecycle | write-draft, proofread, validate, enhance |
| `extract/` | Extract data from sources | knowledge, youtube |
| `format/` | Convert to output formats | markdown |
| `parse/` | Structure unstructured input | topic |
| `search/` | Query external sources | (coming soon) |
| `social/` | Social media operations | adapt, post |
| `transform/` | Modify/process content | summarize |

## Available Actions (11)

```bash
# Blog actions
pai action blog/write-draft --input '{"topic":"AI Ethics","style":"narrative"}'
pai action blog/proofread --input '{"content":"..."}'
pai action blog/validate --input '{"content":"..."}'
pai action blog/enhance --input '{"content":"..."}'

# Extract actions
pai action extract/knowledge --input '{"content":"...", "domain":"security"}'
pai action extract/youtube --input '{"url":"https://youtube.com/watch?v=..."}'

# Social actions
pai action social/adapt --input '{"content":"...", "platforms":["x","linkedin"]}'
pai action social/post --input '{"content":"...", "dryRun":true}'

# Core actions
pai action parse/topic --input '{"text":"quantum computing"}'
pai action transform/summarize --input '{"text":"...", "targetWords":100}'
pai action format/markdown --input '{"content":{...}, "template":"report"}'
```

## Available Pipelines (4)

```bash
# Publish a blog post end-to-end
pai pipeline blog-publish --topic "AI in 2025" --style narrative

# Broadcast to social media
pai pipeline social-broadcast --content "Big announcement..." --dryRun true

# Extract knowledge from YouTube
pai pipeline youtube-knowledge --url "https://youtube.com/watch?v=..."

# Research a topic
pai pipeline research --topic "quantum computing"
```

## Cloud Deployment

Actions can be deployed as Cloudflare Workers:

```bash
# Deploy single action
pai deploy action parse/topic

# Deploy all actions
pai deploy all

# Run in cloud mode
pai action parse/topic --mode cloud --input '{"text":"quantum"}'
```

## See Also

- `../PIPELINES/` - Pipeline definitions that chain actions
- `../SKILL.md` - Core PAI documentation
