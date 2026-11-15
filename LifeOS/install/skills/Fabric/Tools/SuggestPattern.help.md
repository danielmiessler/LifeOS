# SuggestPattern.ts

Prints the top three Fabric patterns for a plain request, each with the reason it was picked.

```
bun skills/Fabric/Tools/SuggestPattern.ts "<request>" [--json] [--no-user]
```

- Reads `Patterns/catalog.yaml` and merges the install's local catalog at `<configRoot>/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Fabric/catalog.yaml` at read time. A shipped pattern wins a name clash, the same order ExecutePattern reads `system.md` in. `--catalog <file>` and `--user-catalog <file>` override the paths.
- Ranking is trigger match first (every word of a trigger present in the request), then name and purpose keywords, weighted by how rare each word is across the library. One Assay judgment-layer question over the top six then reorders them (caller `pattern-suggest`, shadow, timeout 3000 ms). The engine sees the request's first 500 characters and the six candidates' names and purposes, nothing else.
- Fail-open: `LIFEOS_GLANCE_DISABLED=1`, `LIFEOS_INFERENCE_DISABLED`, or any engine failure leaves the trigger ranking standing. The judgment line on stderr says whether the engine was used or why it was skipped.
- A request that names a pattern (an underscore or hyphen name such as `extract_wisdom`, or any name in backticks) or a ported intent (`CheckAgreement`) returns that one pattern with no model call.
- Output is one line per pick: `N. <name> [runs <Intent>] [local] (<reason>)`. `--json` prints the request, the picks with purpose and score, whether the name was explicit, and the engine status.

| Exit | Meaning |
|------|---------|
| 0 | always, including no catalog, no request, or an engine failure |
