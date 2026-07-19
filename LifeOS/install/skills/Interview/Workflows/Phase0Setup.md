# Phase0Setup — first-run install bootstrap

**Purpose:** On a fresh LifeOS install (or one where the bootstrap was never finished), walk the six setup targets that make Pulse work end-to-end: DA identity, Principal identity, voice IDs, credentials, first project, work repo. Once Phase 0 is done on a system, this workflow auto-skips and `/interview` routes to **TelosCheckin** instead.

A fresh LifeOS install ships with placeholder identity ("LifeOS" / "User"), generic voice IDs, an empty `.env`, a sample-row PROJECTS table, and a templated `WORK.REPO` that points nowhere. Until Phase 0 runs, Pulse boots with the wrong DA name, voice notifications use the default Rachel voice, the Assistant module's diary writes to a non-existent DA directory, and the work pipeline crashes on the missing repo.

---

## Voice notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Starting Phase 0 setup — six steps to get Pulse running end-to-end."}' \
  > /dev/null 2>&1 &
```

---

## Step 1 — Detect whether Phase 0 is needed

Run the scanner to see Phase 0 completeness:

```bash
bun "${LIFEOS_DIR}/TOOLS/InterviewScan.ts" --json | jq '.targets[] | select(.phase == 0)'
```

If every Phase 0 target reads ≥80% complete, **skip this workflow** and route to TelosCheckin.

---

## Step 2 — The six setup targets, in order

Walk the six setup targets one at a time. Each writes to a specific file. Voice-confirms only on actual writes. The whole phase is skip-able if the principal already knows what they want and types it directly.

| # | Target | Files written | Skip-when |
|---|--------|---------------|-----------|
| 0.1 | **DA Identity** — name, full name, color, role, personality summary | `USER/DIGITAL_ASSISTANT/DA_IDENTITY.md` (always — YAML frontmatter holds structured schema, body holds prose); `USER/DA/{name}/DA_IDENTITY.md` (if multi-DA structure exists or principal opts in) | DA_IDENTITY.md no longer reads "LifeOS" / "LifeOS Assistant" |
| 0.2 | **Principal Identity** — name (with pronunciation), location, timezone, role, focus | `USER/PRINCIPAL/PRINCIPAL_IDENTITY.md` Quick Reference section | PRINCIPAL_IDENTITY.md no longer reads "User" with "(interview)" markers |
| 0.3 | **Voice IDs** — main DA voice + algorithm voice (offer ElevenLabs library link or "use defaults") | `USER/DIGITAL_ASSISTANT/DA_IDENTITY.md` Voice section + `PULSE/PULSE.toml` `[voice]` block | Voice IDs no longer match the generic Rachel/Adam defaults |
| 0.4 | **Credentials** — ANTHROPIC_API_KEY, ELEVENLABS_API_KEY (skippable with explanation), optional GH_TOKEN, STRIPE_KEY | `{{LIFEOS_ROOT}}/.env` (or `~/.config/LIFEOS/.env` symlink target) | `.env` exists with at least ANTHROPIC_API_KEY set |
| 0.5 | **First project** — at least one row so PROJECTS routing works | `USER/PROJECTS.md` table + Routing Aliases | PROJECTS.md has ≥1 non-sample row |
| 0.6 | **Work repo** — GitHub repo for issues OR explicit "skip + disable work pipeline" | `USER/WORK/config.yaml` `WORK.REPO` field; or `[work] enabled = false` in PULSE.toml | USER/WORK/config.yaml WORK.REPO points at an existing repo |

---

## Step 3 — Conversation flow

1. **Run scanner**, present:
   > "Looks like a fresh setup — Phase 0 hasn't run. I'll walk through six setup steps that get Pulse working end-to-end: identity, voice, credentials, projects, work repo. Roughly 5 minutes. Want to start, or skip Phase 0 and pick up at TELOS?"
2. For each target:
   - Read current file content. If still on the bootstrap default, **Fill mode** — walk the prompts.
   - If already populated, **Review mode** — read back the populated values, ask "still right?"
3. Voice IDs (0.3) — when the principal doesn't have specific voices in mind, offer:
   > "Want to pick from the ElevenLabs voice library, or stick with the defaults (Rachel / Adam)? You can change later by editing DA_IDENTITY.md."
4. Credentials (0.4) — never echo keys back to the principal in voice. Confirm only "captured ANTHROPIC_API_KEY" / "captured ELEVENLABS_API_KEY". If the principal pastes a key in chat, immediately write it to `.env` and ask the principal to clear it from scrollback.
5. After Phase 0 completes, **regenerate PRINCIPAL_TELOS.md** (it interpolates the principal name) and **send a Pulse `/reload`** so the running daemon picks up the new identity:
   ```bash
   bun "${LIFEOS_DIR}/TOOLS/GenerateTelosSummary.ts" 2>/dev/null || true
   curl -s -X POST http://localhost:31337/reload > /dev/null 2>&1 &
   ```
6. Voice the transition:
   > "Phase 0 done — Pulse is now configured with your identity. Moving to TELOS check-in, or break here?"

---

## Rules

- **One question at a time.** Never dump all setup prompts at once.
- **Never echo credentials in voice.** Confirm capture only.
- **Skip-able at every step.** The principal can short-circuit any target.
- **Don't ask again about filled fields.** The scanner's completeness score decides what's still gap-worthy.
- **After Phase 0, route to TelosCheckin** — don't re-prompt for TELOS sections; that's the next workflow's job.
