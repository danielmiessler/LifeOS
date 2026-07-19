---
name: Harvest
version: 1.0.1
description: "Mines a single piece of content (URL, YouTube, article, text, file) for anything useful to LifeOS, ranks the findings, then ingests the content into the Knowledge Archive. USE WHEN harvest, harvest this, harvest <URL>, harvest <YouTube>, harvest this video, harvest this article, /harvest, /ha, mine this for the system, anything useful in this for us, what can LifeOS take from this, analyze this for LifeOS-usefulness, should we adopt anything from this. NOT FOR ingestion-only saves with no system-mining (use _HARVEST directly), broad multi-source upgrade or bookmark scans (use Upgrade / pu), or general research synthesis (use Research)."
license: public
---

# Harvest

Take one piece of content and ask a single question: **is there anything in here worth pulling into LifeOS?** Read it, hold every candidate idea against what the system already is and already has, and report what is worth adopting, where it maps, and how we would use it. System adoption is report-only — changing the system is a separate, approved step. Then, always as the final step, ingest the content into the Knowledge Archive via the `_HARVEST` pipeline so the source itself is preserved.

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| `harvest <url>`, `harvest this`, `/harvest`, `/ha`, "mine this for the system", "anything useful in this for us" | `Workflows/Harvest.md` |

## Quick Reference

- **One input at a time.** A URL, a YouTube link, an article, a raw paste, or a file path.
- **Fetch first, then judge.** YouTube → `fabric -y <url>` for the transcript. Article → WebFetch or Research. File → Read. Raw text → use as-is.
- **Judge against the real system, not a guess of it.** Map each candidate to a concrete surface: an Algorithm phase or gate, a hook, a specific skill, the memory system, Pulse, routing/EFFORT_MODEL, ISA, or a doctrine file. If you can't name the surface, it isn't a harvest hit yet.
- **Prior Status is the honesty check.** NEW / PARTIAL (we have something close) / DONE (already implemented) / REJECTED (considered and declined). Cross-check before calling anything NEW.
- **Output is a ranked table plus an honest verdict.** Rank by usefulness × novelty × effort. If nothing is worth adopting, say so plainly — a clean "nothing here" beats manufactured findings.

## Relationship to neighbors

- **`_HARVEST`** ingests a signal into the Knowledge Archive (a note gets written). Harvest calls it as its mandatory final step — mining first, then ingestion. Use `_HARVEST` directly only when {{PRINCIPAL_NAME}} wants a save with no system-mining.
- **`Upgrade` / `pu`** scans many sources (Anthropic releases, YouTube channels, GitHub, bookmarks) for upgrades. Harvest is the focused single-input cousin: you hand it one thing, it mines that one thing.
- **`Research`** answers a question from many sources. Harvest starts from a source you already have and asks what LifeOS should take from it.

## Gotchas

- **YouTube needs `fabric -y` first.** Never parse the YouTube page HTML — it's nav and JS. `fabric -y <url>` returns the transcript; analyze that.
- **System adoption is report-only. Never edit the system from inside a harvest.** The mining output is a proposal set. Changing an Algorithm file, a hook, a skill, or doctrine happens only after {{PRINCIPAL_NAME}} approves a specific item. The ONE write a harvest always performs is the Knowledge Archive ingestion (final step).
- **Name the surface or drop the finding.** "This is a cool idea" is not a harvest hit. "This maps to a new PostToolUse hook that would catch X" is. Vague usefulness gets cut.
- **Prior Status prevents re-surfacing solved work.** Before tagging NEW, check whether LifeOS already does it (grep skills/hooks, recall recent ISAs). Re-pitching something already built is the main failure mode.
- **Be honest about empty content.** A lot of content has nothing to harvest. Say that. Manufacturing three weak findings to look thorough is worse than one true "nothing here."
- **KB ingestion is not optional and not skippable on a thin harvest.** Even a "nothing here" mining verdict still ends with the `_HARVEST` ingestion — the note preserves the source regardless of system usefulness. If ingestion fails (Arbol down, classifier error), report the failure explicitly; never claim the harvest is complete without a written note or a named failure.

## Examples

```
harvest https://youtu.be/VIDEO_ID
# → fabric -y transcript → extract candidates → map to LifeOS surfaces → ranked table + verdict
# → ALWAYS finishes: bun {{LIFEOS_ROOT}}/skills/_HARVEST/Tools/harvest.ts <url> → KNOWLEDGE note written

harvest https://someblog.com/post-on-agent-memory
# → WebFetch body → same analysis

harvest "long pasted idea about a new eval technique..."
# → analyze the text directly
```

## Execution Log

After completing the workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Harvest","workflow":"Harvest","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```
