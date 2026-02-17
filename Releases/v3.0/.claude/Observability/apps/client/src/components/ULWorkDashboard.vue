<template>
  <div class="flex flex-col gap-4 mx-4 mt-4 mobile:mx-2 mobile:mt-2 flex-1 overflow-hidden pb-4">
    <!-- Header Stats Panel -->
    <div class="glass-panel rounded-2xl p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-[var(--theme-accent-primary)] animate-pulse" v-if="activeSection.length > 0"></div>
            <div class="w-3 h-3 rounded-full bg-green-500" v-else></div>
            <span class="text-sm font-medium text-[var(--theme-text-primary)]">UL Work</span>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <span v-if="activeSection.length > 0" class="px-2 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400 flex items-center gap-1">
              <Loader2 class="w-3 h-3 animate-spin" />
              {{ activeSection.length }} active
            </span>
            <span v-if="queuedSection.length > 0" class="px-2 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 flex items-center gap-1">
              <AlertCircle class="w-3 h-3" />
              {{ queuedSection.length }} needs triage
            </span>
            <span v-if="blockedSection.length > 0" class="px-2 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 flex items-center gap-1">
              <AlertTriangle class="w-3 h-3" />
              {{ blockedSection.length }} blocked
            </span>
            <span v-if="triagedSection.length > 0" class="px-2 py-1 rounded-lg text-xs font-medium bg-green-500/20 text-green-400">
              {{ triagedSection.length }} triaged
            </span>
            <span v-if="projectsSection.length > 0" class="px-2 py-1 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-400">
              {{ projectsSection.length }} projects
            </span>
            <span v-if="remindersSection.length > 0" class="px-2 py-1 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-400">
              {{ remindersSection.length }} reminders
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span v-if="lastPolled" class="text-xs text-[var(--theme-text-secondary)]">
            {{ formatTimeAgo(lastPolled) }}
          </span>
          <button
            @click="showClosed = !showClosed"
            class="text-xs px-2 py-1 rounded-lg transition-colors"
            :class="showClosed
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'"
          >
            {{ showClosed ? 'Hide Done' : 'Show Done' }}
          </button>
          <button
            @click="$emit('refresh')"
            class="glass-button px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 hover:bg-[var(--theme-bg-secondary)] transition-colors"
            :disabled="isLoading"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
            Refresh
          </button>
        </div>
      </div>

      <!-- Lifecycle indicator -->
      <div class="mt-3 flex items-center gap-1 text-xs text-[var(--theme-text-secondary)]">
        <span class="opacity-60">Lifecycle:</span>
        <span class="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300">needs-triage</span>
        <ChevronRight class="w-3 h-3 opacity-40" />
        <span class="px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">triaged</span>
        <ChevronRight class="w-3 h-3 opacity-40" />
        <span class="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">in-progress</span>
        <ChevronRight class="w-3 h-3 opacity-40" />
        <span class="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">closed</span>
      </div>
    </div>

    <!-- Recent Changes Banner -->
    <div
      v-if="recentChanges.length > 0"
      class="glass-panel rounded-2xl p-3 border-l-4 border-l-amber-500"
    >
      <div class="flex items-center gap-2 mb-2">
        <Bell class="w-4 h-4 text-amber-400" />
        <span class="text-sm font-medium text-amber-400">Recent Changes</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="change in recentChanges.slice(0, 8)"
          :key="`${change.issueNumber}-${change.field}-${change.timestamp}`"
          class="text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300"
        >
          #{{ change.issueNumber }}
          <template v-if="change.field === 'new'">new issue</template>
          <template v-else-if="change.field === 'state'">{{ change.oldValue }} &rarr; {{ change.newValue }}</template>
          <template v-else-if="change.field === 'assignees'">assigned to {{ change.newValue || 'none' }}</template>
          <template v-else>{{ change.field }} changed</template>
        </span>
      </div>
    </div>

    <!-- Issue Sections -->
    <div class="glass-panel rounded-2xl flex-1 overflow-hidden flex flex-col">
      <!-- Empty state -->
      <div v-if="allSections.length === 0 && !isLoading" class="flex-1 flex items-center justify-center">
        <div class="flex flex-col items-center gap-4 py-8 text-center">
          <ListChecks class="w-12 h-12 text-[var(--theme-text-secondary)] opacity-50" />
          <div>
            <h3 class="text-lg font-medium text-[var(--theme-text-primary)] mb-2">No Issues</h3>
            <p class="text-sm text-[var(--theme-text-secondary)] max-w-md">
              UL Work issues from <code class="bg-[var(--theme-bg-tertiary)] px-1.5 py-0.5 rounded">danielmiessler/ULWork</code> will appear here.
            </p>
          </div>
        </div>
      </div>

      <!-- Scrollable sections -->
      <div v-if="allSections.length > 0" class="flex-1 overflow-y-auto">

        <!-- 🔥 ACTIVE WORK -->
        <div v-if="activeSection.length > 0">
          <div class="px-4 py-2.5 bg-blue-500/10 border-b border-blue-500/20 flex items-center gap-2 sticky top-0 z-10">
            <Loader2 class="w-4 h-4 text-blue-400 animate-spin" />
            <span class="text-xs font-semibold uppercase tracking-wider text-blue-400">Active Work</span>
            <span class="text-xs text-blue-400/60">{{ activeSection.length }}</span>
          </div>
          <IssueRow
            v-for="issue in activeSection"
            :key="issue.number"
            :issue="issue"
            :work-state="getWorkState(issue)"
            :is-changed="isRecentlyChanged(issue.number)"
          />
        </div>

        <!-- 📋 QUEUED — NEEDS TRIAGE (alert-worthy) -->
        <div v-if="queuedSection.length > 0">
          <div class="px-4 py-2.5 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 sticky top-0 z-10">
            <AlertCircle class="w-4 h-4 text-red-300" />
            <span class="text-xs font-semibold uppercase tracking-wider text-red-300">Queued — Needs Triage</span>
            <span class="text-xs text-red-300/60">{{ queuedSection.length }}</span>
            <span class="ml-auto text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 animate-pulse">ACTION REQUIRED</span>
          </div>
          <IssueRow
            v-for="issue in queuedSection"
            :key="issue.number"
            :issue="issue"
            :work-state="getWorkState(issue)"
            :is-changed="isRecentlyChanged(issue.number)"
          />
        </div>

        <!-- 🚫 BLOCKED / NEEDS HUMAN -->
        <div v-if="blockedSection.length > 0">
          <div class="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 sticky top-0 z-10">
            <AlertTriangle class="w-4 h-4 text-amber-400" />
            <span class="text-xs font-semibold uppercase tracking-wider text-amber-400">Blocked / Needs Human</span>
            <span class="text-xs text-amber-400/60">{{ blockedSection.length }}</span>
          </div>
          <IssueRow
            v-for="issue in blockedSection"
            :key="issue.number"
            :issue="issue"
            :work-state="getWorkState(issue)"
            :is-changed="isRecentlyChanged(issue.number)"
          />
        </div>

        <!-- ✅ TRIAGED & PRIORITIZED -->
        <div v-if="triagedSection.length > 0">
          <div class="px-4 py-2.5 bg-green-500/10 border-b border-green-500/20 flex items-center gap-2 sticky top-0 z-10">
            <CheckCircle2 class="w-4 h-4 text-green-400" />
            <span class="text-xs font-semibold uppercase tracking-wider text-green-400">Triaged &amp; Prioritized</span>
            <span class="text-xs text-green-400/60">{{ triagedSection.length }}</span>
            <span class="ml-auto text-xs text-green-400/40">ready to pick up</span>
          </div>
          <IssueRow
            v-for="issue in triagedSection"
            :key="issue.number"
            :issue="issue"
            :work-state="getWorkState(issue)"
            :is-changed="isRecentlyChanged(issue.number)"
          />
        </div>

        <!-- 📁 PROJECTS -->
        <div v-if="projectsSection.length > 0">
          <div class="px-4 py-2.5 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center gap-2 sticky top-0 z-10">
            <FolderKanban class="w-4 h-4 text-indigo-400" />
            <span class="text-xs font-semibold uppercase tracking-wider text-indigo-400">Projects (Future)</span>
            <span class="text-xs text-indigo-400/60">{{ projectsSection.length }}</span>
            <span class="ml-auto text-xs text-indigo-400/40">break into tasks when ready</span>
          </div>
          <IssueRow
            v-for="issue in projectsSection"
            :key="issue.number"
            :issue="issue"
            :work-state="getWorkState(issue)"
            :is-changed="isRecentlyChanged(issue.number)"
          />
        </div>

        <!-- ⏰ REMINDERS -->
        <div v-if="remindersSection.length > 0">
          <div class="px-4 py-2.5 bg-purple-500/10 border-b border-purple-500/20 flex items-center gap-2 sticky top-0 z-10">
            <Clock class="w-4 h-4 text-purple-400" />
            <span class="text-xs font-semibold uppercase tracking-wider text-purple-400">Reminders</span>
            <span class="text-xs text-purple-400/60">{{ remindersSection.length }}</span>
          </div>
          <IssueRow
            v-for="issue in remindersSection"
            :key="issue.number"
            :issue="issue"
            :work-state="getWorkState(issue)"
            :is-changed="isRecentlyChanged(issue.number)"
          />
        </div>

        <!-- ✅ COMPLETED -->
        <div v-if="showClosed && completedSection.length > 0">
          <div class="px-4 py-2.5 bg-[var(--theme-bg-secondary)] border-b border-[var(--theme-bg-tertiary)] flex items-center gap-2 sticky top-0 z-10">
            <CheckCircle2 class="w-4 h-4 text-[var(--theme-text-secondary)]" />
            <span class="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-secondary)]">Recently Completed</span>
            <span class="text-xs text-[var(--theme-text-secondary)]/60">{{ completedSection.length }}</span>
          </div>
          <IssueRow
            v-for="issue in completedSection"
            :key="issue.number"
            :issue="issue"
            :work-state="getWorkState(issue)"
            :is-changed="isRecentlyChanged(issue.number)"
          />
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  RefreshCw, ListChecks, CheckCircle2, AlertTriangle, AlertCircle,
  Loader2, Bell, Clock, FolderKanban, ChevronRight
} from 'lucide-vue-next';
import type { ULWorkIssue, ULWorkChange } from '../composables/useULWork';
import IssueRow from './IssueRow.vue';

