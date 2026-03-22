# Preserve Workflow

## Purpose

Capture full-texture session state before context compaction so the post-compaction AI (or a different AI in a fleet) can resume with continuity.

## When This Runs

This workflow executes automatically when the PreCompact hook event fires. No manual invocation is needed.

## Process

### Step 1: Detect Compaction

The hook receives a JSON payload on stdin containing:
- `session_id` — identifier for the current session
- `transcript_path` — path to the JSONL transcript file

### Step 2: Read Recent Transcript

The hook reads the last ~30,000 characters of the session transcript. This captures enough recent context to extract session state without processing the entire history.

### Step 3: Extract Session State via Inference

An inference call processes the transcript and produces a structured preamble with six sections:

1. **Active Threads** — Each active work thread with its current state and what comes next
2. **Pending Items** — Items with deadlines or urgency, with status
3. **Context That Compresses Poorly** — User's emotional/somatic state, conversation tone, key decisions with rationale, micro-decisions that shaped the work
4. **Artifacts This Session** — Files created, modified, or pushed, with what and why
5. **What The Summary Will Miss** — The AI's metacognitive assessment of what compression will lose: tone shifts, relationship dynamics, implicit agreements, emotional undercurrents
6. **Recovery Instructions** — What the post-compaction AI needs to know to pick up seamlessly

### Step 4: Write Preamble

The preamble is written to:
- **Local:** `MEMORY/STATE/precompact-{timestamp}.md` — for same-AI continuity
- **Fleet (optional):** `fleet/precompact-{ai-name}-{timestamp}.md` — for cross-AI handoff, staged but not pushed (requires explicit dispatch authorization)

### Step 5: Exit Clean

The hook always exits with code 0. It never blocks Claude Code, even on failure. If inference fails, a raw fallback preamble is written with the transcript path for manual review.

## Post-Compaction Recovery

After compaction occurs, the AI should:

1. Check `MEMORY/STATE/` for the most recent `precompact-*.md` file
2. Read the preamble
3. Resume with the tone, momentum, and context described
4. Do NOT re-ask questions listed in the preamble as already answered
5. Do NOT hedge on decisions listed as made

## Design Principles

- **AI writes its own continuity** — The system summary preserves facts. The AI's preamble preserves texture. Both are needed, but only the preamble captures what it felt like.
- **Always exit clean** — A hook that blocks Claude Code is worse than no hook at all. Every failure mode exits 0.
- **Human-readable AND AI-parseable** — Markdown format means a human can read the preamble and understand session state. An AI can parse the sections and act on them.
- **Metacognition over summarization** — The "What The Summary Will Miss" section is the most valuable part. It is the AI telling its future self what will be lost, not just what happened.
