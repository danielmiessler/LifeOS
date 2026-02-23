/**
 * Timeline Intelligence Composable
 * Aggregates events into time windows and provides intelligent summarization
 * Uses Haiku for fast, cheap summarization of event clusters
 */

import { ref, computed } from 'vue';
import type { HookEvent } from '../types';
import { summarizeEvents, type EventSummary, isHaikuConfigured } from '../utils/haiku';

export interface EventCluster {
  id: string;
  summary: EventSummary;
  events: HookEvent[];
  windowStart: number;
  windowEnd: number;
  expanded: boolean;
}

const SAMPLING_WINDOW_MS = 2500; // 2.5 seconds
const SUMMARIZATION_THRESHOLD = 3; // Summarize if ≥3 events in window
const MAX_EVENTS_BEFORE_COLLAPSE = 5; // Always collapse beyond 5

export function useTimelineIntelligence() {
  const clusters = ref<EventCluster[]>([]);
  const isProcessing = ref(false);
  const hasClusters = computed(() => clusters.value.length > 0);

  /**
   * Process new events and create/update clusters
   */
  async function processEvents(events: HookEvent[]) {
    if (events.length === 0) return;

    isProcessing.value = true;

    try {
      // Group events by time windows
      const windows = groupEventsIntoWindows(events);

      // Process each window
      for (const windowEvents of windows) {
        if (windowEvents.length === 0) continue;

        const shouldCluster =
          windowEvents.length >= SUMMARIZATION_THRESHOLD ||
          windowEvents.length > MAX_EVENTS_BEFORE_COLLAPSE;

        if (shouldCluster && isHaikuConfigured()) {
          // Create a cluster with Haiku summarization
          const summary = await summarizeEvents(windowEvents);
          const clusterId = generateClusterId(windowEvents);

          // Check if cluster already exists
          const existingClusterIndex = clusters.value.findIndex(c => c.id === clusterId);
          if (existingClusterIndex >= 0) {
            // Update existing cluster
            clusters.value[existingClusterIndex].events = windowEvents;
            clusters.value[existingClusterIndex].summary = summary;
          } else {
            // Create new cluster
            clusters.value.push({
              id: clusterId,
              summary,
              events: windowEvents,
              windowStart: Math.min(...windowEvents.map(e => e.timestamp || Date.now())),
              windowEnd: Math.max(...windowEvents.map(e => e.timestamp || Date.now())),
              expanded: false
            });
          }
        } else {
          // Keep events individual (below threshold or no Haiku)
          for (const event of windowEvents) {
            const clusterId = `single-${event.id}-${event.timestamp}`;
            const existingClusterIndex = clusters.value.findIndex(c => c.id === clusterId);

            if (existingClusterIndex < 0) {
              const summary = await summarizeEvents([event]);
              clusters.value.push({
                id: clusterId,
                summary,
                events: [event],
                windowStart: event.timestamp || Date.now(),
                windowEnd: event.timestamp || Date.now(),
                expanded: false
              });
            }
          }
        }
      }

      // Clean old clusters (keep last 5 minutes)
      const cutoff = Date.now() - 5 * 60 * 1000;
      clusters.value = clusters.value.filter(c => c.windowEnd >= cutoff);

      // Sort by timestamp
      clusters.value.sort((a, b) => a.windowStart - b.windowStart);
    } finally {
      isProcessing.value = false;
    }
  }

  /**
   * Group events into time windows
   */
  function groupEventsIntoWindows(events: HookEvent[]): HookEvent[][] {
    if (events.length === 0) return [];

    // Sort by timestamp
    const sortedEvents = [...events].sort((a, b) =>
      (a.timestamp || 0) - (b.timestamp || 0)
    );

    const windows: HookEvent[][] = [];
    let currentWindow: HookEvent[] = [];
    let windowStart = sortedEvents[0].timestamp || Date.now();

    for (const event of sortedEvents) {
      const eventTime = event.timestamp || Date.now();
      const timeSinceWindowStart = eventTime - windowStart;

      if (timeSinceWindowStart <= SAMPLING_WINDOW_MS) {
        // Add to current window
        currentWindow.push(event);
      } else {
        // Start new window
        if (currentWindow.length > 0) {
          windows.push(currentWindow);
        }
        currentWindow = [event];
        windowStart = eventTime;
      }
    }

    // Add final window
    if (currentWindow.length > 0) {
      windows.push(currentWindow);
    }

    return windows;
  }

  /**
   * Generate unique cluster ID based on window and events
   */
  function generateClusterId(events: HookEvent[]): string {
    const timestamps = events.map(e => e.timestamp || 0).sort();
    const start = timestamps[0];
    const end = timestamps[timestamps.length - 1];
    const eventIds = events.map(e => e.id).join('-');
    return `cluster-${start}-${end}-${eventIds.substring(0, 20)}`;
  }

  /**
   * Toggle cluster expansion
   */
  function toggleCluster(clusterId: string) {
    const cluster = clusters.value.find(c => c.id === clusterId);
    if (cluster) {
      cluster.expanded = !cluster.expanded;
    }
  }

  /**
   * Get clusters for a specific agent
   */
  function getClustersForAgent(agentId: string): EventCluster[] {
    const [targetApp, targetSession] = agentId.split(':');
    return clusters.value.filter(cluster =>
      cluster.events.some(e =>
        e.source_app === targetApp &&
        e.session_id.slice(0, 8) === targetSession
      )
    );
  }

  /**
   * Clear all clusters
   */
  function clearClusters() {
    clusters.value = [];
  }

  return {
    clusters,
    isProcessing,
    hasClusters,
    processEvents,
    toggleCluster,
    getClustersForAgent,
    clearClusters,
    config: {
      samplingWindowMs: SAMPLING_WINDOW_MS,
      summarizationThreshold: SUMMARIZATION_THRESHOLD,
      maxEventsBeforeCollapse: MAX_EVENTS_BEFORE_COLLAPSE
    }
  };
}
