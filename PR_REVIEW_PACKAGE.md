# Upstream Contribution Review Package — danielmiessler/LifeOS

**Base:** `danielmiessler/LifeOS` @ `main` = `76ba604` (2026-07-09)
**Status:** All work is LOCAL in the scratch clone. Nothing pushed, no fork, no `gh pr create`. Four local branches + one issue-comment draft, for the principal's review.
**Source payload root:** `LifeOS/install/`

| Item | Deliverable | Branch |
|------|-------------|--------|
| ① | Evidence comment for issue **#1143** (still reproduces) | *none — comment only* |
| ② | De-hardcode the author's DA name ("kai") | `fix/da-name-hardcoding` |
| ③ | Explicit config switch for Telegram voice summaries | `fix/telegram-voice-summary-switch` |
| ④ | PULSE `[da]` defers to the user config | `fix/pulse-da-user-config` |

Each branch is a single clean commit off `main`. All touched `.ts` files pass a Bun transpiler syntax check; details in **Sanity checks** at the end.

---

## Item ① — Evidence comment for issue #1143 (comment only)

**Claim under test:** issue #1143 (`{{DA_NAME}}`/`{{PRINCIPAL_NAME}}` tokens in `telegram.ts`) was closed as "fixed" on 2026-07-07, but the tokens still ship on HEAD `76ba604`.

**Verified against the clone (all facts below re-checked on `76ba604`):**

- The raw, unsubstituted tokens are still present in `LifeOS/install/LIFEOS/PULSE/modules/telegram.ts` — **31 occurrences across 24 lines**: 152, 189, 190, 303, 306, 314, 445, 456, 461, 462, 501, 527, 595, 803, 804, 860, 870, 877, 878, 880, 884, 889, 890, 1031.
- Representative sites: `:152` chat-log entry, `:303–:314` LifeOS context-block headers, `:456–:462` voice-summary prompt, `:860`+ Telegram SDK system prompt.
- The file's most recent commit is `a5bcf65` (2026-07-04 13:46 -0700) — it **predates** the 2026-07-07 close.
- No commit or linked PR references #1143 in local history (`git log --all --grep=1143` → empty).
- `hooks/lib/identity.ts` already exports the fix helpers: `getIdentity()` (:177), `getPrincipal()` (:217), `getDAName()` (:249), `getPrincipalName()` (:268) — **none are used in `telegram.ts`**.
- `telegram.ts` already `import { loadLifeosConfig } from "../../TOOLS/LifeosConfig"` (:19) but only reads the voice ID from it (:99); it never resolves the DA/principal name, so the tokens go out verbatim.

### Comment text to post on issue #1143

> Reproduces on `main` @ `76ba604` (2026-07-09).
>
> The `{{DA_NAME}}` / `{{PRINCIPAL_NAME}}` template tokens are still present as literal, unsubstituted strings in `LifeOS/install/LIFEOS/PULSE/modules/telegram.ts` — 31 occurrences across 24 lines (152, 189, 190, 303, 306, 314, 445, 456, 461, 462, 501, 527, 595, 803, 804, 860, 870, 877, 878, 880, 884, 889, 890, 1031). Representative sites:
>
> - `:152` — chat-log entry: `**{{PRINCIPAL_NAME}}:** ${userMsg} … **{{DA_NAME}}:** ${botMsg}`
> - `:303`–`:314` — LifeOS context-block headers: `### About you ({{DA_NAME}})`, `### About {{PRINCIPAL_NAME}}`, `### {{PRINCIPAL_NAME}}'s TELOS`
> - `:456`–`:462` — the voice-summary prompt: `You are {{DA_NAME}}, {{PRINCIPAL_NAME}}'s AI assistant.` …
> - `:860`+ — the Telegram SDK system prompt: `You are {{DA_NAME}}, responding to {{PRINCIPAL_NAME}} via Telegram …`
>
> These strings are emitted verbatim into the chat log, the model's per-turn context block, and the ElevenLabs voice prompt — so the model literally reads "{{DA_NAME}}" instead of the configured DA name.
>
> On the timeline: this was closed as fixed on 2026-07-07, but the file's most recent commit is `a5bcf65` (2026-07-04) — it predates the close, and I can't find a fix commit or a PR linked to #1143 in history (`git log --all --grep=1143` returns nothing).
>
> There's already a resolution path in-tree. `hooks/lib/identity.ts` exports `getDAName()`, `getPrincipalName()`, `getPrincipal()`, and `getIdentity()`, and `telegram.ts` already imports `loadLifeosConfig` (it uses it for the voice ID at :99) — so the DA and principal names are one call away. Happy to open a small PR that resolves these tokens once at module import (via the config the file already loads, or the identity helpers), falling back to the current defaults, if that's useful.

### If the maintainer wants the fix (offered, not built here)

A minimal PR would resolve `{{DA_NAME}}` → `loadLifeosConfig().da.name` (or `getDAName()`) and `{{PRINCIPAL_NAME}}` → `loadLifeosConfig().principal.name` (or `getPrincipalName()`) once at import, with the existing bootstrap defaults as fallback. Kept out of the branches here because Item ① was scoped as comment-only.

---

## Item ② — `fix/da-name-hardcoding`

