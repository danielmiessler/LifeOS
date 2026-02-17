<template>
  <div class="modern-dashboard">
    <!-- Header Bar -->
    <div class="agent-bar px-5 py-2 mobile:px-3 mobile:py-1.5 border-b border-white/[0.03] bg-[var(--theme-bg-primary)]">
      <!-- Skills, Workflows, Tools row (with Tokens/Cost right-justified) -->
      <div class="flex items-center gap-4 flex-wrap">
        <!-- Skills -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-sm text-[var(--theme-text-tertiary)] font-medium uppercase">SKILLS:</span>
          <div v-if="skillsAndWorkflows.filter(sw => sw.type === 'skill').length === 0" class="flex items-center gap-2">
            <!-- Grayed out Core placeholder -->
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm bg-[#565f89]/20">
              <Settings2 :size="14" class="text-[#565f89]" />
              <span class="font-medium text-[#565f89]">Core</span>
            </div>
          </div>
          <div v-else class="flex items-center gap-2">
            <div
              v-for="item in skillsAndWorkflows.filter(sw => sw.type === 'skill').slice(0, 3)"
              :key="item.name"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm bg-[#bb9af7]/10"
              :title="`Skill: ${item.name}`"
            >
              <Settings2 :size="14" class="text-[#bb9af7]" />
              <span class="font-medium text-[#bb9af7]">{{ item.name }}</span>
            </div>
          </div>
        </div>

        <span class="text-[var(--theme-text-quaternary)]">|</span>

        <!-- Workflows -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-sm text-[var(--theme-text-tertiary)] font-medium uppercase">WORKFLOWS:</span>
          <div v-if="skillsAndWorkflows.filter(sw => sw.type === 'workflow').length === 0" class="flex items-center gap-2">
            <!-- Grayed out None placeholder -->
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm bg-[#565f89]/20">
              <Hammer :size="14" class="text-[#565f89]" />
              <span class="font-medium text-[#565f89]">None</span>
            </div>
          </div>
          <div v-else class="flex items-center gap-2">
            <div
              v-for="item in skillsAndWorkflows.filter(sw => sw.type === 'workflow').slice(0, 3)"
              :key="item.name"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm bg-[#7aa2f7]/10"
              :title="`Workflow: ${item.name}`"
            >
              <Hammer :size="14" class="text-[#7aa2f7]" />
              <span class="font-medium text-[#7aa2f7]">{{ item.name }}</span>
            </div>
          </div>
        </div>

        <span class="text-[var(--theme-text-quaternary)]">|</span>

        <!-- Tools -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-sm text-[var(--theme-text-tertiary)] font-medium uppercase">TOOLS:</span>
          <div v-if="topTools.length === 0" class="flex items-center gap-2">
            <!-- Grayed out placeholder tools: Read, Edit, Bash -->
            <div
              v-for="placeholderTool in ['Read', 'Edit', 'Bash']"
              :key="placeholderTool"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm bg-[#565f89]/20"
            >
              <component :is="getToolIcon(placeholderTool)" :size="14" class="text-[#565f89]" />
              <span class="font-medium text-[#565f89]">{{ placeholderTool }}</span>
            </div>
          </div>
          <div v-else class="flex items-center gap-2">
            <div
              v-for="tool in topTools.slice(0, 4)"
              :key="tool.tool"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm"
              :class="getToolStyle(tool.tool).bgClass"
              :title="`${tool.tool}: ${tool.count} calls${tool.skill ? ` (${tool.skill})` : ''}`"
            >
              <component :is="getToolIcon(tool.tool)" :size="14" :class="getToolStyle(tool.tool).iconClass" />
              <span class="font-medium" :class="getToolStyle(tool.tool).textClass">{{ tool.tool }}</span>
              <span class="font-bold" :class="getToolStyle(tool.tool).countClass">{{ tool.count }}</span>
            </div>
          </div>
        </div>

        <!-- Spacer to push pricing to the right -->
        <div class="flex-1"></div>

        <!-- Tokens -->
        <div
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm flex-shrink-0"
          style="background-color: rgba(224, 175, 104, 0.15)"
          :title="`Input: ${formatTokens(totalTokens.input)} | Output: ${formatTokens(totalTokens.output)}`"
        >
          <Cpu :size="14" class="text-[#e0af68]" />
          <span class="font-medium text-[#e0af68]">{{ formatTokens(totalTokens.input) }}/{{ formatTokens(totalTokens.output) }}</span>
        </div>

        <!-- Cost - green dollar sign and price -->
        <div
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm flex-shrink-0"
          style="background-color: rgba(158, 206, 106, 0.15)"
          :title="`Estimated cost based on Claude Opus pricing`"
        >
          <DollarSign :size="14" class="text-[#9ece6a]" />
          <span class="font-medium text-[#9ece6a]">${{ estimatedCost.toFixed(2) }}</span>
        </div>
      </div>

      <!-- Activities row - separate line below Tools -->
      <div class="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.03]">
        <span class="text-sm text-[var(--theme-text-tertiary)] font-medium flex-shrink-0 uppercase">ACTIVITIES:</span>
        <div v-if="currentActivities.length > 0" class="flex items-center gap-2 flex-wrap flex-1">
          <div
            v-for="(activity, idx) in currentActivities.slice(0, 16)"
            :key="idx"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm"
            style="background-color: rgba(125, 207, 255, 0.12)"
            :title="`${activity.agent}: ${activity.activity}`"
          >
            <Sparkles :size="11" class="text-[#7dcfff] flex-shrink-0 animate-pulse" />
            <span class="text-[var(--theme-text-secondary)]">{{ truncateToWords(activity.activity, 8) }}...</span>
          </div>
        </div>
        <span v-else class="text-sm text-[var(--theme-text-quaternary)] italic">Waiting...</span>
      </div>

      <!-- Agent Pills Bar - Above timeline -->
      <div class="flex gap-2 min-h-[32px] mt-2 pt-2 border-t border-white/[0.03]">
        <button
          v-for="appName in stableAgentNames"
          :key="appName"
          class="agent-pill-top flex-1 min-w-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer flex items-center gap-2 justify-center"
          :class="[
            isAgentActive(appName)
              ? 'text-[var(--theme-text-primary)]'
              : 'text-[var(--theme-text-secondary)] opacity-40 hover:opacity-70'
          ]"
          :style="{
            borderColor: getHexColorForApp(appName) + (isAgentActive(appName) ? '60' : '20'),
            backgroundColor: getHexColorForApp(appName) + (isAgentActive(appName) ? '20' : '05')
          }"
          :title="`${appName}: ${getAgentActionCount(appName)} action${getAgentActionCount(appName) !== 1 ? 's' : ''} (${getAgentInstanceCount(appName)} instance${getAgentInstanceCount(appName) !== 1 ? 's' : ''})`"
        >
          <Sparkles v-if="isAgentActive(appName)" :size="10" class="flex-shrink-0" :style="{ color: getHexColorForApp(appName) }" />
          <Moon v-else :size="10" class="flex-shrink-0 opacity-50" />
          <span class="font-mono truncate">{{ appName }}</span>
          <span
            v-if="getAgentActionCount(appName) >= 1"
            class="px-1.5 py-0.5 text-[14px] font-bold rounded min-w-[20px] text-center flex-shrink-0"
            :style="{
              backgroundColor: getHexColorForApp(appName),
              color: '#1a1b26'
            }"
          >
            {{ getAgentActionCount(appName) }}
          </span>
        </button>
        <!-- Grayed out placeholder agents when none active -->
        <template v-if="stableAgentNames.length === 0">
          <div
            v-for="placeholderAgent in ['User', 'Agent']"
            :key="placeholderAgent"
            class="agent-pill-top flex-1 min-w-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-2 justify-center bg-[#565f89]/20"
          >
            <Moon :size="10" class="flex-shrink-0 text-[#565f89]" />
            <span class="font-mono truncate text-[#565f89]">{{ placeholderAgent }}</span>
          </div>
        </template>
      </div>
    </div>

    <!-- Chart Section -->
    <div class="chart-section px-5 py-4 mobile:px-3 mobile:py-3">
      <div ref="chartContainer" class="relative rounded-xl overflow-hidden">
        <canvas
          ref="canvas"
          class="w-full cursor-crosshair"
          :style="{ height: chartHeight + 'px' }"
          @mousemove="handleMouseMove"
          @mouseleave="handleMouseLeave"
          role="img"
          :aria-label="chartAriaLabel"
        ></canvas>
        <div
          v-if="tooltip.visible"
          class="absolute glass-panel-elevated text-[var(--theme-text-primary)] px-3 py-2 mobile:px-3 mobile:py-2 rounded-xl text-xs mobile:text-sm pointer-events-none z-10 font-medium"
          :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
        >
          {{ tooltip.text }}
        </div>
        <div
          v-if="!hasData"
          class="absolute inset-0 flex items-center justify-center"
        >
          <div class="flex items-center gap-3 text-[var(--theme-text-tertiary)] mobile:text-sm text-base">
            <Loader2 :size="20" :stroke-width="2" class="animate-spin text-[var(--theme-primary)]" />
            <span class="font-medium">Waiting for events...</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import type { HookEvent, TimeRange, ChartConfig } from '../types';
import { useChartData } from '../composables/useChartData';
import { useAdvancedMetrics } from '../composables/useAdvancedMetrics';
import { useHeatLevel } from '../composables/useHeatLevel';
import { createChartRenderer, type ChartDimensions } from '../utils/chartRenderer';
import { useEventEmojis } from '../composables/useEventEmojis';
import { useEventColors } from '../composables/useEventColors';
import {
  Trash2, BarChart3, Users, Zap, Wrench, Clock, Loader2, Activity, Cpu, TrendingUp, Brain, Sparkles, Timer, FolderOpen, Terminal, Layers, DollarSign, Moon,
  // Tool icons
  FileText, FileEdit, FilePlus, Search, FolderSearch, Globe, Send, GitBranch, Package, Code, Database, Eye, MessageSquare, Cog, Play, type LucideIcon,
  // Skill/Workflow icons
  Settings2, Workflow, Hammer
} from 'lucide-vue-next';
import StatBadge from './stats/StatBadge.vue';
import { useAgentContext } from '../composables/useAgentContext';

const props = defineProps<{
  events: HookEvent[];
  filters: {
    sourceApp: string;
    sessionId: string;
    eventType: string;
  };
  timeRange?: TimeRange;
}>();

const emit = defineEmits<{
  updateUniqueApps: [appNames: string[]];
  updateAllApps: [appNames: string[]];
  updateTimeRange: [timeRange: TimeRange];
  updateHeatLevel: [data: { intensity: number; color: string; label: string }];
  updateEventsPerMinute: [count: number];
  updateAgentCounts: [counts: Record<string, number>];
  clearEvents: [];
  toggleFilters: [];
}>();

const canvas = ref<HTMLCanvasElement>();
const chartContainer = ref<HTMLDivElement>();
const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 600);
const chartHeight = computed(() => windowHeight.value <= 400 ? 240 : 260);

const timeRanges: TimeRange[] = ['1M', '2M', '4M', '8M', '16M'];

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
  allEvents,
  currentConfig
} = useChartData();

