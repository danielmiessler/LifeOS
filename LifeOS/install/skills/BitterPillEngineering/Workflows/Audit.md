# Audit Workflow

Full audit of all force-loaded AI instructions for over-prompting.

## Steps

### 1. Discover what's loaded

Read `settings.json` to find:
- `loadAtStartup.files` — force-loaded every session
- `postCompactRestore.fullFiles` — re-loaded after compaction
- `dynamicContext` sections — relationship, learning, work summaries
- CLAUDE.md — native instruction file

Also check for project-level CLAUDE.md files if working in a specific project.

### 2. Read every instruction file

Read each discovered file completely. Count total lines and rules.

### 3. Evaluate each rule against the Five Questions

For every rule found, apply the five questions from SKILL.md. Cross-reference with Claude Code's built-in system prompt behavior:

**Claude already does by default (common false adds):**
- Read files before editing them
- Ask before destructive operations (rm, reset --hard, force push)
- Make minimal changes, don't add unrequested features
- Don't modify quoted/user text
- Check safer alternatives before destructive git ops
- Use structured choices when asking questions

### 4. Check for cross-file conflicts

Compare rules across all files for:
- Same concept stated differently in two places
- Rules that contradict each other
- Outdated references (skill names, file paths, tool names)

### 5. Evaluate context-to-value ratio

For each force-loaded file, estimate:
- How many tokens it consumes
- How often its content actually affects output quality
- Whether it could be on-demand (via the CLAUDE.md routing table) instead of always-loaded

### 6. Produce the report

Use the output format from SKILL.md. Include estimated token savings.

### 7. Offer trimmed versions

If the user approves, produce cleaned versions of the files with dead weight removed.
