/**
 * Depth.ts — the one matcher for the principal's depth and intelligence directives, and the
 * thinking-skill roster the Algorithm's Route step binds to at MAX.
 *
 * Consumers: LIFEOS/ROUTER/FrontDoor.ts (a directive binds the turn to the max rung, source=directive)
 * and hooks/AlgorithmNudge.hook.ts (the depth nudge row). One list, so the router and the nudge
 * can never disagree about what "think deeply" means (Algorithm route ISA ISC-2, 2026-09-19).
 *
 * Origin (principal directive, 2026-09-19): words that ask for depth or intelligence mean the max
 * model and the thinking skills. "deeply analyze" and "think deeper" were not in the old list.
 */

const regexCache = new Map<string, RegExp | null>();

/** Word-boundary test that survives non-ASCII text. JS `\b` is ASCII-only, so a phrase or prompt
 *  carrying accents, umlauts, CJK, or Cyrillic either never matched or matched mid-word.
 *  Metacharacters are escaped; a malformed phrase yields null. (public issue #1787, @xmasyx —
 *  extended to the depth matcher in public issue #1865, @jlacour-git.) */
export function boundedPhraseRe(phrase: string): RegExp | null {
  const cached = regexCache.get(phrase);
  if (cached !== undefined) return cached;
  let result: RegExp | null = null;
  try {
    const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = new RegExp(`(?<![\\p{L}\\p{N}_])${esc}(?![\\p{L}\\p{N}_])`, "u");
  } catch { /* invalid regex */ }
  regexCache.set(phrase, result);
  return result;
}

/** Plain-language depth directives. A false positive costs one held turn that a stated
 *  `🔀 INLINE:` reason clears; a miss costs the principal a shallow answer he asked to avoid. */
export const DEPTH_PHRASES = [
  "think deeply", "think hard", "think harder", "think deeper", "go deep", "go heavy",
  "be thorough", "ultrathink", "dig deep",
  // Live miss, 2026-07-16: "go do a thorough analysis … thoroughly analyze this claim".
  "thorough analysis", "thoroughly analyze", "thoroughly analyse", "thoroughly explore",
  "deep analysis", "deep dive", "deeply look", "deeply analyze", "deeply analyse", "analyze deeply", "analyse deeply",
  // Live miss, 2026-09-19: "Maximum effort." and "high effort" sent no signal.
  "maximum effort", "max effort", "high effort", "maximum intelligence", "max intelligence",
  // German, production-tested by the reporter (public issue #1865, @jlacour-git).
  "denk gründlich", "denke gründlich", "gründlich nachdenken", "gründliche analyse",
  "gründlich analysieren", "geh in die tiefe", "sei gründlich", "tiefenanalyse",
  "volles programm",
  // Portuguese, production-tested on a Portuguese-speaking install (public issue #2530, @drpaulobernardy).
  "pense bem", "pensa bem", "pense a fundo", "a fundo", "aprofunde", "aprofundado",
  "aprofundada", "análise profunda", "análise minuciosa", "análise completa",
  "seja minucioso", "minucioso", "minuciosa", "esmiúce", "esmiuce", "detalhado",
  "detalhada", "de forma detalhada", "exaustivo", "exaustiva", "relatório completo",
  "levantamento completo", "tudo o que você sabe", "tudo que você sabe",
  "não economize", "se estenda", "pode se estender",
];

/** Separated verb→adverb forms ("think through it deeply"), bounded to one sentence. */
export const DEPTH_PATTERNS = [
  /\bthink(?:ing)?\b[^.!?\n]{0,60}\bdeeply\b/,
  /\bdeeply\b[^.!?\n]{0,40}\bthink(?:ing)?\b/,
];

const DEPTH_MAX_PROMPT = 1500; // past this, only the head/tail windows are scanned

