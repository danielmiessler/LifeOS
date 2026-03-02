import { cn } from "@/lib/utils"
import type { Recommendation } from "@/lib/report-data"
import { ArrowRight, Clock, Zap } from "lucide-react"

interface RecommendationCardProps {
  recommendation: Recommendation
  index: number
}

const priorityConfig = {
  immediate: {
    icon: Zap,
    label: "Immediate",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  "short-term": {
    icon: Clock,
    label: "Short-term",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  "long-term": {
    icon: ArrowRight,
    label: "Long-term",
    className: "bg-primary/10 text-primary border-primary/20",
  },
}

export function RecommendationCard({
  recommendation,
  index,
}: RecommendationCardProps) {
  const config = priorityConfig[recommendation.priority]
  const Icon = config.icon

  return (
    <div className="finding-card">
      <div className="finding-header">
        <div className="flex items-start gap-3">
          <span className="text-primary font-bold text-lg">{index + 1}</span>
          <span className="finding-title">{recommendation.title}</span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border",
            config.className
          )}
        >
          <Icon className="h-3 w-3" />
          {config.label}
        </span>
      </div>
      <p className="text-foreground ml-8">{recommendation.description}</p>
    </div>
  )
}
