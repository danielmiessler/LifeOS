---
last_updated: 2026-08-02T00:00:00Z
last_updated_by: da
convention: lifeos-freshness-v1
version: 1.1.4
status: implemented-local-contract
---

# Cortex Local Contract, Privacy Boundary, and Evidence Gates

This page documents the implemented portable Cortex surface. The CLI implementation is `LIFEOS/TOOLS/Cortex.ts`; the shipped in-process adapter factory is `LIFEOS/TOOLS/CortexAdapter.ts`; and the response schema is `LIFEOS/TOOLS/schemas/lifeos-cortex-v1.schema.json`. The broader memory architecture, curation tiers, and canonical directory inventory remain in [`MemorySystem.md`](./MemorySystem.md).

## Scope: what exists and what does not

Cortex v1 is a **local Bun CLI over the existing file-backed memory system**. It is not an MCP server, HTTP service, daemon, cloud product, or second memory runtime. It does not add cross-device sync, remote mutation, external telemetry, Chroma, CMEM, or a vector index. It starts only when invoked and adds no standing process.

`CortexAdapter.ts` ships an in-process factory for the recognized `claude`, `hermes`, `codex`, and `subagent` identities. Its status/search/timeline/get/export methods are read-only, and every remember/propose call remains read-only unless that individual call passes `{allowWrite:true}`. The source-neutral capture types and ingestion helper make capture integration possible, but they do **not** mean every LifeOS capture surface has been automatically migrated. The implemented privacy boundary currently covers reviewer input and reviewer debug/error artifacts, typed items entering `MemorySystem.add()` and its governed persistence paths, and canonical reads used by Cortex search, timeline, get, export, and rebuild. Other hooks and channel-specific capture writers keep their existing paths until explicitly integrated. No universal adapter daemon exists.

## Invocation and canonical root

```bash
bun LIFEOS/TOOLS/Cortex.ts <command> [arguments] [options]
```

The root resolves in this order: the test/runtime override, `--memory-root`, `CORTEX_MEMORY_ROOT`, then `~/.claude/LIFEOS/MEMORY`. The intentional top-level canonical alias is allowed: Cortex resolves it once with `realpath`, verifies the target is a directory, pins that resolved directory as the trust boundary, and reports the pinned path in status. This is how the default `LIFEOS/MEMORY` symlink into the private user-data repository works; callers do not need to resolve it manually.

Symlinks **beneath** the pinned root remain forbidden. Nested directory/file symlinks, realpath escapes, duplicate IDs, malformed JSONL, impossible timestamps, and non-regular canonical files fail with `integrity_error` and exit 4. A verified live `status` resolves the default alias to the private user-data repository under `~/.config/LIFEOS/USER/MEMORY` and reports the pinned path plus the canonical record count.

## Response envelope and semantic exits

Every `Cortex.ts` command writes exactly one JSON object to stdout:

```json
{"schema":"lifeos-cortex/v1","ok":true,"command":"status","data":{},"error":null}
```

Failures keep the same five top-level fields, set `ok:false`, set `data:null`, and return `{code,message}` in `error`. Additional top-level fields are forbidden. The published schema is `LIFEOS/TOOLS/schemas/lifeos-cortex-v1.schema.json`.

| Exit | Meaning | Typical error codes |
|---:|---|---|
| 0 | Success | — |
| 1 | Unexpected internal failure | `internal_error` |
| 3 | An explicit ID or expansion root was not found | `not_found` |
| 4 | Invalid command, option, payload, filter, bound, or canonical integrity | `invalid_input`, `integrity_error` |
| 5 | Write opt-in missing or existing governance refused the mutation | `write_refused`, `governance_refused` |

Callers must use both process exit and envelope; parseable JSON alone does not imply success.

## Commands

All read commands accept `--memory-root <dir>` (the write commands `remember` and `propose` refuse it; see below), and every command accepts an optional recognized adapter identity: `--adapter claude|hermes|codex|subagent`. Unknown, duplicate, missing-value, or command-inapplicable options are rejected rather than ignored.

