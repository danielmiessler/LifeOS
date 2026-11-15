# PatternCatalog.ts

Builds and checks `Patterns/catalog.yaml`, the generated metadata sidecar for the pattern library: one entry per pattern directory that holds a `system.md`. Metadata never goes inside a `system.md`, because UpdatePatterns copies upstream over `Patterns/` and the model applies `system.md` verbatim as the prompt.

```
bun skills/Fabric/Tools/PatternCatalog.ts build [--no-model] [--no-user]
bun skills/Fabric/Tools/PatternCatalog.ts check [--complete] [--json]
bun skills/Fabric/Tools/PatternCatalog.ts triggers [--write]
```

- Each entry holds `name`, `purpose` (one sentence), `category`, `triggers` (three or more), `input`, `output`, `ported_intent` (from `Intents/ExecutePattern.md` § Ported patterns, else `null`), `derived` (`explanation`, `model` or `identity`) and `system_md_hash` (sha256 of the `system.md`).
- Purpose comes from the pattern's line in `Patterns/pattern_explanations.md`. Triggers come from the spaced name, the phrases the retired ExecutePattern selection table routed on, the ported intent's quoted trigger phrases in `SKILL.md`, and short phrases from the purpose and IDENTITY section. Output shape comes from the OUTPUT and STEPS sections.
- Only a pattern with no explanation line gets one model pass (`LIFEOS/TOOLS/Inference.ts`, low level, anthropic lane, no vendor fallback). Answers are cached by `system.md` hash in `Patterns/catalog.cache.json`, so a rebuild of an unchanged library makes zero model calls. With `--no-model`, `LIFEOS_INFERENCE_DISABLED`, or a failed call, the IDENTITY section's first sentence stands in (`derived: identity`) and nothing is cached.
- `build` also catalogs the install's own patterns under `<configRoot>/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Fabric/Patterns/` into `catalog.yaml` beside them; a local name a shipped pattern already uses is skipped, because the shipped one is what runs. `--no-user` skips this. Build prints entry counts with added, changed and removed names and the model-call count.
- `check` fails when a pattern directory has no entry or an entry's hash differs from its `system.md`. `--complete` also fails on an empty field, fewer than three triggers, an entry with no directory, or a count mismatch. `CheckPatterns.ts` runs the same check.
- `triggers` prints a USE WHEN list regenerated from the catalog (core terms, the retired selection table's phrases, then one trigger per ported intent in ExecutePattern's ported-block order), sized so the whole description stays within the skill validator's 1024-character cap. `--write` puts it into `SKILL.md` in place, keeping the description's head and NOT FOR clause.
- Paths for tests and probes: `--patterns <dir>`, `--out <file>`, `--cache <file>`, `--catalog <file>`, `--execute <md>`, `--skill <md>`, `--user-dir <dir>`.

| Exit | Meaning |
|------|---------|
| 0 | `build` and `triggers` always; `check` found the catalog current |
| 1 | `check` found a missing entry, a changed hash, or (with `--complete`) an incomplete entry |
