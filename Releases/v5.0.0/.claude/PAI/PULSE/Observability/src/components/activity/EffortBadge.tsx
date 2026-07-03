import { resolveEffortTier, TIER_BADGE_CLASSES } from "@/lib/effort-tier";

interface EffortBadgeProps {
  effort: string;
  /** When true, render nothing for not-yet-classified placeholders instead of a pending chip. */
  hidePending?: boolean;
}

export default function EffortBadge({ effort, hidePending }: EffortBadgeProps) {
  const { tier, pending, label } = resolveEffortTier(effort);
  if (pending && hidePending) return null;
  const classes = tier ? TIER_BADGE_CLASSES[tier] : TIER_BADGE_CLASSES.pending;

  return (
    <span
      className={`inline-flex items-center gap-1 h-6 px-2.5 text-xs font-bold uppercase tracking-widest border rounded shrink-0 ${classes}`}
    >
      {label}
    </span>
  );
}
