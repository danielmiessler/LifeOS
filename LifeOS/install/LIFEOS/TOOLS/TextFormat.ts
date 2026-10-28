/**
 * @version 1.4.2
 * TextFormat.ts — the one place model output is shaped for a text message.
 *
 * Two consumers: AgentJob.ts (scheduled-job deliveries) and the Photon texting
 * bridge (replies to the principal). Both were sending raw model output to
 * iMessage; the 2026-08-31 screenshot showed status prose followed by a bare
 * `[SILENT]` line, and markdown bold/headers rendering as literal asterisks.
 *
 *   isSilent(result)      → true when the run has nothing to say. Exact match,
 *                            empty, OR a standalone [SILENT] line anywhere — the
 *                            model appending a summary above the token is the
 *                            drift that leaked, so the token wins over the prose.
 *   formatForText(result) → plain text for a phone: markdown stripped, banner and
 *                            closer bytes removed, whitespace collapsed.
 *   formatForRichText(result) → (1.3.0) the same scrub, but bold/italic/strike/inline code and
 *                            bullets are KEPT as CommonMark for spectrum-ts markdown(), which the
 *                            iMessage provider renders as styled text. Headers become bold lines,
 *                            tables flatten, code fences drop their fences. Principal, 2026-09-04:
 *                            "use some emojis and basic text decoration… looks like it's coming
 *                            out of an agent, and not just raw text."
 */

const SILENT = "[SILENT]";

import { closerPattern } from "../../hooks/lib/identity";
import { stripVoiceTags } from "./VoiceTags";

/** A line is the silence token when, stripped of markdown emphasis and trailing punctuation, it is [SILENT] in any case —
 *  or starts with it ("[SILENT] — nothing to report"). Astra 2026-09-04: the exact-line check let dressed-up tokens through. */
function isSilentLine(line: string): boolean {
  const l = line.trim().replace(/^[*_`\s]+|[*_`\s.!]+$/g, "");
  return /^\[silent\]$/i.test(l) || /^\[silent\]\s*[—–:-]/i.test(l);
}
export function isSilent(result: string): boolean {
  const t = result.trim();
  if (t === "") return true;
  return t.split("\n").some(isSilentLine);
}

/** True when the result carried prose AND a [SILENT] line — the drift worth logging. */
export function isSilentWithProse(result: string): boolean {
  const t = result.trim();
  return t !== "" && t !== SILENT && isSilent(t);
}

