<template>
  <div
    class="px-4 py-3 hover:bg-[var(--theme-bg-secondary)] transition-all duration-300 border-b border-[var(--theme-bg-tertiary)]"
    :class="{
      'bg-amber-500/5 ring-1 ring-inset ring-amber-500/20': isChanged,
    }"
  >
    <div class="flex items-start gap-3">
      <!-- State icon -->
      <div class="pt-0.5 flex-shrink-0">
        <!-- Active: in-progress -->
        <div v-if="workState === 'in-progress'" class="relative">
          <Loader2 class="w-5 h-5 text-blue-400 animate-spin" />
        </div>
        <!-- Active: ai-working -->
        <div v-else-if="workState === 'ai-working'" class="relative">
          <Bot class="w-5 h-5 text-cyan-400 animate-pulse" />
        </div>
        <!-- Attention: needs-human -->
        <div v-else-if="workState === 'needs-human'">
          <HandMetal class="w-5 h-5 text-amber-400" />
        </div>
        <!-- Attention: needs-triage -->
        <div v-else-if="workState === 'needs-triage'">
          <AlertCircle class="w-5 h-5 text-red-300" />
        </div>
        <!-- Attention: blocked -->
        <div v-else-if="workState === 'blocked'">
          <Ban class="w-5 h-5 text-red-400" />
        </div>
        <!-- Triaged: ready to pick up -->
        <div v-else-if="workState === 'triaged' || workState === 'ready'">
          <CheckCircle2 class="w-5 h-5 text-green-400" />
        </div>
        <!-- Project: future initiative -->
        <div v-else-if="workState === 'project'">
          <FolderKanban class="w-5 h-5 text-indigo-400" />
        </div>
        <!-- Reminder: time-sensitive -->
        <div v-else-if="workState === 'reminder'">
          <BellRing class="w-5 h-5 text-purple-400" />
        </div>
        <!-- Completed -->
        <div v-else-if="workState === 'completed'">
          <CheckCircle2 class="w-5 h-5 text-[var(--theme-text-secondary)]" />
        </div>
        <!-- Default backlog -->
        <div v-else>
          <Circle class="w-5 h-5 text-[var(--theme-text-secondary)] opacity-40" />
        </div>
      </div>

      <!-- Issue Content -->
      <div class="flex-1 min-w-0">
        <!-- Title row -->
        <div class="flex items-center gap-2 mb-0.5">
          <span class="font-medium text-[var(--theme-text-primary)] truncate" :class="{ 'opacity-60': workState === 'completed' }">
            {{ issue.title }}
          </span>
          <span class="text-xs text-[var(--theme-text-secondary)] opacity-50 flex-shrink-0">
            #{{ issue.number }}
          </span>
        </div>

        <!-- Description excerpt -->
        <p
          v-if="descriptionExcerpt"
          class="text-xs text-[var(--theme-text-secondary)] mb-1.5 line-clamp-2 leading-relaxed"
          :class="{ 'opacity-50': workState === 'completed' }"
        >
          {{ descriptionExcerpt }}
        </p>

        <!-- Labels row -->
        <div class="flex flex-wrap items-center gap-1.5 mb-1.5">
          <!-- Priority badge (prominent) -->
          <span
            v-if="priorityLabel"
            class="text-xs px-1.5 py-0.5 rounded font-semibold"
            :class="priorityClass"
          >
            {{ priorityLabel }}
          </span>
          <!-- Status badge -->
          <span
            class="text-xs px-1.5 py-0.5 rounded"
            :class="statusBadgeClass"
          >
            {{ statusLabel }}
          </span>
          <!-- Other labels -->
          <span
            v-for="label in displayLabels"
            :key="label"
            class="text-xs px-1.5 py-0.5 rounded-full"
            :class="getLabelClass(label)"
          >
            {{ label }}
          </span>
        </div>

        <!-- Meta row -->
        <div class="flex items-center gap-4 text-xs text-[var(--theme-text-secondary)]">
          <span v-if="issue.assignees.length > 0" class="flex items-center gap-1">
            <Users class="w-3 h-3" />
            {{ issue.assignees.join(', ') }}
          </span>
          <span v-else class="flex items-center gap-1 opacity-40">
            <Users class="w-3 h-3" />
            unassigned
          </span>
          <span class="flex items-center gap-1">
            <Clock class="w-3 h-3" />
            {{ formatDate(issue.updatedAt) }}
          </span>
          <span v-if="effortLabel" class="flex items-center gap-1 opacity-60">
            <Timer class="w-3 h-3" />
            {{ effortLabel }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Loader2, Bot, HandMetal, AlertTriangle, AlertCircle, Ban, PlayCircle,
  CheckCircle2, Circle, Users, Clock, Timer, FolderKanban, BellRing
} from 'lucide-vue-next';
import type { ULWorkIssue } from '../composables/useULWork';
import type { WorkState } from './ULWorkDashboard.vue';

