"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Insights Dashboard ───
// Scrollable grid layout hosting all 15 analytics widgets.
// Each widget is a self-contained component under src/components/activity/insights/.
// WidgetCard placeholders will be replaced as individual widget agents deliver.

export default function InsightsDashboard() {
  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        {/* Row 1: Overview metrics */}
        <div className="grid grid-cols-3 gap-4">
          <WidgetCard id="effort-donut" title="Effort Distribution" />
          <WidgetCard id="satisfaction-pulse" title="Satisfaction Pulse" />
          <WidgetCard id="phase-bottleneck" title="Phase Bottlenecks" />
        </div>

        {/* Row 2: Activity patterns */}
        <div className="grid grid-cols-2 gap-4">
          <WidgetCard id="phase-rhythm" title="Phase Rhythm Strip" wide />
          <WidgetCard id="decision-density" title="Decision Density" wide />
        </div>

        {/* Row 3: Error & Health */}
        <div className="grid grid-cols-2 gap-4">
          <WidgetCard id="tool-failure" title="Tool Failure Leaderboard" />
          <WidgetCard id="error-heatmap" title="Error Heatmap" />
        </div>

        {/* Row 4: Agents & Config */}
        <div className="grid grid-cols-3 gap-4">
          <WidgetCard id="agent-constellation" title="Agent Constellation" />
          <WidgetCard id="config-radar" title="Config Drift Radar" />
          <WidgetCard id="mode-sankey" title="Mode Escalation" />
        </div>

        {/* Row 5: History & Learning */}
        <div className="grid grid-cols-2 gap-4">
          <WidgetCard id="reflection-feed" title="Reflection Insights" tall />
          <div className="space-y-4">
            <WidgetCard id="rework-archaeology" title="Rework Archaeology" />
            <WidgetCard id="session-wordcloud" title="Session Wordcloud" />
          </div>
        </div>

        {/* Row 6: Evidence */}
        <WidgetCard
          id="evidence-gallery"
          title="Criteria Evidence Gallery"
          fullWidth
        />
      </div>
    </ScrollArea>
  );
}

// ─── Reusable Widget Card Wrapper ───
// Provides consistent styling for all insight widgets.
// Individual widgets render as children; placeholder shown when empty.

function WidgetCard({
  id,
  title,
  wide,
  tall,
  fullWidth,
  children,
}: {
  id: string;
  title: string;
  wide?: boolean;
  tall?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-widget-id={id}
      className={`rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden ${
        fullWidth ? "col-span-full" : ""
      } ${tall ? "min-h-[400px]" : "min-h-[280px]"}`}
    >
      <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center justify-between">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="p-4">
        {children || (
          <div className="flex items-center justify-center h-40 text-zinc-600 text-xs">
            Loading {title}...
          </div>
        )}
      </div>
    </div>
  );
}
