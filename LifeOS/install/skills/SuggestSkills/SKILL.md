---
name: SuggestSkills
description: "Discover WHICH new skills you should create, from your own work history plus your satisfaction/frustration signals. Read-only and proposal-only: it surfaces recurring pain that no existing skill, loop, or workflow covers, then hands you a ranked shortlist to build with CreateSkill. It never creates or edits a skill itself. Frustration is a first-class signal (a topic can look 'covered' while you keep hitting the same wall inside it), so it reads low ratings and recurrence markers, not just session topics. USE WHEN should I create a skill, what skills do I need, suggest skills, skill gap, based on my recent work, am I missing a skill, what should I build. NOT FOR creating/validating/testing/optimizing an individual skill (use CreateSkill) — this only decides WHAT to build, not how."
---

# SuggestSkills — what should I build next?

A read-only analytics pass over your own work. It answers one question: given what you have actually been doing and where you have been frustrated, is there a recurring problem that deserves its own skill and does not have one yet? It proposes; you decide; `CreateSkill` builds. It has no capability to create or edit a skill, by design.

## Why it is separate from CreateSkill

Discovery is read-only; creation mutates. Keeping the two apart is the permission boundary that makes "never auto-create" real rather than a promise in prose: this skill cannot write a skill even if asked.

## The two blind spots it exists to defeat

1. **Frustration is invisible to topic-matching.** A topic can be nominally covered by a build/test skill while you keep hitting the same wall inside it. Low ratings and "regressed again" recurrence are the strongest signal a skill is missing. Weight them above raw topic frequency.
2. **Discipline gaps hide under covered topics.** "App development" maps to a build skill, but the recurring pain may be an unowned discipline (state modeling, error handling, migration safety) that the build skill never addresses. Coverage means the discipline is genuinely handled, not that the topic shares a keyword.

## Workflow

`Workflows/Scan.md` — the full pass. In short:

1. **Gather deterministically.** Run `Tools/CollectSignals.ts` to emit a normalized corpus (recent sessions, low-rating frustrations with sentiment, and the skill/loop/workflow registry for dedup, plus warnings for any missing or malformed store). The LLM does not gather; it only judges what the tool returns, so two runs see the same evidence.
2. **Cluster by pain.** Group the corpus into recurring themes, carrying both how often each recurs AND how much frustration it drew.
3. **Dedup against real coverage.** For each candidate, read the bodies of the skills/loops/workflows that might cover it. Name-match is not coverage; the covering unit must actually address the failure class.
4. **Verify with two independent passes, report the UNION.** Do not require both passes to agree before surfacing a gap (strict intersection suppresses exactly the subtle discipline gaps this exists to find). Report every gap either pass flags, tagged with its agreement level (both = high confidence, one = needs review).
5. **Propose, never create.** Emit a ranked shortlist with evidence (session count, frustration count, the specific recurring failure) to a review location or the session summary. Route accepted proposals to `CreateSkill`. Redact secrets, client names, and personal paths from anything written out.

## Gotchas

- **A clean topic-coverage result with dirty frustration signals is a FALSE negative.** If the ratings show recurring frustration in an area you marked covered, re-open it — the discipline under that topic is the gap. (This is the exact failure this skill was built to fix.)
- **Recurrence is severity-weighted, not a bare count.** Three trivial sessions matter less than one long, painful, repeated migration. A high-severity pain that recurs across a few sessions qualifies even below an arbitrary threshold.
- **Behavior is not a skill.** "Too verbose", "misread scope", "repeated a reminder" are steering/feedback, not skill gaps. Separate them out and route them to memory/preferences, not to CreateSkill.
- **Gathering is deterministic on purpose.** If you find yourself grepping stores by hand in the workflow, use the tool instead — hand-gathering makes runs non-reproducible and the eval meaningless.
- **Paths are discovered, not assumed.** The tool resolves stores via flags/env/root, so it works across installs; do not hardcode a home directory.
