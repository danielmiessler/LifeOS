export type EffortTier = "E1" | "E2" | "E3" | "E4" | "E5";

// Legacy quality word → tier. NOTE: "standard" is intentionally absent (it is a
// not-yet-classified placeholder; rendering it as E1 was the original bug).
const LEGACY_QUALITY_TIER: Record<string, EffortTier> = {
  extended: "E2",
  advanced: "E3",
  deep: "E4",
  comprehensive: "E5",
};

export interface EffortBadgeModel {
  tier: EffortTier | null;   // resolved tier, or null when not yet classified
  pending: boolean;          // true → render a neutral pending state
  label: string;             // the tier ("E4") or "Pending"
}

/**
 * Resolve the work.json `effort` value into a badge model.
 * - A real tier "E1".."E5" (any case) → that tier.
 * - A legacy quality word (extended/advanced/deep/comprehensive) → its tier.
 * - Anything else (standard / starting / native / turbo / empty / unknown) → pending. NEVER a false E1.
 */
export function resolveEffortTier(raw: string | null | undefined): EffortBadgeModel {
  const v = (raw ?? "").trim().toLowerCase();
  const tierMatch = v.match(/^e([1-5])$/);
  if (tierMatch) {
    const tier = `E${tierMatch[1]}` as EffortTier;
    return { tier, pending: false, label: tier };
  }
  const legacy = LEGACY_QUALITY_TIER[v];
  if (legacy) return { tier: legacy, pending: false, label: legacy };
  return { tier: null, pending: true, label: "Pending" };
}

export const TIER_BADGE_CLASSES: Record<EffortTier | "pending", string> = {
  E1: "bg-amber-500/15 border-amber-500/30 text-amber-400",
  E2: "bg-orange-500/15 border-orange-500/30 text-orange-400",
  E3: "bg-rose-500/15 border-rose-500/30 text-rose-400",
  E4: "bg-purple-500/15 border-purple-500/30 text-purple-400",
  E5: "bg-red-500/15 border-red-500/30 text-red-400",
  pending: "bg-zinc-700/40 border-zinc-600/40 text-zinc-500",
};

export const TIER_TEXT_CLASSES: Record<EffortTier, string> = {
  E1: "text-amber-400", E2: "text-orange-400", E3: "text-rose-400",
  E4: "text-purple-400", E5: "text-red-400",
};

export const EFFORT_TIERS: readonly EffortTier[] = ["E1", "E2", "E3", "E4", "E5"];
