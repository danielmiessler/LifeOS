# Advanced Metrics Integration Guide

## Overview

The `useAdvancedMetrics` composable provides comprehensive analytics beyond basic chart data, including:

- **Events Per Minute** - Real-time throughput rate
- **Total Tokens** - Token consumption tracking (input/output/total)
- **Active Sessions** - Count of unique sessions
- **Success Rate** - Percentage of successful events
- **Top Tools** - Most frequently used tools (top 5)
- **Agent Activity** - Distribution across agents
- **Event Type Breakdown** - Event type distribution
- **Delta Calculations** - Change from previous window

## Integration with LivePulseChart.vue

### Step 1: Import the Composable

```typescript
import { useAdvancedMetrics } from '../composables/useAdvancedMetrics';
```

### Step 2: Extract Required Data from useChartData

```typescript
const {
  timeRange,
  dataPoints,
  addEvent,
  getChartData,
  setTimeRange,
  cleanup: cleanupChartData,
  clearData,
  uniqueAgentCount,
  uniqueAgentIdsInWindow,
  allUniqueAgentIds,
  toolCallCount,
  eventTimingMetrics,
  allEvents,        // <-- Need this for advanced metrics
  currentConfig     // <-- Need this for advanced metrics
} = useChartData();
```

**Note:** The current `useChartData` composable needs to expose `allEvents` and `currentConfig` in its return value.

### Step 3: Initialize Advanced Metrics

```typescript
const {
  eventsPerMinute,
  totalTokens,
  activeSessions,
  successRate,
  topTools,
  agentActivity,
  eventTypeBreakdown,
  eventsPerMinuteDelta
} = useAdvancedMetrics(allEvents, dataPoints, timeRange, currentConfig);
```

### Step 4: Use Metrics in Template

```vue
<template>
  <!-- Events Per Minute with Delta -->
  <div class="metric-card">
    <div class="metric-value">{{ eventsPerMinute }} events/min</div>
    <div class="metric-delta" :class="{ positive: eventsPerMinuteDelta.delta > 0 }">
      {{ eventsPerMinuteDelta.delta > 0 ? '+' : '' }}{{ eventsPerMinuteDelta.delta }}
      ({{ eventsPerMinuteDelta.deltaPercent }}%)
    </div>
  </div>

  <!-- Token Consumption -->
  <div class="metric-card">
    <div class="metric-label">Tokens</div>
    <div class="metric-value">{{ totalTokens.total.toLocaleString() }}</div>
    <div class="metric-breakdown">
      Input: {{ totalTokens.input.toLocaleString() }} |
      Output: {{ totalTokens.output.toLocaleString() }}
    </div>
  </div>

  <!-- Active Sessions -->
  <div class="metric-card">
    <div class="metric-label">Active Sessions</div>
    <div class="metric-value">{{ activeSessions }}</div>
  </div>

  <!-- Success Rate -->
  <div class="metric-card">
    <div class="metric-label">Success Rate</div>
    <div class="metric-value">{{ successRate }}%</div>
  </div>

  <!-- Top Tools -->
  <div class="metric-card">
    <div class="metric-label">Top Tools</div>
    <div v-for="tool in topTools" :key="tool.tool" class="tool-item">
      <span>{{ tool.tool }}</span>
      <span>{{ tool.count }}</span>
    </div>
  </div>

  <!-- Agent Activity Distribution -->
  <div class="metric-card">
    <div class="metric-label">Agent Activity</div>
    <div v-for="agent in agentActivity" :key="agent.agent" class="agent-item">
      <span>{{ agent.agent }}</span>
      <span>{{ agent.count }} ({{ agent.percentage }}%)</span>
    </div>
  </div>

  <!-- Event Type Breakdown -->
  <div class="metric-card">
    <div class="metric-label">Event Types</div>
    <div v-for="type in eventTypeBreakdown" :key="type.type" class="type-item">
      <span>{{ type.type }}</span>
      <span>{{ type.count }} ({{ type.percentage }}%)</span>
    </div>
  </div>
</template>
```

## Required Modification to useChartData.ts

To make this integration work, `useChartData.ts` must expose two additional properties:

```typescript
// In useChartData.ts, add these to the return statement:
return {
  timeRange,
  dataPoints,
  addEvent,
  getChartData,
  setTimeRange,
  cleanup,
  clearData,
  currentConfig,           // <-- Add this
  uniqueAgentCount,
  uniqueAgentIdsInWindow,
  allUniqueAgentIds,
  toolCallCount,
  eventTimingMetrics,
  allEvents                // <-- Add this
};
```

## Standalone Usage Example

You can also use `useAdvancedMetrics` in a completely new component:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import type { HookEvent, ChartDataPoint, TimeRange } from '../types';
import { useChartData } from '../composables/useChartData';
import { useAdvancedMetrics } from '../composables/useAdvancedMetrics';

// Initialize base chart data
const chartData = useChartData();

// Initialize advanced metrics
const metrics = useAdvancedMetrics(
  chartData.allEvents,
  chartData.dataPoints,
  chartData.timeRange,
  chartData.currentConfig
);

// All metrics are reactive and will update automatically
</script>

<template>
  <div class="metrics-dashboard">
    <h2>Advanced Metrics</h2>

    <!-- Display all metrics -->
    <div class="metrics-grid">
      <MetricCard
        title="Events/Min"
        :value="metrics.eventsPerMinute.value"
        :delta="metrics.eventsPerMinuteDelta.value"
      />

      <MetricCard
        title="Success Rate"
        :value="`${metrics.successRate.value}%`"
      />

      <MetricCard
        title="Total Tokens"
        :value="metrics.totalTokens.value.total"
      />

      <MetricCard
        title="Active Sessions"
        :value="metrics.activeSessions.value"
      />
    </div>

    <!-- Tool usage chart -->
    <ToolUsageChart :tools="metrics.topTools.value" />

    <!-- Agent distribution chart -->
    <AgentDistributionChart :agents="metrics.agentActivity.value" />

    <!-- Event type breakdown -->
    <EventTypeChart :types="metrics.eventTypeBreakdown.value" />
  </div>
</template>
```

## Performance Notes

- All calculations use Vue's `computed` properties for automatic memoization
- No loops over full event history - reuses existing `dataPoints` where possible
- Calculations are only re-run when dependencies change
- Efficient filtering using timestamps and Set operations

## Type Safety

All return values are fully typed:

```typescript
import type {
  TokenMetrics,
  ToolUsage,
  AgentActivity,
  EventTypeDistribution,
  DeltaMetrics,
  AdvancedMetrics
} from '../composables/useAdvancedMetrics';
```

## Error Handling

The composable handles missing or malformed data gracefully:

- Returns safe defaults (0, [], null) for missing data
- Uses optional chaining for nested properties
- Checks for division by zero
- Filters out invalid timestamps
- Doesn't crash if event structure varies
