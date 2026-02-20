# Community Attributions

This document tracks community code, patterns, and configurations integrated into the PAI system. All attributions reference original source repositories, authors, and licenses.

---

## jcfischer — Secret Scanning Patterns

- **Source:** https://github.com/jcfischer/pai-secret-scanning
- **Author:** jcfischer
- **License:** MIT
- **Sprint:** S1.1 (Gitleaks Patterns)
- **What was taken:** PAI-specific secret detection patterns for Anthropic, OpenAI, ElevenLabs, Replicate, HuggingFace, Groq API keys, Telegram tokens, personal filesystem paths, and HA tokens. Pre-commit hook pattern and allowlist structure.
- **Files affected:**
  - `/.gitleaks.toml` — 14 custom gitleaks rules adapted from test suite and README documentation

---

## jcfischer — Content Filter Patterns

- **Source:** https://github.com/jcfischer/pai-content-filter
- **Author:** jcfischer
- **License:** MIT
- **Sprint:** S1.2 (Content Filter Patterns)
- **What was taken:** 36 regex patterns for prompt injection (PI), exfiltration (EX), tool invocation abuse (TI), PII detection, and encoding evasion. Pattern structure and severity classification.
- **Files affected:**
  - `/Releases/v3.0/.claude/skills/PAI/PAISECURITYSYSTEM/content-filter-patterns.yaml` — Full pattern library
  - `/Releases/v3.0/.claude/skills/PAI/USER/PAISECURITYSYSTEM/patterns.yaml` — Extended patterns config (gitignored, user-local)

---

## jcfischer — Sandbox Enforcer Pattern

- **Source:** https://github.com/jcfischer/pai-content-filter
- **Author:** jcfischer
- **License:** MIT
- **Sprint:** S7 (Sandbox Enforcer)
- **What was taken:** Concept of sandboxing untrusted external content. Applied as confirm-level SecurityValidator patterns for non-trusted git clone, curl, and wget operations.
- **Files affected:**
  - `/Releases/v3.0/.claude/skills/PAI/PAISECURITYSYSTEM/patterns.example.yaml` — Added sandbox confirm patterns
  - `/Releases/v3.0/.claude/sandbox/.gitkeep` — Sandbox directory

---

## alexandriashai — MCP Guardian Tool Pinning

- **Source:** https://github.com/alexandriashai/mcp-guardian
- **Author:** Alexandria Eden
- **License:** MIT
- **Sprint:** S3 (MCP Guardian Audit) + S5 (MCP Tool Pinning)
- **What was taken:** SHA-256 tool definition hashing pattern (tool_name + description + schema). Multi-server manifest structure. Tool verification and diffing logic.
- **Files affected:**
  - `/Releases/v3.0/.claude/hooks/MCPGuard.hook.ts` — SessionStart hook for tool integrity checking
  - `/Releases/v3.0/.claude/mcp-pins.json` — Initial pin manifest

---

## alexandriashai — MCP Guardian Security Audit

- **Source:** https://github.com/alexandriashai/mcp-guardian
- **Author:** Alexandria Eden
- **License:** MIT
- **Sprint:** S3 (MCP Guardian Audit)
- **What was taken:** Security scanning of MCP server tool definitions. Pattern-based detection of encoded content and suspicious tool descriptions. Used as runtime tool via cloned repo.
- **Files affected:**
  - Audit output saved to `~/github/mccullonas-kb/Marvin/Research/MCP-AUDIT-2026-02-20.md`

---

## zmre — Context Compression Hook

- **Source:** https://github.com/zmre/nix-pai
- **Author:** zmre
- **License:** (see repo)
- **Sprint:** S4.1 (Context Compression Hook)
- **What was taken:** PreCompact hook pattern for voice notification and compaction logging. Transcript stats extraction. Non-blocking hook design with fire-and-forget notification.
- **Files affected:**
  - `/Releases/v3.0/.claude/hooks/ContextCompression.hook.ts` — PreCompact visibility hook

---

## mellanon — Event Capture Hook

- **Source:** https://github.com/mellanon/pai-contrib
- **Author:** mellanon
- **License:** (see repo)
- **Sprint:** S3 (Event Capture)
- **What was taken:** JSONL event capture pattern for all hook events. Date-partitioned file structure (`YYYY-MM/events-YYYY-MM-DD.jsonl`). Agent detection from session mapping and environment variables. Non-blocking append-file design.
- **Files affected:**
  - `/Releases/v3.0/.claude/hooks/EventCapture.hook.ts` — Comprehensive JSONL event logger