// Initialize advanced metrics
const {
  eventsPerMinute,
  totalTokens,
  activeSessions,
  topTools,
  skillsAndWorkflows,
  agentActivity,
  eventTypeBreakdown,
  eventsPerMinuteDelta
} = useAdvancedMetrics(allEvents, dataPoints, timeRange, currentConfig);

// Initialize heat level based on activity
const activeAgentCount = computed(() => agentActivity.value.length);
const {
  intensity: heatIntensity,
  color: heatColor,
  label: heatLabel
} = useHeatLevel(eventsPerMinute, activeAgentCount);

// Compute agent instance counts (how many ACTIVE instances of each agent type exist)
// Uses uniqueAgentIdsInWindow to count only agents with events in current time window
const agentInstanceCounts = computed(() => {
  const counts: Record<string, number> = {};
  uniqueAgentIdsInWindow.value.forEach(agentId => {
    // Extract base agent name (before any session suffix) and capitalize
    const rawName = agentId.split(':')[0];
    const baseName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    counts[baseName] = (counts[baseName] || 0) + 1;
  });
  return counts;
});

// Compute agent ACTION counts (total events/tool calls per agent type in current time window)
// This shows how many actions each agent is performing, not just how many instances exist
const agentActionCounts = computed(() => {
  const now = Date.now();
  const windowMs = currentConfig.value.duration; // Use current time range
  const cutoffTime = now - windowMs;

  const counts: Record<string, number> = {};

  allEvents.value.forEach(event => {
    if (event.timestamp && event.timestamp >= cutoffTime) {
      // Extract base agent name and capitalize
      const rawName = event.agent_name || event.source_app || 'unknown';
      const baseName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      counts[baseName] = (counts[baseName] || 0) + 1;
    }
  });

  return counts;
});

