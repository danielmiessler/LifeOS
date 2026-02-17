<template>
  <div class="agent-swim-lane">
    <div class="lane-header">
      <div class="header-left">
        <div class="agent-label-container">
          <span
            class="agent-label-app-only"
            :style="{
              backgroundColor: getHexColorForApp(appName),
              borderColor: getHexColorForApp(appName)
            }"
          >
            <span class="font-mono text-xs">{{ appName }}</span>
          </span>
        </div>
        <div
          v-if="modelName"
          class="model-badge"
          :title="`Model: ${modelName}`"
        >
          <Brain :size="14" :stroke-width="2.5" />
          <span class="text-xs font-bold">{{ formatModelName(modelName) }}</span>
        </div>
        <div
          class="event-count-badge"
          @mouseover="hoveredEventCount = true"
          @mouseleave="hoveredEventCount = false"
          :title="`Total events in the last ${timeRange === '1m' ? '1 minute' : timeRange === '3m' ? '3 minutes' : '5 minutes'}`"
        >
          <Zap :size="14" :stroke-width="2.5" class="flex-shrink-0" />
          <span class="text-xs font-bold" :class="hoveredEventCount ? 'min-w-[65px]' : ''">
            {{ hoveredEventCount ? `${totalEventCount} Events` : totalEventCount }}
          </span>
        </div>
        <div
          class="tool-call-badge"
          @mouseover="hoveredToolCount = true"
          @mouseleave="hoveredToolCount = false"
          :title="`Tool calls in the last ${timeRange === '1m' ? '1 minute' : timeRange === '3m' ? '3 minutes' : '5 minutes'}`"
        >
          <Wrench :size="14" :stroke-width="2.5" class="flex-shrink-0" />
          <span class="text-xs font-bold" :class="hoveredToolCount ? 'min-w-[75px]' : ''">
            {{ hoveredToolCount ? `${toolCallCount} Tool Calls` : toolCallCount }}
          </span>
        </div>
        <div
          class="avg-time-badge flex items-center gap-1.5 px-2 py-2 bg-[var(--theme-bg-tertiary)] rounded-lg border border-[var(--theme-border-primary)] shadow-sm min-h-[28px]"
          @mouseover="hoveredAvgTime = true"
          @mouseleave="hoveredAvgTime = false"
          :title="`Average time between events in the last ${timeRange === '1m' ? '1 minute' : timeRange === '3m' ? '3 minutes' : '5 minutes'}`"
        >
          <Clock :size="16" :stroke-width="2.5" class="flex-shrink-0" />
          <span class="text-sm font-bold text-[var(--theme-text-primary)]" :class="hoveredAvgTime ? 'min-w-[90px]' : ''">
            {{ hoveredAvgTime ? `Avg Gap: ${formatGap(agentEventTimingMetrics.avgGap)}` : formatGap(agentEventTimingMetrics.avgGap) }}
          </span>
        </div>
      </div>
      <button @click="emit('close')" class="close-btn" title="Remove this swim lane">
        <X :size="16" :stroke-width="2.5" />
      </button>
    </div>
    <div ref="chartContainer" class="chart-wrapper">
      <canvas
        ref="canvas"
        class="w-full cursor-crosshair"
        :style="{ height: chartHeight + 'px' }"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
        @click="handleCanvasClick"
        role="img"
        :aria-label="chartAriaLabel"
      ></canvas>
      <div
        v-if="tooltip.visible"
        class="absolute bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-dark)] text-white px-2 py-1.5 rounded-lg text-xs pointer-events-none z-10 shadow-lg border border-[var(--theme-primary-light)] font-bold drop-shadow-md"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        {{ tooltip.text }}
      </div>
      <div
        v-if="!hasData"
        class="absolute inset-0 flex items-center justify-center"
      >
        <p class="flex items-center gap-2 text-[var(--theme-text-tertiary)] text-sm font-semibold">
          <Loader2 :size="16" :stroke-width="2.5" class="animate-spin" />
          Waiting for events...
        </p>
      </div>
    </div>
    <!-- Cluster Expansion Panel -->
    <div v-if="expandedCluster" class="cluster-details">
      <div class="cluster-details-header">
        <span class="font-bold">Cluster Details</span>
        <button @click="expandedCluster = null" class="close-btn-small">
          <X :size="14" :stroke-width="2.5" />
        </button>
      </div>
      <div class="cluster-details-body">
        <div v-for="(point, index) in getChartData().filter(p => p.clusterId === expandedCluster)" :key="index">
          <div class="cluster-summary">
            <span class="font-bold">{{ point.summaryText || 'Event Cluster' }}</span>
            <span class="text-xs text-[var(--theme-text-tertiary)]">{{ point.count }} events</span>
          </div>
          <div class="event-list">
            <div v-for="(event, eventIndex) in point.rawEvents?.slice(0, 10)" :key="eventIndex" class="event-item">
              <span class="event-type">{{ event.hook_event_type }}</span>
              <span class="event-app">{{ event.source_app ? event.source_app.charAt(0).toUpperCase() + event.source_app.slice(1) : event.source_app }}</span>
              <span class="event-time">{{ new Date(event.timestamp || 0).toLocaleTimeString() }}</span>
            </div>
            <div v-if="(point.rawEvents?.length || 0) > 10" class="text-xs text-[var(--theme-text-tertiary)] mt-2">
              ... and {{ (point.rawEvents?.length || 0) - 10 }} more events
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import type { HookEvent, TimeRange, ChartConfig } from '../types';
import { useAgentChartData } from '../composables/useAgentChartData';
import { createChartRenderer, type ChartDimensions } from '../utils/chartRenderer';
import { useEventEmojis } from '../composables/useEventEmojis';
import { useEventColors } from '../composables/useEventColors';
import { Brain, Wrench, Clock, X, Zap, Loader2 } from 'lucide-vue-next';

