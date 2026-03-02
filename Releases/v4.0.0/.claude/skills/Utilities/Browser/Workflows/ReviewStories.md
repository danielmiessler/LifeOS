# ReviewStories Workflow — Parallel User Story Validation

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ReviewStories workflow in the Browser skill to validate user stories"}' \
  > /dev/null 2>&1 &
```

Running **ReviewStories** in **Browser**...

---

Fan out YAML user stories to parallel UIReviewer agents and aggregate results.

## When to Use

- Validating that a web app meets user story requirements
- Running regression checks across multiple pages/flows
- Batch UI validation after deployment

## Trigger Words

"review stories", "run stories", "ui review", "validate stories", or referencing a `.yaml` story file

## Input

Either:
- **Specific file:** `Stories/HackerNews.yaml` (or full path)
- **All stories:** "all" — globs `Stories/*.yaml`

## Steps

### 1. Discover Stories

```
# Specific file
Read the specified .yaml file from skills/Utilities/Browser/Stories/

# All stories
Glob: skills/Utilities/Browser/Stories/*.yaml
```

### 2. Parse YAML

For each `.yaml` file:
- Extract `name`, `url`, and `stories[]` array
- Each story in the array becomes one UIReviewer dispatch

### 3. Fan Out to Parallel UIReviewers

For each individual story, spawn one UIReviewer agent via the Task tool. **All Task calls go in a single message** for true parallelism.

**Maximum 8 UIReviewers per invocation.** If more than 8 stories, batch into groups of 8.

**Prompt template per UIReviewer:**

```
You are validating a user story. Execute it and report results.

Story file: {file_name}
Base URL: {url}

story:
  name: "{story.name}"
  url: "{url}"
  steps:
{formatted_steps}
  assertions:
{formatted_assertions}

Execute this story. Follow your 5-phase workflow. Return the JSON report AND the RESULT: sentinel line.
```

### 4. Collect Results

After all UIReviewers complete, parse each agent's output for the `RESULT:` sentinel line:

```
RESULT: PASS | Steps: N/M | Assertions: X/Y | Duration: Zs
RESULT: FAIL | Steps: N/M | Assertions: X/Y | Failed: "reason" | Duration: Zs
```

### 5. Aggregate Report

Produce a summary table:

```
## Story Review Results

| Story | File | Result | Steps | Assertions | Duration |
|-------|------|--------|-------|------------|----------|
| Front page loads | HackerNews.yaml | PASS | 1/1 | 2/2 | 8s |
| First story clickable | HackerNews.yaml | PASS | 2/2 | 1/1 | 12s |
| Login flow | ExampleApp.yaml | FAIL | 3/4 | 1/2 | 15s |

**Summary: 2/3 PASS | 1/3 FAIL**
```

Include screenshot paths from each UIReviewer's report for failed stories.

## Design Decisions

- **Task parallelism, not TeamCreate.** UIReviewers are stateless parallel workers. Multiple `Task(subagent_type="UIReviewer")` calls in one message achieve true parallelism without swarm coordination overhead.
- **Stories as YAML text in prompt.** Avoids the agent needing to read the story file — reduces agent tool calls and speeds execution.
- **RESULT sentinel parsing.** Simple string parsing on the last line — no fragile JSON extraction from freeform agent output.
- **8-agent limit.** Matches PAI's parallel agent guidance and avoids resource contention.

## Error Handling

- If a YAML file fails to parse → report the parse error, skip that file
- If a UIReviewer times out → mark that story as TIMEOUT in the summary
- If no RESULT sentinel found → mark as UNKNOWN and include raw agent output for debugging
