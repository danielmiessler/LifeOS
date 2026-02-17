<template>
  <div class="compact-mode h-screen flex flex-col theme-tokyo-night dashboard-modern">
    <!-- Background gradient overlay -->
    <div class="fixed inset-0 bg-gradient-to-br from-[#1a1b26] via-[#16161e] to-[#0f0f14] -z-10"></div>
    <div class="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM3YWEyZjciIGZpbGwtb3BhY2l0eT0iMC4wMiI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] -z-10 opacity-50"></div>

    <!-- Tab Navigation -->
    <TabNavigation
      :active-tab="currentTab"
      :local-count="events.length"
      :ulwork-count="ulworkOpenCount"
      @set-tab="currentTab = $event"
    />

    <!-- LOCAL TAB CONTENT -->
    <template v-if="currentTab === 'local'">
      <!-- Filters -->
      <FilterPanel
      v-if="showFilters"
      class="short:hidden glass-panel-elevated mx-4 mt-4 rounded-2xl"
      :filters="filters"
      @update:filters="filters = $event"
    />

    <!-- Live Pulse Chart - Glass Panel -->
    <div class="mx-4 mt-4 mobile:mx-2 mobile:mt-2">
      <div class="glass-panel rounded-2xl overflow-hidden">
        <LivePulseChart
          :events="events"
          :filters="filters"
          :time-range="currentTimeRange"
          @update-unique-apps="uniqueAppNames = $event"
          @update-all-apps="allAppNames = $event"
          @update-time-range="currentTimeRange = $event"
          @update-heat-level="heatLevel = $event"
          @update-events-per-minute="eventsPerMinute = $event"
          @update-agent-counts="agentCounts = $event"
          @clear-events="handleClearClick"
          @toggle-filters="showFilters = !showFilters"
        />
      </div>
    </div>

    <!-- Agent Swim Lane Container - Glass Panel -->
    <div v-if="selectedAgentLanes.length > 0" class="mx-4 mt-4 mobile:mx-2 mobile:mt-2">
      <div class="glass-panel rounded-2xl p-4 mobile:p-2">
        <AgentSwimLaneContainer
          :selected-agents="selectedAgentLanes"
          :events="events"
          :time-range="currentTimeRange"
          @update:selected-agents="selectedAgentLanes = $event"
        />
      </div>
    </div>

    <!-- Timeline - Glass Panel -->
    <div class="flex flex-col flex-1 overflow-hidden mx-4 my-4 mobile:mx-2 mobile:my-2">
      <div class="glass-panel rounded-2xl flex-1 overflow-hidden">
        <EventTimeline
          :events="events"
          :filters="filters"
          :unique-app-names="uniqueAppNames"
          :all-app-names="allAppNames"
          :heat-level="heatLevel"
          :agent-counts="agentCounts"
          :events-per-minute="eventsPerMinute"
          :time-range="currentTimeRange"
          :time-ranges="['1M', '2M', '4M', '8M', '16M']"
          v-model:stick-to-bottom="stickToBottom"
          @select-agent="toggleAgentLane"
          @set-time-range="setTimeRangeFromTimeline"
        />
      </div>
    </div>

      <!-- Stick to bottom button - Glass styling -->
      <StickScrollButton
        class="short:hidden glass-button"
        :stick-to-bottom="stickToBottom"
        @toggle="stickToBottom = !stickToBottom"
      />
    </template>

    <!-- REMOTE TAB CONTENT -->
    <RemoteAgentDashboard
      v-if="currentTab === 'remote'"
    />

    <!-- UL WORK TAB CONTENT -->
    <ULWorkDashboard
      v-if="currentTab === 'ulwork'"
      :issues="ulworkIssues"
      :recent-changes="ulworkRecentChanges"
      :last-polled="ulworkLastPolled"
      :is-loading="ulworkIsLoading"
      :open-count="ulworkOpenCount"
      :closed-count="ulworkClosedCount"
      :is-recently-changed="ulworkIsRecentlyChanged"
      @refresh="ulworkFetchIssues"
    />

    <!-- Error message - Glass styling -->
    <div
      v-if="error"
      class="fixed bottom-6 left-6 mobile:bottom-4 mobile:left-4 mobile:right-4 glass-panel-elevated rounded-xl px-4 py-3 mobile:px-3 mobile:py-2 border-l-4 border-[var(--theme-accent-error)]"
    >
      <span class="text-[var(--theme-accent-error)] font-medium">{{ error }}</span>
    </div>

    <!-- Theme Manager -->
    <ThemeManager
      :is-open="showThemeManager"
      @close="showThemeManager = false"
    />

    <!-- Toast Notifications -->
    <ToastNotification
      v-for="(toast, index) in toasts"
      :key="toast.id"
      :index="index"
      :agent-name="toast.agentName"
      :agent-color="toast.agentColor"
      @dismiss="dismissToast(toast.id)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { TimeRange } from './types';