/** Strip fenced spans so a paste's fence never silences a directive OUTSIDE it, and a directive
 *  INSIDE a fence never fires. An unclosed fence drops the remainder (the conservative side). */
export function stripFences(prompt: string): string {
  return prompt.replace(/```[\s\S]*?(```|$)/g, " ").replace(/~~~[\s\S]*?(~~~|$)/g, " ");
}

/** Quoted spans ("…", “…”, `…`) are mentions, not instructions (Astra audit 2026-09-19, finding 5). Bounded to one line. */
export function stripQuotes(prompt: string): string {
  return prompt.replace(/"[^"\n]{0,200}"|“[^”\n]{0,200}”|`[^`\n]{0,200}`/g, " ");
}

/** An imperative negation just before the phrase turns it off: "don't think deeply", "no need to go deep", "without a deep dive". */
// Imperative negation only. "You did not think deeply enough" is a complaint that should bind, so a bare
// "not"/"never" does not negate.
const NEGATION_RE = /(?:\bdon['’]?t|\bdo not|\bno need to|\bwithout|\bskip the)\s+(?:\w+\s+){0,2}$/;
function negated(text: string, index: number): boolean {
  return NEGATION_RE.test(text.slice(Math.max(0, index - 30), index));
}

/** Returns the matched phrase or null. Directives live in the ask, which sits at the head or
 *  tail of a long prompt, so a long prompt scans only those windows. Pure. */
export function matchDepthDirective(prompt: string): string | null {
  // Pasted content is NOT excluded: the principal dictates, so his own prompts arrive wrapped as pastes.
  const stripped = stripQuotes(stripFences(prompt));
  const p = (stripped.length > DEPTH_MAX_PROMPT
    ? stripped.slice(0, 300) + "\n" + stripped.slice(-400)
    : stripped).toLowerCase();
  for (const phrase of DEPTH_PHRASES) {
    const re = boundedPhraseRe(phrase);
    const m = re ? re.exec(p) : null;
    if (m && !negated(p, m.index)) return phrase;
  }
  for (const re of DEPTH_PATTERNS) {
    const m = p.match(re);
    if (m && m.index !== undefined && !negated(p, m.index)) return m[0];
  }
  return null;
}

/** The named thinking skills (Algorithm § Spend: the class that carries a default). The Route
 *  step names the ones that fit a MAX turn. DepthGate was retired 2026-09-21. */
export const THINKING_SKILLS = [
  "FirstPrinciples", "SystemsThinking", "IterativeDepth", "ApertureOscillation",
  "RedTeam", "Council", "RootCauseAnalysis", "BeCreative", "Science",
] as const;
export type ThinkingSkill = (typeof THINKING_SKILLS)[number];

/** Each thinking skill's shape in a few words. The Opus classifier's prompt and the engine's thinking
 *  choice (LIFEOS/ROUTER/ThinkingCollect.ts, the offline collector) both read this one map. */
export const THINKING_SHAPES: Record<ThinkingSkill, string> = {
  FirstPrinciples: "constraint teardown", SystemsThinking: "structure and feedback loops",
  IterativeDepth: "multi-lens passes", ApertureOscillation: "scope tension", RedTeam: "adversarial attack",
  Council: "debate between options", RootCauseAnalysis: "incidents", BeCreative: "divergent ideas",
  Science: "competing explanations and the evidence that tells them apart (measured experiments go to HillClimb)",
};

/** Used when the classifier names none: take the problem apart, then see its structure. */
export const DEFAULT_THINKING: ThinkingSkill[] = ["FirstPrinciples", "SystemsThinking"];

export function validThinking(value: unknown): ThinkingSkill[] {
  if (!Array.isArray(value)) return [];
  const out: ThinkingSkill[] = [];
  for (const v of value) if ((THINKING_SKILLS as readonly string[]).includes(v) && !out.includes(v as ThinkingSkill)) out.push(v as ThinkingSkill);
  return out.slice(0, 3);
}
