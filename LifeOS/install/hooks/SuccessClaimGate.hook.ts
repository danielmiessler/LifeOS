#!/usr/bin/env bun
/**
 * SuccessClaimGate.hook.ts — enforce verification-evidence reference on every
 * success claim in an assistant response.
 *
 * PURPOSE:
 * Block-back any response that asserts "shipped/deployed/done/verified/it works/
 * complete/landed" without a same-response tool-output reference (file path,
 * screenshot path, command-output block, tool-result fingerprint).
 *
 * Closes the 125 verification-miss / premature-done occurrences cited in
 * Thread 3 of the 2026-05-14 Upgrade Recommend pass (avg severity 2.2/10).
 * Doctrinal anchor: LIFEOS_SYSTEM_PROMPT.md § Verification + Algorithm v6.6.0 § INLINE
 * VERIFICATION MANDATE.
 *
 * TRIGGER: Stop
 *
 * MECHANISM:
 *   - Read input.last_assistant_message (CC v2.1.47+; transcript-parse fallback)
 *   - Honor input.stop_hook_active to prevent infinite block loops
 *   - Scan for closed-list success-claim phrases via word-boundary regex
 *   - For each detected claim, look for evidence anchors in the same response:
 *       * Absolute file paths starting with /Users/, /opt/, /etc/, /var/, /tmp/
 *       * Interceptor screenshot references (screenshots/, .png with explicit path)
 *       * Fenced code blocks (```...```) containing tool output
 *       * Exit-code text ("exit 0", "exit code 0")
 *       * Quoted command output / file content (multi-line backtick spans)
 *   - On claim-without-evidence, emit decision:block; else pass
 *   - Always append observability JSONL
 *
 * BACKWARDS-COMPAT:
 *   - "would work", "should work" are NOT success claims (they're hedges — the
 *     LIFEOS_SYSTEM_PROMPT.md already bans them; not this hook's job to enforce)
 *   - Past-tense narration ("I shipped it") IS a claim; present-imperative
 *     ("ship it") is NOT — regex anchors on past-tense / completed forms only
 */