const props = defineProps<{
  agentName: string; // Format: "agent:session" (e.g., "pentester:a1b2c3d4")
  events: HookEvent[];
  timeRange: TimeRange;
}>();

const emit = defineEmits<{
  close: [];
}>();

const canvas = ref<HTMLCanvasElement>();
const chartContainer = ref<HTMLDivElement>();
const chartHeight = 80;
const hoveredEventCount = ref(false);
const hoveredToolCount = ref(false);
const hoveredAvgTime = ref(false);

// Format gap time in ms to readable string (e.g., "125ms" or "1.2s")
const formatGap = (gapMs: number): string => {
  if (gapMs === 0) return '—';
  if (gapMs < 1000) {
    return `${Math.round(gapMs)}ms`;
  }
  return `${(gapMs / 1000).toFixed(1)}s`;
};

// Extract app name and session ID from agent ID for display
const appName = computed(() => props.agentName.split(':')[0]);
const sessionId = computed(() => props.agentName.split(':')[1]);

// Get model name from most recent event for this agent
const modelName = computed(() => {
  const [targetAgent, targetSession] = props.agentName.split(':');
  const agentEvents = props.events
    .filter(e => {
      // PAI uses agent_name field (if available) or falls back to source_app
      const eventAgent = e.agent_name || e.source_app;
      return eventAgent === targetAgent && e.session_id.slice(0, 8) === targetSession;
    })
    .filter(e => e.model_name); // Only events with model_name

  if (agentEvents.length === 0) return null;

  // Get most recent event's model name
  const mostRecent = agentEvents[agentEvents.length - 1];
  return mostRecent.model_name;
});

// Format model name for display (e.g., "claude-haiku-4-5-20251001" -> "haiku-4-5")
const formatModelName = (name: string | null | undefined): string => {
  if (!name) return '';

  // Extract model family and version
  // "claude-haiku-4-5-20251001" -> "haiku-4-5"
  // "claude-sonnet-4-5-20250929" -> "sonnet-4-5"
  const parts = name.split('-');
  if (parts.length >= 4) {
    return `${parts[1]}-${parts[2]}-${parts[3]}`;
  }
  return name;
};

// Format event type names for user-friendly display (matching EventRow.vue)
const formatEventType = (eventType: string): string => {
  const displayNames: Record<string, string> = {
    'PreToolUse': 'Pre-Tool',
    'PostToolUse': 'Post-Tool',
    'UserPromptSubmit': 'Prompt',
    'SessionStart': 'Session Start',
    'SessionEnd': 'Session End',
    'Stop': 'Stop',
    'SubagentStop': 'Subagent Stop',
    'PreCompact': 'Pre-Compact',
    'Notification': 'Notification',
    'Completed': 'Completed'
  };
  return displayNames[eventType] || eventType;
};

const {
  dataPoints,
  addEvent,
  getChartData,
  setTimeRange,
  cleanup: cleanupChartData,
  eventTimingMetrics: agentEventTimingMetrics
} = useAgentChartData(props.agentName);

let renderer: ReturnType<typeof createChartRenderer> | null = null;
let resizeObserver: ResizeObserver | null = null;
let animationFrame: number | null = null;
const processedEventIds = new Set<string>();

const { formatEventTypeLabel } = useEventEmojis();
const { getHexColorForApp, getHexColorForSession } = useEventColors();

const hasData = computed(() => dataPoints.value.some(dp => dp.count > 0));

const totalEventCount = computed(() => {
  return dataPoints.value.reduce((sum, dp) => sum + dp.count, 0);
});

const toolCallCount = computed(() => {
  return dataPoints.value.reduce((sum, dp) => {
    return sum + (dp.eventTypes?.['PreToolUse'] || 0);
  }, 0);
});