const props = defineProps<{
  issue: ULWorkIssue;
  workState: WorkState;
  isChanged: boolean;
}>();

// Extract a clean description excerpt from the body
const descriptionExcerpt = computed(() => {
  if (!props.issue.body) return '';
  // Strip markdown headers, links, checkboxes, and formatting
  const cleaned = props.issue.body
    .replace(/^#{1,6}\s+.*/gm, '')         // Remove headers
    .replace(/^[-*]\s*\[[ x]\]\s*/gm, '')  // Remove checkboxes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links → text
    .replace(/\*\*([^*]+)\*\*/g, '$1')      // Bold → plain
    .replace(/^[-*]\s+/gm, '')              // Remove list markers
    .replace(/\n{2,}/g, ' ')               // Collapse newlines
    .replace(/\n/g, ' ')                    // Single newlines → space
    .replace(/\s{2,}/g, ' ')               // Collapse spaces
    .trim();
  // Return first ~150 chars
  if (cleaned.length > 150) {
    return cleaned.slice(0, 150).replace(/\s\S*$/, '') + '...';
  }
  return cleaned;
});

// Priority label and class
const priorityLabel = computed(() => {
  const labels = props.issue.labels;
  if (labels.includes('P0-critical')) return 'P0';
  if (labels.includes('P1-high')) return 'P1';
  if (labels.includes('P2-medium')) return 'P2';
  if (labels.includes('P3-low')) return 'P3';
  return null;
});

const priorityClass = computed(() => {
  switch (priorityLabel.value) {
    case 'P0': return 'bg-red-500/30 text-red-300 ring-1 ring-red-500/40';
    case 'P1': return 'bg-orange-500/25 text-orange-300';
    case 'P2': return 'bg-yellow-500/20 text-yellow-300';
    case 'P3': return 'bg-gray-500/20 text-gray-400';
    default: return '';
  }
});

// Status label and class based on work state
const statusLabel = computed(() => {
  switch (props.workState) {
    case 'in-progress': return 'In Progress';
    case 'ai-working': return 'AI Working';
    case 'needs-human': return 'Needs Human';
    case 'needs-triage': return 'Needs Triage';
    case 'blocked': return 'Blocked';
    case 'triaged': return 'Triaged';
    case 'ready': return 'Ready';
    case 'project': return 'Project';
    case 'reminder': return 'Reminder';
    case 'completed': return 'Done';
    default: return 'Open';
  }
});

const statusBadgeClass = computed(() => {
  switch (props.workState) {
    case 'in-progress': return 'bg-blue-500/20 text-blue-400';
    case 'ai-working': return 'bg-cyan-500/20 text-cyan-400';
    case 'needs-human': return 'bg-amber-500/20 text-amber-400';
    case 'needs-triage': return 'bg-red-500/20 text-red-300';
    case 'blocked': return 'bg-red-500/20 text-red-400';
    case 'triaged': return 'bg-green-500/20 text-green-400';
    case 'ready': return 'bg-green-500/20 text-green-400';
    case 'project': return 'bg-indigo-500/20 text-indigo-400';
    case 'reminder': return 'bg-purple-500/20 text-purple-400';
    case 'completed': return 'bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)]';
    default: return 'bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)]';
  }
});

// Effort label from effort labels
const effortLabel = computed(() => {
  const labels = props.issue.labels;
  if (labels.includes('quick-win')) return 'Quick win';
  if (labels.includes('half-day')) return 'Half day';
  if (labels.includes('multi-day')) return 'Multi-day';
  if (labels.includes('project')) return 'Project';
  return null;
});

// Labels to display (exclude priority, status, and effort labels already shown separately)
const HIDDEN_LABELS = new Set([
  'P0-critical', 'P1-high', 'P2-medium', 'P3-low',
  'in-progress', 'ai-working', 'needs-human', 'needs-triage',
  'blocked', 'ready', 'triaged',
  'quick-win', 'half-day', 'multi-day', 'project', 'reminder',
]);

const displayLabels = computed(() =>
  props.issue.labels.filter(l => !HIDDEN_LABELS.has(l))
);

function getLabelClass(label: string): string {
  if (label === 'problem') return 'bg-red-500/20 text-red-400';
  if (label === 'feature') return 'bg-blue-500/20 text-blue-400';
  if (label === 'reminder') return 'bg-purple-500/20 text-purple-400';
  if (label === 'metric-alert') return 'bg-orange-500/20 text-orange-400';
  if (label === 'decision') return 'bg-indigo-500/20 text-indigo-400';
  if (label.startsWith('agent:')) return 'bg-cyan-500/20 text-cyan-400';
  // Property labels
  if (['newsletter', 'website', 'youtube', 'podcast', 'community', 'consulting', 'open-source', 'internal'].includes(label)) {
    return 'bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)]';
  }
  return 'bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)]';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
</script>
