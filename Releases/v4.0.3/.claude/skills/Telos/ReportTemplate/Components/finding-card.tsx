import { SeverityBadge } from "./severity-badge"
import type { Finding } from "@/lib/report-data"

interface FindingCardProps {
  finding: Finding
  index: number
}

export function FindingCard({ finding, index }: FindingCardProps) {
  return (
    <div className="finding-card">
      <div className="finding-header">
        <div className="flex items-center gap-4">
          <span className="text-primary font-bold text-2xl min-w-[2rem]">
            {index + 1}.
          </span>
          <span className="finding-title">{finding.title}</span>
        </div>
        <SeverityBadge severity={finding.severity} />
      </div>
      <p className="text-foreground mb-2 ml-12">{finding.description}</p>
      <p className="finding-evidence ml-12">
        <span className="font-medium text-foreground">Evidence:</span>{" "}
        {finding.evidence}
      </p>
      <p className="text-xs text-muted mt-2 italic ml-12">Source: {finding.source}</p>
    </div>
  )
}