const chartAriaLabel = computed(() => {
  const [app, session] = props.agentName.split(':');
  return `Activity chart for ${app} (session: ${session}) showing ${totalEventCount.value} events`;
});

const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  text: ''
});

const getThemeColor = (property: string): string => {
  const style = getComputedStyle(document.documentElement);
  const color = style.getPropertyValue(`--theme-${property}`).trim();
  return color || '#3B82F6';
};

const getActiveConfig = (): ChartConfig => {
  return {
    maxDataPoints: 60,
    animationDuration: 300,
    barWidth: 3,
    barGap: 1,
    colors: {
      primary: getThemeColor('primary'),
      glow: getThemeColor('primary-light'),
      axis: getThemeColor('border-primary'),
      text: getThemeColor('text-tertiary')
    }
  };
};

const getDimensions = (): ChartDimensions => {
  const width = chartContainer.value?.offsetWidth || 800;
  return {
    width,
    height: chartHeight,
    padding: {
      top: 7,
      right: 7,
      bottom: 15,  // Minimal padding now that labels are inline with icons
      left: 7
    }
  };
};

const render = () => {
  if (!renderer || !canvas.value) return;

  const data = getChartData();
  const maxValue = Math.max(...data.map(d => d.count), 1);

  renderer.clear();
  renderer.drawBackground();
  renderer.drawAxes();
  renderer.drawTimeLabels(props.timeRange);
  renderer.drawBars(data, maxValue, 1, formatEventTypeLabel, getHexColorForSession, getHexColorForApp);
};

const animateNewEvent = (x: number, y: number) => {
  let radius = 0;
  let opacity = 0.8;

  const animate = () => {
    if (!renderer) return;

    render();
    renderer.drawPulseEffect(x, y, radius, opacity);

    radius += 2;
    opacity -= 0.02;

    if (opacity > 0) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      animationFrame = null;
    }
  };

  animate();
};

const handleResize = () => {
  if (!renderer || !canvas.value) return;

  const dimensions = getDimensions();
  renderer.resize(dimensions);
  render();
};

const processNewEvents = () => {
  const currentEvents = props.events;
  const newEventsToProcess: HookEvent[] = [];

  // Find events that haven't been processed yet
  currentEvents.forEach(event => {
    const eventKey = `${event.id}-${event.timestamp}`;
    if (!processedEventIds.has(eventKey)) {
      processedEventIds.add(eventKey);
      newEventsToProcess.push(event);
    }
  });

  // Parse agent ID to get agent name and session
  const [targetAgent, targetSession] = props.agentName.split(':');

  // Process new events (filter by agent ID: agent_name:session)
  newEventsToProcess.forEach(event => {
    if (
      event.hook_event_type !== 'refresh' &&
      event.hook_event_type !== 'initial'
    ) {
      // PAI uses agent_name field (if available) or falls back to source_app
      const eventAgent = event.agent_name || event.source_app;

      if (
        eventAgent === targetAgent &&
        event.session_id.slice(0, 8) === targetSession
      ) {
          addEvent(event);

        // Trigger pulse animation for new event
        if (renderer && canvas.value) {
          const chartArea = getDimensions();
          const x = chartArea.width - chartArea.padding.right - 10;
          const y = chartArea.height / 2;
          animateNewEvent(x, y);
        }
      }
    }
  });

  // Clean up old event IDs to prevent memory leak
  const currentEventIds = new Set(currentEvents.map(e => `${e.id}-${e.timestamp}`));
  processedEventIds.forEach(id => {
    if (!currentEventIds.has(id)) {
      processedEventIds.delete(id);
    }
  });

  render();
};

// Watch for new events - immediate: true ensures we process existing events on mount
watch(() => props.events, processNewEvents, { deep: true, immediate: true });

// Watch for time range changes - update internal timeRange and trigger reaggregation
watch(() => props.timeRange, (newRange) => {
  setTimeRange(newRange);
  render();
}, { immediate: true });

const handleMouseMove = (event: MouseEvent) => {
  if (!canvas.value || !chartContainer.value) return;

  const rect = canvas.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const data = getChartData();
  const dimensions = getDimensions();
  const chartArea = {
    x: dimensions.padding.left,
    y: dimensions.padding.top,
    width: dimensions.width - dimensions.padding.left - dimensions.padding.right,
    height: dimensions.height - dimensions.padding.top - dimensions.padding.bottom
  };

  const barWidth = chartArea.width / data.length;
  const barIndex = Math.floor((x - chartArea.x) / barWidth);

  if (barIndex >= 0 && barIndex < data.length && y >= chartArea.y && y <= chartArea.y + chartArea.height) {
    const point = data[barIndex];
    if (point.count > 0) {
      const eventTypesText = Object.entries(point.eventTypes || {})
        .map(([type, count]) => `${formatEventType(type)}: ${count}`)
        .join(', ');

      tooltip.value = {
        visible: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top - 30,
        text: `${point.count} events${eventTypesText ? ` (${eventTypesText})` : ''}`
      };
      return;
    }
  }

  tooltip.value.visible = false;
};

