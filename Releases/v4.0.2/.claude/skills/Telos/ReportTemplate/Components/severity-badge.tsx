import { cn } from "@/lib/utils"

type Severity = "critical" | "high" | "medium" | "low"

interface SeverityBadgeProps {
  severity: Severity
}

const severityConfig: Record<Severity, { label: string; className: string }> = {
  critical: { label: "Critical", className: "severity-critical" },
  high: { label: "High", className: "severity-high" },
  medium: { label: "Medium", className: "severity-medium" },
  low: { label: "Low", className: "severity-low" },
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config = severityConfig[severity]
  return (
    <span className={cn("severity-badge", config.className)}>
      {config.label}
    </span>
  )
}
