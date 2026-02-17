<template>
  <div class="flex flex-col gap-4 mx-4 mt-4 mobile:mx-2 mobile:mt-2 flex-1 overflow-hidden pb-4">
    <!-- Header Stats Panel - Similar to LivePulseChart header -->
    <div class="glass-panel rounded-2xl p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-blue-500 animate-pulse" v-if="runningCount > 0"></div>
            <div class="w-3 h-3 rounded-full bg-green-500" v-else></div>
            <span class="text-sm font-medium text-[var(--theme-text-primary)]">Background Tasks</span>
          </div>

          <!-- Stats badges -->
          <div class="flex items-center gap-3">
            <span class="px-2 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400">
              {{ runningCount }} running
            </span>
            <span class="px-2 py-1 rounded-lg text-xs font-medium bg-green-500/20 text-green-400">
              {{ completedCount }} completed
            </span>
            <span v-if="failedCount > 0" class="px-2 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-400">
              {{ failedCount }} failed
            </span>
          </div>
        </div>

        <button
          @click="fetchTasks"
          class="glass-button px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 hover:bg-[var(--theme-bg-secondary)] transition-colors"
          :disabled="isLoading"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
          Refresh
        </button>
      </div>
    </div>

    <!-- Error message -->
    <div
      v-if="error"
      class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400"
    >
      {{ error }}
    </div>

    <!-- Task Timeline - Similar to EventTimeline -->
    <div class="glass-panel rounded-2xl flex-1 overflow-hidden flex flex-col">
      <!-- Timeline header -->
      <div class="px-4 py-3 border-b border-[var(--theme-bg-tertiary)] flex items-center justify-between">
        <span class="text-sm font-medium text-[var(--theme-text-secondary)]">Task Timeline</span>
        <span class="text-xs text-[var(--theme-text-secondary)]">{{ tasks.length }} tasks</span>
      </div>

      <!-- Empty state -->
      <div v-if="tasks.length === 0 && !isLoading" class="flex-1 flex items-center justify-center">
        <div class="flex flex-col items-center gap-4 py-8 text-center">
          <Terminal class="w-12 h-12 text-[var(--theme-text-secondary)] opacity-50" />
          <div>
            <h3 class="text-lg font-medium text-[var(--theme-text-primary)] mb-2">No Background Tasks</h3>
            <p class="text-sm text-[var(--theme-text-secondary)] max-w-md">
              Start a background task using Bash with <code class="bg-[var(--theme-bg-tertiary)] px-1.5 py-0.5 rounded">run_in_background: true</code>
            </p>
          </div>
        </div>
      </div>

      <!-- Task List - Timeline style -->
      <div v-if="tasks.length > 0" class="flex-1 overflow-y-auto">
        <div class="divide-y divide-[var(--theme-bg-tertiary)]">
          <div
            v-for="task in tasks"
            :key="task.taskId"
            class="group"
          >
            <!-- Task Row - Collapsed -->
            <div
              class="px-4 py-3 cursor-pointer hover:bg-[var(--theme-bg-secondary)] transition-colors flex items-start gap-3"
              :class="{
                'bg-blue-500/5 border-l-2 border-l-blue-500': task.status === 'running',
                'opacity-70': task.status === 'completed'
              }"
              @click="toggleTask(task)"
            >
              <!-- Status indicator with icon -->
              <div class="flex flex-col items-center pt-0.5">
                <Loader2
                  v-if="task.status === 'running'"
                  class="w-5 h-5 text-blue-400 animate-spin flex-shrink-0"
                />
                <CheckCircle2
                  v-else-if="task.status === 'completed'"
                  class="w-5 h-5 text-green-500 flex-shrink-0"
                />
                <XCircle
                  v-else
                  class="w-5 h-5 text-red-500 flex-shrink-0"
                />
                <div
                  v-if="selectedTask?.taskId !== task.taskId"
                  class="w-0.5 flex-1 mt-1 bg-[var(--theme-bg-tertiary)]"
                ></div>
              </div>

              <!-- Task Content -->
              <div class="flex-1 min-w-0">
                <!-- Task header -->
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-medium text-[var(--theme-text-primary)] truncate">
                    {{ task.description }}
                  </span>
                  <span
                    class="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                    :class="getStatusBadgeClass(task.status)"
                  >
                    {{ task.status }}
                  </span>
                  <span
                    class="text-xs px-1.5 py-0.5 rounded bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)] flex-shrink-0"
                  >
                    {{ task.taskType }}
                  </span>
                </div>

                <!-- Task metadata -->
                <div class="flex items-center gap-4 text-xs text-[var(--theme-text-secondary)]">
                  <code class="font-mono">{{ task.taskId }}</code>
                  <span class="flex items-center gap-1">
                    <Clock class="w-3 h-3" />
                    {{ formatDuration(task) }}
                  </span>
                  <span class="flex items-center gap-1">
                    <Activity class="w-3 h-3" />
                    {{ task.eventCount }} lines
                  </span>
                  <span>{{ formatTime(task.startedAt) }}</span>
                </div>
              </div>

              <!-- Expand indicator -->
              <ChevronDown
                class="w-4 h-4 text-[var(--theme-text-secondary)] transition-transform flex-shrink-0"
                :class="{ 'rotate-180': selectedTask?.taskId === task.taskId }"
              />
            </div>

            <!-- Expanded Details -->
            <div
              v-if="selectedTask?.taskId === task.taskId"
              class="px-4 pb-4 bg-[var(--theme-bg-secondary)]"
            >
              <div class="ml-6 pl-3 border-l-2 border-[var(--theme-bg-tertiary)]">
                <!-- Output Preview -->
                <div class="mb-4">
                  <h4 class="text-xs font-medium text-[var(--theme-text-secondary)] mb-2 uppercase tracking-wide flex items-center gap-2">
                    <Terminal class="w-3 h-3" />
                    Live Output
                  </h4>
                  <div class="bg-[var(--theme-bg-primary)] rounded-lg p-3 font-mono text-xs text-[var(--theme-text-primary)] whitespace-pre-wrap max-h-[300px] overflow-y-auto border border-[var(--theme-bg-tertiary)]">{{ task.outputPreview || 'No output yet...' }}</div>
                </div>

                <!-- Error if present -->
                <div v-if="task.error" class="mb-4">
                  <h4 class="text-xs font-medium text-red-400 mb-2 uppercase tracking-wide flex items-center gap-2">
                    <AlertCircle class="w-3 h-3" />
                    Error
                  </h4>
                  <div class="bg-red-500/10 rounded-lg p-3 text-sm text-red-400 whitespace-pre-wrap border border-red-500/20">
                    {{ task.error }}
                  </div>
                </div>

                <!-- Metadata Grid -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div class="bg-[var(--theme-bg-primary)] rounded-lg p-2 border border-[var(--theme-bg-tertiary)]">
                    <span class="text-[var(--theme-text-secondary)] block mb-1">Task ID</span>
                    <code class="text-[var(--theme-text-primary)] font-mono">{{ task.taskId }}</code>
                  </div>
                  <div class="bg-[var(--theme-bg-primary)] rounded-lg p-2 border border-[var(--theme-bg-tertiary)]">
                    <span class="text-[var(--theme-text-secondary)] block mb-1">Type</span>
                    <span class="text-[var(--theme-text-primary)]">{{ task.taskType }}</span>
                  </div>
                  <div class="bg-[var(--theme-bg-primary)] rounded-lg p-2 border border-[var(--theme-bg-tertiary)]">
                    <span class="text-[var(--theme-text-secondary)] block mb-1">Started</span>
                    <span class="text-[var(--theme-text-primary)]">{{ formatTime(task.startedAt) }}</span>
                  </div>
                  <div class="bg-[var(--theme-bg-primary)] rounded-lg p-2 border border-[var(--theme-bg-tertiary)]">
                    <span class="text-[var(--theme-text-secondary)] block mb-1">Last Activity</span>
                    <span class="text-[var(--theme-text-primary)]">{{ formatTime(task.lastActivity) }}</span>
                  </div>
                </div>

                <!-- Output file path -->
                <div class="mt-3 text-xs text-[var(--theme-text-secondary)]">
                  <span class="opacity-60">Output file:</span>
                  <code class="ml-1 opacity-80">{{ task.outputFile }}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RefreshCw, Terminal, Clock, Activity, ChevronDown, AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-vue-next';
