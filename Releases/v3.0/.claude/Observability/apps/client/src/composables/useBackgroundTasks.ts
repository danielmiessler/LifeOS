/**
 * Composable for managing background task state
 * Connects to WebSocket for real-time updates and fetches task list on mount
 */

import { ref, onMounted, onUnmounted } from 'vue';
import type { BackgroundTask } from '../types';

const API_BASE = 'http://localhost:4000';
const WS_URL = 'ws://localhost:4000/stream';

export function useBackgroundTasks() {
  const tasks = ref<BackgroundTask[]>([]);
  const selectedTask = ref<BackgroundTask | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;

  /**
   * Fetch all tasks from the API
   */
  const fetchTasks = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${API_BASE}/api/tasks`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      tasks.value = await response.json();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch tasks';
      console.error('[useBackgroundTasks] Error fetching tasks:', err);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Fetch a specific task by ID
   */
  const fetchTask = async (taskId: string): Promise<BackgroundTask | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/tasks/${taskId}`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (err) {
      console.error(`[useBackgroundTasks] Error fetching task ${taskId}:`, err);
      return null;
    }
  };

  /**
   * Fetch full task output
   */
  const fetchTaskOutput = async (taskId: string): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/tasks/${taskId}/output`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data.output;
    } catch (err) {
      console.error(`[useBackgroundTasks] Error fetching task output ${taskId}:`, err);
      return null;
    }
  };

  /**
   * Select a task for detailed view
   */
  const selectTask = (task: BackgroundTask | null) => {
    selectedTask.value = task;
  };

  /**
   * Handle WebSocket task updates
   */
  const handleTaskUpdate = (task: BackgroundTask) => {
    const index = tasks.value.findIndex(t => t.taskId === task.taskId);
    if (index >= 0) {
      tasks.value[index] = task;
    } else {
      // New task - add to beginning
      tasks.value.unshift(task);
    }

    // Update selected task if it's the same one
    if (selectedTask.value?.taskId === task.taskId) {
      selectedTask.value = task;
    }
  };

  /**
   * Connect to WebSocket for real-time updates
   */
  const connectWebSocket = () => {
    if (ws) {
      ws.close();
    }

    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[useBackgroundTasks] WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'task_update') {
          handleTaskUpdate(message.data);
        }
      } catch (err) {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      console.log('[useBackgroundTasks] WebSocket disconnected, reconnecting...');
      // Reconnect after 3 seconds
      reconnectTimer = window.setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('[useBackgroundTasks] WebSocket error:', err);
    };
  };

  /**
   * Cleanup WebSocket connection
   */
  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
  };

  // Initialize on mount
  onMounted(() => {
    fetchTasks();
    connectWebSocket();
  });

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect();
  });

  return {
    tasks,
    selectedTask,
    isLoading,
    error,
    fetchTasks,
    fetchTask,
    fetchTaskOutput,
    selectTask,
    disconnect
  };
}