**PR title:** `fix: de-hardcode the author's DA name across TOOLS, PULSE, and hooks`

**PR body:**

> Following the invitation in #1334 to help scrub the author's personal identifiers out of the shipped payload, this de-hardcodes the DA name (`"kai"`) so a fresh install reflects the name the principal chose during setup instead of the author's.
>
> One root cause — the DA name literal baked into ~15 sites — across six clusters:
>
> 1. **TOOLS attribution defaults** — `TelosFreshness.ts` (`by = "kai"` on `bumpTelosTimestamp` / `bumpContextTimestamp`).
> 2. **PULSE.toml `[da].primary`** — personal literal → neutral placeholder + pointer to the canonical config.
> 3. **DA-subsystem fallbacks** — `DAGrowth.ts`, `DASchedule.ts` (`?? "kai"`, help text).
> 4. **CLI banner text** — `MemoryStatus.ts` (`kai status`), `MemoryInsights.ts` (`kai insights`), `BannerRetro.ts` (`KAI` block-letter ASCII).
> 5. **Work labels** — `WorkSweep.ts` (×4), `PULSE/modules/work.ts`, `hooks/ReminderRouter.hook.ts` (`Agent:kai` → `Agent:<da-name>`).
> 6. **Telegram + memory graph** — `telegram.ts` speaker-label regex and voice-note filename, `MemoryGraph.ts` stopword list (drops the personal names `kai`, `daniel`).
>
> Mechanism: TOOLS and hooks read the configured name via `getDAName()` (`hooks/lib/identity.ts`); PULSE modules resolve it through the config they already load. The three `Agent:<da>` label producers share one source so their labels agree. `BannerRetro` renders the DA name (`stats.name`, default `"LifeOS"`) instead of hardcoded art. Surgical — no behavior change beyond the name value.

**Judgment calls:**

- **Import-path convention.** Used `../../hooks/lib/identity` for TOOLS→identity (and `./lib/identity` for the hook, `../../../hooks/lib/identity` for `work.ts` matching its own `work-config` import). This form resolves in both the source tree and the installed `~/.claude` layout. Some existing files use `../../../.claude/hooks/lib/identity`, which does **not** resolve from the source tree (`bun build` fails on it) — I deliberately did not copy that form.
- **`work.ts` label source.** The `Agent:<da>` label in `work.ts`'s setup instructions must match the labels `WorkSweep`/`ReminderRouter` actually create, so I sourced it from the same `getDAName()` helper (reachable — `work.ts` already imports `hooks/lib/work-config`) rather than a separate config read. Label consistency across the three producers outweighs the "PULSE prefers LifeosConfig" guideline for this one site.
- **`telegram.ts`.** Added a module-level `DA_NAME` const mirroring the existing `DA_VOICE_ID` pattern (resolved from `loadLifeosConfig`, which telegram already imports), `"LifeOS"` fallback. Regex is metachar-escaped; the voice-note filename is slug-sanitized. Also renamed the internal-only, export-but-zero-importer `synthesizeKaiVoice` → `synthesizeDaVoice` (on-theme, trivial). The `{{DA_NAME}}`/`{{PRINCIPAL_NAME}}` tokens on nearby lines are **left untouched** — those are issue #1143's separate concern.
- **`BannerRetro`.** Chose "derive from DA name" over "use LIFEOS": `stats.name` (the DA display name, default `"LifeOS"`) was already in scope at both render sites, so the banner now spells the actual DA name letter-spaced. Arbitrary-name block-glyph art isn't feasible without a full font, so the two `KAI` constants were removed.
- **`PULSE.toml [da].primary`.** A TOML value can't defer to another file by itself (that is Item ④), so on this branch I neutralized the personal literal to placeholder `"Aria"` (matches the `LIFEOS_CONFIG.toml` scaffold default) + a comment pointing to the canonical config. If ② and ④ both land, ④'s loader override makes this a pure fresh-install fallback.
- **Deferred as follow-up (not in this branch):** `skills/Prompting/Templates/Data/Agents.yaml` (`kai:` key / `id: kai`) and `VoicePresets.yaml` (`default_voice: kai`). Here `"kai"` is a **structural agent/preset key** referenced by template lookups (the displayed name in `Agents.yaml` already uses `{{DA_NAME}}`); renaming the key would require updating every reference and risks breaking template resolution — template-semantic, out of scope for a surgical de-hardcode. Also left: `LIFEOS/TOOLS/SessionRename.ts:13` (a doc-comment mention of `kai status`) and `BannerNeofetch.ts`'s `kaiGradient` local variable (derived from `stats.name` at runtime — not a hardcoded literal). Both cosmetic; flagged for a follow-up sweep.

**Full `git diff main` (`fix/da-name-hardcoding`):**