### `status`

```bash
bun LIFEOS/TOOLS/Cortex.ts status [--memory-root DIR] [--adapter ADAPTER]
```

Read-only; accepts no positional arguments. Reports canonical root and record count, `mode:"local-read-only"`, and `indexes:[]`. This is contract/corpus status, **not** the evidence-driven operational health report below.

### `search`

```bash
bun LIFEOS/TOOLS/Cortex.ts search "query" \
  [--type TYPE] [--source SOURCE] [--session SESSION] \
  [--from DATE] [--to DATE] [--page N] [--page-size N] \
  [--recency WEIGHT] \
  [--expand ID --max-nodes N --max-tokens N]
```

Search uses local BM25 over lexical `[a-z0-9]+` terms. Type, source, and session are exact-match filters. `--from` and `--to` filter the record's `created` timestamp inclusively. `--recency` must be finite and non-negative and adds updated-time weighting; it does not replace lexical relevance. Search returns cards only—never body content.

Optional graph expansion starts from explicit `--expand` ID, follows canonical `related` IDs breadth-first, and returns bounded cards. It does not build or query a persistent graph database.

### `timeline`

```bash
bun LIFEOS/TOOLS/Cortex.ts timeline --anchor ID_OR_DATE \
  [--before N] [--after N] \
  [--type TYPE] [--source SOURCE] [--session SESSION] \
  [--from DATE] [--to DATE] [--page N] [--page-size N]
```

Read-only. The anchor is an active record ID or valid date. Results are ordered by `created`, then ID. ID anchors include the center record if it remains inside selected filters; date anchors return requested neighbors. `before` and `after` default to 5 each and may be zero.

### `get`

```bash
bun LIFEOS/TOOLS/Cortex.ts get ID [ID ...]
```

Read-only. Returns full sanitized records only for explicitly selected active IDs. If any requested ID is missing, expired, or not yet valid, the whole command returns exit 3. Up to 100 IDs may be requested.

### `export`

```bash
bun LIFEOS/TOOLS/Cortex.ts export ID [ID ...]
```

Read-only despite its name: it serializes selected full records to stdout and creates no file. The payload format is `lifeos-cortex-export/v1`. Selection, validity, privacy sanitization, all-or-nothing not-found behavior, and the 100-ID cap match `get`.

### `rebuild`

```bash
bun LIFEOS/TOOLS/Cortex.ts rebuild --from-canonical
```

Read-only proof of rebuildability. The explicit flag is required. It normalizes canonical records, computes SHA-256 digests for canonical and reconstructed views, and reports `equivalent`, record count, and `indexes:[]` in a `lifeos-cortex-canonical-rebuild/v1` payload. It creates no index. Equal digests prove deterministic reconstruction of the Cortex record view, not byte-for-byte rewriting of source files.

### `remember` and `propose`

```bash
bun LIFEOS/TOOLS/Cortex.ts remember '<typed-item-json>' \
  --adapter claude|hermes|codex|subagent --allow-write

bun LIFEOS/TOOLS/Cortex.ts propose '<typed-item-json>' \
  --adapter claude|hermes|codex|subagent --allow-write
```

These are the only mutating contract commands. Both require a recognized explicit adapter **and** `--allow-write`; naming an adapter does not grant write permission by itself. Command and item discriminator are bound: `remember` accepts only `type:"memory"`, `type:"idea"`, or `type:"knowledge"`, while `propose` accepts only `type:"proposal"`. A mismatch is refused before `MemorySystem.add()` is called. Each command accepts exactly one JSON payload and delegates an authorized item to `MemorySystem.add()`. Existing mutation tiers, target pinning, proposal approval, audit logs, snapshots, source ownership, and shrink guards remain authoritative. A governance refusal is exit 5, not a partial success. A `type:"memory"` entry (`op:"add"`, the default) must be one line that starts with `NAME: `, `ROLE: `, `RELATION: `, `PREFERENCE: ` or `RULE: ` (case-sensitive, space after the colon), with at most 256 characters after the prefix; anything else is refused with exit 5 and nothing is written. Writes use the install's fixed memory paths, so `--memory-root` is refused on `remember` and `propose`. `export` is not a write verb: it only emits selected content on stdout.

