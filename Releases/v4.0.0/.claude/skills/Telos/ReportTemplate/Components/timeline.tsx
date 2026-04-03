import type { TimelinePhase } from "@/lib/report-data"

interface TimelineProps {
  phases: TimelinePhase[]
}

export function Timeline({ phases }: TimelineProps) {
  return (
    <div className="timeline">
      {phases.map((phase, index) => (
        <div key={index} className="timeline-item">
          <div className="timeline-phase">{phase.phase}</div>
          <div className="timeline-title">{phase.title}</div>
          <div className="timeline-description">{phase.description}</div>
          <div className="text-xs text-primary font-medium mt-1">
            {phase.duration}
          </div>
        </div>
      ))}
    </div>
  )
}