export function formatForText(result: string): string {
  let s = result.replace(/\r\n/g, "\n");
  // Terminal-format bytes that must never reach a phone.
  s = s.replace(/^[═]{3,}.*$/gm, "");
  s = s.replace(new RegExp(`^${closerPattern()}\\s*\\w+:\\s*(.*)$`, "gm"), (_m, said: string) => stripVoiceTags(said)); // voice tags are performed, never texted
  s = s.replace(/^[🤖👾🧠⚙️]\s*[A-Z]{2,}\s*$/gmu, "");
  s = s.replace(/^(🔧 CHANGE|✅ VERIFY|❓ OPEN|⚙️ SYSTEM|🧠 MEMORY|🩺 MEMORY HEALTH|✍️ WRITING-AUDIT|🧭 ALGO-NUDGE|⏫ VERSION-DRIFT):.*$/gm, "");
  s = s.split("\n").filter((l) => !isSilentLine(l)).join("\n");
  // Markdown → plain.
  s = s.replace(/^```[^\n]*\n([\s\S]*?)\n```\s*$/gm, "$1");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  s = s.replace(/__([^_\n]+)__/g, "$1");
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/g, "$1$2");
  s = s.replace(/`([^`\n]+)`/g, "$1");
  s = s.replace(/^[ \t]*(?:-{3,}|\*{3,})[ \t]*$\n?/gm, "");
  s = s.replace(/^[ \t]*[-*][ \t]+/gm, "• ");
  s = s.replace(/^[ \t]*>[ \t]?/gm, "");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)");
  // Tables: drop separator rows, turn pipes into " · ".
  s = s.replace(/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$\n?/gm, "");
  s = s.replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_m, row: string) => row.split("|").map((c) => c.trim()).filter(Boolean).join(" · "));
  // Whitespace.
  s = s.split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/** Shared scrub: terminal-format bytes, hook lines, [SILENT] lines — never reach a phone in either mode. */
function scrubTerminalBytes(result: string): string {
  let s = result.replace(/\r\n/g, "\n");
  s = s.replace(/^[═]{3,}.*$/gm, "");
  s = s.replace(new RegExp(`^${closerPattern()}\\s*\\w+:\\s*(.*)$`, "gm"), (_m, said: string) => stripVoiceTags(said)); // voice tags are performed, never texted
  s = s.replace(/^[🤖👾🧠⚙️]\s*[A-Z]{2,}\s*$/gmu, "");
  s = s.replace(/^(🔧 CHANGE|✅ VERIFY|❓ OPEN|⚙️ SYSTEM|🧠 MEMORY|🩺 MEMORY HEALTH|✍️ WRITING-AUDIT|🧭 ALGO-NUDGE|⏫ VERSION-DRIFT):.*$/gm, "");
  return s.split("\n").filter((l) => !isSilentLine(l)).join("\n");
}

/** Markdown kept where iMessage can render it (bold, italic, strike, inline code, bullets); everything else flattened. */
export function formatForRichText(result: string): string {
  let s = scrubTerminalBytes(result);
  s = s.replace(/^```[^\n]*\n([\s\S]*?)\n```\s*$/gm, "$1");
  s = s.replace(/^#{1,6}\s+(.+)$/gm, (_m, h: string) => `**${h.replace(/\*\*/g, "").trim()}**`);
  s = s.replace(/^[ \t]*(?:-{3,}|\*{3,})[ \t]*$\n?/gm, "");
  s = s.replace(/^[ \t]*[-*][ \t]+/gm, "• ");
  s = s.replace(/^[ \t]*>[ \t]?/gm, "");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)");
  s = s.replace(/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$\n?/gm, "");
  s = s.replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_m, row: string) => row.split("|").map((c) => c.trim()).filter(Boolean).join(" · "));
  s = s.split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// ── The card (1.4.0, 2026-10-03, Relay ISA F13) ──────────────────────────────
// Every text sent to the principal is formatted and carries emojis (2026-10-03).
// Every text that reaches their phone is a short designed card: a lead emoji, a bold title, short lines, the
// link alone on its last line. textCard() is the one renderer; send.ts adds a lead emoji to anything that arrives
// without one and logs the miss. Title and body are caller text and are escaped so a * or _ cannot restyle the card.

/** The ten icons the principal confirmed, then the ones inferred for ratification (down, switch, weather, judge, default). */
export const CARD_EMOJI = {
  critical: "🚨", fire: "🔥", mail: "📬", money: "💸", calendar: "📅", security: "🛡️", scheduler: "⏰", recovered: "✅", news: "📰", workflow: "⚙️",
  down: "🔴", switch: "🔁", weather: "🌺", judge: "🧪", default: "💬",
} as const;
export type CardKind = keyof typeof CARD_EMOJI;
export const DEFAULT_CARD_EMOJI: string = CARD_EMOJI.default;

/** The emoji a text from each origin gets when it arrives without one. Unlisted origins get the default. */
export const ORIGIN_EMOJI: Readonly<Record<string, string>> = {
  vigil: CARD_EMOJI.fire, workflows: CARD_EMOJI.workflow, requested: CARD_EMOJI.default, cloudpager: CARD_EMOJI.down,
  "scheduler-watch": CARD_EMOJI.scheduler, calibrate: CARD_EMOJI.judge, heartbeat: CARD_EMOJI.calendar, "artist-scan": CARD_EMOJI.news,
  "mail-monitor": CARD_EMOJI.mail, "invoice-watch": CARD_EMOJI.money, "morning-brief": CARD_EMOJI.calendar, "lifelog-capture": CARD_EMOJI.calendar,
};
export function originEmoji(origin: string): string { return Object.hasOwn(ORIGIN_EMOJI, origin) ? ORIGIN_EMOJI[origin]! : DEFAULT_CARD_EMOJI; }

const EMOJI_UNIT = String.raw`\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*`;
const LEAD_EMOJI_RE = new RegExp(`^(?:${EMOJI_UNIT})`, "u");
const CARD_HEAD_RE = new RegExp(String.raw`^(?:${EMOJI_UNIT}) \*\*(?:[^*\n\\]|\\.)+\*\*(?:\n|$)`, "u");
/** The emoji a text opens with, or null. */
export function leadEmoji(text: string): string | null { return text.match(LEAD_EMOJI_RE)?.[0] ?? null; }
/** True when the text opens on a card head: an emoji, then the title in bold, alone on its line. */
export function isCard(text: string): boolean { return CARD_HEAD_RE.test(text); }

const URL_SPAN = /https?:\/\/\S+|www\.\S+/gi;
const MD_META = /[\\*_`\[\]~]/g;
const escapeSegment = (t: string): string => t.replace(MD_META, (m) => "\\" + m);
/** Caller text made literal under markdown: * _ ` [ ] ~ and backslash get a backslash, a leading # > - + is escaped, and a URL is left untouched so it stays clickable. */
export function escapeMd(text: string): string {
  let out = "", last = 0;
  for (const m of text.matchAll(URL_SPAN)) { out += escapeSegment(text.slice(last, m.index)) + m[0]; last = m.index! + m[0].length; }
  out += escapeSegment(text.slice(last));
  return out.split("\n").map((l) => l.replace(/^(\s*)([#>+-])(?=\s|#|$)/, (_m, sp: string, c: string) => `${sp}\\${c}`)).join("\n");
}
/** A card's text as plain words: bold markers and escapes removed. What the interruption ledger records. */
export function stripMarkup(text: string): string { return text.replace(/\*\*/g, "").replace(/\\([\\*_`\[\]~#>+-])/g, (_m, c: string) => c); }

/**
 * A meeting-prep brief opens `Prep: <title> at <HH:mm>` in plain words, because Vigil's Route classifies it by that prefix before it is sent.
 * The sender turns that one line into the card head (`📅 **Prep: …**`) and leaves the rest as written. Null when the text is not a prep brief.
 */
export function prepCard(text: string): string | null {
  const m = text.match(/^Prep: ([^\n]+)((?:\n[\s\S]*)?)$/);
  return m ? `${CARD_EMOJI.calendar} **${escapeMd(`Prep: ${m[1]!.trim()}`)}**${m[2]}` : null;
}

export type CardInput = {
  kind: CardKind;
  title: string;
  /** One line per entry, or a string split on newlines. */
  body?: string | string[];
  /** A trailing line kept above the link, such as the 👍/👎 answer line. */
  footer?: string;
  /** The link, alone on the last line as `🔗 <url>`, byte-identical. */
  url?: string | null;
  /** Longest card in characters. Default 400. */
  cap?: number;
};
const oneLineText = (s: string): string => s.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
const cut = (s: string, n: number): string => { const cs = [...s]; return cs.length <= n ? s : cs.slice(0, Math.max(0, n - 1)).join("").trimEnd() + "…"; };

/**
 * `<emoji> **<title>**`, the body one short line each, an optional footer, then `🔗 <url>`, within `cap`. A card over its cap drops
 * whole body lines from the end, then shortens the last remaining line with …, then the title; the link is never touched.
 */
export function textCard(i: CardInput): string {
  const cap = i.cap ?? 400, emoji = CARD_EMOJI[i.kind];
  const footer = i.footer ? escapeMd(oneLineText(i.footer)) : null, link = i.url ? `🔗 ${i.url}` : null;
  let title = oneLineText(i.title) || "Update";
  let body = (Array.isArray(i.body) ? i.body : (i.body ?? "").split("\n")).map(oneLineText).filter(Boolean);
  const render = (t: string, b: string[]): string => [`${emoji} **${escapeMd(t)}**`, ...b.map(escapeMd), footer, link].filter((l): l is string => l !== null).join("\n");
  const fits = (t: string, b: string[]): boolean => render(t, b).length <= cap;
  while (body.length > 1 && !fits(title, body)) body = body.slice(0, -1);
  if (!fits(title, body) && body.length === 1) {
    let n = [...body[0]!].length;
    while (n > 1 && !fits(title, [cut(body[0]!, n)])) n--;
    body = fits(title, [cut(body[0]!, n)]) ? [cut(body[0]!, n)] : [];
  }
  if (!fits(title, body)) { let n = [...title].length; while (n > 1 && !fits(cut(title, n), body)) n--; title = cut(title, n); }
  return render(title, body);
}

// ── Delivery verdict (1.2.0, 2026-09-03) ─────────────────────────────────────
// The [SILENT] contract is prose, and on 2026-09-03 two lifelog-capture ticks
// texted 671- and 1,023-char status essays ("No calendar commitments this
// cycle… state file is verified… queued for retry…") with no token at all.
// A routine tick that took no action has nothing to say, whatever it wrote.
// Two deterministic teeth, applied before any text leaves for a phone:
//   1. status prose — a result matching the no-action vocabulary is silent;
//   2. the cap — a text message over maxChars is not a text message; it is
//      held in the job ledger instead of delivered.
export const DEFAULT_TEXT_CAP = 600;

/** Routine-tick vocabulary. Any hit means the run is reporting on itself, not delivering. */
export const STATUS_PROSE_RE: RegExp = new RegExp([
  String.raw`\bno (?:new |explicit )?(?:calendar[- ])?commitments?\b`,
  String.raw`\bnothing (?:else )?(?:needs|requires) your attention\b`,
  String.raw`\bnothing (?:actionable|to report|new|calendar-worthy)\b`,
  String.raw`\bno action (?:was )?(?:taken|needed|required)\b`,
  String.raw`\bstate file (?:is |was )?(?:verified|updated|saved)\b`,
  String.raw`\bqueued (?:in state )?for (?:a )?(?:clean |automatic )?(?:first-command )?retry\b`,
  String.raw`\bthis (?:cycle|tick)\b`,
  String.raw`\broutine (?:no-op )?check\b`,
  String.raw`\bstill (?:unavailable|shows no account)\b`,
].join("|"), "i");

export type DeliveryVerdict =
  | { deliver: true; text: string }
  | { deliver: false; reason: "silent" | "status-prose" | "over-cap"; text: string };

/** Decide whether a job result may be texted, and what text. */
export function deliveryVerdict(result: string, maxChars: number = DEFAULT_TEXT_CAP): DeliveryVerdict {
  if (isSilent(result)) return { deliver: false, reason: "silent", text: "" };
  // 1.4.0: the delivered text is the rich form (bold and bullets kept) and the cap measures it, markup included.
  const text = formatForRichText(result);
  if (STATUS_PROSE_RE.test(text)) return { deliver: false, reason: "status-prose", text };
  if (text.length > maxChars) return { deliver: false, reason: "over-cap", text };
  return { deliver: true, text };
}