const handleMouseLeave = () => {
  tooltip.value.visible = false;
};

const expandedCluster = ref<string | null>(null);

const handleCanvasClick = (event: MouseEvent) => {
  if (!canvas.value || !chartContainer.value) return;

  const rect = canvas.value.getBoundingClientRect();
  const x = event.clientX - rect.left;

  const data = getChartData();
  const dimensions = getDimensions();
  const chartArea = {
    x: dimensions.padding.left,
    y: dimensions.padding.top,
    width: dimensions.width - dimensions.padding.left - dimensions.padding.right,
    height: dimensions.height - dimensions.padding.top - dimensions.padding.bottom
  };

  const barWidth = chartArea.width / data.length;
  const barIndex = Math.floor((x - chartArea.x) / barWidth);

  if (barIndex >= 0 && barIndex < data.length) {
    const point = data[barIndex];
    if (point.isCluster && point.clusterId) {
      // Toggle expansion
      if (expandedCluster.value === point.clusterId) {
        expandedCluster.value = null;
      } else {
        expandedCluster.value = point.clusterId;
      }
    }
  }
};

// Watch for theme changes
const themeObserver = new MutationObserver(() => {
  if (renderer) {
    render();
  }
});

onMounted(() => {
  if (!canvas.value || !chartContainer.value) return;

  const dimensions = getDimensions();
  const config = getActiveConfig();

  renderer = createChartRenderer(canvas.value, dimensions, config);

  // Set up resize observer
  resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(chartContainer.value);

  // Observe theme changes
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });

  // Initial render
  render();

  // Start optimized render loop with FPS limiting
  let lastRenderTime = 0;
  const targetFPS = 30;
  const frameInterval = 1000 / targetFPS;

  const renderLoop = (currentTime: number) => {
    const deltaTime = currentTime - lastRenderTime;

    if (deltaTime >= frameInterval) {
      render();
      lastRenderTime = currentTime - (deltaTime % frameInterval);
    }

    requestAnimationFrame(renderLoop);
  };
  requestAnimationFrame(renderLoop);
});

onUnmounted(() => {
  cleanupChartData();

  if (renderer) {
    renderer.stopAnimation();
  }

  if (resizeObserver && chartContainer.value) {
    resizeObserver.disconnect();
  }

  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }

  themeObserver.disconnect();
});
</script>

<style scoped>
.agent-swim-lane {
  width: 100%;
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;  /* Add spacing to prevent label overlap with next swimlane */
}

.lane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  padding: 0 7px;
  gap: 8px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.agent-label-container {
  display: flex;
  align-items: center;
  gap: 0;
  white-space: nowrap;
}

.agent-label-app-only {
  padding: 8px 8px;
  border-radius: 8px;
  border: 1px solid currentColor;
  color: white;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: inline-flex;
  align-items: center;
  min-height: 28px;
}

.model-badge,
.event-count-badge,
.tool-call-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px;
  background: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-primary);
  border-radius: 8px;
  color: var(--theme-text-primary);
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  min-height: 28px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.model-badge {
  cursor: default;
}

.event-count-badge:hover,
.tool-call-badge:hover,
.model-badge:hover {
  background: var(--theme-bg-quaternary);
  border-color: var(--theme-primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.avg-time-badge {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--theme-text-tertiary);
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--theme-bg-quaternary);
  color: var(--theme-text-primary);
  transform: scale(1.1);
}

.chart-wrapper {
  position: relative;
  width: 100%;
  border: 1px solid var(--theme-border-primary);
  border-radius: 6px;
  overflow: hidden;
  background: var(--theme-bg-tertiary);
}

.cluster-details {
  margin-top: 8px;
  background: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-primary);
  border-radius: 6px;
  overflow: hidden;
}

.cluster-details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--theme-bg-quaternary);
  border-bottom: 1px solid var(--theme-border-primary);
  font-size: 12px;
}

.close-btn-small {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--theme-text-tertiary);
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.2s;
}

.close-btn-small:hover {
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-primary);
}

.cluster-details-body {
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.cluster-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-item {
  display: grid;
  grid-template-columns: 150px 150px 1fr;
  gap: 12px;
  padding: 6px 8px;
  background: var(--theme-bg-primary);
  border-radius: 4px;
  font-size: 11px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
}

.event-type {
  color: var(--theme-text-primary);
  font-weight: 600;
}

.event-app {
  color: var(--theme-primary);
  font-weight: 600;
}

.event-time {
  color: var(--theme-text-tertiary);
  text-align: right;
}
</style>