import { useWebSocket } from './composables/useWebSocket';
import { useThemes } from './composables/useThemes';
import { useEventColors } from './composables/useEventColors';
import EventTimeline from './components/EventTimeline.vue';
import FilterPanel from './components/FilterPanel.vue';
import StickScrollButton from './components/StickScrollButton.vue';
import LivePulseChart from './components/LivePulseChart.vue';
import ThemeManager from './components/ThemeManager.vue';
import ToastNotification from './components/ToastNotification.vue';
import AgentSwimLaneContainer from './components/AgentSwimLaneContainer.vue';
import TabNavigation from './components/TabNavigation.vue';
import RemoteAgentDashboard from './components/RemoteAgentDashboard.vue';
import ULWorkDashboard from './components/ULWorkDashboard.vue';
import { useULWork } from './composables/useULWork';

// Tab state
const currentTab = ref<'local' | 'remote' | 'ulwork'>('local');

// WebSocket connection
const { events, isConnected, error, clearEvents, onMessage } = useWebSocket('ws://localhost:4000/stream');

// Theme management (sets up theme system)
useThemes();

// Event colors
const { getHexColorForApp } = useEventColors();

// UL Work state
const {
  issues: ulworkIssues,
  recentChanges: ulworkRecentChanges,
  lastPolled: ulworkLastPolled,
  isLoading: ulworkIsLoading,
  openCount: ulworkOpenCount,
  closedCount: ulworkClosedCount,
  handleUpdate: ulworkHandleUpdate,
  fetchIssues: ulworkFetchIssues,
  isRecentlyChanged: ulworkIsRecentlyChanged,
} = useULWork();

// Wire WebSocket ulwork_update messages to the UL Work composable
onMessage((type, data) => {
  if (type === 'ulwork_update') {
    ulworkHandleUpdate(data);
  }
});

// Filters
const filters = ref({
  sourceApp: '',
  sessionId: '',
  eventType: ''
});

// UI state
const stickToBottom = ref(true);
const showThemeManager = ref(false);
const showFilters = ref(false);
const uniqueAppNames = ref<string[]>([]); // Apps active in current time window
const allAppNames = ref<string[]>([]); // All apps ever seen in session
const selectedAgentLanes = ref<string[]>([]);
const currentTimeRange = ref<TimeRange>('1M'); // Current time range from LivePulseChart
const heatLevel = ref({ intensity: 0, color: '#565f89', label: 'Low' });
const agentCounts = ref<Record<string, number>>({});
const eventsPerMinute = ref(0);

// Toast notifications
interface Toast {
  id: number;
  agentName: string;
  agentColor: string;
}
const toasts = ref<Toast[]>([]);
let toastIdCounter = 0;
const seenAgents = new Set<string>();

// Watch for new agents and show toast
watch(uniqueAppNames, (newAppNames) => {
  // Find agents that are new (not in seenAgents set)
  newAppNames.forEach(appName => {
    if (!seenAgents.has(appName)) {
      seenAgents.add(appName);
      // Show toast for new agent
      const toast: Toast = {
        id: toastIdCounter++,
        agentName: appName,
        agentColor: getHexColorForApp(appName)
      };
      toasts.value.push(toast);
    }
  });
}, { deep: true });

const dismissToast = (id: number) => {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
};

// Handle agent tag clicks for swim lanes
const toggleAgentLane = (agentName: string) => {
  const index = selectedAgentLanes.value.indexOf(agentName);
  if (index >= 0) {
    // Remove from comparison
    selectedAgentLanes.value.splice(index, 1);
  } else {
    // Add to comparison
    selectedAgentLanes.value.push(agentName);
  }
};

// Handle clear button click
const handleClearClick = () => {
  clearEvents();
  selectedAgentLanes.value = [];
};

// Handle time range change from EventTimeline
const setTimeRangeFromTimeline = (range: TimeRange) => {
  currentTimeRange.value = range;
};

// Debug handler for theme manager
const handleThemeManagerClick = () => {
  console.log('Theme manager button clicked!');
  showThemeManager.value = true;
};
</script>