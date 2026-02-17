import { ref, onMounted, onUnmounted } from 'vue';

export interface AgentContext {
  activeSkill: string | null;
  currentProject: {
    name: string;
    root: string;
    type: string;
  } | null;
  learningsToday: number;
  recentLearnings: { title: string; timestamp: string }[];
  sessionsToday: number;
  skillCount: number;
  sessionDuration: number;
  lastUpdate: string | null;
}

export function useAgentContext() {
  const context = ref<AgentContext | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  let pollInterval: ReturnType<typeof setInterval> | null = null;

  const fetchContext = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/agent/context');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      context.value = await response.json();
      error.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading.value = false;
    }
  };

  // Format session duration as human readable
  const formatDuration = (ms: number): string => {
    if (ms < 60000) return '<1m';
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  onMounted(() => {
    fetchContext();
    // Poll every 30 seconds for updates
    pollInterval = setInterval(fetchContext, 30000);
  });

  onUnmounted(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });

  return {
    context,
    loading,
    error,
    formatDuration,
    refresh: fetchContext
  };
}
