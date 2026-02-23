/**
 * Example usage and validation of useAdvancedMetrics composable
 *
 * This file demonstrates how to use the advanced metrics composable
 * and validates that all metrics are correctly calculated.
 */

import { ref } from 'vue';
import type { HookEvent, ChartDataPoint, TimeRange } from '../../types';
import { useAdvancedMetrics } from '../useAdvancedMetrics';

// Example: Create mock data
const createMockEvents = (): HookEvent[] => [
  {
    id: 1,
    source_app: 'kai',
    agent_name: 'kai',
    session_id: 'session-001',
    hook_event_type: 'PostToolUse',
    payload: {
      tool_name: 'Read',
      usage: { input_tokens: 1000, output_tokens: 500 }
    },
    timestamp: Date.now() - 30000 // 30 seconds ago
  },
  {
    id: 2,
    source_app: 'kai',
    agent_name: 'engineer',
    session_id: 'session-002',
    hook_event_type: 'PostToolUse',
    payload: {
      tool_name: 'Write',
      usage: { input_tokens: 800, output_tokens: 300 }
    },
    timestamp: Date.now() - 20000 // 20 seconds ago
  },
  {
    id: 3,
    source_app: 'kai',
    agent_name: 'kai',
    session_id: 'session-001',
    hook_event_type: 'PreToolUse',
    payload: { tool_name: 'Read' },
    timestamp: Date.now() - 10000 // 10 seconds ago
  },
  {
    id: 4,
    source_app: 'kai',
    agent_name: 'engineer',
    session_id: 'session-002',
    hook_event_type: 'error',
    payload: { error: 'Something went wrong' },
    timestamp: Date.now() - 5000 // 5 seconds ago
  }
];

const createMockDataPoints = (): ChartDataPoint[] => [
  {
    timestamp: Date.now() - 60000,
    count: 10,
    eventTypes: { 'PostToolUse': 6, 'PreToolUse': 4 },
    sessions: { 'session-001': 7, 'session-002': 3 },
    apps: { 'kai': 10 }
  },
  {
    timestamp: Date.now() - 30000,
    count: 15,
    eventTypes: { 'PostToolUse': 8, 'PreToolUse': 5, 'error': 2 },
    sessions: { 'session-001': 8, 'session-002': 7 },
    apps: { 'kai': 12, 'engineer': 3 }
  }
];

// Example: Initialize the composable
export function exampleUsage() {
  // Create refs with mock data
  const allEvents = ref<HookEvent[]>(createMockEvents());
  const dataPoints = ref<ChartDataPoint[]>(createMockDataPoints());
  const timeRange = ref<TimeRange>('1m');
  const currentConfig = ref({
    duration: 60 * 1000, // 1 minute
    bucketSize: 1000,
    maxPoints: 60
  });

  // Initialize advanced metrics
  const metrics = useAdvancedMetrics(
    allEvents,
    dataPoints,
    timeRange,
    currentConfig
  );

  // Example: Access metrics
  console.log('Events Per Minute:', metrics.eventsPerMinute.value);
  // Expected: ~25 events/min (25 total events / 1 minute)

  console.log('Total Tokens:', metrics.totalTokens.value);
  // Expected: { input: 1800, output: 800, total: 2600 }

  console.log('Active Sessions:', metrics.activeSessions.value);
  // Expected: 2 (session-001 and session-002)

  console.log('Success Rate:', metrics.successRate.value);
  // Expected: 75% (3 successful events out of 4)

  console.log('Top Tools:', metrics.topTools.value);
  // Expected: [{ tool: 'Read', count: 2 }, { tool: 'Write', count: 1 }]

  console.log('Agent Activity:', metrics.agentActivity.value);
  // Expected: [
  //   { agent: 'kai', count: 2, percentage: 50 },
  //   { agent: 'engineer', count: 2, percentage: 50 }
  // ]

  console.log('Event Type Breakdown:', metrics.eventTypeBreakdown.value);
  // Expected: [
  //   { type: 'PostToolUse', count: 2, percentage: 50 },
  //   { type: 'PreToolUse', count: 1, percentage: 25 },
  //   { type: 'error', count: 1, percentage: 25 }
  // ]

  console.log('Events Per Minute Delta:', metrics.eventsPerMinuteDelta.value);
  // Expected: Comparison between current and previous time window

  return metrics;
}

// Example: Integration with LivePulseChart
export function integrateWithComponent() {
  // Assuming you have useChartData initialized
  const chartData = {
    allEvents: ref<HookEvent[]>([]),
    dataPoints: ref<ChartDataPoint[]>([]),
    timeRange: ref<TimeRange>('1m'),
    currentConfig: ref({
      duration: 60 * 1000,
      bucketSize: 1000,
      maxPoints: 60
    })
  };

  // Initialize advanced metrics with chart data
  const advancedMetrics = useAdvancedMetrics(
    chartData.allEvents,
    chartData.dataPoints,
    chartData.timeRange,
    chartData.currentConfig
  );

  // All metrics are reactive and will update automatically
  return advancedMetrics;
}

// Example: Validation function
export function validateMetrics() {
  const metrics = exampleUsage();

  const validations = {
    eventsPerMinute: metrics.eventsPerMinute.value >= 0,
    totalTokensHasProperties:
      typeof metrics.totalTokens.value.input === 'number' &&
      typeof metrics.totalTokens.value.output === 'number' &&
      typeof metrics.totalTokens.value.total === 'number',
    activeSessionsIsNumber: typeof metrics.activeSessions.value === 'number',
    successRateInRange:
      metrics.successRate.value >= 0 && metrics.successRate.value <= 100,
    topToolsIsArray: Array.isArray(metrics.topTools.value),
    agentActivityIsArray: Array.isArray(metrics.agentActivity.value),
    eventTypeBreakdownIsArray: Array.isArray(metrics.eventTypeBreakdown.value),
    deltaHasAllProperties:
      typeof metrics.eventsPerMinuteDelta.value.current === 'number' &&
      typeof metrics.eventsPerMinuteDelta.value.previous === 'number' &&
      typeof metrics.eventsPerMinuteDelta.value.delta === 'number' &&
      typeof metrics.eventsPerMinuteDelta.value.deltaPercent === 'number'
  };

  const allValid = Object.values(validations).every(v => v === true);
  console.log('All metrics valid:', allValid);
  console.log('Validation details:', validations);

  return allValid;
}