// Get action count for an agent type
const getAgentActionCount = (appName: string): number => {
  // User's actions are UserPromptSubmit events
  if (appName === 'User') {
    const now = Date.now();
    const windowMs = currentConfig.value.duration;
    const cutoffTime = now - windowMs;
    return allEvents.value.filter(e =>
      e.hook_event_type === 'UserPromptSubmit' &&
      e.timestamp &&
      e.timestamp >= cutoffTime
    ).length;
  }
  return agentActionCounts.value[appName] || 0;
};

// Stable agent names for the top pills bar (accumulates all seen agents)
const seenAgentNames = ref<Set<string>>(new Set());

// Check if user has submitted prompts in this session
const hasUserEvents = computed(() => {
  return allEvents.value.some(event => event.hook_event_type === 'UserPromptSubmit');
});

// Check if user is currently active (has UserPromptSubmit in current time window)
const isUserActive = computed(() => {
  const now = Date.now();
  const windowMs = 30000; // 30 second window
  return allEvents.value.some(event =>
    event.hook_event_type === 'UserPromptSubmit' &&
    event.timestamp &&
    (now - event.timestamp) < windowMs
  );
});

// Capitalize first letter of agent name
const capitalizeAgentName = (name: string): string => {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const stableAgentNames = computed(() => {
  // Add "User" if there are UserPromptSubmit events
  if (hasUserEvents.value) {
    seenAgentNames.value.add('User');
  }

  // Extract unique app names from all agent IDs and capitalize them
  allUniqueAgentIds.value.forEach(agentId => {
    const appName = capitalizeAgentName(agentId.split(':')[0]);
    seenAgentNames.value.add(appName);
  });
  return Array.from(seenAgentNames.value).sort();
});

// Check if an agent is currently active (has events in current time window)
const isAgentActive = (appName: string): boolean => {
  // Special case for User (principal)
  if (appName === 'User') {
    return isUserActive.value;
  }
  // Compare capitalized names
  return uniqueAgentIdsInWindow.value.some(agentId => {
    const rawName = agentId.split(':')[0];
    const capitalizedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    return capitalizedName === appName;
  });
};

// Get instance count for an agent type
const getAgentInstanceCount = (appName: string): number => {
  // User is always a single "instance"
  if (appName === 'User') {
    return hasUserEvents.value ? 1 : 0;
  }
  return agentInstanceCounts.value[appName] || 0;
};

// Format gap time in ms to readable string (e.g., "125ms" or "1.2s")
const formatGap = (gapMs: number): string => {
  if (gapMs === 0) return '—';
  if (gapMs < 1000) {
    return `${Math.round(gapMs)}ms`;
  }
  return `${(gapMs / 1000).toFixed(1)}s`;
};

// Format tokens with K/M suffixes (with tilde to indicate estimation)
const formatTokens = (tokens: number): string => {
  if (tokens === 0) return '~0';
  if (tokens >= 1000000) {
    return `~${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 10000) {
    return `~${Math.round(tokens / 1000)}K`;
  }
  if (tokens >= 1000) {
    return `~${(tokens / 1000).toFixed(1)}K`;
  }
  return `~${tokens.toString()}`;
};

// Truncate text to N words (no ellipsis - added in template)
const truncateToWords = (text: string, maxWords: number): string => {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ');
};

// Watch uniqueAgentIdsInWindow and emit updates (for active agents in time window)
watch(uniqueAgentIdsInWindow, (agentIds) => {
  emit('updateUniqueApps', agentIds);
}, { immediate: true });

// Watch allUniqueAgentIds and emit updates (for all agents ever seen)
watch(allUniqueAgentIds, (agentIds) => {
  emit('updateAllApps', agentIds);
}, { immediate: true });

// Watch timeRange and emit updates
watch(timeRange, (range) => {
  emit('updateTimeRange', range);
}, { immediate: true });

// Watch heat level and emit updates
watch([heatIntensity, heatColor, heatLabel], () => {
  emit('updateHeatLevel', {
    intensity: heatIntensity.value,
    color: heatColor.value,
    label: heatLabel.value
  });
}, { immediate: true });

// Watch agent counts and emit updates
watch(agentInstanceCounts, (counts) => {
  emit('updateAgentCounts', counts);
}, { immediate: true, deep: true });

// Watch events per minute and emit updates
watch(eventsPerMinute, (count) => {
  emit('updateEventsPerMinute', count);
}, { immediate: true });

// Real-time activities from Kitty tab titles (sent by update-tab-title.ts hook)
interface AgentActivityItem {
  agent: string;
  activity: string;
  timestamp: number;
}

// Store for real-time activities (updated via polling)
const realTimeActivities = ref<AgentActivityItem[]>([]);

// Fetch activities from Kitty tabs
const fetchActivities = async () => {
  try {
    const response = await fetch('http://localhost:4000/api/activities');
    if (response.ok) {
      const activities = await response.json();
      // Replace entire array with fresh data from API
      realTimeActivities.value = activities.map((act: any) => ({
        agent: act.agent,
        activity: act.activity,
        timestamp: new Date(act.timestamp).getTime()
      }));
    }
  } catch {
    // Server might not be running
  }
};

// Computed property that shows ONLY real-time activities from Kitty tab titles
// These are the semantic "Verb-ing noun noun" summaries from update-tab-title.ts
const currentActivities = computed((): AgentActivityItem[] => {
  // Return all activities from the server (Kitty tab titles)
  return realTimeActivities.value
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 16);
});

let renderer: ReturnType<typeof createChartRenderer> | null = null;
let resizeObserver: ResizeObserver | null = null;
let animationFrame: number | null = null;
let activityPollInterval: ReturnType<typeof setInterval> | null = null;
const processedEventIds = new Set<string>();

const { formatEventTypeLabel } = useEventEmojis();
const { getHexColorForSession, getHexColorForApp } = useEventColors();

// Agent context (learnings, active skill, session duration)
const { context: agentContext, formatDuration } = useAgentContext();

const hasData = computed(() => dataPoints.value.some(dp => dp.count > 0));

const totalEventCount = computed(() => {
  return dataPoints.value.reduce((sum, dp) => sum + dp.count, 0);
});

// Estimate cost based on Claude Opus 4 pricing
// Input: $15/1M tokens, Output: $75/1M tokens
const estimatedCost = computed(() => {
  const inputCostPerMillion = 15;
  const outputCostPerMillion = 75;
  const inputCost = (totalTokens.value.input / 1_000_000) * inputCostPerMillion;
  const outputCost = (totalTokens.value.output / 1_000_000) * outputCostPerMillion;
  return inputCost + outputCost;
});

// Tool icon mapping - returns icon component based on tool name
const getToolIcon = (toolName: string): LucideIcon => {
  const toolIcons: Record<string, LucideIcon> = {
    // File operations - cyan theme
    'Read': FileText,
    'Write': FilePlus,
    'Edit': FileEdit,
    'MultiEdit': FileEdit,
    // Search operations - purple theme
    'Grep': Search,
    'Glob': FolderSearch,
    // Shell operations - green theme
    'Bash': Terminal,
    'BashOutput': Terminal,
    // Web operations - orange theme
    'WebFetch': Globe,
    'WebSearch': Globe,
    // Task/Agent operations - pink theme
    'Task': Send,
    'TodoWrite': MessageSquare,
    // Code operations - blue theme
    'NotebookEdit': Code,
    'NotebookRead': Code,
    // System operations - yellow theme
    'Skill': Cog,
    'SlashCommand': Play,
  };
  return toolIcons[toolName] || Wrench;
};

// Tool style mapping - returns color classes based on tool category
interface ToolStyle {
  bgClass: string;
  iconClass: string;
  textClass: string;
  countClass: string;
}

const getToolStyle = (toolName: string): ToolStyle => {
  // File operations - cyan/blue
  if (['Read', 'Write', 'Edit', 'MultiEdit'].includes(toolName)) {
    return {
      bgClass: 'bg-[#7dcfff]/10',
      iconClass: 'text-[#7dcfff]',
      textClass: 'text-[#7dcfff]',
      countClass: 'text-[#7dcfff]'
    };
  }
  // Search operations - purple
  if (['Grep', 'Glob'].includes(toolName)) {
    return {
      bgClass: 'bg-[#bb9af7]/10',
      iconClass: 'text-[#bb9af7]',
      textClass: 'text-[#bb9af7]',
      countClass: 'text-[#bb9af7]'
    };
  }
  // Shell operations - green
  if (['Bash', 'BashOutput'].includes(toolName)) {
    return {
      bgClass: 'bg-[#9ece6a]/10',
      iconClass: 'text-[#9ece6a]',
      textClass: 'text-[#9ece6a]',
      countClass: 'text-[#9ece6a]'
    };
  }
  // Web operations - orange
  if (['WebFetch', 'WebSearch'].includes(toolName)) {
    return {
      bgClass: 'bg-[#ff9e64]/10',
      iconClass: 'text-[#ff9e64]',
      textClass: 'text-[#ff9e64]',
      countClass: 'text-[#ff9e64]'
    };
  }
  // Task/Agent operations - pink
  if (['Task', 'TodoWrite'].includes(toolName)) {
    return {
      bgClass: 'bg-[#f7768e]/10',
      iconClass: 'text-[#f7768e]',
      textClass: 'text-[#f7768e]',
      countClass: 'text-[#f7768e]'
    };
  }
  // Default - neutral gray
  return {
    bgClass: 'bg-[#565f89]/10',
    iconClass: 'text-[#a9b1d6]',
    textClass: 'text-[#a9b1d6]',
    countClass: 'text-[#c0caf5]'
  };
};

const chartAriaLabel = computed(() => {
  const rangeText = timeRange.value === '1M' ? '1 minute' : timeRange.value === '2M' ? '2 minutes' : timeRange.value === '4M' ? '4 minutes' : timeRange.value === '8M' ? '8 minutes' : '16 minutes';
  return `Activity chart showing ${totalEventCount.value} events over the last ${rangeText}`;
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
  return color || '#3B82F6'; // fallback
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
    height: chartHeight.value,
    padding: {
      top: 15,
      right: 15,
      bottom: 35,  // More space for time labels
      left: 15
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
  renderer.drawTimeLabels(timeRange.value);
  renderer.drawBars(data, maxValue, 1, formatEventTypeLabel, getHexColorForApp);
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

const handleWindowResize = () => {
  windowHeight.value = window.innerHeight;
};

const handleResize = () => {
  if (!renderer || !canvas.value) return;

  const dimensions = getDimensions();
  renderer.resize(dimensions);
  render();
};

const isEventFiltered = (event: HookEvent): boolean => {
  if (props.filters.sourceApp && event.source_app !== props.filters.sourceApp) {
    return false;
  }
  if (props.filters.sessionId && event.session_id !== props.filters.sessionId) {
    return false;
  }
  if (props.filters.eventType && event.hook_event_type !== props.filters.eventType) {
    return false;
  }
  return true;
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
  
  // Process new events
  newEventsToProcess.forEach(event => {
    if (event.hook_event_type !== 'refresh' && event.hook_event_type !== 'initial' && isEventFiltered(event)) {
      addEvent(event);
      
      // Trigger pulse animation for new event
      if (renderer && canvas.value) {
        const chartArea = getDimensions();
        const x = chartArea.width - chartArea.padding.right - 10;
        const y = chartArea.height / 2;
        animateNewEvent(x, y);
      }
    }
  });
  
  // Clean up old event IDs to prevent memory leak
  // Keep only IDs from current events
  const currentEventIds = new Set(currentEvents.map(e => `${e.id}-${e.timestamp}`));
  processedEventIds.forEach(id => {
    if (!currentEventIds.has(id)) {
      processedEventIds.delete(id);
    }
  });
  
  render();
};

// Watch for new events
watch(() => props.events, (newEvents) => {
  // If events array is empty, clear all internal state
  if (newEvents.length === 0) {
    clearData();
    processedEventIds.clear();
    render();
    return;
  }
  processNewEvents();
}, { deep: true });

// Watch for filter changes
watch(() => props.filters, () => {
  // Reset and reprocess all events with new filters
  dataPoints.value = [];
  processedEventIds.clear();
  processNewEvents();
}, { deep: true });

// Watch for time range changes (internal)
watch(timeRange, () => {
  // Need to re-process all events when time range changes
  // because bucket sizes are different
  render();
});

// Watch for time range prop changes (from parent, e.g., IntensityBar buttons)
watch(() => props.timeRange, (newRange) => {
  if (newRange && newRange !== timeRange.value) {
    setTimeRange(newRange);
  }
});

// Watch for chart height changes
watch(chartHeight, () => {
  handleResize();
});

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
        .map(([type, count]) => `${type}: ${count}`)
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

const handleTimeRangeKeyDown = (event: KeyboardEvent, currentIndex: number) => {
  let newIndex = currentIndex;
  
  switch (event.key) {
    case 'ArrowLeft':
      newIndex = Math.max(0, currentIndex - 1);
      break;
    case 'ArrowRight':
      newIndex = Math.min(timeRanges.length - 1, currentIndex + 1);
      break;
    case 'Home':
      newIndex = 0;
      break;
    case 'End':
      newIndex = timeRanges.length - 1;
      break;
    default:
      return;
  }
  
  if (newIndex !== currentIndex) {
    event.preventDefault();
    setTimeRange(timeRanges[newIndex]);
    // Focus the new button
    const buttons = (event.currentTarget as HTMLElement)?.parentElement?.querySelectorAll('button');
    if (buttons && buttons[newIndex]) {
      (buttons[newIndex] as HTMLButtonElement).focus();
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

  // Fetch initial activities from server
  fetchActivities();

  // Poll for activities every 2 seconds (stored globally for cleanup)
  activityPollInterval = setInterval(fetchActivities, 2000);

  // Set up resize observer
  resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(chartContainer.value);

  // Observe theme changes
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });

  // Listen for window height changes
  window.addEventListener('resize', handleWindowResize);

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

  // Clean up activity polling interval
  if (activityPollInterval) {
    clearInterval(activityPollInterval);
  }

  themeObserver.disconnect();

  // Remove window resize listener
  window.removeEventListener('resize', handleWindowResize);
});
</script>

<style scoped>
/* Modern Dashboard Layout */
.modern-dashboard {
  display: flex;
  flex-direction: column;
}

/* Tools Bar - Horizontal list of active tools */
.tools-bar {
  /* border removed */
}

/* Chart Section - Clean with breathing room */
.chart-section {
  /* Clean styling inherited from parent glass panel */
}

</style>