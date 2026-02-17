import { ref, computed, onMounted, onUnmounted } from 'vue';

export interface ULWorkIssue {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  labels: string[];
  assignees: string[];
  author: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface ULWorkChange {
  issueNumber: number;
  field: 'state' | 'labels' | 'assignees' | 'title' | 'new';
  oldValue?: string;
  newValue: string;
  timestamp: number;
}

export interface ULWorkUpdate {
  issues: ULWorkIssue[];
  changes: ULWorkChange[];
  lastPolled: number;
}

export function useULWork() {
  const issues = ref<ULWorkIssue[]>([]);
  const recentChanges = ref<ULWorkChange[]>([]);
  const lastPolled = ref(0);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Track which issues changed recently (for highlight animation)
  const changedIssueNumbers = ref<Set<number>>(new Set());

  // WebSocket listener — called from App.vue when ulwork_update received
  function handleUpdate(update: ULWorkUpdate) {
    issues.value = update.issues;
    lastPolled.value = update.lastPolled;

    if (update.changes.length > 0) {
      recentChanges.value = [...update.changes, ...recentChanges.value].slice(0, 50);

      // Mark changed issues for highlight
      const newChanged = new Set(update.changes.map(c => c.issueNumber));
      changedIssueNumbers.value = newChanged;

      // Clear highlights after 5 seconds
      setTimeout(() => {
        changedIssueNumbers.value = new Set();
      }, 5000);
    }
  }

  // Manual fetch via REST API
  async function fetchIssues() {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await fetch('http://localhost:4000/api/ulwork');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ULWorkUpdate = await res.json();
      issues.value = data.issues;
      lastPolled.value = data.lastPolled;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch UL Work issues';
    } finally {
      isLoading.value = false;
    }
  }

  const openCount = computed(() => issues.value.filter(i => i.state === 'OPEN').length);
  const closedCount = computed(() => issues.value.filter(i => i.state === 'CLOSED').length);

  function isRecentlyChanged(issueNumber: number): boolean {
    return changedIssueNumbers.value.has(issueNumber);
  }

  return {
    issues,
    recentChanges,
    lastPolled,
    isLoading,
    error,
    openCount,
    closedCount,
    handleUpdate,
    fetchIssues,
    isRecentlyChanged,
  };
}
