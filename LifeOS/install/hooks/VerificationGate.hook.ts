#!/usr/bin/env bun
/**
 * @version 1.2.3
 * VerificationGate.hook.ts — task-aware verification gate (Stop).
 *
 * 1.2.0 (2026-10-14): an honest downgrade covers only its own claim
 * (claimTextAfterDowngrades); a publicity probe must be a real repository network query whose answer carries the
 * claimed version; a sub-agent exempts a claim only when its completed result shows that claim's evidence
 * (agentVerifiedClaim); dedupe is bound to the turn; every claim in the reply is judged (classifyClaims). Items 2
 * and 5 of the firing rule below read with those changes.
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
 * T4 code-logic BLOCKS as of 2026-08-17 (adoption of improvement-pass NP3: its
 * log-until-clean corpus came back clean across two passes and T1-T3 blocking
 * demonstrably killed the false-completion class). Kill-switch: VERIFGATE_T4=0.
 * T6 media-modality ("the clip is centered/fixed") is LOG-ONLY (VERIFGATE_T6=0
 * silences it) — added 2026-08-20 from improvement pass #4, observing until its
 * false-positive surface is measured. T7 artifact-created (a `🔧 CHANGE:` line
 * naming a path as New:/created) BLOCKS when the path is absent — a filesystem
 * fact, language-independent, no `acted` gate: the founding incident made four
 * reads, wrote nothing, and reported a counted description of a file that did
 * not exist (public issue #1917, @jlacour-git). Present-but-older-than-the-turn
 * is LOG-ONLY until its corpus proves clean. VERIFGATE_T7=0 silences it. T5 publicity ("X is public/live/released") BLOCKS by default. VERIFGATE_T5=logonly
 * downgrades it to observation, VERIFGATE_T5=off disables it. Shipped armed rather
 * than log-only-first (Max recommended the latter on false-positive cost grounds):
 * The principal asked for teeth the same night the class produced three fabrications,
 * and the FP surface tested clean across 11 negatives — staged/local/private-push
 * phrasing, questions, attributed relays, negations, and bare version statements. T5 is the only
 * type that skips BOTH the act-then-claim precondition and the sub-agent bypass —
 * see the rationale block at its call site.
 *
 * HISTORY, because this header used to lie: from 2026-07-08 to 2026-07-31 it read
 * "T5 factual NEVER blocks" while the type union was T1|T2|T3|T4|null and no T5
 * code path existed. A documented type that was never built, in the header of the
 * gate whose entire thesis is that claims need evidence. It was found only after
 * the gap it described let three fabricated publicity claims through in one
 * session. Do not describe intended behavior here as though it ships.
 * Per-type env kill switches (VERIFGATE_T1=0 …); VERIFGATE_OFF=1 disables all.
 * Fail-OPEN on any internal error — the gate must never be why a Stop breaks. An unreadable transcript is not such
 * an error (2026-10-15, S046/S047): it is unknown evidence, so it clears no claim (see the strict read in run()).
 *
 * TA — ask coverage (the done-check, 2026-10-08). AskPin.hook.ts (maintainer-side, not shipped) pins the explicit
 * asks of the principal's request at prompt time. A reply that claims done (a CHANGE
 * section, no partial-progress wording) BLOCKS when it never mentions a pinned
 * list item, or when an edit this turn broke a language-only constraint ("Java
 * only"). Naming the ask as skipped or open passes. Whether the evidence really
 * fulfils each ask is judgment: DoneCheckJudge.hook.ts (maintainer-side, not shipped) asks Glance in shadow.
 * VERIFGATE_ASKS=0 silences TA.
 *
 * TRIGGER: Stop
 */

import { readHookInput } from "./lib/hook-io";
import {
  parseTurnEvents, turnStartMs,
  hadDeploy, hadCodeEdit, hadFrontendEdit, hadFlowEdit, spawnedAgent,
  probedAfterDeploy, flowExercised, pixelViewed, testPassedAfterEdit, mediaInspected,
  type TxEvent,
} from "./lib/transcript-evidence";
import { programName, shellSteps } from "./lib/shell-commands";
import { pathForms, substituteWord } from "./lib/shell-paths";
import { parseShell } from "./lib/shell-parse";
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from "fs";
import { dirname, isAbsolute, join } from "path";
import { createHash } from "crypto";
import { homedir } from "node:os";
import { closerPattern } from "./lib/identity";
import { getLifeosDir } from "./lib/paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord
import { recordGateRun } from "../LIFEOS/TOOLS/GateReach";
import { bashWrittenPaths, claimsDone, languageViolations, pinDir, readPins, replyKey, unmentionedItems, writePins } from "./lib/ask-pins";

const LIFEOS = getLifeosDir();
const OBS_PATH = join(LIFEOS, "MEMORY", "OBSERVABILITY", "verification-gate.jsonl");
const STATE_PATH = join(LIFEOS, "MEMORY", "STATE", "verification-gate-blocked.json");

// ── Claim units ──────────────────────────────────────────────────────────────
export function splitIntoUnits(text: string): string[] {
  // Split on commas/semicolons too, so each claim in a comma-run summary is
  // judged against its OWN evidence type (FP-B) instead of one compound unit.
  //
  // The lookarounds keep dotted numbers intact: a separator only splits when it
  // is NOT sitting between two digits. A plain `[.!?;,\n]+` split shredded
  // "7.23.2 is public" into ["7", "23", "2 is public"], destroying the version
  // token and leaving a fragment `unitIsClaimable` rejected outright, so the
  // claim vanished before any type could see it. That blind spot hit every type
  // carrying a version, IP, or decimal. Found 2026-07-31 by testing the gate
  // against the exact sentence it was built to catch.
  //
  // A newline is exempt from that protection and ALWAYS splits: no number is
  // written across two lines, so the lookarounds only ever fused unrelated lines
  // — a line ending in a digit followed by a line starting with one became a
  // single unit, which both invented claims spanning two sentences and let a
  // neighbouring line's hedge ("local", "not") suppress a real claim.
  // (ported from public PR #1738, @elhoim)
  //
  // "?" ends a unit but stays on it, so unitIsClaimable's question guard sees it
  // (public issue #2231, @drpaulobernardy). A dash also ends a unit, so "Deployed
  // and live — any questions?" leaves the claim half claimable instead of riding
  // the question exemption. A comma before a tag question does NOT split: ", right?"
  // cut loose would leave its statement judged without the question that softens it.
  return text
    .split(UNIT_SEPARATOR)
    .map((u) => (u ?? "").trim())
    .filter(Boolean);
}

// Tag questions: a statement handed back for confirmation ("..., right?").
const TAG_WORDS =
  String.raw`(?:right|correct|yes|no|ok(?:ay)?|yeah|agreed|is\s+that\s+right|am\s+i\s+right|` +
  String.raw`(?:isn|aren|doesn|don|didn|wasn|weren|won|hasn|haven)'?t\s+(?:it|they|we|you|i))`;
const TAG_QUESTION = new RegExp(String.raw`,\s*${TAG_WORDS}\s*\?[\s"'”’)\]]*$`, "i");
const UNIT_SEPARATOR = new RegExp(
  String.raw`\n+|(?<=\?)|\s[—–-]\s|—|(?:(?<!\d)[.!;,]+|[.!;,]+(?!\d))(?!(?<=,)\s*${TAG_WORDS}\s*\?)`,
  "i",
);
// Conjunctions a real question may open with: "So is it live?", "And did it pass?"
const QUESTION_LEAD_IN = /^\s*(?:(?:and|so|but|or|ok(?:ay)?|also|then|well|quick\s+check)\s+)+/i;

/**
 * A "?" exempts a unit only when the unit is a real question: it opens with an
 * interrogative (after an optional conjunction) or it ends in a tag question.
 * A declarative sentence with "?" glued on ("Deployed and the site is live now?",
 * "The login flow works end to end now?") is still judged. Issue #2231 asked for
 * that form to be exempt, but this gate's adversary is the model itself: a bare
 * exemption on the character let any claim dodge the evidence requirement by
 * ending in "?", while the words still told the reader the work was done.
 */
