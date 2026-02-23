import { ref } from 'vue';
import type { HookEvent } from '../types';

export function useHITLNotifications() {
  const hasPermission = ref(false);

  // Request notification permission
  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      hasPermission.value = permission === 'granted';
    }
  };

  // Show notification for HITL request
  const notifyHITLRequest = (event: HookEvent) => {
    if (!hasPermission.value || !event.humanInTheLoop) return;

    const notification = new Notification('Agent Needs Your Input', {
      body: event.humanInTheLoop.question.slice(0, 100),
      icon: '/vite.svg',
      tag: `hitl-${event.id}`,
      requireInteraction: true
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  };

  return {
    hasPermission,
    requestPermission,
    notifyHITLRequest
  };
}