## Progressive cards and pagination

Search and timeline cards contain `id`, `type`, `created`, `updated`, `provenance` (`source`, nullable `session`, relative `path`), numeric `score`, and `est_tokens`. Cards do not contain `content` or excerpts. `est_tokens` is sanitized content characters divided by four, rounded up. Listing responses include exact filtered `total`, one-based `page`, `page_size`, and `items`. Defaults are page 1 and 10 items; page size is capped at 100. Stable score ties break by ID.

## Resource bounds and strict input rules

| Surface | Bound |
|---|---:|
| Search query | 2,048 characters and 64 lexical terms |
| Listing page size | 100 |
| Timeline `before` / `after` | 0–100 each |
| Graph expansion | 100 nodes and 50,000 estimated tokens |
| Explicit `get` / `export` IDs | 100 |
| CLI write payload | 262,144 bytes |
| Typed-item free-text field | 65,536 characters |
| Typed metadata string | 1,024 characters |
| Proposal target path | 4,096 characters |
| Hot-memory set | 48 entries, 256 characters each |
| Related links | 64 |

Typed persistence rejects unknown fields, invalid enums or field types, non-finite/out-of-range confidence, control characters, frontmatter/comment injection, ambiguous session metadata, oversized arrays, and required text that becomes empty after privacy stripping. Bounds are refusal limits, not targets. A representative 1,500-record contract search is test-bounded below 1.5 seconds; the separate benchmark uses repeated measurements.

## Canonical source and deterministic rebuild

Markdown and JSONL remain canonical. Derived indexes are disposable and cannot become source of truth. The default CLI retrieval corpus is the existing `KNOWLEDGE/` tree, excluding underscore- and dot-prefixed paths; when a supplied canonical root contains root-level `*_MEMORY.md` files, those are included too. A fixture layout with `MEMORY/KNOWLEDGE/` is also supported for hermetic tests.

Canonical records require unique non-empty IDs and valid `created`/`updated` timestamps. Missing Markdown IDs receive a stable path-derived ID. Provenance uses a path relative to canonical root, so changing an absolute root alias does not change the record digest. Canonical reads are sanitized again, preventing older marked content from bypassing the current boundary.

The shipped `LIFEOS/CORTEX_INDEX_POLICY.json` is the affirmative `lifeos-cortex-index-policy/v1` marker with `policy:"no-index-v1"`. With that marker and no index manifest, BM25 reads canonical files directly, `status` reports `indexes:[]`, and `rebuild` creates nothing. Health reports this explicit state as healthy `no-index-v1` without traversing or hashing the corpus merely to prove non-adoption. If both the manifest and policy marker are missing, index state is ambiguous and health warns `index-evidence-missing`; a malformed marker is critical. If a valid adopted-index manifest exists, it supersedes the no-index marker and its actual bytes and hashes are verified.

## Privacy boundary

Explicit private spans use HTML-like tags: `public <private>never persist or export this</private> public`. Matching is case-insensitive and accepts harmless whitespace and attributes. Nested spans are removed. An orphan closing tag is removed as control markup. An unclosed opening tag fails closed by suppressing the rest of the string.

The boundary is applied before reviewer inference, reviewer debug/error serialization, typed-item routing, canonical lexical ranking, graph expansion, get, export, and rebuild. Typed-item sanitization recursively covers content plus persistence-bearing metadata such as titles, names, rationale, session provenance, entries, and related slugs. Required fields emptied by stripping are rejected.

