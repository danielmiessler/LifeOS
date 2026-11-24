/** Vigil event schema and dependency-free validation. @version 0.3.0 */
export const KINDS = ["health", "security", "money", "customer", "news", "life", "ai", "infra", "notification", "other"] as const;
export const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export const PRIVACY_CLASSES = ["public", "personal", "customer"] as const;
export type StateInput = { read: boolean; age_minutes: number | null };
export type VigilEvent = {
  id: string; source: string; ts: string; kind: typeof KINDS[number]; severity: typeof SEVERITIES[number];
  title: string; summary: string; ref: string | null; url: string | null;
  privacy_class: typeof PRIVACY_CLASSES[number]; dedup_key: string;
  meta?: Record<string, string | number | boolean | null | Record<string, StateInput>>;
};

const SECRET_RES = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i,
  /\b(?:sk|pk|ghp|glpat|csk)-[A-Za-z0-9_-]{16,}/i,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  /\b[a-f0-9]{40,}\b/i,
  /\b[A-Za-z0-9+/=_-]{48,}\b/,
];
/** The generic long-run pattern above. A url path is judged segment by segment instead, because a news slug is a long run of words. */
const LONG_RUN = SECRET_RES[SECRET_RES.length - 1]!;
/** A readable path segment: short words joined by - _ . ~ +. A token is one long unbroken or mixed run, so it never matches. */
const SLUG_SEGMENT = /^[A-Za-z0-9%]{1,24}(?:[-_.~+]+[A-Za-z0-9%]{1,24})*[-_.~+]*$/;
const CREDENTIAL = "Credential-shaped string refused";

/**
 * Why a piece of text is refused as credential-shaped, or null. The same patterns validateEvent applies; STATVS refuses
 * with it before an append. With `slugs: true` (STATVS, which stores session slugs and ISA paths) the generic long run is
 * judged the way urlRefusal judges a path: each `/`-separated part of a long run must be slug-shaped, or be under 32
 * characters. A content-addressed filename (`maskContentAddresses`) is masked first. Every other pattern applies
 * unchanged. The default keeps Vigil's behaviour exactly.
 */
export function credentialRefusal(text: string, opts: { slugs?: boolean } = {}): string | null {
  if (!opts.slugs) return SECRET_RES.some((re) => re.test(text)) ? CREDENTIAL : null;
  text = maskContentAddresses(text);
  if (SECRET_RES.some((re) => re !== LONG_RUN && re.test(text))) return CREDENTIAL;
  for (const m of text.matchAll(new RegExp(LONG_RUN.source, "g"))) {
    for (const part of m[0].split("/")) {
      if (part.length >= 32 && !SLUG_SEGMENT.test(part)) return CREDENTIAL;
    }
  }
  return null;
}

/**
 * A content-addressed filename in a path: `/<40 or 64 lowercase hex>.<one 1–8 char ASCII extension>`, ending its
 * segment (Calibrate saves artifacts as `artifacts/<sha256><ext>`). No double extension, no other length, no URL.
 */
const CONTENT_ADDRESS = /(?<=\/)(?:[a-f0-9]{64}|[a-f0-9]{40})\.[A-Za-z0-9]{1,8}(?![A-Za-z0-9._~+%?#=&-])/g;

/**
 * Masks content-addressed filenames so a path naming a file by its digest is not refused as a token. Accepts a
 * residual risk, approved by the principal on 2026-11-23: a real 40- or 64-hex secret used as such a filename passes.
 * A match inside a URL (`://`, or a query or fragment) is left as is and judged by every pattern.
 */
export function maskContentAddresses(text: string): string {
  return text.replace(CONTENT_ADDRESS, (m: string, offset: number) => {
    const start = Math.max(...[" ", "\t", "\n", '"', "'", "`", "(", "<", ","].map((c) => text.lastIndexOf(c, offset))) + 1;
    return /:\/\/|[?#=&]/.test(text.slice(start, offset)) ? m : `content-address${m.slice(m.indexOf("."))}`;
  });
}

/**
 * Why a url is refused, or null.
 * Userinfo, and anything credential-shaped in the query or fragment, is refused exactly as before. The host and each
 * path segment get every pattern except the long run; a path segment (not the host, whose labels are often long words)
 * of 32+ characters must be slug-shaped.
 * A url that is not absolute http(s) keeps the full old check, so nothing that passed before is newly refused.
 */
export function urlRefusal(url: string): string | null {
  let u: URL | null = null;
  try { u = new URL(url); } catch { u = null; }
  if (!u || (u.protocol !== "https:" && u.protocol !== "http:")) return SECRET_RES.some((re) => re.test(url)) ? CREDENTIAL : null;
  if (u.username || u.password) return CREDENTIAL;
  if (SECRET_RES.some((re) => re.test(u.search + u.hash))) return CREDENTIAL;
  const narrow = SECRET_RES.filter((re) => re !== LONG_RUN);
  if (narrow.some((re) => re.test(u.hostname))) return CREDENTIAL;
  for (const part of u.pathname.split("/")) {
    if (!part) continue;
    if (narrow.some((re) => re.test(part))) return CREDENTIAL;
    if (part.length >= 32 && !SLUG_SEGMENT.test(part)) return CREDENTIAL;
  }
  return null;
}

export function validateEvent(value: unknown): asserts value is VigilEvent {
  if (!value || typeof value !== "object") throw new Error("Vigil event must be an object");
  const e = value as Record<string, unknown>;
  for (const key of ["id", "source", "ts", "title", "summary", "dedup_key"]) if (typeof e[key] !== "string" || !e[key]) throw new Error(`Invalid ${key}`);
  if (!KINDS.includes(e.kind as never) || !SEVERITIES.includes(e.severity as never) || !PRIVACY_CLASSES.includes(e.privacy_class as never)) throw new Error("Invalid event enum");
  if (Number.isNaN(Date.parse(e.ts as string))) throw new Error("Invalid ts");
  if ((e.title as string).length > 140 || (e.summary as string).length > 1000) throw new Error("Event text exceeds limit");
  if (e.ref !== null && typeof e.ref !== "string" || e.url !== null && typeof e.url !== "string") throw new Error("Invalid pointer");
  if (e.meta !== undefined && (!e.meta || typeof e.meta !== "object" || Array.isArray(e.meta))) throw new Error("Invalid meta");
  // Every field but url keeps the full check; url is judged by urlRefusal (ISC-134).
  const text = JSON.stringify({ ...e, url: null });
  if (SECRET_RES.some((re) => re.test(text))) throw new Error(CREDENTIAL);
  const urlReason = typeof e.url === "string" ? urlRefusal(e.url) : null;
  if (urlReason) throw new Error(urlReason);
  if (/^From:.*\n(?:.*\n)*?Subject:/im.test(e.summary as string) || /^Subject:.*\n(?:.*\n)*?From:/im.test(e.summary as string)) throw new Error("Email body refused");
  if ((e.kind === "health" || e.kind === "money") && /(?:\$\s*\d|\b\d+(?:\.\d+)?\s*(?:bpm|ms|kg|lbs?|usd|eur|gbp)\b)/i.test(e.summary as string)) throw new Error("Raw health or money value refused");
}
