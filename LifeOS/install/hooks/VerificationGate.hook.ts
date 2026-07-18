#!/usr/bin/env bun
/**
 * @version 1.0.1
 * VerificationGate.hook.ts — task-aware verification gate (Stop).
 *
 * Replaces the deregistered SuccessClaimGate. Thesis: THE MESSAGE IS A CLAIM;
 * THE TRANSCRIPT IS THE EVIDENCE. The old hook graded the message's own prose
 * ("interceptor-verified") and died from false positives + missed the class
 * where the prose overclaims (Apple: "live and verified" citing a button-render
 * screenshot while the login callback 500'd). This hook detects claims from the
 * last message but detects EVIDENCE only from the transcript's actual tool calls.
 *
 * Firing rule (Fable + Forge synthesis, 2026-07-08) — BLOCK iff ALL hold; any
 * failure ⇒ PASS (default pass):
 *   1. not a stop-hook recovery pass (loop guard)
 *   2. a verification/behavior claim of a blocking type survives every guard
 *      (negation, question, intent/future, conditional, quote, narration,
 *       honest-downgrade), scanned on message with code/quote/blockquote stripped
 *   3. ACT-THEN-CLAIM: the transcript shows this turn actually did mutating work
 *      of the claimed type (kills the whole narration/status/analysis FP family)
 *   4. type-scoped required evidence is ABSENT/stale in the transcript
 *   5. no confounder: no sub-agent this turn (evidence would be invisible), and
 *      the claim wasn't already blocked once (fingerprint dedupe)
 *
 * Teeth by type: T1 web-deploy / T2 interactive-flow / T3 visual-appearance BLOCK.
 * T4 code-logic is LOG-ONLY until its corpus proves clean. T5 factual NEVER blocks.
 * Per-type env kill switches (VERIFGATE_T1=0 …); VERIFGATE_OFF=1 disables all.
 * Fail-OPEN on any read/parse error — the gate must never be why a Stop breaks.
 *
 * TRIGGER: Stop
 */

import { readHookInput } from "./lib/hook-io";
import {
  parseTurnEvents,
  hadDeploy, hadCodeEdit, hadFrontendEdit, hadFlowEdit, spawnedAgent,
  probedAfterDeploy, flowExercised, pixelViewed, testPassedAfterEdit,
  type TxEvent,
} from "./lib/transcript-evidence";
import { appendFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { createHash } from "crypto";
import { getClaudeDir } from "./lib/paths";

const LIFEOS = process.env.LIFEOS_DIR || join(getClaudeDir(), "LIFEOS");
const OBS_PATH = join(LIFEOS, "MEMORY", "OBSERVABILITY", "verification-gate.jsonl");
const STATE_PATH = join(LIFEOS, "MEMORY", "STATE", "verification-gate-blocked.json");

// ── Claim units ──────────────────────────────────────────────────────────────
export function splitIntoUnits(text: string): string[] {
  // Split on commas/semicolons too, so each claim in a comma-run summary is
  // judged against its OWN evidence type (FP-B) instead of one compound unit.
  return text.split(/[.!?;,\n]+/).map((u) => u.trim()).filter(Boolean);
}

/** Strip fenced code, inline code, and blockquote lines — a spec/example that
 * CONTAINS "the login flow works" is not a claim. */
export function stripNoise(msg: string): string {
  return msg
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/^\s*>.*$/gm, " ");
}