The source-neutral `CaptureEnvelope` carries `source`, `channel`, `timestamps.captured_at` (plus optional `source_at`), optional `valid_from`/`valid_until`, optional `session_id`, and `content`. `ingestCaptureEnvelope(input, consumer)` is the actual ingestion helper: it calls `createCaptureEnvelope`, strips private content, then passes only the sanitized envelope to the supplied consumer. Fixtures cover Claude, Hermes, Codex, subagents, and a messaging channel. This proves the helper and envelope can represent those sources; only call sites that explicitly invoke the helper use it, and the fixtures do not claim that every existing source or hook has been migrated automatically.

### Native transcript retention limit

**Native harness transcripts may retain `<private>` content outside Cortex's control for the harness's documented 30-day retention period.** Cortex leaves those transcript bytes untouched and strips only the controlled copy before reviewer inference or Cortex persistence/export. The private tag is a Cortex persistence and processing boundary, not a promise to redact the harness transcript, terminal scrollback, upstream provider logs, or content sent before the tag reached Cortex.

## Validity windows

`valid_from` is inclusive and `valid_until` is exclusive. Missing boundaries are open-ended. Invalid boundaries fail closed. Search, timeline, get, and export exclude records not valid at query time by default. Filtering by `--from`/`--to` is separate: those options constrain `created`; they do not override validity.

## Retrieval benchmark and vector evidence gate

The versioned labeled query set is `LIFEOS/MEMORY/BENCHMARKS/cortex-retrieval-v1.jsonl`. The labels file lives in the private MEMORY tree and is authored by the operator against their own corpus before the first benchmark run — it does not ship with the system. Each JSONL row provides a query, expected IDs, optional expected temporal order, and optional known false IDs.

```bash
bun LIFEOS/TOOLS/CortexBenchmark.ts \
  --labels LIFEOS/MEMORY/BENCHMARKS/cortex-retrieval-v1.jsonl \
  --memory-root LIFEOS/MEMORY \
  --output LIFEOS/MEMORY/BENCHMARKS/cortex-benchmark-v1-YYYYMMDD.json
```

The benchmark imports the production `activeCortexRecords`, `rankBM25`, `toCortexCard`, and canonical digest functions rather than carrying a benchmark-only ranker. It runs each labeled query 25 times. Within each query/sample it performs one production ranking and shares that exact ranked result between two disclosure measurements: `bm25-baseline` serializes full top-five records, while `progressive` serializes top-five cards and fetches only the selected first full record. The ranking quality is therefore intentionally identical; the compared behavior is disclosure and injection cost, not two retrieval algorithms.

Per configuration it reports Recall@5, MRR, temporal pair-order accuracy, false recall, injected tokens, p95 latency, latency samples, corpus disk bytes, measured disk growth, descendant process count, peak RSS, and execution-path name. It also reports corpus tokenizations and ranking runs so card-first comparison cannot hide duplicate retrieval work.

The report schema is `lifeos-cortex-benchmark/v1`. Stdout always receives the report; durable output is opt-in through `--output`, must be under the resolved `MEMORY/BENCHMARKS/` directory, must use a versioned `cortex-benchmark-vN-*.json` filename, and is created without overwriting an existing report. The report records corpus/label digests, exact command, timestamp, production ranker/validity paths, disclosure paths, top K, and sample count.

A benchmark run produces a versioned report under `MEMORY/BENCHMARKS/` that both configurations are scored against: recall, MRR, temporal accuracy, false recall, injected-token reduction from progressive disclosure, shared production ranking runs, per-configuration latency samples, disk growth, and process count. Reports are reproducible point-in-time local measurements against the operator's own corpus and labels, not universal latency or quality claims.

`vector_config` is currently `null`: there is no vector benchmark candidate and no vector index. A vector or hybrid index may be adopted only after a labeled report demonstrates retrieval-quality improvement over progressive BM25, and only if it is canonical-rebuildable and stays within separately documented disk and process bounds. Lower token use alone is not evidence for a vector index.

## Truthful operational health

`Cortex.ts status` reports contract availability and corpus shape. Operational health comes from:

```bash
bun LIFEOS/TOOLS/MemoryHealthCheck.ts --json
```

The machine-readable report includes `overall`, measured evidence, effective thresholds, findings, and health-derived exit 0/1/2 for ok/warn/critical. Missing evidence never produces green.