```diff
diff --git a/LifeOS/install/LIFEOS/PULSE/PULSE.toml b/LifeOS/install/LIFEOS/PULSE/PULSE.toml
index 3256696..adba217 100644
--- a/LifeOS/install/LIFEOS/PULSE/PULSE.toml
+++ b/LifeOS/install/LIFEOS/PULSE/PULSE.toml
@@ -86,7 +86,9 @@ enabled = true
 
 [da]
 enabled = true
-primary = "kai"
+# DA display name (placeholder). The canonical DA name lives in
+# LIFEOS/USER/CONFIG/LIFEOS_CONFIG.toml [da].name; rename your DA there.
+primary = "Aria"
 heartbeat_schedule = "*/30 * * * *"
 heartbeat_model = "haiku"
 heartbeat_cost_ceiling = 0.01
diff --git a/LifeOS/install/LIFEOS/PULSE/modules/telegram.ts b/LifeOS/install/LIFEOS/PULSE/modules/telegram.ts
index 708730b..615aab3 100644
--- a/LifeOS/install/LIFEOS/PULSE/modules/telegram.ts
+++ b/LifeOS/install/LIFEOS/PULSE/modules/telegram.ts
@@ -102,6 +102,18 @@ const DA_VOICE_ID = ((): string => {
   return "21m00Tcm4TlvDq8ikWAM"  // ElevenLabs "Rachel" — public voice
 })()
 
+// DA display name — read once at import from LifeosConfig ([da].name in
+// LIFEOS/USER/CONFIG/LIFEOS_CONFIG.toml). Used to strip a leading speaker label
+// off voice summaries and to name the outbound voice-note file. "LifeOS"
+// fallback matches the identity loader's default when config is unavailable.
+const DA_NAME = ((): string => {
+  try {
+    const n = loadLifeosConfig().da.name
+    if (n && typeof n === "string" && n.length > 0) return n
+  } catch { /* fall through to default */ }
+  return "LifeOS"
+})()
+
 // ── Module State ──
 
 let bot: Bot | null = null
@@ -499,7 +511,8 @@ function tidySummary(raw: string): string {
   // Strip wrapping quotes
   s = s.replace(/^["'`]+|["'`]+$/g, "")
   // Strip leading speaker labels ({{DA_NAME}}:, Summary:, etc.)
-  s = s.replace(/^(kai|summary|voice|output|response)[:\-—]\s*/i, "")
+  const daLabel = DA_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
+  s = s.replace(new RegExp(`^(${daLabel}|summary|voice|output|response)[:\\-—]\\s*`, "i"), "")
   // Strip leading list markers
   s = s.replace(/^[-*•]\s+/, "")
   // Collapse internal whitespace
@@ -528,7 +541,7 @@ function fallbackFirstSentence(text: string): string {
  * bytes as a Buffer; never writes to disk. Telegram's sendVoice consumes the
  * Buffer via grammY's InputFile constructor.
  */
-export async function synthesizeKaiVoice(text: string): Promise<Buffer> {
+export async function synthesizeDaVoice(text: string): Promise<Buffer> {
   const url = `https://api.elevenlabs.io/v1/text-to-speech/${DA_VOICE_ID}?output_format=opus_48000_64`
   const spokenText = disambiguateHomographs(text)
   const res = await fetch(url, {
@@ -612,11 +625,11 @@ export function sendVoiceSummary(
       }
 
       const tSynth = Date.now()
-      const buf = await synthesizeKaiVoice(summary)
+      const buf = await synthesizeDaVoice(summary)
       const synthLatencyMs = Date.now() - tSynth
 
       const tSend = Date.now()
-      await ctx.api.sendVoice(chatId, new InputFile(buf, "kai-summary.ogg"))
+      await ctx.api.sendVoice(chatId, new InputFile(buf, `${DA_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-summary.ogg`))
       const sendLatencyMs = Date.now() - tSend
 
       lastVoiceSendMs = Date.now() - t0
diff --git a/LifeOS/install/LIFEOS/PULSE/modules/work.ts b/LifeOS/install/LIFEOS/PULSE/modules/work.ts
index c8fb9b8..fb1f89a 100644
--- a/LifeOS/install/LIFEOS/PULSE/modules/work.ts
+++ b/LifeOS/install/LIFEOS/PULSE/modules/work.ts
@@ -24,6 +24,7 @@
 import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
 import { join } from "path";
 import { loadWorkConfig, type WorkConfig } from "../../../hooks/lib/work-config";
+import { getDAName } from "../../../hooks/lib/identity";
 
 // Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
 for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
@@ -317,7 +318,7 @@ function setupTemplate(reason: string): Response {
     subtype,
     instructions: [
       "Configure the work repo via the privacy-attested CLI: `bun ~/.claude/skills/_ULWORK/Tools/SetWorkRepo.ts <owner/repo>`. The CLI calls `gh repo view --json visibility,isPrivate` and refuses to write the config unless the repo is currently private.",
-      "Ensure the repo has these labels: Type:feature, Type:reminder, Type:research, Type:queue, Status:queued, Status:in-progress, Status:in-review, Status:blocked, Status:done, Priority:P0..P3, Property:internal, Agent:kai, pai-sync.",
+      `Ensure the repo has these labels: Type:feature, Type:reminder, Type:research, Type:queue, Status:queued, Status:in-progress, Status:in-review, Status:blocked, Status:done, Priority:P0..P3, Property:internal, Agent:${getDAName()}, pai-sync.`,
       "Restart Pulse so this module re-reads work_repo.json: `bun ~/.claude/LIFEOS/PULSE/manage.sh restart`.",
       "Run an Algorithm session — ULWorkSync.hook.ts will open the first issue at SessionEnd.",
     ],
diff --git a/LifeOS/install/LIFEOS/TOOLS/BannerRetro.ts b/LifeOS/install/LIFEOS/TOOLS/BannerRetro.ts
index 6caa680..e4457fa 100755
--- a/LifeOS/install/LIFEOS/TOOLS/BannerRetro.ts
+++ b/LifeOS/install/LIFEOS/TOOLS/BannerRetro.ts
@@ -278,24 +278,13 @@ const LIFEOS_CUBE_WIDE = [
   "   +----------+",
 ];
 
-// ═══════════════════════════════════════════════════════════════════════════
-// Block Letter KAI (using block characters)
-// ═══════════════════════════════════════════════════════════════════════════
-
-const BLOCK_KAI = [
-  "█  █  █████  █████",
-  "█ █   █   █    █  ",
-  "██    █████    █  ",
-  "█ █   █   █    █  ",
-  "█  █  █   █  █████",
-];
-
-// Smaller block KAI
-const BLOCK_KAI_SMALL = [
-  "█▀▄  ▄▀█  █",
-  "█▀▄  █▀█  █",
-  "▀ ▀  ▀ ▀  █",
-];
+// The banner spells the configured DA name (stats.name, which defaults to
+// "LifeOS"), rendered letter-spaced at the render sites below. The former
+// hardcoded "KAI" block-letter constants were removed so the banner reflects
+// whatever DA the principal named during setup.
+function daNameBanner(name: string): string {
+  return name.toUpperCase().split("").join(" ");
+}
 
 // ═══════════════════════════════════════════════════════════════════════════
 // Dynamic Stats & Identity
@@ -514,12 +503,10 @@ function createRetroBanner(): string {
   lines.push(`  ${gd}System Status:${RESET} ${g}${progress}${RESET} ${h}75%${RESET}`);
 
   // ─────────────────────────────────────────────────────────────────────────
-  // BLOCK LETTER KAI
+  // DA NAME (derived from configured DA identity)
   // ─────────────────────────────────────────────────────────────────────────
   lines.push("");
-  for (const row of BLOCK_KAI_SMALL) {
-    lines.push(`    ${c}${row}${RESET}`);
-  }
+  lines.push(`    ${c}${daNameBanner(stats.name)}${RESET}`);
 
   // ─────────────────────────────────────────────────────────────────────────
   // GITHUB URL
@@ -625,12 +612,8 @@ function createPureASCIIBanner(): string {
   lines.push(`  ${gd}Status:${RESET} ${g}[########....] 75%${RESET}`);
 
   lines.push("");
-  // Simple block KAI
-  lines.push(`    ${c}#  # ### ###${RESET}`);
-  lines.push(`    ${c}# #  ### ###${RESET}`);
-  lines.push(`    ${c}##   # # ###${RESET}`);
-  lines.push(`    ${c}# #  ### ###${RESET}`);
-  lines.push(`    ${c}#  # # # ###${RESET}`);
+  // DA name (derived from configured DA identity)
+  lines.push(`    ${c}${daNameBanner(stats.name)}${RESET}`);
 
   lines.push("");
   lines.push(`  ${gd}----------------------------------------${RESET}`);
diff --git a/LifeOS/install/LIFEOS/TOOLS/DAGrowth.ts b/LifeOS/install/LIFEOS/TOOLS/DAGrowth.ts
index 4402c01..1cf5be8 100755
--- a/LifeOS/install/LIFEOS/TOOLS/DAGrowth.ts
+++ b/LifeOS/install/LIFEOS/TOOLS/DAGrowth.ts
@@ -13,6 +13,7 @@
  */
 
 import { join } from "path"
+import { getDAName } from "../../hooks/lib/identity"
 
 const HOME = process.env.HOME ?? "~"
 const LifeOS = join(HOME, ".claude", "LIFEOS")
@@ -40,7 +41,7 @@ interface GrowthEvent {
 
 function parsePrimaryDA(content: string): string {
   const match = content.match(/^primary:\s*(\S+)/m)
-  return match?.[1] ?? "kai"
+  return match?.[1] ?? getDAName()
 }
 
 async function readJSONL<T>(path: string): Promise<T[]> {
@@ -212,7 +213,7 @@ async function main() {
   const args = process.argv.slice(2)
   const command = args[0] ?? "summary"
 
-  let primaryDA = "kai"
+  let primaryDA = getDAName()
   try {
     const registryContent = await Bun.file(REGISTRY_PATH).text()
     primaryDA = parsePrimaryDA(registryContent)
diff --git a/LifeOS/install/LIFEOS/TOOLS/DASchedule.ts b/LifeOS/install/LIFEOS/TOOLS/DASchedule.ts
index 6bd0f70..57d5112 100755
--- a/LifeOS/install/LIFEOS/TOOLS/DASchedule.ts
+++ b/LifeOS/install/LIFEOS/TOOLS/DASchedule.ts
@@ -12,6 +12,7 @@
 
 import { join } from "path"
 import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs"
+import { getDAName } from "../../hooks/lib/identity"
 
 const HOME = process.env.HOME ?? "~"
 const LIFEOS_DIR = join(HOME, ".claude", "LIFEOS")
@@ -143,7 +144,7 @@ function addTask(args: Record<string, string>): void {
   const task: ScheduledTask = {
     id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
     created_at: new Date().toISOString(),
-    created_by: args.by ?? "kai",
+    created_by: args.by ?? getDAName(),
     description: desc,
     schedule: hasCron
       ? { type: "recurring", cron: args.cron, until: args.until }
@@ -251,6 +252,6 @@ Options:
   --model     LLM model (for type=prompt, default: haiku)
   --command   Shell command (for type=script)
   --until     Expiry ISO datetime (for recurring)
-  --by        Creator name (default: kai)`)
+  --by        Creator name (default: ${getDAName()})`)
     break
 }
diff --git a/LifeOS/install/LIFEOS/TOOLS/MemoryGraph.ts b/LifeOS/install/LIFEOS/TOOLS/MemoryGraph.ts
index a7272ce..882f3c7 100755
--- a/LifeOS/install/LIFEOS/TOOLS/MemoryGraph.ts
+++ b/LifeOS/install/LIFEOS/TOOLS/MemoryGraph.ts
@@ -202,7 +202,7 @@ function ingest(): Raw[] {
 // ============================================================================
 
 const STOP = new Set(("a an and are as at be by for from has have in into is it its of on or that the to with we our this " +
-  "you your i me my system build make want need use using via pai memory work isa kai daniel new add get set " +
+  "you your i me my system build make want need use using via pai memory work isa new add get set " +
   "not but all any can will should would they them then than over under about across into out up down").split(" "));
 
 function tokenize(text: string): Set<string> {
diff --git a/LifeOS/install/LIFEOS/TOOLS/MemoryInsights.ts b/LifeOS/install/LIFEOS/TOOLS/MemoryInsights.ts
index 8f6afa1..af4ead6 100644
--- a/LifeOS/install/LIFEOS/TOOLS/MemoryInsights.ts
+++ b/LifeOS/install/LIFEOS/TOOLS/MemoryInsights.ts
@@ -1,6 +1,6 @@
 #!/usr/bin/env bun
 /**
- * MemoryInsights — `kai insights` CLI for autonomic memory delta view.
+ * MemoryInsights — the DA-named `insights` CLI for autonomic memory delta view.
  *
  * Visual-freshness ISA, F4 (ISC-30 through ISC-38).
  *
@@ -22,6 +22,7 @@
 import { existsSync, readFileSync, statSync } from "node:fs";
 import { resolve as pathResolve } from "node:path";
 import { homedir } from "node:os";
+import { getDAName } from "../../hooks/lib/identity";
 
 const ROOT = pathResolve(homedir(), ".claude");
 const OBS = pathResolve(ROOT, "LIFEOS/MEMORY/OBSERVABILITY");
@@ -41,7 +42,7 @@ function parseArgs(): Args {
       if (!Number.isNaN(n) && n > 0) days = n;
       i++;
     } else if (argv[i] === "--help" || argv[i] === "-h") {
-      console.log("kai insights — memory delta over the last N day(s)");
+      console.log(`${getDAName().toLowerCase()} insights — memory delta over the last N day(s)`);
       console.log("usage: bun LIFEOS/TOOLS/MemoryInsights.ts [--days N]");
       console.log("       --days N    window size in days (default: 1)");
       process.exit(0);
@@ -163,7 +164,7 @@ function main(): void {
   // Zero-activity short-circuit (ISC-36)
   const zeroActivity = reviewerRuns.length === 0 && memoryWrites.length === 0 && proposals.length === 0;
   if (zeroActivity) {
-    console.log(`kai insights — last ${days} day(s)`);
+    console.log(`${getDAName().toLowerCase()} insights — last ${days} day(s)`);
     console.log("═".repeat(60));
     console.log(`window: ${fmtClock(sinceMs)} → ${fmtClock(now)}`);
     console.log(`(no activity in last ${days} day(s))`);
@@ -173,7 +174,7 @@ function main(): void {
   }
 
   const out: string[] = [];
-  out.push(`kai insights — last ${days} day(s)`);
+  out.push(`${getDAName().toLowerCase()} insights — last ${days} day(s)`);
   out.push("═".repeat(60));
   out.push(`window: ${fmtClock(sinceMs)} → ${fmtClock(now)}`);
   out.push("");
diff --git a/LifeOS/install/LIFEOS/TOOLS/MemoryStatus.ts b/LifeOS/install/LIFEOS/TOOLS/MemoryStatus.ts
index f6029b5..a4e9a6c 100755
--- a/LifeOS/install/LIFEOS/TOOLS/MemoryStatus.ts
+++ b/LifeOS/install/LIFEOS/TOOLS/MemoryStatus.ts
@@ -31,6 +31,7 @@ import {
   PENDING_PROPOSALS_PATH,
 } from "./MemoryTypes";
 import { read as readMemory } from "./MemoryWriter";
+import { getDAName } from "../../hooks/lib/identity";
 
 const CLAUDE_ROOT = pathResolve(homedir(), ".claude");
 const LIFEOS_DIR = pathJoin(CLAUDE_ROOT, "LIFEOS");
@@ -253,7 +254,7 @@ function relTime(iso: string | null): string {
 
 function renderText(r: StatusReport): string {
   const out: string[] = [];
-  out.push("kai status — LifeOS memory subsystem");
+  out.push(`${getDAName().toLowerCase()} status — LifeOS memory subsystem`);
   out.push("─".repeat(48));
   out.push("");
   out.push("Hot-layer memory files:");
diff --git a/LifeOS/install/LIFEOS/TOOLS/TelosFreshness.ts b/LifeOS/install/LIFEOS/TOOLS/TelosFreshness.ts
index 81a71ce..1f9e4be 100755
--- a/LifeOS/install/LIFEOS/TOOLS/TelosFreshness.ts
+++ b/LifeOS/install/LIFEOS/TOOLS/TelosFreshness.ts
@@ -24,6 +24,7 @@
 
 import { readFileSync, writeFileSync, existsSync } from "fs";
 import { basename, join } from "path";
+import { getDAName } from "../../hooks/lib/identity";
 
 // Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
 for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
@@ -552,7 +553,7 @@ function refreshFreshnessCache(): void {
  */
 export function bumpTelosTimestamp(
   slug?: string,
-  by: string = "kai",
+  by: string = getDAName(),
   path: string = TELOS_PATH,
 ): { changed: boolean; sectionFound: boolean } {
   if (!existsSync(path)) return { changed: false, sectionFound: false };
@@ -617,7 +618,7 @@ export function bumpTelosTimestamp(
   return { changed: true, sectionFound };
 }
 
-export function bumpContextTimestamp(filePath: string, by: string = "kai"): { changed: boolean } {
+export function bumpContextTimestamp(filePath: string, by: string = getDAName()): { changed: boolean } {
   if (!existsSync(filePath)) return { changed: false };
 
   const raw = readFileSync(filePath, "utf-8");
diff --git a/LifeOS/install/LIFEOS/TOOLS/WorkSweep.ts b/LifeOS/install/LIFEOS/TOOLS/WorkSweep.ts
index 806c79f..051b176 100755
--- a/LifeOS/install/LIFEOS/TOOLS/WorkSweep.ts
+++ b/LifeOS/install/LIFEOS/TOOLS/WorkSweep.ts
@@ -27,6 +27,7 @@
 import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, appendFileSync } from "fs";
 import { join } from "path";
 import { loadWorkConfig } from "../../hooks/lib/work-config";
+import { getDAName } from "../../hooks/lib/identity";
 
 // Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
 for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
@@ -255,7 +256,7 @@ async function sweepSessions(
       "Status:queued",
       projectProperty(fm.project),
       "Priority:P3",
-      "Agent:kai",
+      `Agent:${getDAName()}`,
     ], existingLabels);
     const goalLine = fm.principal_stated_goal ? `\n> 🎯 **Principal stated goal:** ${fm.principal_stated_goal}\n` : "";
     const body = [
@@ -378,7 +379,7 @@ async function sweepProjectChecks(
       "Status:queued",
       projectProperty(row.name.toLowerCase()),
       "Priority:P3",
-      "Agent:kai",
+      `Agent:${getDAName()}`,
       "stale",
     ], existingLabels);
     const body = [
@@ -443,7 +444,7 @@ async function sweepGoals(
       "Status:queued",
       "Property:internal",
       "Priority:P2",
-      "Agent:kai",
+      `Agent:${getDAName()}`,
     ], existingLabels);
     const body = [
       `## 🎯 TELOS Goal`,
@@ -514,7 +515,7 @@ async function sweepBpeCadence(
     "Status:queued",
     "Property:internal",
     "Priority:P3",
-    "Agent:kai",
+    `Agent:${getDAName()}`,
   ], existingLabels);
   const body = [
     `## 🪓 Scheduled BitterPillEngineering pass`,
diff --git a/LifeOS/install/hooks/ReminderRouter.hook.ts b/LifeOS/install/hooks/ReminderRouter.hook.ts
index 8635ab0..8f47f87 100755
--- a/LifeOS/install/hooks/ReminderRouter.hook.ts
+++ b/LifeOS/install/hooks/ReminderRouter.hook.ts
@@ -22,6 +22,7 @@ import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
 import { createHash } from "crypto";
 import { join, dirname } from "path";
 import { loadWorkConfig } from "./lib/work-config";
+import { getDAName } from "./lib/identity";
 
 const HOME = process.env.HOME || "";
 const STATE_PATH = join(HOME, ".claude", "LIFEOS", "MEMORY", "STATE", "reminder-router-seen.json");
@@ -178,7 +179,7 @@ function buildIssue(match: RouteMatch, prompt: string): { title: string; body: s
     "Property:internal",
     "Status:queued",
     "Priority:P3",
-    "Agent:kai",
+    `Agent:${getDAName()}`,
     "pai-sync",
   ];
 
```

---

## Item ③ — `fix/telegram-voice-summary-switch`

**PR title:** `fix(telegram): add explicit config switch for voice summaries`

**PR body:**

> `sendVoiceSummary` was gated only by the presence of `ELEVENLABS_API_KEY`. Because the Telegram module and the CLI `/notify` VoiceServer share that one env var, an install that wants ElevenLabs for the CLI channel but *not* spoken Telegram notes had no way to turn the latter off short of unsetting the key (which kills both).
>
> This adds a `[telegram] voice_summaries` flag, threaded through the existing `loadPulseConfig → startTelegram → activeConfig` path — no new plumbing (`loadPulseConfig` already passes the whole `[telegram]` table through). Defaults to enabled (undefined ⇒ on) so existing installs are unchanged; set `voice_summaries = false` to keep text replies but suppress the voice note. `telegramHealth()` reflects the switch.

**Judgment calls:**

- Chose a dedicated `[telegram] voice_summaries` flag over reusing the top-level `[voice] enabled`, because `[voice]` gates the separate CLI VoiceServer/`/notify` channel — conflating the two surfaces would be wrong.
- No `pulse.ts` change needed: `loadPulseConfig` already casts and forwards the entire `[telegram]` table to `startTelegram(config.telegram)` (an `any`-typed dynamic-import call), which stores it in `activeConfig`. Adding the typed field to `TelegramConfig` + the guard is sufficient.

**Full `git diff main` (`fix/telegram-voice-summary-switch`):**

```diff
diff --git a/LifeOS/install/LIFEOS/PULSE/PULSE.toml b/LifeOS/install/LIFEOS/PULSE/PULSE.toml
index 3256696..80c69c6 100644
--- a/LifeOS/install/LIFEOS/PULSE/PULSE.toml
+++ b/LifeOS/install/LIFEOS/PULSE/PULSE.toml
@@ -15,6 +15,9 @@ enabled = true
 
 [telegram]
 enabled = true
+# Send a spoken summary of each text reply as a Telegram voice note. Requires
+# ELEVENLABS_API_KEY. Set false to keep text replies but suppress voice notes.
+voice_summaries = true
 
 [imessage]
 enabled = false
diff --git a/LifeOS/install/LIFEOS/PULSE/modules/telegram.ts b/LifeOS/install/LIFEOS/PULSE/modules/telegram.ts
index 708730b..7c84cf3 100644
--- a/LifeOS/install/LIFEOS/PULSE/modules/telegram.ts
+++ b/LifeOS/install/LIFEOS/PULSE/modules/telegram.ts
@@ -58,6 +58,11 @@ export interface TelegramConfig {
   max_turns?: number
   sdk_timeout_ms?: number
   edit_interval_ms?: number
+  // Send a spoken summary of each text reply as a Telegram voice note.
+  // Defaults to enabled (undefined ⇒ on) so existing installs are unchanged;
+  // set `voice_summaries = false` under [telegram] in PULSE.toml to opt out
+  // even when ELEVENLABS_API_KEY is present.
+  voice_summaries?: boolean
 }
 
 // ── Constants ──
@@ -570,6 +575,9 @@ export function sendVoiceSummary(
   fullText: string,
 ): void {
   if (!ELEVENLABS_API_KEY) return
+  // Explicit opt-out: a principal can keep text replies but suppress voice
+  // notes via [telegram] voice_summaries = false, even with an API key present.
+  if (activeConfig?.voice_summaries === false) return
   const wordCount = fullText.trim().split(/\s+/).length
   if (wordCount < SHORT_REPLY_WORDS) {
     log("info", "voice summary skipped — short reply", { wordCount, chatId: ctx.chat.id })
@@ -1084,7 +1092,10 @@ export function telegramHealth(): {
   last_session_id?: string
   voice_summary: { enabled: boolean; last_send_ms: number | null }
 } {
-  const voice_summary = { enabled: ELEVENLABS_API_KEY !== "", last_send_ms: lastVoiceSendMs }
+  const voice_summary = {
+    enabled: ELEVENLABS_API_KEY !== "" && activeConfig?.voice_summaries !== false,
+    last_send_ms: lastVoiceSendMs,
+  }
 
   if (!bot) {
     return {
```

---

## Item ④ — `fix/pulse-da-user-config`

**PR title:** `fix(pulse): defer [da] identity to the user config (LIFEOS_CONFIG.toml)`

**PR body:**

> PULSE's `[da].primary` was read only from the shipped `PULSE.toml`, so the DA name was unoverridable from the user tier — it lived in two files (`PULSE.toml` and `LIFEOS/USER/CONFIG/LIFEOS_CONFIG.toml [da].name`) that could silently disagree.
>
> `loadPulseConfig` now defers `[da].primary` to `LIFEOS_CONFIG.toml [da].name` when present, via the existing `LifeosConfig` loader — converging the two identity configs on one source of truth rather than adding a third layer. Fresh installs without the user config keep the `PULSE.toml` value.

**Judgment calls:**

- Implemented as a mutation of the parsed `da` object before the config return, inside a `try/catch` so a missing/invalid `LIFEOS_CONFIG.toml` (fresh install) simply keeps the `PULSE.toml` value.
- Kept to `pulse.ts` only (no `PULSE.toml` edit) so it does not overlap Item ②'s `PULSE.toml` change; the two compose cleanly.
- Functionally tested both paths (see Sanity checks): config-present → `primary` becomes the user-config DA name; config-absent → `primary` unchanged.

**Full `git diff main` (`fix/pulse-da-user-config`):**

```diff
diff --git a/LifeOS/install/LIFEOS/PULSE/pulse.ts b/LifeOS/install/LIFEOS/PULSE/pulse.ts
index 1a7251d..416af0c 100755
--- a/LifeOS/install/LIFEOS/PULSE/pulse.ts
+++ b/LifeOS/install/LIFEOS/PULSE/pulse.ts
@@ -17,6 +17,7 @@
 import { join } from "path"
 import { readFileSync, existsSync } from "fs"
 import { parse } from "smol-toml"
+import { loadLifeosConfig } from "../TOOLS/LifeosConfig"
 
 // ── Load .env before anything else ──
 
@@ -231,6 +232,20 @@ async function loadPulseConfig(): Promise<PulseConfig> {
 
   const daemonConfig = await loadConfig(PULSE_DIR)
 
+  // Converge the DA identity on a single source of truth. PULSE.toml ships a
+  // placeholder [da].primary, but the DA's real name lives in the user config
+  // (LIFEOS/USER/CONFIG/LIFEOS_CONFIG.toml [da].name). Defer to it when present
+  // — via the existing LifeosConfig loader — rather than maintaining the DA
+  // name in two files. Fresh installs without the user config keep the
+  // PULSE.toml value.
+  const da = (parsed.da as PulseConfig["da"]) ?? { enabled: false }
+  try {
+    const daName = loadLifeosConfig().da.name
+    if (daName) da.primary = daName
+  } catch {
+    // LIFEOS_CONFIG.toml absent or invalid (e.g. fresh install) — keep PULSE.toml's value.
+  }
+
   return {
     port: (parsed.port as number) ?? parseInt(process.env.PULSE_PORT || "31337", 10),
     tls: (parsed.tls as PulseConfig["tls"]) ?? undefined,
@@ -243,7 +258,7 @@ async function loadPulseConfig(): Promise<PulseConfig> {
     work: (parsed.work as PulseConfig["work"]) ?? { enabled: true },
     telos: (parsed.telos as PulseConfig["telos"]) ?? { enabled: true },
     hooks: (parsed.hooks as PulseConfig["hooks"]) ?? { enabled: true },
-    da: (parsed.da as PulseConfig["da"]) ?? { enabled: false },
+    da,
     worker: parsed.worker as PulseConfig["worker"],
     jobs: daemonConfig.jobs,
   }
```

---

## Cross-branch interactions

- **② and ④** both concern the `[da]` DA name but touch **different files** (② → `PULSE.toml` value; ④ → `pulse.ts` loader). With both merged, ④'s loader overrides `primary` from `LIFEOS_CONFIG.toml` when present, and ②'s `"Aria"` placeholder becomes the fresh-install fallback. No conflict.
- **② and ③** both touch `telegram.ts` but in different regions (② near the module-const block, the `tidySummary` regex, `synthesizeDaVoice`, and the voice-note filename; ③ in the `TelegramConfig` interface, the `sendVoiceSummary` guard, and `telegramHealth`). No overlapping lines — they apply independently.
- All three branch from `main` independently; order of merge does not matter.

## Sanity checks performed

The clone has **no `node_modules`** and no `tsc`, so a full type-check/bundle isn't possible. Checks used:

- **Syntax (all touched `.ts`):** `Bun.Transpiler` pass → every file **PARSE-OK** (no syntax error introduced).
- **Import-path resolution:** `bun build` on the identity-importing TOOLS/hooks/PULSE files reaches `hooks/lib/identity.ts` and fails only on the missing `yaml` npm package — which confirms my new import **paths resolve** (the failures are the un-installed clone's missing deps, not mine). `BannerRetro.ts` `bun build` succeeds outright.
- **TOML validity:** both edited `PULSE.toml`s parse via Bun's native TOML (`require`): `da.primary = "Aria"` (②), `telegram = {enabled:true, voice_summaries:true}` (③).
- **Item ④ defer logic — functional test** with a temp `LIFEOS_CONFIG.toml`: config-present → `primary="Aria"` (**PASS**); config-absent → `primary` kept as the `PULSE.toml` value `"kai"` (**PASS**).
- **Item ② residue:** grep confirms zero remaining personal `"kai"` / `Agent:kai` / `kai-summary` / `BLOCK_KAI` / `synthesizeKaiVoice` / `kai daniel` / `(default: kai)` literals within the enumerated scope.

## Things I could not verify

- **Runtime end-to-end** (Pulse daemon, live Telegram bot, rendered banners): requires `bun install`, running services, and API keys — out of scope for a local static build. All verification here is static (parse + import-resolution + isolated functional tests).
- **GitHub issue #1143 metadata** (the "closed as fixed on 2026-07-07" and "no linked PR" claims): I verified the **code-side** facts against the clone (tokens present, file's last-commit date, no local commit referencing 1143). The close date/label come from the task description — I did not query the GitHub API (no push/`gh` per instructions).
- **Issue #1334's exact wording/scope:** cited as the de-hardcoding invitation per the task; not fetched.
- **`getDAName()`'s resolved value on a real install:** its fallback chain is DA_IDENTITY.md frontmatter → `settings.json` → `"LifeOS"`. Whether the shipped identity file exposes proper frontmatter is a separate concern; wiring the helper is correct regardless, and `"LifeOS"` is a safe neutral default.

---

*Generated locally. Review, then push/PR at your discretion.*