export type WorkState =
  | 'in-progress' | 'ai-working'
  | 'needs-human' | 'needs-triage' | 'blocked'
  | 'triaged' | 'ready'
  | 'project' | 'reminder'
  | 'backlog' | 'completed';

const props = defineProps<{
  issues: ULWorkIssue[];
  recentChanges: ULWorkChange[];
  lastPolled: number;
  isLoading: boolean;
  openCount: number;
  closedCount: number;
  isRecentlyChanged: (n: number) => boolean;
}>();

defineEmits<{
  refresh: [];
}>();

const showClosed = ref(false);

function getWorkState(issue: ULWorkIssue): WorkState {
  if (issue.state === 'CLOSED') return 'completed';
  const labels = issue.labels;
  // Active states
  if (labels.includes('in-progress')) return 'in-progress';
  if (labels.includes('ai-working')) return 'ai-working';
  // Blocked states
  if (labels.includes('needs-human')) return 'needs-human';
  if (labels.includes('blocked')) return 'blocked';
  // Category states (order matters — check before needs-triage since projects/reminders may also have it)
  if (labels.includes('project')) return 'project';
  if (labels.includes('reminder')) return 'reminder';
  // Triage states
  if (labels.includes('triaged')) return 'triaged';
  if (labels.includes('needs-triage')) return 'needs-triage';
  if (labels.includes('ready')) return 'ready';
  return 'backlog';
}

