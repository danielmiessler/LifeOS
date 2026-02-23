import { ref, computed } from 'vue';
import type { HookEvent, ChartDataPoint, TimeRange } from '../types';

export function useChartData(agentIdFilter?: string) {
  const timeRange = ref<TimeRange>('1M');
  const dataPoints = ref<ChartDataPoint[]>([]);

  // Parse agent ID filter (format: "app:session")
  const parseAgentId = (agentId: string): { app: string; session: string } | null => {
    const parts = agentId.split(':');
    if (parts.length === 2) {
      return { app: parts[0], session: parts[1] };
    }
    return null;
  };

  const agentIdParsed = agentIdFilter ? parseAgentId(agentIdFilter) : null;
  
  // Store all events for re-aggregation when time range changes
  const allEvents = ref<HookEvent[]>([]);
  
  // Debounce for high-frequency events
  let eventBuffer: HookEvent[] = [];
  let debounceTimer: number | null = null;
  const DEBOUNCE_DELAY = 50; // 50ms debounce
  
  const timeRangeConfig = {
    '1M': {
      duration: 60 * 1000, // 1 minute in ms
      bucketSize: 1000, // 1 second buckets
      maxPoints: 60
    },
    '2M': {
      duration: 2 * 60 * 1000, // 2 minutes in ms
      bucketSize: 2000, // 2 second buckets
      maxPoints: 60
    },
    '4M': {
      duration: 4 * 60 * 1000, // 4 minutes in ms
      bucketSize: 4000, // 4 second buckets
      maxPoints: 60
    },
    '8M': {
      duration: 8 * 60 * 1000, // 8 minutes in ms
      bucketSize: 8000, // 8 second buckets
      maxPoints: 60
    },
    '16M': {
      duration: 16 * 60 * 1000, // 16 minutes in ms
      bucketSize: 16000, // 16 second buckets
      maxPoints: 60
    }
  };
  
  const currentConfig = computed(() => timeRangeConfig[timeRange.value]);
  
  const getBucketTimestamp = (timestamp: number): number => {
    const config = currentConfig.value;
    return Math.floor(timestamp / config.bucketSize) * config.bucketSize;
  };
  
  const processEventBuffer = () => {
    const eventsToProcess = [...eventBuffer];
    eventBuffer = [];

    // Debug: Log event processing
    if (eventsToProcess.length > 0) {
      console.log(`[useChartData] Processing ${eventsToProcess.length} new events`);
    }

    // Add events to our complete list
    allEvents.value.push(...eventsToProcess);

    eventsToProcess.forEach(event => {
      if (!event.timestamp) return;

      // Skip if event doesn't match agent ID filter (check both app and session)
      if (agentIdParsed) {
        if (event.source_app !== agentIdParsed.app) {
          return;
        }
        // Check if session ID matches (first 8 chars)
        if (event.session_id.slice(0, 8) !== agentIdParsed.session) {
          return;
        }
      }

      const bucketTime = getBucketTimestamp(event.timestamp);

      // Find existing bucket or create new one
      let bucket = dataPoints.value.find(dp => dp.timestamp === bucketTime);
      if (bucket) {
        bucket.count++;
        // Track event types
        if (!bucket.eventTypes) {
          bucket.eventTypes = {};
        }
        bucket.eventTypes[event.hook_event_type] = (bucket.eventTypes[event.hook_event_type] || 0) + 1;
        // Track sessions
        if (!bucket.sessions) {
          bucket.sessions = {};
        }
        bucket.sessions[event.session_id] = (bucket.sessions[event.session_id] || 0) + 1;
        // Track apps (prefer agent_name over source_app)
        if (!bucket.apps) {
          bucket.apps = {};
        }
        const appKey = event.agent_name || event.source_app || 'unknown';
        bucket.apps[appKey] = (bucket.apps[appKey] || 0) + 1;
        // Track raw events (for tool name extraction in timeline)
        if (!bucket.rawEvents) {
          bucket.rawEvents = [];
        }
        bucket.rawEvents.push(event);
      } else {
        const appKey = event.agent_name || event.source_app || 'unknown';
        dataPoints.value.push({
          timestamp: bucketTime,
          count: 1,
          eventTypes: { [event.hook_event_type]: 1 },
          sessions: { [event.session_id]: 1 },
          apps: { [appKey]: 1 },
          rawEvents: [event] // Add raw events for tool name extraction
        });
      }
    });

    // Clean old data once after processing all events
    cleanOldData();
    cleanOldEvents();
  };
  
  const addEvent = (event: HookEvent) => {
    eventBuffer.push(event);
    
    // Clear existing timer
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    
    // Set new timer
    debounceTimer = window.setTimeout(() => {
      processEventBuffer();
      debounceTimer = null;
    }, DEBOUNCE_DELAY);
  };
  
  const cleanOldData = () => {
    const now = Date.now();
    const cutoffTime = now - currentConfig.value.duration;

    const beforeCount = dataPoints.value.length;
    dataPoints.value = dataPoints.value.filter(dp => dp.timestamp >= cutoffTime);
    const afterCount = dataPoints.value.length;

    // Ensure we don't exceed max points
    if (dataPoints.value.length > currentConfig.value.maxPoints) {
      dataPoints.value = dataPoints.value.slice(-currentConfig.value.maxPoints);
    }

    // Debug: Log cleanup summary (throttled to avoid spam)
    if (beforeCount !== afterCount && Math.random() < 0.1) {  // Only log 10% of the time
      const totalEvents = dataPoints.value.reduce((sum, dp) => sum + dp.count, 0);
      console.log(`[useChartData] Cleaned old data: ${beforeCount} → ${afterCount} data points, ${totalEvents} total events`);
    }
  };
  
  const cleanOldEvents = () => {
    const now = Date.now();
    const cutoffTime = now - 5 * 60 * 1000; // Keep events for max 5 minutes
    
    allEvents.value = allEvents.value.filter(event => 
      event.timestamp && event.timestamp >= cutoffTime
    );
  };
  
  const getChartData = (): ChartDataPoint[] => {
    const now = Date.now();
    const config = currentConfig.value;
    const startTime = now - config.duration;
    
    // Create array of all time buckets in range
    const buckets: ChartDataPoint[] = [];
    for (let time = startTime; time <= now; time += config.bucketSize) {
      const bucketTime = getBucketTimestamp(time);
      const existingBucket = dataPoints.value.find(dp => dp.timestamp === bucketTime);
      buckets.push({
        timestamp: bucketTime,
        count: existingBucket?.count || 0,
        eventTypes: existingBucket?.eventTypes || {},
        sessions: existingBucket?.sessions || {},
        apps: existingBucket?.apps || {},
        rawEvents: existingBucket?.rawEvents || []
      });
    }
    
    // Return only the last maxPoints buckets
    return buckets.slice(-config.maxPoints);
  };
  
  const setTimeRange = (range: TimeRange) => {
    timeRange.value = range;
    // Re-aggregate data for new bucket size
    reaggregateData();
  };
  
  const reaggregateData = () => {
    // Clear current data points
    dataPoints.value = [];

    // Re-process all events with new bucket size
    const now = Date.now();
    const cutoffTime = now - currentConfig.value.duration;

    // Filter events within the time range and by agent ID if specified
    let relevantEvents = allEvents.value.filter(event =>
      event.timestamp && event.timestamp >= cutoffTime
    );

    if (agentIdParsed) {
      relevantEvents = relevantEvents.filter(event =>
        event.source_app === agentIdParsed.app &&
        event.session_id.slice(0, 8) === agentIdParsed.session
      );
    }

    // Re-aggregate all relevant events
    relevantEvents.forEach(event => {
      if (!event.timestamp) return;

      const bucketTime = getBucketTimestamp(event.timestamp);

      // Find existing bucket or create new one
      let bucket = dataPoints.value.find(dp => dp.timestamp === bucketTime);
      if (bucket) {
        bucket.count++;
        bucket.eventTypes[event.hook_event_type] = (bucket.eventTypes[event.hook_event_type] || 0) + 1;
        bucket.sessions[event.session_id] = (bucket.sessions[event.session_id] || 0) + 1;
        // Track raw events (for tool name extraction in timeline)
        if (!bucket.rawEvents) {
          bucket.rawEvents = [];
        }
        bucket.rawEvents.push(event);
      } else {
        dataPoints.value.push({
          timestamp: bucketTime,
          count: 1,
          eventTypes: { [event.hook_event_type]: 1 },
          sessions: { [event.session_id]: 1 },
          apps: { [event.source_app || 'unknown']: 1 },
          rawEvents: [event] // Add raw events for tool name extraction
        });
      }
    });

    // Clean up
    cleanOldData();
  };
  
  // Auto-clean old data every second
  const cleanupInterval = setInterval(() => {
    cleanOldData();
    cleanOldEvents();
  }, 1000);
  
  // Cleanup on unmount
  const cleanup = () => {
    clearInterval(cleanupInterval);
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      processEventBuffer(); // Process any remaining events
    }
  };

  // Clear all data (for when user clicks clear button)
  const clearData = () => {
    dataPoints.value = [];
    allEvents.value = [];
    eventBuffer = [];
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
  
  // Helper to create unique agent ID from source_app + session_id
  const createAgentId = (sourceApp: string, sessionId: string): string => {
    return `${sourceApp}:${sessionId.slice(0, 8)}`;
  };

  // Compute unique agent IDs (source_app:session_id) within the current time window
  const uniqueAgentIdsInWindow = computed(() => {
    const now = Date.now();
    const config = currentConfig.value;
    const cutoffTime = now - config.duration;

    // Get all unique (source_app, session_id) combos from events in the time window
    const uniqueAgents = new Set<string>();

    allEvents.value.forEach(event => {
      if (event.timestamp && event.timestamp >= cutoffTime) {
        const agentId = createAgentId(event.source_app, event.session_id);
        uniqueAgents.add(agentId);
      }
    });

    return Array.from(uniqueAgents);
  });

  // Compute ALL unique agent IDs ever seen in the session (not just in current window)
  const allUniqueAgentIds = computed(() => {
    const uniqueAgents = new Set<string>();

    allEvents.value.forEach(event => {
      const agentId = createAgentId(event.source_app, event.session_id);
      uniqueAgents.add(agentId);
    });

    return Array.from(uniqueAgents);
  });

  // Compute unique agent count based on current time window
  const uniqueAgentCount = computed(() => {
    return uniqueAgentIdsInWindow.value.length;
  });

  // Compute total tool calls (PreToolUse events) based on current time window
  const toolCallCount = computed(() => {
    return dataPoints.value.reduce((sum, dp) => {
      return sum + (dp.eventTypes?.['PreToolUse'] || 0);
    }, 0);
  });

  // Compute event timing metrics (min, max, average gap between events in ms)
  const eventTimingMetrics = computed(() => {
    const now = Date.now();
    const config = currentConfig.value;
    const cutoffTime = now - config.duration;

    // Get all events in current time window, sorted by timestamp
    const windowEvents = allEvents.value
      .filter(e => e.timestamp && e.timestamp >= cutoffTime)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    if (windowEvents.length < 2) {
      return { minGap: 0, maxGap: 0, avgGap: 0 };
    }

    // Calculate gaps between consecutive events
    const gaps: number[] = [];
    for (let i = 1; i < windowEvents.length; i++) {
      const gap = (windowEvents[i].timestamp || 0) - (windowEvents[i - 1].timestamp || 0);
      if (gap > 0) {
        gaps.push(gap);
      }
    }

    if (gaps.length === 0) {
      return { minGap: 0, maxGap: 0, avgGap: 0 };
    }

    const minGap = Math.min(...gaps);
    const maxGap = Math.max(...gaps);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    return { minGap, maxGap, avgGap };
  });

  return {
    timeRange,
    dataPoints,
    addEvent,
    getChartData,
    setTimeRange,
    cleanup,
    clearData,
    currentConfig,
    uniqueAgentCount,
    uniqueAgentIdsInWindow,
    allUniqueAgentIds,
    toolCallCount,
    eventTimingMetrics,
    allEvents  // Exposed for useAdvancedMetrics integration
  };
}