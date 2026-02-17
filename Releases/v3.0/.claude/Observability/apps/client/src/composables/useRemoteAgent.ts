import { ref, onMounted, onUnmounted } from 'vue';

export interface RemoteSession {
  sessionId: string;
  status: 'running' | 'completed' | 'error';
  result?: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

export interface RemoteAgentHealth {
  status: string;
  version: string;
  uptime?: number;
  hasApiKey: boolean;
  apiKeyLength: number;
}

export interface RemoteAgent {
  name: string;
  url: string;
  health: RemoteAgentHealth | null;
  sessions: RemoteSession[];
  isConnected: boolean;
  lastChecked: number;
  error: string | null;
}

export function useRemoteAgent(agents: { name: string; url: string }[]) {
  const remoteAgents = ref<RemoteAgent[]>(
    agents.map(a => ({
      name: a.name,
      url: a.url,
      health: null,
      sessions: [],
      isConnected: false,
      lastChecked: 0,
      error: null
    }))
  );

  let pollInterval: ReturnType<typeof setInterval> | null = null;

  const fetchAgentHealth = async (agent: RemoteAgent) => {
    try {
      const response = await fetch(`${agent.url}/health`, {
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      agent.health = await response.json();
      agent.isConnected = true;
      agent.error = null;
    } catch (err) {
      agent.isConnected = false;
      agent.error = err instanceof Error ? err.message : 'Connection failed';
      agent.health = null;
    }
    agent.lastChecked = Date.now();
  };

  const fetchAgentSessions = async (agent: RemoteAgent) => {
    try {
      const response = await fetch(`${agent.url}/sessions`, {
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      agent.sessions = await response.json();
    } catch (err) {
      // Sessions might fail if no active sessions, that's okay
      if (agent.isConnected) {
        agent.sessions = [];
      }
    }
  };

  const refreshAll = async () => {
    await Promise.all(
      remoteAgents.value.map(async (agent) => {
        await fetchAgentHealth(agent);
        if (agent.isConnected) {
          await fetchAgentSessions(agent);
        }
      })
    );
  };

  const submitQuery = async (agentName: string, prompt: string): Promise<RemoteSession | null> => {
    const agent = remoteAgents.value.find(a => a.name === agentName);
    if (!agent) return null;

    try {
      const response = await fetch(`${agent.url}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      // Refresh sessions to include the new one
      await fetchAgentSessions(agent);
      return result;
    } catch (err) {
      agent.error = err instanceof Error ? err.message : 'Query failed';
      return null;
    }
  };

  const getSession = async (agentName: string, sessionId: string): Promise<RemoteSession | null> => {
    const agent = remoteAgents.value.find(a => a.name === agentName);
    if (!agent) return null;

    try {
      const response = await fetch(`${agent.url}/session/${sessionId}`, {
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      return null;
    }
  };

  const startPolling = (intervalMs = 5000) => {
    stopPolling();
    refreshAll();
    pollInterval = setInterval(refreshAll, intervalMs);
  };

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  onMounted(() => {
    startPolling();
  });

  onUnmounted(() => {
    stopPolling();
  });

  return {
    remoteAgents,
    refreshAll,
    submitQuery,
    getSession,
    startPolling,
    stopPolling
  };
}