function sortByPriority(a: ULWorkIssue, b: ULWorkIssue): number {
  const priorityOrder = (issue: ULWorkIssue): number => {
    if (issue.labels.includes('P0-critical')) return 0;
    if (issue.labels.includes('P1-high')) return 1;
    if (issue.labels.includes('P2-medium')) return 2;
    if (issue.labels.includes('P3-low')) return 3;
    return 4;
  };
  const diff = priorityOrder(a) - priorityOrder(b);
  if (diff !== 0) return diff;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

// 🔥 Active Work (in-progress, ai-working)
const activeSection = computed(() =>
  props.issues
    .filter(i => {
      const s = getWorkState(i);
      return s === 'in-progress' || s === 'ai-working';
    })
    .sort(sortByPriority)
);

// 📋 Queued — Needs Triage (alert-worthy!)
const queuedSection = computed(() =>
  props.issues
    .filter(i => getWorkState(i) === 'needs-triage')
    .sort(sortByPriority)
);

// 🚫 Blocked / Needs Human
const blockedSection = computed(() =>
  props.issues
    .filter(i => {
      const s = getWorkState(i);
      return s === 'needs-human' || s === 'blocked';
    })
    .sort(sortByPriority)
);

// ✅ Triaged & Prioritized (includes 'ready' and 'triaged')
const triagedSection = computed(() =>
  props.issues
    .filter(i => {
      const s = getWorkState(i);
      return s === 'triaged' || s === 'ready' || s === 'backlog';
    })
    .sort(sortByPriority)
);

// 📁 Projects
const projectsSection = computed(() =>
  props.issues
    .filter(i => getWorkState(i) === 'project')
    .sort(sortByPriority)
);

// ⏰ Reminders
const remindersSection = computed(() =>
  props.issues
    .filter(i => getWorkState(i) === 'reminder')
    .sort(sortByPriority)
);

// ✅ Recently Completed
const completedSection = computed(() =>
  props.issues
    .filter(i => getWorkState(i) === 'completed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
);

const allSections = computed(() => [
  ...activeSection.value,
  ...queuedSection.value,
  ...blockedSection.value,
  ...triagedSection.value,
  ...projectsSection.value,
  ...remindersSection.value,
  ...(showClosed.value ? completedSection.value : []),
]);

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 5) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  return `${Math.floor(diffSecs / 60)}m ago`;
}
</script>