import { useBackgroundTasks } from '../composables/useBackgroundTasks';
import type { BackgroundTask } from '../types';

const { tasks: rawTasks, selectedTask, isLoading, error, fetchTasks, selectTask } = useBackgroundTasks();

// Sort tasks: running first, then by most recent
const tasks = computed(() => {
  const statusOrder = { running: 0, failed: 1, completed: 2 };
  return [...rawTasks.value].sort((a, b) => {
    const statusDiff = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
    if (statusDiff !== 0) return statusDiff;
    return b.startedAt - a.startedAt;
  });
});

const runningCount = computed(() =>
  rawTasks.value.filter(t => t.status === 'running').length
);

const completedCount = computed(() =>
  rawTasks.value.filter(t => t.status === 'completed').length
);

const failedCount = computed(() =>
  rawTasks.value.filter(t => t.status === 'failed').length
);

const toggleTask = (task: BackgroundTask) => {
  if (selectedTask.value?.taskId === task.taskId) {
    selectTask(null);
  } else {
    selectTask(task);
  }
};

const getStatusClass = (status: string) => {
  switch (status) {
    case 'running':
      return 'bg-blue-500 animate-pulse';
    case 'completed':
      return 'bg-green-500';
    case 'failed':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'running':
      return 'bg-blue-500/20 text-blue-400';
    case 'completed':
      return 'bg-green-500/20 text-green-400';
    case 'failed':
      return 'bg-red-500/20 text-red-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
};

const formatDuration = (task: BackgroundTask) => {
  const end = task.completedAt || Date.now();
  const ms = end - task.startedAt;

  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
};

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString();
};
</script>