import { readHookInput, parseTranscriptFromInput } from "./lib/hook-io";
import { appendFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const OBS_PATH = join(
  process.env.LIFEOS_DIR || join(process.env.HOME!, ".claude", "LIFEOS"),
  "MEMORY",
  "OBSERVABILITY",
  "success-claim-gate.jsonl",
);

// Closed-list success-claim regex — past-tense / completed forms anchored to
// first-person or it/now constructions to reduce false-positive on non-claim
// uses ("when you're done", "complete the form", "the deployed system").
// Word-boundary anchored; case-insensitive; multiline.
const CLAIM_PATTERNS: RegExp[] = [
  /\b(I|we|it'?s|it\s+is)\s+(shipped|deployed|landed|verified|finished|pushed|merged|complete[d]?)\b/im,
  /\b(it\s+works|works\s+now|works\s+as\s+expected|all\s+green|all\s+passing)\b/im,
  /\b(task|build|deploy|fix)\s+(complete|done|finished|landed)\b/im,
];

// Narration guards — matches that are NOT this-turn done-claims. A claim verb
// followed by a calendar year ("shipped in 2024") is past narration, not a
// completion claim; a claim verb inside double quotes is attributed/quoted
// framing, not an assertion about this turn's work. Stripping these before
// claim detection kills the false-positive that bounced advisory responses.
const NARRATION_GUARDS: RegExp[] = [
  /\b(shipped|deployed|landed|verified|finished|pushed|merged|complete[d]?)\s+(in|back\s+in|since|during|by)\s+(19|20)\d\d\b/gim, // past-dated narration
  /"[^"]*\b(shipped|deployed|landed|verified|finished|pushed|merged|complete[d]?)\b[^"]*"/gim, // quoted/attributed
  /(thesis|essay|framing|claim|story|version|post|repo|project)\s+\w*\s*(I|we)\s+(shipped|deployed|landed|finished|pushed|merged)/gim, // narrating a named past artifact
  // Backward-reference to a PRIOR turn ("deployed ... earlier", "already live-verified",
  // "prod rollout was done in the prior turns") is narration about already-finished,
  // already-evidenced work — not a fresh this-turn deploy claim. Without this, a
  // follow-up turn (e.g. a git push) that merely references an earlier verified deploy
  // trips the 2-class deploy bar with no in-turn evidence to satisfy it — an unescapable
  // loop. Requires an explicit prior-turn marker, so genuine same-turn claims still gate.
  /\b(shipped|deployed|prod[\s-]?deployed|landed|verified|live[\s-]?verified|finished|live)\b[^.\n]{0,48}\b(earlier|already|previously|in\s+(the\s+)?prior\s+turns?|prior\s+turns?|last\s+turn|in\s+a\s+prior\s+turn)\b/gim,
  /\b(earlier|already|previously|in\s+(the\s+)?prior\s+turns?|prior\s+turns?|last\s+turn)\b[^.\n]{0,48}\b(shipped|deployed|prod[\s-]?deployed|landed|verified|live[\s-]?verified|finished|live)\b/gim,
];

// Evidence anchors — any one match in the same response satisfies the gate.
const EVIDENCE_PATTERNS: RegExp[] = [
  /\/Users\/[A-Za-z0-9_\-./]+/, // absolute macOS path
  /\/(opt|etc|var|tmp|home|usr)\/[A-Za-z0-9_\-./]+/, // other absolute paths
  /\bPAI\/[A-Za-z0-9_\-./]+\.(md|ts|tsx|json|jsonl|sql|sh|yaml|yml|txt|png)\b/i, // relative LifeOS repo path
  /(^|[\s`(])~?\/?\.?claude\/[A-Za-z0-9_\-./]+/i, // ~/.claude or .claude relative path
  /\b[A-Za-z0-9_\-]+\/[A-Za-z0-9_\-./]+\.(md|ts|tsx|json|jsonl|sql|sh|yaml|yml|txt)\b/, // any relative <dir>/<file>.ext citation
  /\bscreenshots?\/[A-Za-z0-9_\-./]+\.(png|jpe?g|webp)\b/i, // Interceptor screenshot
  /```[\s\S]+?```/, // fenced code block (any content)
  /\bexit\s+(code\s+)?0\b/i, // exit-code evidence
  /\$\(.+?\)/, // command substitution (often in evidence quotes)
  /^\s{4,}.+$/m, // 4-space indented line (often tool output paste)
  /\b[a-f0-9]{7,40}\b/, // git SHA / uuid prefix (reference is evidence)
  /\b(AlgoPhase|tool[- ]output|task[- ]notification)\b/i, // explicit tool-output citation
];

interface SuccessGateRecord {
  ts: string;
  session_id: string;
  decision: "pass" | "block" | "block-webui-no-interceptor" | "skip-recovery" | "no-claim";
  detected_claim: string | null;
  evidence_found: boolean;
  message_length: number;
  stop_hook_active: boolean;
}

function appendObs(record: SuccessGateRecord): void {
  try {
    mkdirSync(dirname(OBS_PATH), { recursive: true });
    appendFileSync(OBS_PATH, JSON.stringify(record) + "\n", "utf-8");
  } catch (err) {
    console.error("[SuccessClaimGate] obs write failed:", err);
  }
}

// Strip narration (past-dated / quoted / named-artifact claims) before scanning
// for this-turn done-claims, so the gate only fires on real assertions.
function stripNarration(message: string): string {
  let out = message;
  for (const guard of NARRATION_GUARDS) out = out.replace(guard, " ");
  return out;
}

function findClaim(message: string): string | null {
  const scannable = stripNarration(message);
  for (const pat of CLAIM_PATTERNS) {
    const m = scannable.match(pat);
    if (m) return m[0];
  }
  return null;
}

// Deploy-shaped claims get a stricter, CONJUNCTIVE bar (2026-06-12, Interceptor
// verify-loop rewire): one evidence anchor of any kind is enough for ordinary
// done-claims, but "deployed/live" claims must cite at least TWO distinct
// evidence classes (e.g. screenshot path + fenced tool output, or fenced
// output + git SHA + http status). Rationale: a single code fence could be
// build output — it proves nothing about the live site. Bar is class-count,
// not Interceptor-verb-specific, so curl-verified API deploys still pass.
const DEPLOY_CLAIM = /\b(deployed\s+(to|at|and|successfully)|deploy\s+(is\s+)?(complete|done|finished|succeeded)|(is|it'?s|site'?s|now)\s+live\b|went\s+live|live\s+at|live\s+on)/im;

function countEvidenceClasses(message: string): number {
  return EVIDENCE_PATTERNS.reduce((n, pat) => n + (pat.test(message) ? 1 : 0), 0);
}

// ── Modality-fidelity gate (2026-06-27 incident: a browser-broken /admin page
// was called "live and locked down" on curl evidence) ─────────────────────────
// Doctrine (LIFEOS_SYSTEM_PROMPT.md § Verification): curl is NOT verification for
// web output; Interceptor is mandatory. The class-count bar above let a
// curl-only deploy claim pass. This gate closes that exact hole: a PAGE/UI
// success-claim must cite Interceptor-class evidence OR honestly downgrade.
// API/CLI/file claims are untouched — curl stays valid there.

// A claim that something a human views in a browser is live / works / verified.
const WEB_UI_NOUN =
  /\b(the\s+)?(page|site|web\s*site|admin(\s+(page|panel|ui|login|section))?|login(\s+page)?|sign[\s-]?in|dashboard|front[\s-]?end|\bUI\b|form|landing|home\s*page)\b/i;
const RENDER_VERB =
  /\b(renders?|loads?\s+(in|the)|displays?|in\s+the\s+browser|browser[\s-]?verif\w*|on[\s-]?screen|the\s+login(\s+page)?\s+(shows|appears)|sign[\s-]?in\s+(shows|appears|works))\b/i;
const LIVE_UI_CLAIM =
  /\b((is|it'?s|site'?s|page'?s|now)\s+live|went\s+live|locked\s+down|fail[\s-]?closed\s+verif\w*|verified\s+(live|in\s+the\s+browser|fail[\s-]?closed)|works\s+(now|in\s+the\s+browser|end[\s-]?to[\s-]?end))\b/i;

// Interceptor-class evidence — the only thing that verifies rendered web output.
// Includes the ScrubFlow frame-scrub manifest (the frames the model actually
// viewed + their SSIM scores) — motion/flow evidence, keyed on the manifest,
// NOT a bare video path ("video.mp4 exists" is not proof it rendered right).
const INTERCEPTOR_EVIDENCE =
  /\binterceptor\b|\/Downloads\/[A-Za-z0-9_\-]+\.(png|webp|jpe?g)\b|\bpai[\s-]?screenshots?\b|\bscreenshots?\/[A-Za-z0-9_\-./]+\.(png|jpe?g|webp)\b|\bDOM\s+read\b|\bComputer\s+Use\b|\bframe[\s-]?scrub\b|\bscrub(?:bed|flow)\b|\bframes?\/[A-Za-z0-9_\-./]+manifest\.json\b/i;

// Honest downgrade / deferral — an explicit "not browser-verified" is allowed;
// it is not a false done-claim. This is the sanctioned escape when Interceptor
// is genuinely unavailable (wedged) — you defer, you do NOT substitute curl.
const HONEST_DOWNGRADE =
  /\b(DEFERRED[\s-]?VERIFY|not\s+(yet\s+)?(browser[\s-]?)?verif\w*|not\s+verified\s+in\s+(a\s+)?browser|deployed\s+but\s+not\s+(live[\s-]?|browser[\s-]?)?verif\w*|curl[\s-]?only|haven'?t\s+(browser[\s-]?|yet\s+)?verif\w*|pending\s+(browser\s+|live\s+)?verif\w*|screenshot\s+(path\s+)?wedged|could\s+not\s+capture\s+(a\s+)?screenshot|not\s+(yet\s+)?browser[\s-]?verified)\b/i;

// Returns true when the message asserts a browser-facing thing is live/works,
// with NO Interceptor evidence and NO honest downgrade — the catastrophic class.
//
// TASK-AWARE SCOPING (2026-07-04): the live-claim and the web-UI context must
// co-occur in the SAME sentence/line. The prior version OR'd LIVE_UI_CLAIM into
// BOTH halves of the test, so any "…is now live" collapsed the conjunction and
// fired even with zero web nouns present — a git-push "the rename is now live"
// got blocked as a web claim (false positive {{PRINCIPAL_NAME}} hit repeatedly). Requiring
// same-unit co-occurrence means "live" only trips the browser teeth when it's
// live ABOUT a page/site/admin/dashboard/form/login (or a render verb), never
// about a hook, tag, repo, worker, or CLI. The real 2026-06-27 case ("Admin's
// live and locked down", curl-only) still blocks — "admin" is in the same unit.
// Escapes (Interceptor evidence / honest downgrade) still scan the whole message.
function splitIntoUnits(text: string): string[] {
  // Sentence terminators + line breaks — each clause/bullet is its own unit, so a
  // web noun in one section can't satisfy a non-web "live" claim in another.
  return text.split(/[.!?\n]+/).map((u) => u.trim()).filter(Boolean);
}

function unitAssertsLive(u: string): boolean {
  return LIVE_UI_CLAIM.test(u) || DEPLOY_CLAIM.test(u) || /\b(it\s+works|works\s+now)\b/i.test(u);
}

function unitIsWebUi(u: string): boolean {
  return WEB_UI_NOUN.test(u) || RENDER_VERB.test(u);
}

function isUnverifiedWebUiClaim(message: string): boolean {
  const s = stripNarration(message);
  // A web-UI claim requires a live/deploy/works assertion AND a web-UI noun or
  // render verb IN THE SAME unit — the claim must be about the web thing.
  const hasWebUiClaim = splitIntoUnits(s).some((u) => unitAssertsLive(u) && unitIsWebUi(u));
  if (!hasWebUiClaim) return false;
  if (INTERCEPTOR_EVIDENCE.test(message)) return false; // verified the right way
  if (HONEST_DOWNGRADE.test(message)) return false; // honestly deferred
  return true;
}

async function main(): Promise<void> {
  const input = await readHookInput();
  if (!input) {
    process.exit(0);
  }

  if (input.stop_hook_active === true) {
    appendObs({
      ts: new Date().toISOString(),
      session_id: input.session_id ?? "unknown",
      decision: "skip-recovery",
      detected_claim: null,
      evidence_found: false,
      message_length: (input.last_assistant_message ?? "").length,
      stop_hook_active: true,
    });
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }

  let message = input.last_assistant_message;
  if (!message) {
    try {
      const parsed = await parseTranscriptFromInput(input);
      message = parsed.lastMessage ?? undefined;
    } catch {
      // best-effort
    }
  }

  if (!message || message.trim().length === 0) {
    process.exit(0);
  }

  const sessionId = input.session_id ?? "unknown";

  // ── TEETH (narrow, 2026-06-27): a page/UI claim with no browser verification
  // BLOCKS. Runs BEFORE the general claim/deploy detection because the web-UI
  // claim surface ("live", "locked down", "the admin page works") is broader
  // than the older CLAIM_PATTERNS — a curl-only "Admin's live and locked down"
  // matched no CLAIM_PATTERN and slipped through entirely (the 2026-06-27 bug).
  // This is the one case where a double-emit is cheaper than shipping a false
  // "it's live". General claims stay non-blocking telemetry (2026-06-20
  // directive); only browser-facing-claim-without-Interceptor gets teeth.
  // stop_hook_active (handled above) prevents any loop.
  if (isUnverifiedWebUiClaim(message)) {
    appendObs({
      ts: new Date().toISOString(),
      session_id: sessionId,
      decision: "block-webui-no-interceptor",
      detected_claim: "web-ui-claim-without-interceptor",
      evidence_found: false,
      message_length: message.length,
      stop_hook_active: false,
    });
    console.log(
      JSON.stringify({
        decision: "block",
        reason:
          "WEB-UI VERIFICATION GAP. You claimed a page/UI is live / works / verified / locked down, but the response cites only curl/HTTP (or no) evidence — no Interceptor screenshot or DOM read. curl is NOT verification for web output (LIFEOS_SYSTEM_PROMPT.md § Verification; Algorithm Rule 1). Before stopping, do ONE of: (a) exercise the REAL browser path with Interceptor and cite the artifact (screenshot path / DOM read), or (b) downgrade the claim honestly — 'deployed, not browser-verified' — and mark the ISC [DEFERRED-VERIFY]. If Interceptor is wedged, that is a deferral, never a license to substitute curl.",
      }),
    );
    process.exit(0);
  }

  // Deploy-shaped assertions are claims in their own right (2026-06-12) — a
  // bare "Deployed to production" previously matched no CLAIM_PATTERN and
  // bypassed the gate entirely.
  const deployMatch = stripNarration(message).match(DEPLOY_CLAIM);
  const claim = findClaim(message) ?? (deployMatch ? deployMatch[0] : null);

  if (!claim) {
    appendObs({
      ts: new Date().toISOString(),
      session_id: sessionId,
      decision: "no-claim",
      detected_claim: null,
      evidence_found: false,
      message_length: message.length,
      stop_hook_active: false,
    });
    process.exit(0);
  }

  const evidenceClasses = countEvidenceClasses(message);
  const isDeployClaim = deployMatch !== null;
  const requiredClasses = isDeployClaim ? 2 : 1;
  const evidence = evidenceClasses >= requiredClasses;

  if (!evidence) {
    // NON-BLOCKING (2026-06-20, {{PRINCIPAL_NAME}} directive). decision:block on a Stop hook
    // re-emits the whole response = the user sees it twice (the API has no
    // "replace"). Verification discipline stays doctrine (LIFEOS_SYSTEM_PROMPT.md
    // § Verification) and remains my responsibility; this gate now records the
    // miss for telemetry instead of forcing a duplicate re-emit.
    appendObs({
      ts: new Date().toISOString(),
      session_id: sessionId,
      decision: "block",
      detected_claim: claim,
      evidence_found: false,
      message_length: message.length,
      stop_hook_active: false,
    });
    process.exit(0);
  }

  appendObs({
    ts: new Date().toISOString(),
    session_id: sessionId,
    decision: "pass",
    detected_claim: claim,
    evidence_found: true,
    message_length: message.length,
    stop_hook_active: false,
  });
  process.exit(0);
}

main().catch((err) => {
  console.error("[SuccessClaimGate] fatal:", err);
  process.exit(0);
});