function isRealQuestion(u: string): boolean {
  return LEADING_INTERROGATIVE.test(u.replace(QUESTION_LEAD_IN, "")) || TAG_QUESTION.test(u);
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

/**
 * The message with each honestly downgraded claim removed. A downgrade used to
 * exempt the whole message, so a disclaimer about one item let every other claim through. Now it covers the
 * sentence it sits in, plus the sentence before when the downgrade has no subject of its own ("Deployed to X.
 * Not yet verified live."). Every other sentence is still judged. Sentences split on terminal punctuation followed
 * by whitespace, so dotted versions ("7.24.2") stay whole.
 */
const SUBJECTLESS_DOWNGRADE =
  /^\s*(?:(?:but|and|so|though)\s+)?(?:not\b|haven'?t\b|pending\b|deferred|verifying\b|verify\s+next|checking\b|probing\b|about\s+to\b|running\s+the\b|next\b|couldn'?t\b|can'?t\b|still\s+(?:need|to)\b)/i;
export function claimTextAfterDowngrades(message: string): string {
  const sentences = stripNoise(message).split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const drop = new Set<number>();
  sentences.forEach((s, i) => {
    if (!HONEST_DOWNGRADE.test(s)) return;
    drop.add(i);
    if (i > 0 && SUBJECTLESS_DOWNGRADE.test(s)) drop.add(i - 1);
  });
  return sentences.filter((_, i) => !drop.has(i)).join("\n");
}

// Per-unit non-claim guards.
const NONCLAIM =
  /\b(not|isn'?t|aren'?t|wasn'?t|weren'?t|doesn'?t|don'?t|didn'?t|won'?t|can'?t|cannot|couldn'?t|no\s+longer|still\s+(not|broken|500|failing)|never|needs?\s+to|should\s+be|would\s+be|make\s+sure|please|let'?s|going\s+to|will\s+be|to\s+be|want|hope|expect|if\s|once\s|when\s|after\s|assuming|would|could\s+you|can\s+you)\b/i;
const LEADING_INTERROGATIVE =
  /^\s*(is|are|does|do|did|can|could|should|would|will|has|have|how|why|what|where|when|which|who|isn'?t|aren'?t)\b/i;
// Imperative/recipe lead ("Run X, then Y works") — an instruction, not a claim.
const LEADING_IMPERATIVE =
  /^\s*(run|do|execute|try|click|open|deploy|add|set|install|go|check|make|use|call|start|restart|edit|write|create|build|test|verify|ensure|remember\s+to)\b/i;
const RECIPE = /\b(then|and\s+then|after\s+that)\b[^.\n]{0,40}\b(works?|is\s+live|verified|passes?)\b/i;
// A quotation counts only when a reporting verb introduces it. The old `\b"…"\b`
// never matched a normal quote; a bare any-quote exemption would let scare quotes
// hide a claim. public issue #2234, @drpaulobernardy
const ATTRIBUTION =
  /\b(you\s+(said|asked|told|mentioned)|per\s+the|according\s+to|the\s+(ticket|PR|docs?|user|issue|spec)\s+(say|says|said|claims?))\b|\b(reads|says|said|shows|titled|called|labell?ed)\s*:?\s*["“]/i;
// Prior-turn / dated narration (kept from the old hook's battle-tested set).
const NARRATION =
  /\b(earlier|already|previously|in\s+(the\s+)?prior\s+turns?|prior\s+turns?|last\s+turn)\b|\b(in|back\s+in|since|during)\s+(19|20)\d\d\b/i;

export function unitIsClaimable(u: string, opts?: { allowNarration?: boolean }): boolean {
  if (u.includes("?") && isRealQuestion(u)) return false;
  if (LEADING_INTERROGATIVE.test(u)) return false;
  if (LEADING_IMPERATIVE.test(u)) return false;
  if (RECIPE.test(u)) return false;
  if (NONCLAIM.test(u)) return false;
  if (ATTRIBUTION.test(u)) return false;
  // NARRATION exists so re-describing an earlier turn's work isn't re-blocked.
  // T5 opts out: for publicity, the narration words ARE the dangerous phrasing.
  // "already published", "shipped earlier" assert public state just as hard as
  // the present tense, and the founding incident's real sentence ended "...doc
  // mismatches ALREADY in it", which this guard suppressed on its own.
  if (!opts?.allowNarration && NARRATION.test(u)) return false;
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
// T6 — media modality (improvement pass #4, 2026-08-20). A claim that a VIDEO or
// AUDIO artifact is right closes on the artifact, never on its transcript. Burned
// 2026-08-18: a reported clip-framing defect was answered by verifying the
// transcript and the defect shipped. LOG-ONLY on arrival — no new blocking
// surface without a clean observation corpus (the T4 precedent).
const T6_MEDIA = /\b(video|clip|reel|short|footage|render|audio|voice[\s-]?over|track|episode|cut)\b/i;
const T6_RIGHT = /\b(centered|centred|framed|in\s+frame|cropped|aligned|synced|in\s+sync|looks?\s+(right|correct|good)|renders?\s+(right|correctly)|fixed|correct(ed)?)\b/i;
// A transcript/caption check is the wrong-modality evidence this type exists to catch.
const T6_TEXT_PROXY = /\b(transcript|caption|subtitle|srt|vtt|word[\s-]?level)\b/i;

const T4_CODE = /\b(tests?\s+(pass|green|passing)|\d+\s*\/\s*\d+\s+(pass|green)|all\s+(green|passing)|verified\s+(with|via)\s+a?\s*(run|test)|it\s+works\b)\b/i;

// ── T5: publicity claims (2026-07-31) ────────────────────────────────────────
// The narrow subclass where "did you check?" is answerable deterministically.
// Origin: three fabrications in one session, the third nested inside the
// correction of the second — "7.23.2 is public right now" (public was 22 feature
// versions behind), then "public is at v7.1.1, last commit 2026-07-29" (that
// commit was local-only, one ahead of origin, never pushed).
//
// Why THIS subclass and not "factual claims" generally: OPERATIONAL_PREFERENCES already
// legislates the vocabulary ("shipped/live/released mean PUBLIC — only after
// CreateRelease"), so the detector enforces an existing contract instead of
// inventing a taxonomy, and the evidence set is one command rather than semantic
// entity-matching. Generic file-content and bare-version detectors were designed
// and CUT: they reintroduce the false-positive death that killed SuccessClaimGate,
// and a version detector would have blocked truth constantly while still missing
// this incident — the number was right, the PUBLICITY was invented.
// A bare semver counts as a release surface ONLY because the publicity predicate
// is required alongside it. "LifeOS is at 7.24.2" has no predicate and never
// fires; "7.24.2 is public" does. Dropping semver from this set was my first
// implementation bug — it made the gate miss the exact sentence it was built for.
const T5_SURFACE = /\b(public\s+repo|public\s+repository|github|the\s+public|docs\s+site|release[ds]?|published|v?\d+\.\d+\.\d+)\b/i;
const T5_PREDICATE = /\b(is|are|'s|was|were|now|already)\s+(public|live|released|shipped|published|out)\b/i;
// Local/staged nouns in the unit ⇒ it's a private-tree statement, not a publicity
// claim. "The payload is staged" and "local is ahead of origin" must never block.
const T5_LOCAL = /\b(local(ly)?|staged?|staging|payload|private\s+repo|~\/\.claude|LIFEOS_RELEASES|candidate|shadow\s+release)\b/i;

// A claim must name a public place, not just use a publicity word (2026-10-15 native-unblock ISC-9). "Both items were
// published at 10:13" (a local file), "is live in TaintGuard 4.1.0" (an internal module) and "out of the release env
// template" blocked turns. A strong place (public repo, GitHub, the public, docs site) takes any predicate; a release
// word or bare version needs a word that only means public, or the version itself said to be out or live.
const T5_PLACE = /\b(public\s+repo|public\s+repository|github|the\s+public|docs\s+site)\b/i;
const T5_PUBLIC_ONLY = /\b(is|are|'s|was|were|now|already)\s+(public|released|shipped|published)\b/i;
const T5_VERSION_OUT = /\bv?\d+\.\d+\.\d+\s+(is|was|'s)\s+(now\s+)?(out|live)\b/i;
export function namesPublicPlace(unit: string): boolean {
  if (T5_PLACE.test(unit)) return true;
  if (!/\b(release[ds]?|v?\d+\.\d+\.\d+)\b/i.test(unit)) return false;
  return T5_PUBLIC_ONLY.test(unit) || T5_VERSION_OUT.test(unit);
}

export type ClaimType = "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | null;

// ── T7: artifact-created (public issue #1917, @jlacour-git) ──────────────────
// Paths on a `New:`-labelled line inside the `🔧 CHANGE:` block. Backticks are
// stripped; a path token preceded by `//` is a URL, not a file; a token ending
// in `.git` is a repo, not a file. Only the block is read — narration elsewhere
// in the message is not a creation claim. Bare `created|wrote|written` used to
// count too, which blocked on "Removed x (created earlier)" and "wrote og.png
// to R2" (2026-09-03 /LI audit, finding 4) — the label is the claim.
const T7_CREATED = /(^|\W)new:/i;
const T7_PATH = /(?:~\/|\.{1,2}\/|\/)?[\w@+-]+(?:\.[\w@+-]+)*(?:\/[\w@.+-]+)+\.[A-Za-z0-9]{1,8}(?![\w/])/g;

export function artifactClaimPaths(message: string): string[] {
  const block = message.match(new RegExp(`🔧\\s*CHANGE:([\\s\\S]*?)(?=\\n\\s*(?:✅\\s*VERIFY|❓\\s*OPEN|⚙️\\s*SYSTEM|🧠\\s*MEMORY|${closerPattern()}):|$)`));
  if (!block) return [];
  const out: string[] = [];
  for (const line of block[1].split("\n")) {
    if (!T7_CREATED.test(line)) continue;
    const clean = line.replace(/`/g, "");
    for (const m of clean.matchAll(T7_PATH)) {
      const idx = m.index ?? 0;
      if (idx >= 2 && clean.slice(idx - 2, idx) === "//") continue; // URL host/path
      if (/\.git$/i.test(m[0])) continue; // repo slug, not a file
      out.push(m[0]);
    }
  }
  return out;
}

function resolveArtifactPath(p: string, cwd: unknown): string | null {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  if (p.startsWith("/")) return p;
  return typeof cwd === "string" && cwd ? join(cwd, p) : null; // bare relative with no cwd: unknowable, skip
}

/** The strongest media-modality claim in the message, or null. Log-only classifier. */
export function classifyMediaClaim(message: string): string | null {
  const units = splitIntoUnits(stripNoise(message)).filter((u) => unitIsClaimable(u));
  for (const u of units) if (T6_MEDIA.test(u) && T6_RIGHT.test(u)) return u;
  return null;
}

/** True when the message leans on a text proxy for a media claim. */
export function usesTextProxy(unit: string): boolean { return T6_TEXT_PROXY.test(unit); }

/**
 * Every unit in the message that asserts something is PUBLIC without hedging, in order (S049, 2026-10-15).
 * Each is judged on its own evidence: a verified first claim no longer hides an unverified later one.
 */
export function publicityClaimUnits(message: string): string[] {
  // Fix round 2 (S048): a URL is one word. The unit splitter breaks at every `.` not between digits, so
  // `https://github.com/trusted/fabric v1.2.3 is public` lost its owner (`com/trusted/fabric v1.2.3 …`) and its claim
  // fell back to "any repository". URLs and host/path words are held out of the split and put back in their unit;
  // trailing sentence punctuation stays outside, where it still ends the unit.
  const held: string[] = [];
  const masked = stripNoise(message).replace(/\b(?:https?:\/\/|(?:[\w-]+\.)+[A-Za-z]{2,}\/)\S*/gi, (m) => {
    const tail = /[.,;:!?)\]]+$/.exec(m)?.[0] ?? "";
    held.push(m.slice(0, m.length - tail.length));
    return `\u0000${held.length - 1}\u0000${tail}`;
  });
  const units = splitIntoUnits(masked)
    .map((u) => u.replace(/\u0000(\d+)\u0000/g, (_, i: string) => held[Number(i)] ?? ""))
    .filter((u) => unitIsClaimable(u, { allowNarration: true }));
  // Final round 2 (tightening only): HEAD's own split of the message is judged too. Holding a URL whole can carry a
  // downgrade word (`staged`, `Candidate`) from before the URL into the unit, which T5_LOCAL then suppresses, while
  // HEAD split at the URL's dots and judged the claim after them. Every unit either reading finds is a claim.
  const legacy = splitIntoUnits(stripNoise(message)).filter((u) => unitIsClaimable(u, { allowNarration: true }));
  const claims = (us: string[]): string[] => us.filter((u) => !T5_LOCAL.test(u) && T5_SURFACE.test(u) && T5_PREDICATE.test(u) && namesPublicPlace(u));
  return [...new Set([...claims(units), ...claims(legacy)])];
}

/** The first claiming unit, or null. Kept for callers that only ask whether the message claims publicity at all. */
export function publicityClaimUnit(message: string): string | null {
  return publicityClaimUnits(message)[0] ?? null;
}

// Evidence for a publicity claim: a probe that actually reached the public
// surface AND came back with an answer. Enumerable by construction — that's what
// makes T5 tractable. Naming the surface is not evidence: a failed `git
// ls-remote`, or any command that merely mentions github.com, used to pass the
// claim (LOSIntegrity 2026-10-13).
/** ls-remote's answer: one `<sha>\t<ref>` line per ref the remote holds. */
const LS_REMOTE_ANSWER = /\b[0-9a-f]{40}\s+(?:refs\/|HEAD\b)/;
/** Output that says the probe did not reach an answer, whatever the exit flag says. */
const PROBE_FAILED =
  /\bfatal:|\berror:|\bcould not (?:resolve|read|connect)|\brepository not found\b|"message"\s*:\s*"(?:Not Found|Bad credentials|Requires authentication)"|\bHTTP\/?[\d.]*\s+[45]\d\d\b/i;

type ProbeEvent = {
  target: string;
  resultText: string;
  kind?: string;
  command?: string;
  isToolError?: boolean;
};

/** One query a command line makes on the public surface. */
export interface PublicQuery {
  /**
   * The `owner/repo` the query answered for, lower-cased: named on the line (`--repo`, an API path, a URL) or read
   * from the checkout the line names (`git -C <dir>`, one `cd <dir>`) through git's own remote resolution (S047/S048
   * fix round 2). Null when neither says; such a query binds only a claim that names no repository.
   */
  repo: string | null;
  /** A `git ls-remote`, whose answer must be ref lines. */
  lsRemote: boolean;
}

/** `owner/repo` lower-cased from its two parts, or null when either is not a plain GitHub name. */
function slugOf(owner: string | undefined, name: string | undefined): string | null {
  if (!owner || !name) return null;
  const repo = name.replace(/\.git$/i, "");
  const plain = (s: string): boolean => /^[\w.-]+$/.test(s) && !/^\.+$/.test(s);
  return plain(owner) && plain(repo) ? `${owner}/${repo}`.toLowerCase() : null;
}

/**
 * The `owner/repo` a GitHub remote address names, lower-cased, or null (S047 fix round 2). The address is parsed,
 * never searched: over https the host must be exactly github.com, www.github.com, raw.githubusercontent.com, or
 * api.github.com with a `/repos/` path, with no user, password or port, so `https://attacker.invalid/https://github.com/o/r`
 * names no repository. The ssh forms git uses for the same host (`git@github.com:o/r.git`, `ssh://git@github.com/o/r`)
 * are read too, because a global `url.<ssh>.insteadOf` turns the https spelling into them.
 */
export function urlRepo(word: string): string | null {
  const scp = /^git@github\.com:([^/\s]+)\/([^/\s]+?)\/?$/i.exec(word);
  if (scp) return slugOf(scp[1], scp[2]);
  let u: URL;
  try { u = new URL(word); } catch { return null; }
  if (u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  const segs = u.pathname.split("/").filter(Boolean);
  if (u.protocol === "ssh:") return host === "github.com" && u.username === "git" && segs.length === 2 ? slugOf(segs[0], segs[1]) : null;
  if (u.protocol !== "https:" || u.username) return null;
  if (host === "github.com" || host === "www.github.com" || host === "raw.githubusercontent.com") return segs[0] === "rate_limit" ? null : slugOf(segs[0], segs[1]);
  if (host === "api.github.com") return segs[0] === "repos" ? slugOf(segs[1], segs[2]) : null;
  return null;
}

/** `owner/repo` from a `-R`/`--repo` value or a positional slug (`gh repo view o/r`), or null. */
function slugRepo(word: string | undefined): string | null {
  if (!word) return null;
  const fromUrl = urlRepo(word);
  if (fromUrl) return fromUrl;
  const m = /^(?:github\.com\/)?([\w.-]+)\/([\w.-]+)$/i.exec(word);
  return m ? slugOf(m[1], m[2]) : null;
}

/** One option a program may be given on a probe line; `value` options take the next word or their attached rest. */
interface Opt { names: string[]; value?: boolean; check?: (v: string) => boolean }

/**
 * An argv tail read against an allowlist of options (S047 fix round 2): its operands and the values given to each
 * option (keyed by the option's first name), or null. Every option must be listed. A short cluster is read letter by
 * letter, and a value letter takes the rest of its word or the next word, so `-q'"v1.2.3"'` and `-wv1.2.3` are an
 * option with a value, as the program reads them. A long option takes `=value` or the next word. An unlisted option,
 * a missing value, or a value its check refuses returns null: an option the guard does not know can never steer
 * where the client connects or what it prints.
 */
function readOptions(args: string[], opts: Opt[], numericCount = false): { operands: string[]; values: Map<string, string[]> } | null {
  const by = new Map<string, Opt>();
  for (const o of opts) for (const n of o.names) by.set(n, o);
  const operands: string[] = [];
  const values = new Map<string, string[]>();
  const take = (o: Opt, v: string | undefined): boolean => {
    if (v === undefined || (o.check && !o.check(v))) return false;
    values.set(o.names[0]!, [...(values.get(o.names[0]!) ?? []), v]);
    return true;
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--") { operands.push(...args.slice(i + 1)); break; }
    if (a === "-" || !a.startsWith("-")) { operands.push(a); continue; }
    if (numericCount && /^-\d+$/.test(a)) continue; // `head -5`
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const o = by.get(eq < 0 ? a : a.slice(0, eq));
      if (!o) return null;
      if (!o.value) { if (eq >= 0) return null; continue; }
      if (!take(o, eq >= 0 ? a.slice(eq + 1) : args[++i])) return null;
      continue;
    }
    for (let j = 1; j < a.length; j++) {
      const o = by.get(`-${a[j]}`);
      if (!o) return null;
      if (!o.value) continue;
      if (!take(o, j + 1 < a.length ? a.slice(j + 1) : args[++i])) return null;
      break;
    }
  }
  return { operands, values };
}

const isInt = (v: string): boolean => /^\d+$/.test(v);
const isNum = (v: string): boolean => /^\d+(?:\.\d+)?$/.test(v);
const bare = (...names: string[]): Opt => ({ names });

/**
 * A jq filter that only selects from the remote's JSON (`.tag_name`, `.[0].tag_name`). A string literal, a
 * variable or `env` lets the filter print text of its own choosing (`--jq '"v1.2.3"'`).
 */
const pureJqPath = (f: string | undefined): boolean =>
  typeof f === "string" && /^[\w.\[\]| ]+$/.test(f) && !/\benv\b|\d\.\d/.test(f);

/** Env names a probe line may set: they change neither where the client connects nor what it prints. */
const NEUTRAL_ENV = /^(?:PAGER|GH_PAGER|GIT_PAGER|NO_COLOR|CLICOLOR|TERM|LANG|LC_[A-Z]+|GH_NO_UPDATE_NOTIFIER|GH_PROMPT_DISABLED|GH_REPO)$/;

// Allowlists (S047 fix round 2). Each names only options that change neither the destination nor the text printed.
// Anything else (a write method, an output template, `-w`, `--resolve`, `-x`, `-o`, `--label`, `-H` on grep) is refused.
// Final round: gh's `--cache` is refused too; a cached answer is not a fresh query of the remote (criterion C7).
const GH_OPTS: Opt[] = [
  { names: ["-R", "--repo"], value: true },
  { names: ["-q", "--jq"], value: true, check: pureJqPath },
  { names: ["--json"], value: true, check: (v) => /^[\w,]+$/.test(v) },
  { names: ["-H", "--header"], value: true },
  { names: ["-L", "--limit"], value: true, check: isInt },
  { names: ["-O", "--order"], value: true, check: (v) => /^(?:asc|desc)$/.test(v) },
  { names: ["--visibility", "--language", "--topic"], value: true, check: (v) => /^[\w.+-]+$/.test(v) },
  bare("-i", "--include", "--paginate", "--slurp", "--silent", "--exclude-drafts", "--exclude-pre-releases", "--source", "--fork", "--archived", "--no-archived"),
];
const LS_REMOTE_OPTS: Opt[] = [
  bare("-t", "--tags"), bare("-h", "--heads"), bare("-b", "--branches"), bare("--refs"), bare("-q", "--quiet"),
  bare("--exit-code"), bare("--symref"), { names: ["--sort"], value: true, check: (v) => /^-?[\w:()*.-]+$/.test(v) },
];
const FETCH_OPTS: Opt[] = [
  bare("-t", "--tags"), bare("-p", "--prune"), bare("-P", "--prune-tags"), bare("-n", "--no-tags"), bare("-v", "--verbose"),
  bare("-q", "--quiet"), bare("-f", "--force"), bare("--dry-run"),
];
const CURL_OPTS: Opt[] = [
  bare("-s", "--silent"), bare("-S", "--show-error"), bare("-L", "--location"), bare("-f", "--fail"), bare("--fail-with-body"),
  bare("-i", "--include"), bare("-I", "--head"), bare("--compressed"), bare("-g", "--globoff"), bare("--http1.1"), bare("--http2"),
  { names: ["-H", "--header"], value: true }, { names: ["-A", "--user-agent"], value: true },
  { names: ["-m", "--max-time"], value: true, check: isNum }, { names: ["--connect-timeout"], value: true, check: isNum },
  { names: ["--retry"], value: true, check: isInt }, { names: ["--retry-delay"], value: true, check: isInt },
  { names: ["--max-redirs"], value: true, check: isInt },
];
const WGET_OPTS: Opt[] = [
  bare("-q", "--quiet"), { names: ["-O", "--output-document"], value: true, check: (v) => v === "-" },
  { names: ["--header"], value: true }, { names: ["-U", "--user-agent"], value: true }, { names: ["-T", "--timeout"], value: true, check: isNum },
];
const HEAD_OPTS: Opt[] = [
  { names: ["-n", "--lines"], value: true, check: (v) => /^[+-]?\d+$/.test(v) },
  { names: ["-c", "--bytes"], value: true, check: (v) => /^[+-]?\d+$/.test(v) },
];
const CONTEXT_OPTS: Opt[] = [
  { names: ["-e", "--regexp"], value: true }, { names: ["-m", "--max-count"], value: true, check: isInt },
  { names: ["-A", "--after-context"], value: true, check: isInt }, { names: ["-B", "--before-context"], value: true, check: isInt },
  { names: ["-C", "--context"], value: true, check: isInt },
];
const GREP_OPTS: Opt[] = [
  ...CONTEXT_OPTS,
  bare("-i", "--ignore-case"), bare("-v", "--invert-match"), bare("-E", "--extended-regexp"), bare("-F", "--fixed-strings"),
  bare("-G", "--basic-regexp"), bare("-o", "--only-matching"), bare("-w", "--word-regexp"), bare("-x", "--line-regexp"),
  bare("-s", "--no-messages"), bare("-q", "--quiet", "--silent"), bare("-a", "--text"), bare("-I"), bare("-h", "--no-filename"),
];
const RG_OPTS: Opt[] = [
  ...CONTEXT_OPTS,
  bare("-i", "--ignore-case"), bare("-v", "--invert-match"), bare("-F", "--fixed-strings"), bare("-o", "--only-matching"),
  bare("-w", "--word-regexp"), bare("-x", "--line-regexp"), bare("-N", "--no-line-number"), bare("-s", "--case-sensitive"),
  bare("-S", "--smart-case"), bare("-I", "--no-filename"), bare("-a", "--text"), bare("-q", "--quiet"), bare("--no-heading"),
];
const JQ_OPTS: Opt[] = [
  bare("-r", "--raw-output"), bare("-c", "--compact-output"), bare("-e", "--exit-status"), bare("-M", "--monochrome-output"),
  bare("-C", "--color-output"), bare("-S", "--sort-keys"), bare("-j", "--join-output"), bare("-a", "--ascii-output"),
  bare("--tab"), { names: ["--indent"], value: true, check: isInt },
];

const gitMemo = new Map<string, string | null>();
/**
 * Read-only git for remote resolution (S047/S048 fix round 2): an argument array and no shell, a short timeout,
 * no prompts, and none of the caller's GIT_* overrides. Its stdout, or null when git fails.
 */
function gitRead(dir: string | null, args: string[]): string | null {
  const key = JSON.stringify([dir, args]);
  if (gitMemo.has(key)) return gitMemo.get(key)!;
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith("GIT_")) env[k] = v;
  env.GIT_TERMINAL_PROMPT = "0";
  let out: string | null = null;
  try {
    const r = spawnSync("git", [...(dir ? ["-C", dir] : []), "--no-pager", ...args], { cwd: dir ?? "/", env, encoding: "utf-8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] });
    out = r.status === 0 && typeof r.stdout === "string" ? r.stdout : null;
  } catch { out = null; }
  gitMemo.set(key, out);
  return out;
}

/**
 * The GitHub repository a git remote argument reaches from `dir`, as git itself resolves it (`ls-remote --get-url`,
 * which applies insteadOf and looks a remote name up in the checkout), or null. A remote name, or no argument, means
 * nothing without a known checkout. A path, a local repository or another host resolves to no GitHub repository.
 */
function remoteRepo(dir: string | null, remote: string | undefined): string | null {
  const isUrl = remote !== undefined && (/:\/\//.test(remote) || /^[\w.-]+@[\w.-]+:/.test(remote));
  if (!isUrl && dir === null) return null;
  const out = gitRead(dir, ["ls-remote", "--get-url", ...(remote !== undefined ? ["--", remote] : [])]);
  const line = out?.split("\n")[0]?.trim() ?? "";
  return line ? urlRepo(line) : null;
}

/** The one GitHub repository a checkout's remotes reach (what `gh` without `--repo` answers for), or null. */
function checkoutRepo(dir: string): string | null {
  const names = gitRead(dir, ["remote"]);
  if (names === null) return null;
  const repos = new Set<string>();
  for (const n of names.split("\n").map((s) => s.trim()).filter(Boolean)) {
    const r = remoteRepo(dir, n);
    if (r) repos.add(r);
  }
  return repos.size === 1 ? [...repos][0]! : null;
}

/**
 * Whether every fetch refspec configured in the checkout maps remote refs onto their usual local names, so the
 * ref names `git fetch` prints are the remote's own: `+refs/heads/*:refs/remotes/<r>/*`, `+refs/tags/*:refs/tags/*`.
 * A refspec such as `+refs/heads/main:refs/tags/v1.2.3` makes fetch print a name the checkout chose.
 */
function standardFetchSpecs(dir: string): boolean {
  const out = gitRead(dir, ["config", "--get-regexp", "^remote\\..*\\.fetch$"]);
  if (out === null) return true; // none configured (git exits 1): fetch prints only what it is asked for
  return out.split("\n").filter(Boolean).every((l) => {
    const spec = l.slice(l.indexOf(" ") + 1).trim();
    return /^\+?refs\/heads\/\*:refs\/remotes\/[\w.-]+\/\*$/.test(spec) || /^\+?refs\/tags\/\*:refs\/tags\/\*$/.test(spec);
  });
}

/** The physical directory `word` names from `base` (null when unknown), when it exists now; else null. */
function knownDir(word: string, base: string | null): string | null {
  const w = substituteWord(word, {});
  if (w === null || (!isAbsolute(w) && base === null)) return null;
  const f = pathForms(w, base ?? "/");
  return f.exists ? f.real : null;
}

/**
 * The query one argv makes on the public surface, "poison" when it is a public client used in a way whose output
 * or destination the line can steer (an option outside the allowlist, another host, a refspec, a remote that does
 * not resolve to GitHub), or null when it is not a query at all. `dir` is the checkout the line runs in, when known.
 */
function queryOf(argv: string[], env: Record<string, string>, dir: string | null): PublicQuery | "poison" | null {
  const prog = programName(argv[0]);
  const args = argv.slice(1);
  if (prog === "gh") {
    const read = readOptions(args, GH_OPTS);
    if (!read) return "poison";
    const pos = read.operands;
    const sub = pos[0];
    if (sub === "api") {
      if (pos.length !== 2) return "poison";
      const m = /^\/?repos\/([^/?#]+)\/([^/?#]+)/.exec(pos[1]!);
      const repo = m ? slugOf(m[1], m[2]) : null;
      return repo ? { repo, lsRemote: false } : null;
    }
    if ((sub === "release" || sub === "repo") && /^(?:view|list)$/.test(pos[1] ?? "")) {
      if (pos.length > 3) return "poison";
      // gh asks the LAST -R/--repo it is given (final round, confirmed against gh); a line naming two leaves the
      // reader to guess which one answered, so it is not evidence for either.
      const repoOpts = read.values.get("-R") ?? [];
      if (repoOpts.length > 1) return "poison";
      const named = repoOpts[0] ?? env.GH_REPO;
      if (named !== undefined) {
        const repo = slugRepo(named);
        return repo ? { repo, lsRemote: false } : "poison";
      }
      if (sub === "repo" && pos[1] === "view" && pos[2] !== undefined) {
        const repo = slugRepo(pos[2]);
        return repo ? { repo, lsRemote: false } : "poison";
      }
      if (sub === "repo" && pos[1] === "list") return { repo: null, lsRemote: false };
      return { repo: dir === null ? null : checkoutRepo(dir), lsRemote: false };
    }
    return null;
  }
  if (prog === "git") {
    // Only -C is read before the subcommand: `-c url.<x>.insteadOf=…`, `--exec-path` or `--git-dir` can send a
    // GitHub URL to a local stand-in.
    let i = 0;
    let gdir = dir;
    for (; i < args.length && args[i]!.startsWith("-"); i++) {
      const a = args[i]!;
      if (a === "-C" && args[i + 1] !== undefined) {
        gdir = knownDir(args[++i]!, gdir);
        if (gdir === null) return "poison"; // a checkout the guard cannot find now cannot be resolved
        continue;
      }
      if (a === "--no-pager" || a === "-P") continue;
      return "poison";
    }
    const sub = args[i] ?? "";
    if (sub !== "ls-remote" && sub !== "fetch") return null; // `git log --format='… https://github.com/…'` reads the checkout
    const read = readOptions(args.slice(i + 1), sub === "ls-remote" ? LS_REMOTE_OPTS : FETCH_OPTS);
    if (!read) return "poison";
    const ops = read.operands;
    if (sub === "fetch") {
      if (ops.length > 1) return "poison"; // a refspec names the local ref fetch reports
      if (gdir === null || !standardFetchSpecs(gdir)) return "poison";
    }
    const repo = remoteRepo(gdir, ops[0]);
    return repo ? { repo, lsRemote: sub === "ls-remote" } : "poison";
  }
  if (prog === "curl" || prog === "wget") {
    const read = readOptions(args, prog === "curl" ? CURL_OPTS : WGET_OPTS);
    if (!read || read.operands.length !== 1) return "poison";
    if (prog === "wget" && read.values.get("-O")?.[0] !== "-") return "poison"; // without -O - it prints its own log
    const repo = urlRepo(read.operands[0]!);
    return repo ? { repo, lsRemote: false } : "poison";
  }
  if (prog === "xh" || prog === "http" || prog === "https") {
    const read = readOptions(args, []);
    const ops = read?.operands ?? [];
    const url = ops.length === 1 ? ops[0] : ops.length === 2 && /^GET$/i.test(ops[0]!) ? ops[1] : undefined;
    const repo = url === undefined ? null : urlRepo(url);
    return read && repo ? { repo, lsRemote: false } : "poison";
  }
  return null;
}

/** A program that only passes its stdin through, cut down: it reads no file and prints no text of its own. */
function inertFilter(argv: string[]): boolean {
  const prog = programName(argv[0]);
  const args = argv.slice(1);
  if (prog === "head" || prog === "tail") return readOptions(args, HEAD_OPTS, true)?.operands.length === 0;
  if (prog === "grep" || prog === "egrep" || prog === "fgrep" || prog === "rg") {
    const read = readOptions(args, prog === "rg" ? RG_OPTS : GREP_OPTS);
    if (!read) return false;
    return read.operands.length <= (read.values.has("-e") ? 0 : 1); // a further operand is a file read
  }
  if (prog === "jq") {
    const read = readOptions(args, JQ_OPTS);
    return read !== null && read.operands.length === 1 && pureJqPath(read.operands[0]);
  }
  return false;
}

/**
 * The one public query a command line makes, when its output can only be that query's answer (S047, 2026-10-15),
 * or null. Read through the shared shell parser: every simple command the line runs must be the query, one `cd`
 * before it, or a filter after it that passes the answer through. Anything else (an echo, a nested shell, a
 * subshell, a branch that may not run, a comment, input fed from a heredoc or file, a write elsewhere, a second
 * query) makes the output something the line could have authored, so it is not evidence. Fix round 2: a comment's
 * text is parsed as commands for the guards that refuse, so a line with one is not evidence; the cd must run in the
 * shell itself (not forked, not after `&&`/`||`), and its directory binds the query only through the checkout git
 * finds there now, never through its name. With one cd and nothing else that can fail before the query, `cd X ||
 * query` runs the query only when cd failed, and then X cannot be read either.
 * Residuals: a working directory the line does not name is unknown (a remote name then binds nothing); a
 * repository-local insteadOf in that unknown directory can redirect an explicit URL; a repository's own hooks can
 * print during `git fetch`; ~/.curlrc is not read.
 */
export function attributableQuery(cmd: string): PublicQuery | null {
  if (queryMemo.has(cmd)) return queryMemo.get(cmd)!;
  const q = computeAttributableQuery(cmd);
  queryMemo.set(cmd, q);
  return q;
}
const queryMemo = new Map<string, PublicQuery | null>();

function computeAttributableQuery(cmd: string): PublicQuery | null {
  let walked: ReturnType<typeof shellSteps>;
  let segs: ReturnType<typeof parseShell>;
  try { walked = shellSteps(cmd); segs = parseShell(cmd); } catch { return null; } // unparseable: nothing counts as evidence
  if (walked.tooDeep || walked.steps.length !== segs.length) return null; // a nested body: not one plain line
  let found: PublicQuery | null = null;
  let dir: string | null = null;
  let cds = 0;
  for (let k = 0; k < walked.steps.length; k++) {
    const step = walked.steps[k]!;
    const seg = segs[k]!;
    if (seg.commented || seg.scope.length) return null;
    if (seg.heredocBodies.length || seg.hereStrings.length || seg.toks.some((t) => t.op === "<" || t.op === "<<")) return null;
    if (step.depth > 0) return null;
    // No wrapper is neutral (final round 2): HEAD never credited a wrapped query (`env X=1 gh …`, `timeout 10 gh …`),
    // and `env -C`/`-S` move or rewrite what runs. Leading `NAME=value` words stay readable through step.env.
    if (step.wrappers.length) return null;
    if (Object.keys(step.env).some((key) => !NEUTRAL_ENV.test(key))) return null;
    if (step.writeTargets.some((t) => t !== "/dev/null")) return null;
    if (step.argv.length === 0) continue; // a neutral bare assignment
    const prog = programName(step.argv[0]);
    if (prog === "cd") {
      if (found || ++cds > 1 || seg.forked || seg.conditional || seg.pipedOut) return null;
      const target = step.argv.slice(1).filter((a) => !/^-[LPe@]+$/.test(a));
      if (target.length > 1 || target[0] === "-") return null; // `cd -` prints a directory
      dir = target.length === 0 ? knownDir("~", null) : knownDir(target[0]!, null);
      continue;
    }
    const q = queryOf(step.argv, step.env, dir);
    if (q === "poison") return null;
    if (q) {
      if (found) return null; // two answers in one output: neither can be told apart
      found = q;
      continue;
    }
    // A filter passes the answer through only when it reads the query's pipe (final round): after `;` or `&&`,
    // `rg v1.2.3` with no file searches the working directory and prints local matches.
    if (found && segs[k - 1]?.pipedOut === true && inertFilter(step.argv)) continue;
    return null;
  }
  return found;
}

/**
 * True when the command line's output is one public repository query's answer (LOSIntegrity
 * S047). Matching the text of the command is not enough: `echo https://github.com/…`,
 * `gh api rate_limit` and a query in a branch that never runs all name the surface without asking it.
 */
export function isRepoNetworkQuery(cmd: string): boolean {
  return legacyRepoNetworkQuery(cmd) && attributableQuery(cmd) !== null; // HEAD's ceiling (final round 2)
}

/** The query an event made, for repository binding. A WebFetch event carries only the host. */
function eventQuery(e: ProbeEvent): PublicQuery | null {
  if (e.kind === "probe" && !e.command) return { repo: null, lsRemote: false };
  return attributableQuery(e.command ?? e.target);
}

/** A repository answer that states non-public visibility: gh's `visibility`/`isPrivate`, the REST API's `private`. */
const NOT_PUBLIC_ANSWER =
  /"visibility"\s*:\s*"(?:private|internal)"|"(?:private|isPrivate)"\s*:\s*true\b|^\s*(?:visibility|isPrivate|private)\s*[:\t ]\s*(?:private|internal|true)\b/im;

// ── HEAD's reading, kept as a ceiling (final round 2, tightening only) ─────────────────────────────────────────
// The parsed reading above only narrows what counts. These are HEAD's predicates verbatim: an event the old gate did
// not credit is never credited now, whatever the argv reader makes of it (a quoted program name, an option before
// the subcommand, a wrapper). Retire them only together with a replay showing the parsed reading alone is no looser.
const LEGACY_LS_REMOTE = /\bgit\s+(?:-C\s+\S+\s+)?ls-remote\b/i;
const LEGACY_PUBLIC_QUERY =
  /\bgit\s+-C\s+\S*LifeOS\b|\bgh\s+(?:api|release|repo|search)\b|\b(?:curl|wget|gh|git|https?|xh)\b[^|;&\n]*github\.com|\bgit\s+fetch\b|\borigin\/main\b/i;
const LEGACY_GH_REPO_URL =
  /\bhttps?:\/\/(?:(?:www\.)?github\.com\/(?!rate_limit\b)[\w.-]+\/[\w.-]+|api\.github\.com\/repos\/[\w.-]+\/[\w.-]+|raw\.githubusercontent\.com\/[\w.-]+\/[\w.-]+)/i;
function legacyRepoNetworkQuery(cmd: string): boolean {
  for (const seg of cmd.split(/\s*(?:;|&&|\|\||\||\n)\s*/)) {
    const words = seg.trim().split(/\s+/).map((w) => w.replace(/^['"]|['"]$/g, ""));
    while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]!)) words.shift();
    const prog = (words[0] ?? "").replace(/^.*\//, "");
    const args = words.slice(1);
    if (prog === "gh") {
      const sub = args[0];
      if (sub === "api") {
        const endpoint = args.slice(1).find((a) => !a.startsWith("-")) ?? "";
        if (/^\/?repos\/[\w.-]+\/[\w.-]+/.test(endpoint)) return true;
        continue;
      }
      if ((sub === "release" || sub === "repo") && /^(?:view|list)$/.test(args[1] ?? "")) return true;
      continue;
    }
    if (prog === "git") {
      if (LEGACY_LS_REMOTE.test(seg) || /^fetch$/.test(args.find((a) => !a.startsWith("-") && !/^~?\//.test(a)) ?? "")) return true;
      if (/\bgit\s+-C\s+\S*LifeOS\b/i.test(seg) || /\borigin\/main\b/.test(seg)) return true;
      if (args.some((a) => LEGACY_GH_REPO_URL.test(a))) return true;
      continue;
    }
    if (/^(?:curl|wget|xh|http|https)$/.test(prog) && args.some((a) => LEGACY_GH_REPO_URL.test(a))) return true;
  }
  return false;
}
/** HEAD's isSuccessfulPublicProbe, minus the result checks the current one makes first. */
function legacyPublicProbe(e: ProbeEvent): boolean {
  if (e.kind === "probe") {
    if (!/(?:^|\.)github(?:usercontent)?\.com$/i.test(e.target.trim())) return false;
    return e.command ? legacyRepoNetworkQuery(e.command) : true;
  }
  const cmd = e.command ?? e.target;
  if (LEGACY_LS_REMOTE.test(cmd)) return LS_REMOTE_ANSWER.test(e.resultText ?? "") && legacyRepoNetworkQuery(cmd);
  return LEGACY_PUBLIC_QUERY.test(cmd) && legacyRepoNetworkQuery(cmd);
}

/** True iff this one event is a public-surface probe that succeeded. */
export function isSuccessfulPublicProbe(e: ProbeEvent): boolean {
  // The raw exit flag, not `isError`: that one also fires on failure words a
  // successful read quotes (release notes, issue bodies).
  if (e.isToolError === true) return false;
  const text = e.resultText ?? "";
  if (HARD_FAIL.test(text) || PROBE_FAILED.test(text)) return false;
  if (text.trim().length === 0) return false;
  // An answer that says the repository is private or internal is the opposite of publicity evidence (final round,
  // S047/S048): gh and git are authenticated, so they answer for private repositories too. Residual: an answer that
  // states no visibility (ls-remote ref lines, `gh release view`) is still credited, so a private repository the
  // session can read clears a claim whose name and version match it. Only a stated private visibility is refused.
  if (NOT_PUBLIC_ANSWER.test(text)) return false;
  if (!legacyPublicProbe(e)) return false; // HEAD's ceiling (final round 2)
  // A curl/wget probe carries its command: the argv must name a repository.
  // WebFetch events carry only the host.
  if (e.kind === "probe" && !/(?:^|\.)github(?:usercontent)?\.com$/i.test(e.target.trim())) return false;
  const q = eventQuery(e);
  if (!q) return false;
  return q.lsRemote ? LS_REMOTE_ANSWER.test(text) : true;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Words that sit between a product name and its version or predicate and never name a repository. */
const CLAIM_FILLER = new Set([
  "v", "version", "versions", "ver", "release", "releases", "released", "tag", "tags", "tagged", "build", "the", "a",
  "an", "and", "or", "both", "now", "is", "are", "was", "were", "has", "have", "been", "be", "also", "then", "so",
  "that", "which", "with", "of", "for", "to", "on", "in", "at", "as", "our", "my", "your", "its", "their", "new",
  "newest", "latest", "current", "this", "these", "stable", "final", "patch", "feature", "major", "minor", "today",
  "yesterday", "finally", "officially", "just", "already", "rc", "candidate", "from", "by", "see", "live", "public",
  "out", "shipped", "published", "cut", "bumped", "here", "there", "it", "we", "i", "you", "they", "repo",
  "repository", "github", "gh", "page", "site", "docs", "everything", "all", "each", "every", "code", "changes", "work",
]);

/** A github.com `owner/repo` written in claim text, lower-cased, or null. */
function claimSlug(word: string): string | null {
  const m = /\bgithub\.com\/([\w.-]+)\/([\w.-]+)/i.exec(word);
  return m ? slugOf(m[1], m[2]) : null;
}

/**
 * The repository a claim names just before a point in it (S048 fix round 2): a github.com `owner/repo`, or the
 * nearest word that is not filler (`Fabric v1.2.3`, `Fabric is public`). A path or another host's URL names a
 * repository by its last segment (`gitlab.com/o/fabric` → fabric), so it binds instead of falling back to "any".
 */
function namedBefore(text: string): { slugs: string[]; name: string | null } {
  const words = text.split(/\s+/).filter(Boolean);
  for (let k = words.length - 1, seen = 0; k >= 0 && seen < 4; k--, seen++) {
    const raw = words[k]!;
    const slug = claimSlug(raw);
    if (slug) return { slugs: [slug], name: null };
    const w = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "").replace(/['’]s$/i, "");
    if (!w || CLAIM_FILLER.has(w.toLowerCase()) || /^v?\d/i.test(w)) continue;
    const last = w.includes("/") ? (w.split("/").filter(Boolean).pop() ?? "") : w;
    const name = last.replace(/\.git$/i, "").toLowerCase();
    return { slugs: [], name: name || null };
  }
  return { slugs: [], name: null };
}

/** One version a claim asserts, and the repository it names for that version. */
export interface VersionClaim {
  version: string;
  /** `owner/repo` the claim spells out for this version (a GitHub URL just before it, or one whose name it gives). */
  slugs: string[];
  /** The product name just before the version (`Fabric v1.2.3`), lower-cased, or null. */
  name: string | null;
}

/**
 * What a publicity claim binds its evidence to (S048/S049, 2026-10-15). Each version carries the repository the
 * claim names for it: a GitHub `owner/repo` (owner and name must both match), or the product word just before it
 * (`Fabric v1.2.3`, `deeds@0.9.9`), whose repository name must match. A version with neither falls back to the
 * unit's GitHub slugs, then to the names of repositories queried this session that the unit mentions. With none
 * of those the version itself is the only binding. `subject` is what the claim names before its predicate
 * (`Deeds is public`), the binding of a claim that carries no version (fix round 2).
 */
export function claimBindings(unit: string, queried: Iterable<string>): { versions: VersionClaim[]; slugs: string[]; names: string[]; subject: { slugs: string[]; name: string | null }; subjects: Array<{ slugs: string[] } | { names: string[] }> } {
  const slugs = [...new Set([...unit.matchAll(/\bgithub\.com\/([\w.-]+)\/([\w.-]+)/gi)].map((m) => slugOf(m[1], m[2])).filter((s): s is string => s !== null))];
  const names = new Set<string>();
  for (const slug of queried) {
    const name = slug.split("/")[1] ?? "";
    if (name.length >= 3 && new RegExp(`(?<![\\w.-])${escapeRe(name)}(?![\\w-])`, "i").test(unit)) names.add(name);
  }
  const versions: VersionClaim[] = [];
  for (const m of unit.matchAll(/\bv?(\d+\.\d+\.\d+)\b/g)) {
    const before = namedBefore(unit.slice(0, m.index ?? 0));
    let vSlugs = before.slugs;
    if (before.name && !vSlugs.length) vSlugs = slugs.filter((s) => s.split("/")[1] === before.name); // `Fabric v1 (github.com/o/fabric)`
    versions.push({ version: m[1]!, slugs: vSlugs, name: before.name });
  }
  const pred = T5_PREDICATE.exec(unit);
  const subject = pred ? namedBefore(unit.slice(0, pred.index)) : { slugs: [], name: null };
  return { versions, slugs, names: [...names], subject, subjects: claimSubjects(unit, slugs) };
}

/**
 * Every repository a unit names as the subject of one of its predicates without a version (S049 final round). Every
 * predicate is read, not only the first, so `Fabric is public on GitHub and Deeds is public on GitHub` and
 * `Fabric v1.2.3 and Deeds are public` each ask for the evidence of both repositories. Each predicate's clause (the text since the
 * previous predicate) is split at its conjunctions; a part that carries a version is bound by that version, and every
 * other part that names something binds it. A bare name narrows to the unit's github.com slugs with that name.
 */
function claimSubjects(unit: string, unitSlugs: string[]): Array<{ slugs: string[] } | { names: string[] }> {
  const out: Array<{ slugs: string[] } | { names: string[] }> = [];
  let from = 0;
  for (const m of unit.matchAll(new RegExp(T5_PREDICATE.source, "gi"))) {
    const clause = unit.slice(from, m.index ?? 0);
    from = (m.index ?? 0) + m[0].length;
    for (const part of clause.split(/[,;&]|\b(?:and|plus|as well as)\b/i)) {
      if (/\bv?\d+\.\d+\.\d+\b/.test(part)) continue;
      const s = namedBefore(`${part} `);
      if (s.slugs.length) { out.push({ slugs: s.slugs }); continue; }
      if (!s.name) continue;
      const narrowed = unitSlugs.filter((x) => x.split("/")[1] === s.name);
      out.push(narrowed.length ? { slugs: narrowed } : { names: [s.name] });
    }
  }
  return out;
}

/** True when the query answered for the repository a claim names (null wants: the claim names none). */
function answersFor(q: PublicQuery, want: { slugs: string[] } | { names: string[] } | null): boolean {
  if (!want) return true;
  if (q.repo === null) return false;
  if ("slugs" in want) return want.slugs.includes(q.repo);
  return want.names.includes(q.repo.split("/")[1]!);
}

/**
 * True iff some event in the window probed the public surface and got an answer. With a claim, every version the
 * claim names must be in the answer of a probe of the repository the claim names for that version
 *: a probe of the repo that shows v7.0.0 does not prove "7.9.9 is public", and a probe
 * of another repository that shows the same version proves nothing about this one. A claim with no version is bound
 * to the repository it names before its predicate (fix round 2): evidence for Fabric does not prove "Deeds is public".
 */
export function publicStateProbed(ev: ProbeEvent[], claimUnit?: string): boolean {
  const answered = ev.filter(isSuccessfulPublicProbe).map((e) => ({ e, q: eventQuery(e)! }));
  if (!claimUnit) return answered.length > 0;
  const queried = new Set<string>();
  for (const e of ev) {
    const q = eventQuery(e);
    if (q?.repo) queried.add(q.repo);
  }
  const { versions, slugs, names, subject, subjects } = claimBindings(claimUnit, queried);
  const unitWant = slugs.length ? { slugs } : names.length ? { names } : null;
  // Every predicate's subject needs its own answer (S049 final round), on top of the bindings below, never instead.
  if (!subjects.every((want) => answered.some(({ q }) => answersFor(q, want)))) return false;
  // HEAD's condition stays (final round 2, tightening only): one answer carries every version the unit names. The
  // per-version repository bindings below narrow it; they never let separate answers add up to the claim.
  const shownRe = (v: string): RegExp => new RegExp(`(?<![\\d.])v?${v.replace(/\./g, "\\.")}(?![\\d.]*\\d)`);
  if (versions.length && !answered.some(({ e }) => versions.every((vc) => shownRe(vc.version).test(e.resultText ?? "")))) return false;
  if (versions.length === 0) {
    const want = subject.slugs.length ? { slugs: subject.slugs } : slugs.length ? { slugs } : subject.name ? { names: [subject.name] } : unitWant;
    return answered.some(({ q }) => answersFor(q, want));
  }
  return versions.every((vc) => {
    const want = vc.slugs.length ? { slugs: vc.slugs } : vc.name ? { names: [vc.name] } : unitWant;
    const shown = new RegExp(`(?<![\\d.])v?${vc.version.replace(/\./g, "\\.")}(?![\\d.]*\\d)`);
    return answered.some(({ e, q }) => answersFor(q, want) && shown.test(e.resultText ?? ""));
  });
}

/** Classify the strongest claim in the message (T2 outranks T1). Returns the
 * type + the matched unit, or null. */
export function classifyClaim(message: string): { type: Exclude<ClaimType, null>; unit: string } | null {
  const units = splitIntoUnits(stripNoise(message)).filter((u) => unitIsClaimable(u));
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

/**
 * Every claim in the message, one entry per (unit, type). classifyClaim picks
 * the single strongest claim, so a verified high-priority claim used to hide an unverified one elsewhere in the
 * reply. Per unit the same precedence holds: a flow claim (T2) is that unit's type; otherwise each of T1, T3 and
 * T4 the unit carries is its own claim.
 */
export function classifyClaims(message: string): { type: Exclude<ClaimType, null>; unit: string }[] {
  const out: { type: Exclude<ClaimType, null>; unit: string }[] = [];
  for (const u of splitIntoUnits(stripNoise(message)).filter((x) => unitIsClaimable(x))) {
    if (T2_FLOW.test(u) && T2_WORKS.test(u) && !T3_VISUAL.test(u)) { out.push({ type: "T2", unit: u }); continue; }
    if (T1_LIVE.test(u) && T1_WEBNOUN.test(u)) out.push({ type: "T1", unit: u });
    if (T3_VISUAL.test(u) && T3_LOOK.test(u)) out.push({ type: "T3", unit: u });
    if (T4_CODE.test(u)) out.push({ type: "T4", unit: u });
  }
  return out;
}

// ── TF: contradicted completion ──────────────────────────────────────────────
// The turn's FINAL tool result is a hard failure (traceback / exit≠0 / not
// found), nothing ran after it, yet the message claims completion. Class
// tool:bash:exit-code-traceback-most-recent-call-last (9 events/7d, deriver
// 2026-07-16): "python3 -c … dies with Traceback, then the turn ends claiming
// success." Deliberately narrow: hard-failure text only — an HTTP 4xx status
// line alone never fires this (negative-control probes are legitimate).
const HARD_FAIL =
  /\btraceback\s*\(most recent call last\)|\bcommand not found\b|\bpermission denied\b|\bno such file or directory\b|\bexit(ed)?(\s+with)?(\s+code)?\s+[1-9]\d*\b|\bsegmentation fault\b|\bpanic:\s/i;
const COMPLETION =
  /\b(done|complete(d)?|finished|fixed|resolved|all\s+set|checks?\s+out|success(ful|fully)?|works?\s+(now|fine|correctly)|good\s+to\s+go|everything('?s)?\s+(fine|working|good))\b/i;
const ACKNOWLEDGES_FAILURE =
  /\b(fail(s|ed|ure|ing)?|error(s|ed)?|traceback|exception|broke|broken|didn'?t\s+(work|run|parse)|couldn'?t|hit\s+a\s+(snag|wall)|blocked)\b/i;

/** Shared core: does the message claim completion while `resultText` carries
 * hard-failure output? Independent of the exit flag — the two callers below
 * gate on `is_error` in opposite directions. */
function completionClaimOverFailingOutput(message: string, resultText: string): string | null {
  if (!HARD_FAIL.test(resultText)) return null;
  const stripped = stripNoise(message);
  if (ACKNOWLEDGES_FAILURE.test(stripped)) return null; // honest about the failure ⇒ not a contradiction
  for (const u of splitIntoUnits(stripped).filter((u) => unitIsClaimable(u))) {
    if (COMPLETION.test(u)) return u;
  }
  return null;
}

/** Returns the claiming unit iff the message asserts completion while the
 * turn's final tool event hard-failed and nothing succeeded after it.
 *
 * The raw `is_error` flag is required alongside the text match. HARD_FAIL alone
 * reads the OUTPUT, so any command that merely quotes failure words fired it —
 * a successful `rg -n "exit 1"` was a contradicted completion. Bash sets
 * `is_error` on every non-zero exit, so the founding class (a traceback then a
 * success claim) is untouched; what no longer fires is a command that printed
 * failure text and still exited 0.
 * (ported from public PR #1738, @elhoim) */
export function contradictedCompletionUnit(message: string, evs: { isToolError: boolean; resultText: string }[]): string | null {
  if (evs.length === 0) return null;
  const last = evs[evs.length - 1]!;
  if (!last.isToolError) return null;
  return completionClaimOverFailingOutput(message, last.resultText);
}

/** The SUPPRESSED companion to contradictedCompletionUnit. Same shape, but for
 * the case the `is_error` requirement deliberately lets through: the final tool
 * event printed hard-failure output yet exited 0 (`cmd || true`, status-swallowing
 * wrappers), then the message claimed completion. Requiring `is_error` fixed a
 * real FP (a passing `rg -n "exit 1"`) but opened this hole; rather than reinstate
 * a text-only BLOCK path (which re-opens that FP), the caller LOGS this to
 * observability so the hole is visible and its real rate is measurable. Never
 * blocks. */
export function suppressedContradictionUnit(message: string, evs: { isToolError: boolean; resultText: string }[]): string | null {
  if (evs.length === 0) return null;
  const last = evs[evs.length - 1]!;
  if (last.isToolError) return null; // that path is contradictedCompletionUnit's
  return completionClaimOverFailingOutput(message, last.resultText);
}

// A terse liveness/works assertion with no flow noun in the unit ("both apps
// live and verified"). Narrow on purpose — it must NOT match an ordinary
// "✅ VERIFY: read the file" description, only an overclaim-shaped assertion.
const GENERIC_FLOW =
  /\b(live\s+and\s+verified|it\s+works\b|works\s+now|works\s+end[\s-]?to[\s-]?end|confirmed\s+working|fully\s+working|sign[\s-]?in\s+works|login\s+works|working\s+(now|end[\s-]?to[\s-]?end)|both\s+(apps\s+)?(live|working|verified))\b/i;
export function genericFlowClaimUnit(message: string): string | null {
  for (const u of splitIntoUnits(stripNoise(message)).filter((u) => unitIsClaimable(u))) {
    if (GENERIC_FLOW.test(u)) return u;
  }
  return null;
}

// ── State + telemetry ────────────────────────────────────────────────────────
/**
 * The dedupe key. `turn` binds T1-T7 and TF blocks to the turn that earned them (LOSIntegrity
 * ): the same claim with no new evidence in a later turn blocks again. An empty turn keeps the
 * session-wide key TA uses, which carries its own pin identity.
 */
function fingerprint(session: string, type: string, unit: string, turn = ""): string {
  const scope = turn ? `${session}|${turn}` : session;
  return createHash("sha256").update(`${scope}|${type}|${unit.toLowerCase().replace(/\s+/g, " ").trim()}`).digest("hex").slice(0, 16);
}
/** The current turn's identity for dedupe; unknown means no dedupe at all, so the obligation is never lost. */
function turnKey(transcriptPath: unknown): string {
  let start: number | null = null;
  try { start = typeof transcriptPath === "string" ? turnStartMs(transcriptPath) : null; } catch { start = null; }
  return start == null ? `unknown-${Date.now()}-${Math.random().toString(36).slice(2)}` : `turn-${start}`;
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
  T1: (u, ev) => `LifeOS: WEB-DEPLOY VERIFICATION GAP. You claimed: "${u}". The transcript shows the deployed thing was never probed after the deploy — ${ev}. Deployed ≠ live. Do ONE, then restate: (a) probe the deployed origin — an Interceptor navigate/screenshot of the live URL, or a curl returning 2xx/3xx — after the deploy; or (b) downgrade honestly ("deployed, not verified live"). This gate reads the transcript's real tool calls, not your wording — rewording won't pass it; verifying or downgrading will.`,
  T2: (u, ev) => `LifeOS: FLOW VERIFICATION GAP. You claimed: "${u}". The transcript shows the flow was never exercised — ${ev}. A render/screenshot proves a page painted; it does NOT prove the flow works (this exact gap shipped a 500ing Apple login). Do ONE, then restate: (a) drive the real flow — navigate + interact (submit/consent) + read the post-action state, or hit the endpoint and show the 2xx/3xx + Set-Cookie/redirect; or (b) downgrade honestly ("deployed, flow NOT exercised", ISC [DEFERRED-VERIFY]). This gate reads the transcript, not your wording — only verifying or downgrading passes it.`,
  T3: (u, ev) => `LifeOS: APPEARANCE VERIFICATION GAP. You claimed: "${u}". The transcript shows no pixel image was captured AND read after the last frontend edit — ${ev}. A DOM read proves an element exists; only a viewed pixel proves it LOOKS right (this shipped the wrong logo 3×). Capture a non-blank image, Read it, then restate — or downgrade ("placed, not pixel-viewed").`,
  T4: (u, ev) => `LifeOS: CODE-CLAIM VERIFICATION GAP. You claimed: "${u}". The transcript shows code was edited this turn but no test/check ran and passed AFTER the last edit — ${ev}. "Tests pass" is a claim about a tool run, not about the code's intent. Run the suite (or the relevant check) and show it green after the final edit, then restate — or downgrade honestly ("edited, not yet re-tested"). This gate reads the transcript's real tool results — rewording won't pass it.`,
};

/** Type-scoped evidence evaluation. Extracted so the sub-agent bypass can compute
 * the same verdict it is about to skip and log the counterfactual (2026-07-31) —
 * previously the branch returned before any evaluation, so the size of the hole
 * was unmeasurable. Pure: reads events, touches no state. */
function evaluateClaim(
  claim: { type: Exclude<ClaimType, null>; unit: string },
  ev: TxEvent[],
): { acted: boolean; verified: boolean; evSummary: string } {
  if (claim.type === "T1") {
    return {
      acted: hadDeploy(ev),
      verified: probedAfterDeploy(ev),
      evSummary: `${ev.filter((e) => e.kind === "deploy").length} deploy(s), 0 post-deploy probe of the origin`,
    };
  }
  if (claim.type === "T2") {
    const caps = ev.filter((e) => e.kind === "interceptor-capture").length;
    const inter = ev.filter((e) => e.kind === "interceptor-interact").length;
    return {
      acted: hadCodeEdit(ev) || hadDeploy(ev),
      verified: flowExercised(ev),
      evSummary: `${caps} render capture(s), ${inter} interaction(s), 0 successful endpoint round-trip after the last change`,
    };
  }
  if (claim.type === "T3") {
    return {
      acted: hadFrontendEdit(ev),
      verified: pixelViewed(ev),
      evSummary: "no capture+Read of a pixel image after the last frontend edit",
    };
  }
  // T4 — blocking since 2026-08-17. T5 never reaches here; it resolves before the bypass.
  return {
    acted: hadCodeEdit(ev),
    verified: testPassedAfterEdit(ev),
    evSummary: "no passing test/check run after the last code edit",
  };
}

/**
 * Type-scoped evidence a completed agent result must show before it stands in for the parent's own
 *. Any Agent/Task event used to exempt every claim in the turn, so one
 * unrelated dispatch immunized the reply.
 */
const AGENT_EVIDENCE: Record<Exclude<ClaimType, null>, RegExp> = {
  T1: /\b(?:HTTP\/?[\d.]*\s+[23]\d\d|status(?:\s+code)?\s*:?\s*[23]\d\d|returned\s+(?:a\s+)?[23]\d\d|screenshot(?:ted)?\s+(?:of\s+)?the\s+live|navigated\s+to)\b/i,
  T2: /\b(?:signed\s+in|logged\s+in|session\s+(?:issued|cookie|created|established)|set-cookie|completed\s+(?:the\s+)?(?:checkout|login|sign[\s-]?in|flow)|verified\s+the\s+flow|flow\s+(?:works|verified|exercised))\b/i,
  T3: /\b(?:screenshot|pixel|captured\s+(?:the\s+)?(?:page|image|frame)|viewed\s+the\s+(?:image|page|render))\b/i,
  T4: /\b(?:\d+\s+pass(?:ed|ing)?\b(?![^\n]*\b[1-9]\d*\s+fail)|tests?\s+pass(?:ed)?|all\s+(?:green|passing))\b/i,
  T5: /$^/,
  T6: /$^/,
};

/**
 * True when an agent that finished AFTER the last mutation of the claimed kind returned, without error, the
 * type's evidence, and names the claim's host or file when the claim names one. Otherwise the parent's own
 * transcript decides.
 */
export function agentVerifiedClaim(claim: { type: Exclude<ClaimType, null>; unit: string }, ev: TxEvent[]): boolean {
  const mutations = ev.filter((e) => e.kind === "edit" || e.kind === "deploy").map((e) => e.seq);
  const after = mutations.length ? Math.max(...mutations) : -1;
  const subjects = [...claim.unit.matchAll(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b|[\w.-]+\.[A-Za-z0-9]{1,8}\b/gi)].map((m) => m[0].toLowerCase())
    .filter((s) => !/^\d+(?:\.\d+)+$/.test(s));
  return ev.some((e) => {
    if (e.kind !== "agent-result" || e.seq <= after || e.isToolError || !e.resultText.trim()) return false;
    if (HARD_FAIL.test(e.resultText)) return false;
    if (!AGENT_EVIDENCE[claim.type].test(e.resultText)) return false;
    const hay = `${e.target}\n${e.resultText}`.toLowerCase();
    return subjects.length === 0 || subjects.some((s) => hay.includes(s));
  });
}

/** A Bash command that only reads: it is not work, so a prose "done" after it is not a done claim. */
const READ_ONLY_COMMAND = /^\s*(?:cd\s+\S+\s*&&\s*)?(?:ls|eza|cat|bat|head|tail|rg|grep|fd|find|wc|pwd|echo|which|git\s+(?:status|log|diff|show|branch))\b[^>]*$/;

/** Asks the judge whether a reply that never names these asks accounts for them anyway. True lifts the block;
 * false or null (judge unavailable) keeps it. Loaded only on a would-be block. */
export type AskVeto = (request: string, reply: string, asks: string[], session: string) => Promise<boolean | null>;
const JUDGE_HOOK = join(import.meta.dir, "DoneCheckJudge.hook.ts"); // the shadow judge is maintainer-side and not shipped
/** No judge file (a public install) is the same as an unavailable judge: null, so the block stands. */
const defaultVeto: AskVeto = async (request, reply, asks, session) => {
  if (!existsSync(JUDGE_HOOK)) return null;
  return ((await import(JUDGE_HOOK)) as { asksAccounted: AskVeto }).asksAccounted(request, reply, asks, session);
};

/** TA — the code-visible half of the done-check. Returns a block, or null. Marks the
 * pins satisfied when a done reply covers them, so a later "y" is not re-checked. Code finds the candidate drops;
 * the judge veto may lift a dropped-ask block (an honest partial in other words, a list that was never asks) but
 * never causes one, and a broken language rule is code-decided with no veto. */
export async function askCoverage(transcriptPath: unknown, message: string, session: string, dir = pinDir(), veto: AskVeto = defaultVeto): Promise<object | null> {
  const pins = readPins(dir, session);
  if (!pins || pins.satisfied || pins.asks.length === 0) return null;
  const edited: string[] = [];
  const created: string[] = [];
  let didWork = false;
  try {
    for (const e of parseTurnEvents(transcriptPath as string)) {
      if (e.isToolError) continue;
      if (e.kind === "edit") { edited.push(e.target); if (e.tool === "Write") created.push(e.target); didWork = true; }
      else if (e.command) {
        const written = bashWrittenPaths(e.command);
        edited.push(...written); created.push(...written);
        if (written.length || !READ_ONLY_COMMAND.test(e.command)) didWork = true;
      }
    }
  } catch { didWork = true; /* no transcript: judge the reply on its words alone */ }
  if (!claimsDone(message, pins.asks, { didWork })) return null;
  const dropped = unmentionedItems(pins.asks, message);
  const broken = languageViolations(pins.asks, edited, created);
  if (!dropped.length && !broken.length) {
    try { writePins(dir, { ...pins, satisfied: true, satisfiedBy: replyKey(message) }); } catch { /* fail open */ }
    obs({ decision: "pass-verified", type: "TA", asks: pins.asks.length });
    return null;
  }
  const unit = [...dropped.map((a) => a.text), ...broken.map((b) => b.ask.text)].join(" | ");
  // One block per turn: the same ask dropped again under a new request, or after a "y", blocks again; only the
  // rewrite (stop_hook_active, handled above) is let through (acceptance rounds 5 and 6, 2026-10-08).
  const fp = fingerprint(session, "TA", `${pins.pinnedAt}|${replyKey(pins.prompt)}|${unit}`);
  if (alreadyBlocked(fp)) { obs({ decision: "pass-dedupe", type: "TA" }); return null; }
  if (!broken.length) {
    let accounted: boolean | null = null;
    try { accounted = await veto(pins.prompt, message, dropped.map((a) => a.text), session); } catch { /* keep the block */ }
    if (accounted === true) { obs({ decision: "pass-vetoed", type: "TA", dropped: dropped.length }); return null; }
  }
  recordBlocked(fp);
  obs({ decision: "block", type: "TA", unit, dropped: dropped.length, broken: broken.length });
  const lines = [
    ...dropped.map((a) => `- never mentioned: "${a.text}"`),
    ...broken.map((b) => `- constraint "${b.ask.text}" broken by edits to ${b.paths.slice(0, 5).join(", ")}`),
  ];
  return {
    decision: "block",
    reason: `LifeOS: DROPPED ASK. The reply reads as done, but the request pinned asks it does not account for:\n${lines.join("\n")}\nFor each one, do it and show the evidence, or name it in the reply as skipped or open with the reason, then restate. Calling partial work done is what this check stops.`,
  };
}

/**
 * Returns a decision object to emit, or null. Pure — no exit, no stdout.
 * TA (ask coverage) is advisory since 2026-10-15 (native-unblock ISC-10): it runs with no judge veto, so the stop
 * path calls no model, and a finding is shown as a non-blocking note only when no other check blocks. Its veto lifted
 * two thirds of its own blocks, so a block from it was more often wrong than right.
 */
export async function run(input: NonNullable<Awaited<ReturnType<typeof readHookInput>>>): Promise<object | null> {
  const message = input.last_assistant_message ?? "";
  let advisory: string | null = null;
  if (process.env.VERIFGATE_OFF !== "1" && input.stop_hook_active !== true && message.trim() && process.env.VERIFGATE_ASKS !== "0") {
    const ta = (await askCoverage(input.transcript_path, message, input.session_id ?? "unknown", pinDir(), async () => null)) as { reason?: string } | null;
    if (ta?.reason) advisory = ta.reason.replace(/^LifeOS: DROPPED ASK\./, "LifeOS (advisory, not blocking): possible dropped ask.");
  }
  const verdict = await runClaims(input);
  if (verdict) return verdict;
  return advisory ? { systemMessage: advisory } : null;
}

async function runClaims(input: NonNullable<Awaited<ReturnType<typeof readHookInput>>>): Promise<object | null> {
  recordGateRun("hook:VerificationGate.hook", { result: "executed" });
  if (process.env.VERIFGATE_OFF === "1") return null;
  if (input.stop_hook_active === true) { obs({ decision: "skip-recovery" }); return { continue: true }; }

  const message = input.last_assistant_message ?? "";
  if (!message.trim()) return null;
  const session = input.session_id ?? "unknown";

  // TA — ask coverage runs in run() as an advisory note (native-unblock ISC-10).

  // Honest downgrades cover their own claim, never the whole message. `claimText` is the
  // message with each downgraded claim removed; everything below judges what is left.
  const claimText = claimTextAfterDowngrades(message);
  if (!claimText.trim()) { obs({ decision: "pass-honest-downgrade" }); return null; }
  if (claimText !== stripNoise(message).split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean).join("\n")) {
    obs({ decision: "partial-honest-downgrade" });
  }
  const turn = turnKey(input.transcript_path);

  // The turn is read strictly (final round, S047 with S046): a missing transcript or a torn line in the current turn
  // is unknown history, not an empty turn. It used to return before T5 ran, and an empty turn reads as "did nothing",
  // which passes every act-then-claim type. Unknown history now clears no claim: T5 still judges its evidence, and
  // T1-T4 claims are treated as acted and unverified. With a transcript reader that has no strict mode the option
  // is ignored and behaviour is as before.
  let ev: TxEvent[] = [];
  let unreadable = false;
  try {
    ev = parseTurnEvents(input.transcript_path as string, { strict: true } as { sessionWindow?: boolean });
  } catch {
    unreadable = true;
    obs({ decision: "transcript-unreadable" });
    // Final round 2: the lenient read HEAD used still feeds TF, which can only block. A failure the readable lines show
    // (`false` → `command not found`, then a torn line) contradicts "Done." as it did in HEAD. Nothing read this
    // way clears a claim: T1-T4 stay acted-and-unverified and T5 falls back to no evidence.
    try { ev = parseTurnEvents(input.transcript_path); } catch { ev = []; }
  }

  // TF — contradicted completion (final tool event hard-failed, message says done).
  // Checked before type classification: the contradiction is more specific than
  // any T1-T4 typing of the same prose. Subagent confounder applies (the agent
  // may hold the recovery evidence); VERIFGATE_TF=0 kills it.
  if (process.env.VERIFGATE_TF !== "0" && !spawnedAgent(ev)) {
    const tfUnit = contradictedCompletionUnit(claimText, ev);
    if (tfUnit) {
      const fp = fingerprint(session, "TF", tfUnit, turn);
      if (!alreadyBlocked(fp)) {
        recordBlocked(fp);
        obs({ decision: "block", type: "TF", unit: tfUnit });
        return {
          decision: "block",
          reason: `LifeOS: CONTRADICTED COMPLETION. You claimed: "${tfUnit}" — but the turn's FINAL tool result is a hard failure (traceback / non-zero exit / not-found) with nothing succeeding after it. Either fix and re-run the failed step and show it passing, or state the failure honestly instead of claiming completion. This gate reads the transcript's real tool results — rewording won't pass it.`,
        };
      }
      obs({ decision: "pass-dedupe", type: "TF" });
    } else {
      // Swallowed-status hole: final event printed hard-failure text but exited 0,
      // so the block above (which requires is_error) can't fire. Log, never block.
      const suppressed = suppressedContradictionUnit(claimText, ev);
      if (suppressed) obs({ decision: "log-suppressed", type: "TF", reason: "hard-fail-text-but-exit-0", unit: suppressed });
    }
  }

  // T7 — artifact-created. A CHANGE line that names a path as new/created is
  // checked against the filesystem: absent → BLOCK (no language, no `acted`
  // gate, no subagent bypass — if a delegate wrote it, it exists). Present but
  // untouched since the turn started → LOG-ONLY until that corpus proves clean.
  // public issue #1917, @jlacour-git
  if (process.env.VERIFGATE_T7 !== "0") {
    const claimed = artifactClaimPaths(message);
    if (claimed.length > 0) {
      const start = turnStartMs(input.transcript_path);
      const missing: string[] = [];
      const stale: string[] = [];
      for (const raw of claimed) {
        const abs = resolveArtifactPath(raw, (input as { cwd?: unknown }).cwd);
        if (!abs) continue;
        if (!existsSync(abs)) { missing.push(raw); continue; }
        if (start != null) { try { if (statSync(abs).mtimeMs < start - 1000) stale.push(raw); } catch { /* unreadable: treat as present */ } }
      }
      if (missing.length > 0) {
        const unit = `New: ${missing.join(", ")}`;
        const fp = fingerprint(session, "T7", unit, turn);
        if (!alreadyBlocked(fp)) {
          recordBlocked(fp);
          obs({ decision: "block", type: "T7", unit, missing });
          return {
            decision: "block",
            reason: `LifeOS: ARTIFACT VERIFICATION GAP. Your CHANGE block names ${missing.length === 1 ? "a file" : "files"} as created — ${missing.join(", ")} — but ${missing.length === 1 ? "it does not exist" : "they do not exist"} on disk. A completion report about a file that was never written is the founding incident of this check. Fix it: write the file and then restate, or state honestly that it was not written. This gate stats the path — rewording won't pass it.`,
          };
        }
        obs({ decision: "pass-dedupe", type: "T7" });
      } else if (stale.length > 0) {
        obs({ decision: "would-block-logonly", type: "T7", unit: `New: ${stale.join(", ")}`, reason: "path exists but predates the turn start; re-run after writing it this turn" });
      } else {
        obs({ decision: "pass-verified", type: "T7", unit: `New: ${claimed.join(", ")}` });
      }
    }
  }

  // T6 — media modality. LOG-ONLY by design on arrival (VERIFGATE_T6=0 silences it):
  // the class is real (a clip-framing defect shipped after the transcript was
  // verified instead of the frame) but its false-positive surface is untested,
  // and T1-T4 all earned their teeth from a clean observation corpus first.
  if (process.env.VERIFGATE_T6 !== "0") {
    const mediaUnit = classifyMediaClaim(claimText);
    if (mediaUnit && !mediaInspected(ev)) {
      obs({
        decision: "would-block-logonly",
        type: "T6",
        unit: mediaUnit,
        textProxy: usesTextProxy(message),
        reason: "media claim with no frame Read and no media probe this turn",
      });
    }
  }

  // T5 — publicity. Checked BEFORE the subagent bypass and WITHOUT act-then-claim,
  // both deliberately (2026-07-31):
  //   * No subagent bypass: there is no "the agent holds the evidence" story here.
  //     The cure is one git command the parent runs in five seconds. The incident
  //     that motivated T5 had TWO audit subagents running, neither of which had
  //     probed the repo either.
  //   * No act-then-claim: the other types require mutation before scrutiny, which
  //     is what killed their false positives. A publicity claim's failure mode is
  //     asserting WITHOUT acting — the failing turn deployed nothing and edited
  //     nothing, so an acted-gate would have passed it even with the bypass closed.
  // The FP surface that act-then-claim would have covered is bought back by
  // session-window evidence (a probe earlier in the session counts). T5 blocks by
  // default (see the header): VERIFGATE_T5=logonly downgrades it to observation,
  // VERIFGATE_T5=off disables it.
  if (process.env.VERIFGATE_T5 !== "off") {
    // Every publicity claim is judged on its own (S049, 2026-10-15); the first unverified one blocks.
    const pubUnits = publicityClaimUnits(claimText);
    let sessionEv: TxEvent[] | null = null;
    for (const pubUnit of pubUnits) {
      if (sessionEv === null) {
        try { sessionEv = parseTurnEvents(input.transcript_path, { sessionWindow: true }); } catch { sessionEv = unreadable ? [] : ev; }
      }
      if (publicStateProbed(sessionEv, pubUnit)) {
        obs({ decision: "pass-verified", type: "T5", unit: pubUnit });
      } else {
        const fp = fingerprint(session, "T5", pubUnit, turn);
        if (alreadyBlocked(fp)) {
          obs({ decision: "pass-dedupe", type: "T5" });
        } else if (process.env.VERIFGATE_T5 === "logonly") {
          obs({ decision: "would-block-logonly", type: "T5", unit: pubUnit });
        } else {
          recordBlocked(fp);
          obs({ decision: "block", type: "T5", unit: pubUnit });
          return {
            decision: "block",
            reason: `LifeOS: UNPROBED PUBLICITY CLAIM. You asserted: "${pubUnit}" — but nothing in this session probed the public surface (no git ls-remote, no gh api/release/repo, no github.com fetch). Public state is not knowable from a local checkout: a local clone can sit ahead of origin with commits that were never pushed, which is exactly how this gate's founding incident happened. The probe must ask the repository the claim names (its owner too, when the claim gives a github.com URL) and its output must be that one query's answer, with no other command on the line printing. Run the probe and cite it, or downgrade the claim ("staged", "pushed private", "local") or attribute it ("Max reports X"). This gate reads the transcript's real tool calls — rewording won't pass it.`,
          };
        }
      }
    }
  }

  // Every claim is judged against its own evidence; the first unverified one blocks.
  let claims = classifyClaims(claimText);
  // Type a terse "live and verified" from what the session actually TOUCHED:
  // auth/flow edits ⇒ it's a flow claim. This is the Apple-miss catch. The same
  // unit typed T1 is judged as the flow claim instead, as before.
  if (!claims.some((c) => c.type === "T2")) {
    const gu = genericFlowClaimUnit(claimText);
    if (gu && hadFlowEdit(ev)) claims = [...claims.filter((c) => !(c.type === "T1" && c.unit === gu)), { type: "T2", unit: gu }];
  }
  if (claims.length === 0) { obs({ decision: "no-claim" }); return null; }

  for (const claim of claims) {
    // Per-type teeth switches: T1-T4 all block unless disabled (VERIFGATE_<T>=0).
    // T4 promoted from log-only 2026-08-17 (NP3 adoption; corpus clean two passes).
    const blockingType = process.env[`VERIFGATE_${claim.type}`] !== "0";
    const { acted, verified, evSummary } = unreadable
      ? { acted: true, verified: false, evSummary: "the transcript of this turn could not be read, so no evidence can be shown" }
      : evaluateClaim(claim, ev);

    if (!acted) { obs({ decision: "pass-no-activity", type: claim.type }); continue; }
    if (verified) { obs({ decision: "pass-verified", type: claim.type }); continue; }

    // Delegation: an agent counts only when its completed result, after the last
    // mutation, shows this claim type's evidence for this claim's subject. Any dispatch used to pass every claim.
    if (!unreadable && spawnedAgent(ev)) {
      if (agentVerifiedClaim(claim, ev)) { obs({ decision: "pass-subagent", type: claim.type, unit: claim.unit }); continue; }
      obs({ decision: "subagent-insufficient", type: claim.type, unit: claim.unit });
    }

    // Evidence absent + acted this turn ⇒ candidate block. Dedupe is per turn.
    const fp = fingerprint(session, claim.type, claim.unit, turn);
    if (alreadyBlocked(fp)) { obs({ decision: "pass-dedupe", type: claim.type }); continue; }

    if (!blockingType) { obs({ decision: "would-block-logonly", type: claim.type, unit: claim.unit }); continue; }

    recordBlocked(fp);
    obs({ decision: "block", type: claim.type, unit: claim.unit, evSummary });
    return { decision: "block", reason: BLOCK_MSGS[claim.type]!(claim.unit, evSummary) };
  }
  return null;
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
