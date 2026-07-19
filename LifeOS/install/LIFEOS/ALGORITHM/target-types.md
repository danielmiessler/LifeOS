## Target Types — Detection, ISC Generation, and Execution

Reference document for optimize mode's target analysis phase. Defines how to detect, understand, evaluate, and run each target type.

### Target Type Detection

Read the target path and content to classify into one of five types:

| Type | Detection Rule |
|------|---------------|
| **skill** | Directory contains `SKILL.md`, or path points to a skill directory under `{{LIFEOS_ROOT}}/skills/` |
| **prompt** | Standalone `.md` or `.txt` file containing prompt instructions (no SKILL.md in parent) |
| **agent** | `.md` file with agent frontmatter (`name`, `description`, tools/capabilities fields) |
| **code** | Source file(s) with `metric_command` provided in ISA — `.ts`, `.js`, `.py`, `.go`, etc. |
| **function** | Source file + specific function name — subset of code, scoped to a single function |

**Ambiguity resolution:**
- If `metric_command` is provided → always use metric mode regardless of file type
- If target is `.md` and has SKILL.md → skill type
- If target is `.md` and has agent frontmatter → agent type
- If target is `.md` and neither → prompt type
- If `eval_mode: eval` is explicitly set → use eval mode even for code files

### Per-Type Configuration

---

#### Skill

**What to read:**
1. `SKILL.md` — purpose, routing description, constraints
2. `Workflows/` directory — all workflow files
3. `Context/` directory — domain knowledge files
4. Any `*.md` in the skill root — additional configuration

**ISC generation template:**
```
- "Does the skill produce output relevant to the input query?"
- "Does the output follow the workflow's specified format?"
- "Does the skill avoid generic filler or boilerplate content?"
- "Does the output contain specific, actionable information?"
- Anti: "The output must NOT contain placeholder text or TODOs."
- Anti: "The output must NOT ignore the input and produce canned responses."
```

**Test input generation:**
- Extract example invocations from SKILL.md description
- Generate 3-5 diverse inputs spanning the skill's stated capabilities
- Include at least one edge case (minimal input, ambiguous input, out-of-scope input)
- Vary complexity: one simple, one moderate, one complex

**How to run in sandbox:**
1. Copy all skill files to `sandbox/` directory
2. For each test input, invoke using `Skill()` tool call with the sandbox copy
3. Capture full output text for judging

**Sandbox strategy:** Copy skill directory to `MEMORY/WORK/{slug}/sandbox/skill_name/`. Mutations modify sandbox copies only.

---

#### Prompt

**What to read:**
1. The prompt file itself — full content
2. Any sibling files referenced by the prompt (imports, includes)
3. File name and directory context for purpose inference

**ISC generation template:**
```
- "Does the output directly address the input topic?"
- "Does the output follow the structural format specified in the prompt?"
- "Does the output contain specific facts or examples, not just generalities?"
- "Is the output appropriately scoped (not too broad, not too narrow)?"
- Anti: "The output must NOT contain meta-commentary about the prompt itself."
- Anti: "The output must NOT pad with filler to appear longer."
```

**Test input generation:**
- Infer the prompt's expected input type from its instructions
- Generate 3-5 representative inputs that exercise different aspects
- Include one "stress test" input (unusual format, edge case topic)

**How to run in sandbox:**
1. Copy prompt file to `sandbox/`
2. For each test input, send `prompt_content + test_input` to LLM via LifeOS Inference Tool
3. Capture output text for judging

**Sandbox strategy:** Copy prompt file(s) to `MEMORY/WORK/{slug}/sandbox/`. Simple file copy, no git needed.

---

#### Agent

**What to read:**
1. The agent definition file — frontmatter + instructions
2. Any referenced tool configurations
3. System prompt sections if present

**ISC generation template:**
```
- "Does the agent complete the assigned task to a usable state?"
- "Does the agent use appropriate tools for each step?"
- "Does the agent's output match the expected format or deliverable?"
- "Does the agent handle errors or unexpected states gracefully?"
- Anti: "The agent must NOT make unnecessary tool calls."
- Anti: "The agent must NOT produce empty or placeholder output."
```

**Test input generation:**
- Extract task descriptions from the agent's purpose/description field
- Generate 3-5 tasks of varying complexity within the agent's stated scope
- Include one task near the agent's capability boundary

**How to run in sandbox:**
1. Copy agent definition to `sandbox/`
2. For each test input, spawn agent with the sandbox definition and test task
3. Capture agent's final output for judging (not intermediate tool calls)

**Sandbox strategy:** Copy agent definition to `MEMORY/WORK/{slug}/sandbox/`. Mutations modify the definition file.

---

#### Code

**What to read:**
1. All files listed in `mutable_files`
2. Related test files if they exist
3. Build/run configuration files

**ISC generation:** Not needed — metric mode uses `metric_command` output as the signal. ISC criteria serve as guard rails only (test suite passes, no type errors, etc.).

**Test input generation:** Not applicable — the `metric_command` is the test.

**How to run:**
1. Use existing git branch approach: `optimize/{metric_name}`
2. Run `metric_command`, extract numeric value
3. Compare to baseline

**Sandbox strategy:** Git branch (existing behavior). No sandbox directory needed.

---

#### Function

**What to read:**
1. The source file containing the function
2. The function signature, arguments, return type
3. Calling code — how the function is used
4. Related tests if they exist

**ISC generation:** Same as code — metric mode with guard rails. If `eval_mode: eval` is explicitly set, generate criteria about the function's output quality.

**Eval-mode ISC template (when explicitly requested):**
```
- "Does the function produce correct output for the given input?"
- "Does the function handle edge-case inputs without errors?"
- "Does the function's output match the expected type/schema?"
- Anti: "The function must NOT silently swallow errors."
```

**Test input generation:** Extract input patterns from existing tests or calling code. Generate representative inputs covering normal, boundary, and error cases.

**How to run:**
- If metric mode: same as code type
- If eval mode: invoke the function with test inputs, capture output, judge

**Sandbox strategy:** Same as code — git branch for metric mode. For eval mode on a single function, can use sandbox directory with a test harness file.

---

### Auto-ISC Generation Process

When the optimizer enters Phase 0 (TARGET ANALYSIS), it generates eval criteria automatically:

1. **Read target comprehensively** — load all files per the "What to read" section above
2. **Extract purpose** — what is this target supposed to do?
3. **Extract constraints** — what rules or format requirements exist?
4. **Extract edge cases** — what unusual inputs or states should it handle?
5. **Draft 3-6 binary criteria** using the per-type ISC generation template as a starting point, customized to the specific target
6. **Draft 1-2 anti-criteria** based on common failure modes for this target type
7. **Apply the 3-question test** (from eval-guide.md) to each criterion — drop any that fail
8. **Present to user for approval** — show generated criteria, allow modification before loop starts

### Test Input Generation Process

1. **Read target** to understand expected input format and domain
2. **Generate 3-5 diverse inputs** spanning the target's capabilities
3. **Ensure variety:**
   - At least one simple/straightforward input
   - At least one complex/multi-faceted input
   - At least one edge case or boundary input
4. **Present to user alongside eval criteria** for approval

### Cross-Type Concerns

**All target types share:**
- The same 8-step loop structure (from optimize-loop.md)
- Guard rail semantics (ISC criteria as invariant assertions)
- Results logging (results.tsv + ISA experiments table)
- Plateau protocol
- Session resume capability

**Key differences:**
- Code/function use git branches; skill/prompt/agent use sandbox directories
- Code/function use metric_command; skill/prompt/agent use LLM-as-judge
- Code/function don't need auto-ISC; others generate it automatically
