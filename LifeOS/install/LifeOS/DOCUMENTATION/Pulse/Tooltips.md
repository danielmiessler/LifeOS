---
last_updated: 2026-07-02
last_updated_by: kai
last_reviewed: 2026-07-02
last_reviewed_by: kai
convention: pai-freshness-v1
---

# Custom Tooltips

The Pulse dashboard teaches itself. Every non-obvious number, chart, and badge carries a contextual tooltip, so you learn what a metric means the moment you hover over it — instead of hunting through a manual. Freshness indicators do the same for staleness: a small marker on each panel tells you how current the underlying data is and when it was last refreshed.

This is a deliberate design choice. A dashboard dense enough to be useful is dense enough to be confusing; tooltips carry the explanation *to* the number rather than making you go find it.

## What they cover

- **Chart tooltips** — hover any point on a chart to see the exact value, its label, and the series it belongs to.
- **Freshness indicators** — a per-panel marker showing how recently the data was updated, so a stale panel is visibly stale rather than silently wrong.
- **Badge and metric tooltips** — the status badges, KPI tiles, and insight panels explain their own scoring and thresholds on hover.

## Where it lives

The tooltip system is part of the Pulse Observability dashboard (a Next.js app):

- `LIFEOS/PULSE/Observability/src/components/ui/chart.tsx` — the shared `ChartTooltip` used across every chart.
- `LIFEOS/PULSE/Observability/src/components/FreshnessIndicator.tsx` — the per-panel freshness marker.
- `LIFEOS/PULSE/Observability/src/app/globals.css` — tooltip styling.
- `LIFEOS/PULSE/modules/tab-freshness.ts` — the freshness data each indicator reads.

Individual insight panels (phase-bottleneck, mode-escalation, agent-constellation, error-heatmap, knowledge-graph, and the business/growth/finances views) each attach their own tooltips through the shared components above.

## Related

- Pulse — the dashboard these tooltips live in: `LIFEOS/DOCUMENTATION/Pulse/PulseSystem.md`
- Pulse metadata catalog (badges, strips, panels): `LIFEOS/DOCUMENTATION/Pulse/PulseMetadata.md`
- The freshness convention behind the indicators: `Freshness/FreshnessSystem.md`