| Evidence | Default | Result when breached |
|---|---:|---|
| Reviewer success freshness | 7 days | WARN when stale |
| In-progress reviewer terminal-row grace | 10 minutes | CRITICAL timeout |
| Retrieval evidence freshness | 24 hours | WARN when missing/stale |
| Pending proposal backlog | greater than 10 | WARN |
| Observability stream growth | a stream's bytes in the last 24 hours exceed its budget (default 10 MiB per day, `USER/CONFIG/observability-budgets.json`) | WARN `observability-over-budget:<stream>` |
| Observability liveness | no write anywhere under `MEMORY/OBSERVABILITY/` for more than 30 days | WARN `observability-stale` |
| Adopted index freshness | greater than 7 days | WARN |

Latest reviewer evidence wins over historical successes. A failed, parse-failed, timed-out, malformed, schema-incomplete, or invalid latest reviewer run is CRITICAL. A newer run directory without a terminal row after the 10-minute grace is a timeout. Malformed JSONL is surfaced rather than skipped to an older success. Invalid or future timestamps cannot prove freshness.

Proposal evidence counts rows whose status is exactly `pending`; malformed proposal JSONL warns. Observability evidence measures each stream's bytes written in the last 24 hours (`LIFEOS/TOOLS/lib/JsonlGrowth.ts`) and the newest write time under `MEMORY/OBSERVABILITY/`. A nightly `observability-prune` workflow archives rows older than 30 days (7 for `bunker-runs`). Retrieval evidence comes from the latest valid `memory-retrievals.jsonl` row.

For a future derived index, the `lifeos-cortex-index/v1` manifest must name canonical SHA-256, index path and SHA-256, and `indexed_at`. Invalid manifests, path violations, missing index bytes, canonical mismatch, or index-byte mismatch are CRITICAL. A verified missing manifest is the healthy `no-index-v1` lexical baseline; it is not an excuse to call unmeasured index state healthy.

A live verification run reports an `overall` verdict with per-check counts (critical/warn/ok) across reviewer freshness, index evidence, retrieval evidence, proposal backlog against its threshold, and observability log age and volume against their caps. Each run's output records current evidence, not a permanent health guarantee.

Threshold overrides are accepted only as finite positive values; invalid values create a critical `cortex-threshold-invalid` finding rather than disabling comparison. Supported operational overrides are `CORTEX_RETRIEVAL_STALE_MS`, `CORTEX_PROPOSAL_BACKLOG`, and `CORTEX_OBSERVABILITY_MAX_AGE_MS` (per-stream growth budgets live in `USER/CONFIG/observability-budgets.json`). Test/automation paths use `CORTEX_HEALTH_ROOT`, `CORTEX_HEALTH_NOW`, `CORTEX_INDEX_MANIFEST`, `CORTEX_HEALTH_NO_WRITE`, and `CORTEX_HEALTH_REPORT_PATH`.

## Explicit non-claims

The implemented upgrade does **not** provide an MCP server or network API, cross-device or cloud synchronization, CMEM/CMEM Cloud/Chroma/SQLite FTS/embeddings/vector index, external Cortex telemetry, a Cortex daemon or always-on sidecar, automatic adoption by every hook/channel/capture surface, redaction of the native harness transcript, or automatic full-record injection from search results.

## Related documentation

- [`MemorySystem.md`](./MemorySystem.md) — memory architecture, curation tiers, writers, and directory inventory
- [`../Observability/ObservabilitySystem.md`](../Observability/ObservabilitySystem.md) — health evidence and local observability pipeline
- `LIFEOS/TOOLS/CaptureEnvelope.ts` — private-span and validity implementation
- `LIFEOS/TOOLS/CortexAdapter.ts` — shipped in-process read/write adapter factory
- `LIFEOS/TOOLS/CortexBenchmark.ts` — benchmark method and report schema
- `LIFEOS/TOOLS/CortexHealth.ts` — evidence collector and fail-closed assessment