// Whole-message escapes.
const HONEST_DOWNGRADE =
  /\b(DEFERRED[\s-]?VERIFY|not\s+(yet\s+)?(browser[\s-]?|pixel[\s-]?|end[\s-]?to[\s-]?end\s+)?verif\w*|not\s+verified\b|haven'?t\s+(yet\s+)?(browser[\s-]?|actually\s+)?(verif\w*|exercised|tested|looked|driven)|deployed\s+but\s+not\s+\w*\s*verif\w*|flow\s+not\s+exercised|not\s+(yet\s+)?(browser[\s-]?)?tested|pending\s+(browser\s+|live\s+|your\s+)?(verif\w*|tap|test)|your\s+(tap|test)\s+to\s+confirm|verifying\s+(next|now)|verify\s+next|checking\s+now|probing\s+(it\s+)?now|about\s+to\s+(verify|test|check|probe)|running\s+the\s+(check|probe|test|verification)|next[\s:]+verif\w*|couldn'?t\s+(capture|verify|reach)|can'?t\s+(mint|verify|drive))\b/i;

// Per-unit non-claim guards.
const NONCLAIM =
  /\b(not|isn'?t|aren'?t|wasn'?t|weren'?t|doesn'?t|don'?t|didn'?t|won'?t|can'?t|cannot|couldn'?t|no\s+longer|still\s+(not|broken|500|failing)|never|needs?\s+to|should\s+be|would\s+be|make\s+sure|please|let'?s|going\s+to|will\s+be|to\s+be|want|hope|expect|if\s|once\s|when\s|after\s|assuming|would|could\s+you|can\s+you)\b/i;
const LEADING_INTERROGATIVE =
  /^\s*(is|are|does|do|did|can|could|should|would|will|has|have|how|why|what|where|when|which|who|isn'?t|aren'?t)\b/i;
// Imperative/recipe lead ("Run X, then Y works") — an instruction, not a claim.
const LEADING_IMPERATIVE =
  /^\s*(run|do|execute|try|click|open|deploy|add|set|install|go|check|make|use|call|start|restart|edit|write|create|build|test|verify|ensure|remember\s+to)\b/i;
const RECIPE = /\b(then|and\s+then|after\s+that)\b[^.\n]{0,40}\b(works?|is\s+live|verified|passes?)\b/i;
const ATTRIBUTION =
  /\b(you\s+(said|asked|told|mentioned)|per\s+the|according\s+to|the\s+(ticket|PR|docs?|user|issue|spec)\s+(say|says|said|claims?)|"[^"]*")\b/i;
// Prior-turn / dated narration (kept from the old hook's battle-tested set).
const NARRATION =
  /\b(earlier|already|previously|in\s+(the\s+)?prior\s+turns?|prior\s+turns?|last\s+turn)\b|\b(in|back\s+in|since|during)\s+(19|20)\d\d\b/i;

function unitIsClaimable(u: string): boolean {
  if (u.includes("?")) return false;
  if (LEADING_INTERROGATIVE.test(u)) return false;
  if (LEADING_IMPERATIVE.test(u)) return false;
  if (RECIPE.test(u)) return false;
  if (NONCLAIM.test(u)) return false;
  if (ATTRIBUTION.test(u)) return false;
  if (NARRATION.test(u)) return false;
  return true;
}

// Type predicates (in one claimable unit).
const T1_LIVE = /\b((is|it'?s|site'?s|page'?s|now)\s+live|went\s+live|live\s+(at|on)|deployed\s+(to|at|and\s+(live|working))|deploy\s+(is\s+)?(complete|done|succeeded))\b/i;
const T1_WEBNOUN = /\b(site|page|web\s*site|url|domain|https?:\/\/|worker|deploy(ment|ed)?|production|prod\b|admin|dashboard)\b/i;
// No "callback"/"end-to-end" — both are heavily overloaded in TS/JS and stole
// non-flow "it works" claims into T2 (FP-C).
const T2_FLOW = /\b(log[\s-]?in|sign[\s-]?in|sign[\s-]?up|auth(entication|orization)?|oauth|sso|checkout|payment|purchase|the\s+(login|sign[\s-]?in|auth|checkout)\s+flow)\b/i;
const T2_WORKS = /\b(works?(\s+(now|end[\s-]?to[\s-]?end|fine|correctly|great))?|working|functional|verified(\s+working)?|confirmed\s+working|succeeds?|can\s+(now\s+)?(log|sign)\s+in|completes?|goes?\s+through)\b/i;
const T3_VISUAL = /\b(logo|image|icon|favicon|thumbnail|hero|banner|button|layout|header|footer|nav(bar)?|wordmark|graphic|background|colou?r)\b/i;
const T3_LOOK = /\b(renders?|rendered|displays?|displayed|looks?\s+(right|correct|good|great|fine)|is\s+(now\s+)?(centered|centred|aligned|transparent|visible|positioned|the\s+(right|correct)\s+colou?r))\b/i;
const T4_CODE = /\b(tests?\s+(pass|green|passing)|\d+\s*\/\s*\d+\s+(pass|green)|all\s+(green|passing)|verified\s+(with|via)\s+a?\s*(run|test)|it\s+works\b)\b/i;

export type ClaimType = "T1" | "T2" | "T3" | "T4" | null;

/** Classify the strongest claim in the message (T2 outranks T1). Returns the
 * type + the matched unit, or null. */
export function classifyClaim(message: string): { type: Exclude<ClaimType, null>; unit: string } | null {
  const units = splitIntoUnits(stripNoise(message)).filter(unitIsClaimable);
  let t1: string | null = null, t3: string | null = null, t4: string | null = null;
  for (const u of units) {
    // Visual noun in the unit ⇒ it's a look/styling claim, not a flow claim —
    // let T3 handle it; don't let T2 steal "the sign-in button works" (FP-C).
    if (T2_FLOW.test(u) && T2_WORKS.test(u) && !T3_VISUAL.test(u)) return { type: "T2", unit: u };
    if (!t1 && T1_LIVE.test(u) && T1_WEBNOUN.test(u)) t1 = u;
    if (!t3 && T3_VISUAL.test(u) && T3_LOOK.test(u)) t3 = u;
    if (!t4 && T4_CODE.test(u)) t4 = u;
  }
  if (t1) return { type: "T1", unit: t1 };
  if (t3) return { type: "T3", unit: t3 };
  if (t4) return { type: "T4", unit: t4 };
  return null;
}

// A terse liveness/works assertion with no flow noun in the unit ("both apps
// live and verified"). Narrow on purpose — it must NOT match an ordinary
// "✅ VERIFY: read the file" description, only an overclaim-shaped assertion.
const GENERIC_FLOW =
  /\b(live\s+and\s+verified|it\s+works\b|works\s+now|works\s+end[\s-]?to[\s-]?end|confirmed\s+working|fully\s+working|sign[\s-]?in\s+works|login\s+works|working\s+(now|end[\s-]?to[\s-]?end)|both\s+(apps\s+)?(live|working|verified))\b/i;
export function genericFlowClaimUnit(message: string): string | null {
  for (const u of splitIntoUnits(stripNoise(message)).filter(unitIsClaimable)) {
    if (GENERIC_FLOW.test(u)) return u;
  }
  return null;
}

// ── State + telemetry ────────────────────────────────────────────────────────
function fingerprint(session: string, type: string, unit: string): string {
  return createHash("sha256").update(`${session}|${type}|${unit.toLowerCase().replace(/\s+/g, " ").trim()}`).digest("hex").slice(0, 16);
}
function alreadyBlocked(fp: string): boolean {
  try {
    if (!existsSync(STATE_PATH)) return false;
    const arr = JSON.parse(readFileSync(STATE_PATH, "utf-8")) as string[];
    return arr.includes(fp);
  } catch { return false; }
}
function recordBlocked(fp: string): void {
  try {
    mkdirSync(dirname(STATE_PATH), { recursive: true });
    let arr: string[] = [];
    if (existsSync(STATE_PATH)) { try { arr = JSON.parse(readFileSync(STATE_PATH, "utf-8")); } catch {} }
    arr.push(fp);
    if (arr.length > 400) arr = arr.slice(-400);
    writeFileSync(STATE_PATH, JSON.stringify(arr));
  } catch {}
}
function obs(rec: Record<string, unknown>): void {
  try { mkdirSync(dirname(OBS_PATH), { recursive: true }); appendFileSync(OBS_PATH, JSON.stringify({ ts: new Date().toISOString(), ...rec }) + "\n"); } catch {}
}

const BLOCK_MSGS: Record<string, (unit: string, ev: string) => string> = {
  T1: (u, ev) => `WEB-DEPLOY VERIFICATION GAP [VerificationGate/T1]. You claimed: "${u}". The transcript shows the deployed thing was never probed after the deploy — ${ev}. Deployed ≠ live. Do ONE, then restate: (a) probe the deployed origin — an Interceptor navigate/screenshot of the live URL, or a curl returning 2xx/3xx — after the deploy; or (b) downgrade honestly ("deployed, not verified live"). This gate reads the transcript's real tool calls, not your wording — rewording won't pass it; verifying or downgrading will.`,
  T2: (u, ev) => `FLOW VERIFICATION GAP [VerificationGate/T2]. You claimed: "${u}". The transcript shows the flow was never exercised — ${ev}. A render/screenshot proves a page painted; it does NOT prove the flow works (this exact gap shipped a 500ing Apple login). Do ONE, then restate: (a) drive the real flow — navigate + interact (submit/consent) + read the post-action state, or hit the endpoint and show the 2xx/3xx + Set-Cookie/redirect; or (b) downgrade honestly ("deployed, flow NOT exercised", ISC [DEFERRED-VERIFY]). This gate reads the transcript, not your wording — only verifying or downgrading passes it.`,
  T3: (u, ev) => `APPEARANCE VERIFICATION GAP [VerificationGate/T3]. You claimed: "${u}". The transcript shows no pixel image was captured AND read after the last frontend edit — ${ev}. A DOM read proves an element exists; only a viewed pixel proves it LOOKS right (this shipped the wrong logo 3×). Capture a non-blank image, Read it, then restate — or downgrade ("placed, not pixel-viewed").`,
};

/** Returns a decision object to emit, or null. Pure — no exit, no stdout. */
export async function run(input: NonNullable<Awaited<ReturnType<typeof readHookInput>>>): Promise<object | null> {
  if (process.env.VERIFGATE_OFF === "1") return null;
  if (input.stop_hook_active === true) { obs({ decision: "skip-recovery" }); return { continue: true }; }

  const message = input.last_assistant_message ?? "";
  if (!message.trim()) return null;
  const session = input.session_id ?? "unknown";

  // Whole-message honest-downgrade escape.
  if (HONEST_DOWNGRADE.test(stripNoise(message))) { obs({ decision: "pass-honest-downgrade" }); return null; }

  let ev: TxEvent[] = [];
  try { ev = parseTurnEvents(input.transcript_path); } catch { obs({ decision: "pass-transcript-error" }); return null; }

  let claim = classifyClaim(message);
  // Type a terse "live and verified" from what the session actually TOUCHED:
  // auth/flow edits ⇒ it's a flow claim. This is the Apple-miss catch.
  if (!claim || claim.type === "T1") {
    const gu = genericFlowClaimUnit(message);
    if (gu && hadFlowEdit(ev)) claim = { type: "T2", unit: gu };
  }
  if (!claim) { obs({ decision: "no-claim" }); return null; }

  // Per-type teeth switches: T4 log-only by default; T1-T3 block unless disabled.
  const blockingType = claim.type !== "T4" && process.env[`VERIFGATE_${claim.type}`] !== "0";

  // Confounder: a sub-agent this turn may hold the evidence in its own context.
  if (spawnedAgent(ev)) { obs({ decision: "pass-subagent", type: claim.type }); return null; }

  // ACT-THEN-CLAIM + type-scoped evidence.
  let acted = false, verified = false, evSummary = "";
  if (claim.type === "T1") {
    acted = hadDeploy(ev);
    verified = probedAfterDeploy(ev);
    evSummary = `${ev.filter((e) => e.kind === "deploy").length} deploy(s), 0 post-deploy probe of the origin`;
  } else if (claim.type === "T2") {
    acted = hadCodeEdit(ev) || hadDeploy(ev);
    verified = flowExercised(ev);
    const caps = ev.filter((e) => e.kind === "interceptor-capture").length;
    const inter = ev.filter((e) => e.kind === "interceptor-interact").length;
    evSummary = `${caps} render capture(s), ${inter} interaction(s), 0 successful endpoint round-trip after the last change`;
  } else if (claim.type === "T3") {
    acted = hadFrontendEdit(ev);
    verified = pixelViewed(ev);
    evSummary = `no capture+Read of a pixel image after the last frontend edit`;
  } else { // T4 — log-only
    acted = hadCodeEdit(ev);
    verified = testPassedAfterEdit(ev);
  }

  if (!acted) { obs({ decision: "pass-no-activity", type: claim.type }); return null; }
  if (verified) { obs({ decision: "pass-verified", type: claim.type }); return null; }

  // Evidence absent + acted this turn ⇒ candidate block.
  const fp = fingerprint(session, claim.type, claim.unit);
  if (alreadyBlocked(fp)) { obs({ decision: "pass-dedupe", type: claim.type }); return null; }

  if (!blockingType) { obs({ decision: "would-block-logonly", type: claim.type, unit: claim.unit }); return null; }

  recordBlocked(fp);
  obs({ decision: "block", type: claim.type, unit: claim.unit, evSummary });
  return { decision: "block", reason: BLOCK_MSGS[claim.type]!(claim.unit, evSummary) };
}

if (import.meta.main) {
  (async () => {
    const input = await readHookInput();
    if (input) {
      const d = await run(input);
      if (d) console.log(JSON.stringify(d));
    }
    process.exit(0);
  })().catch((err) => { console.error("[VerificationGate] fatal:", err); process.exit(0); });
}
