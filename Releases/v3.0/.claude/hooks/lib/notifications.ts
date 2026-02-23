/**
 * Notification Service — ntfy + voice only
 *
 * Simplified from multi-channel (Discord, Twilio, Desktop) to just ntfy push.
 * Voice notifications are handled by the voice server (localhost:8888).
 *
 * Design principles:
 * - Async, non-blocking (fire-and-forget)
 * - Fail gracefully (never block hook execution)
 * - Expandable later if needed
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getIdentity } from './identity';

// ============================================================================
// Types
// ============================================================================

export type NotificationPriority = 'min' | 'low' | 'default' | 'high' | 'urgent';

export type NotificationEvent =
  | 'taskComplete'
  | 'longTask'
  | 'backgroundAgent'
  | 'error'
  | 'security';

export interface NotificationOptions {
  title?: string;
  priority?: NotificationPriority;
  tags?: string[];
  click?: string;
  actions?: Array<{
    action: 'view' | 'http';
    label: string;
    url: string;
  }>;
}

export interface NotificationConfig {
  ntfy: {
    enabled: boolean;
    topic: string;
    server: string;
  };
  thresholds: {
    longTaskMinutes: number;
  };
  routing: {
    [key in NotificationEvent]: ('ntfy')[];
  };
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: NotificationConfig = {
  ntfy: {
    enabled: false,
    topic: '',
    server: 'ntfy.sh'
  },
  thresholds: {
    longTaskMinutes: 5
  },
  routing: {
    taskComplete: [],
    longTask: ['ntfy'],
    backgroundAgent: ['ntfy'],
    error: ['ntfy'],
    security: ['ntfy']
  }
};

function expandEnvVars(content: string): string {
  return content.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || '');
}

export function getNotificationConfig(): NotificationConfig {
  try {
    const paiDir = process.env.PAI_DIR || join(homedir(), '.claude');
    const settingsPath = join(paiDir, 'settings.json');

    if (existsSync(settingsPath)) {
      const rawContent = readFileSync(settingsPath, 'utf-8');
      const expandedContent = expandEnvVars(rawContent);
      const settings = JSON.parse(expandedContent);
      if (settings.notifications) {
        return {
          ...DEFAULT_CONFIG,
          ntfy: { ...DEFAULT_CONFIG.ntfy, ...settings.notifications?.ntfy },
          thresholds: { ...DEFAULT_CONFIG.thresholds, ...settings.notifications?.thresholds },
          routing: { ...DEFAULT_CONFIG.routing, ...settings.notifications?.routing }
        };
      }
    }
  } catch (error) {
    console.error('Failed to load notification config:', error);
  }

  return DEFAULT_CONFIG;
}

// ============================================================================
// Session Timing
// ============================================================================

const SESSION_START_FILE = '/tmp/pai-session-start.txt';

export function recordSessionStart(): void {
  try { writeFileSync(SESSION_START_FILE, Date.now().toString()); } catch {}
}

export function getSessionDurationMinutes(): number {
  try {
    if (existsSync(SESSION_START_FILE)) {
      const startTime = parseInt(readFileSync(SESSION_START_FILE, 'utf-8'));
      return (Date.now() - startTime) / 1000 / 60;
    }
  } catch {}
  return 0;
}

export function isLongRunningTask(): boolean {
  const config = getNotificationConfig();
  return getSessionDurationMinutes() >= config.thresholds.longTaskMinutes;
}

// ============================================================================
// ntfy Push
// ============================================================================

export async function sendPush(
  message: string,
  options: NotificationOptions = {}
): Promise<boolean> {
  const config = getNotificationConfig();

  if (!config.ntfy.enabled || !config.ntfy.topic) {
    return false;
  }

  try {
    const url = `https://${config.ntfy.server}/${config.ntfy.topic}`;

    const headers: Record<string, string> = {
      'Content-Type': 'text/plain',
    };

    if (options.title) headers['Title'] = options.title;

    if (options.priority) {
      const priorityMap: Record<NotificationPriority, string> = {
        'min': '1', 'low': '2', 'default': '3', 'high': '4', 'urgent': '5'
      };
      headers['Priority'] = priorityMap[options.priority] || '3';
    }

    if (options.tags?.length) headers['Tags'] = options.tags.join(',');
    if (options.click) headers['Click'] = options.click;

    if (options.actions?.length) {
      headers['Actions'] = options.actions
        .map(a => `${a.action}, ${a.label}, ${a.url}`)
        .join('; ');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: message,
      signal: AbortSignal.timeout(5000),
    });

    return response.ok;
  } catch (error) {
    console.error('ntfy send failed:', error);
    return false;
  }
}

// ============================================================================
// Smart Router
// ============================================================================

export async function notify(
  event: NotificationEvent,
  message: string,
  options: NotificationOptions = {}
): Promise<void> {
  const config = getNotificationConfig();
  const channels = config.routing[event] || [];

  for (const channel of channels) {
    if (channel === 'ntfy') {
      sendPush(message, {
        title: options.title || getDefaultTitle(event),
        priority: options.priority || getDefaultPriority(event),
        tags: options.tags || getDefaultTags(event),
        ...options
      }).catch(() => {});
    }
  }
}

export async function notifyTaskComplete(message: string, options: NotificationOptions = {}): Promise<void> {
  const event: NotificationEvent = isLongRunningTask() ? 'longTask' : 'taskComplete';
  await notify(event, message, options);
}

export async function notifyBackgroundAgent(
  agentType: string,
  message: string,
  options: NotificationOptions = {}
): Promise<void> {
  await notify('backgroundAgent', message, {
    title: `${agentType} Agent Complete`,
    tags: ['robot', 'white_check_mark'],
    ...options
  });
}

export async function notifyError(message: string, options: NotificationOptions = {}): Promise<void> {
  await notify('error', message, {
    priority: 'high',
    tags: ['warning', 'x'],
    ...options
  });
}

// ============================================================================
// Helpers
// ============================================================================

function getDefaultTitle(event: NotificationEvent): string {
  const DA_NAME = getIdentity().name;
  const titles: Record<NotificationEvent, string> = {
    taskComplete: DA_NAME,
    longTask: `${DA_NAME} - Task Complete`,
    backgroundAgent: `${DA_NAME} - Agent Complete`,
    error: `${DA_NAME} - Error`,
    security: `${DA_NAME} - Security Alert`
  };
  return titles[event];
}

function getDefaultPriority(event: NotificationEvent): NotificationPriority {
  const priorities: Record<NotificationEvent, NotificationPriority> = {
    taskComplete: 'default',
    longTask: 'default',
    backgroundAgent: 'default',
    error: 'high',
    security: 'urgent'
  };
  return priorities[event];
}

function getDefaultTags(event: NotificationEvent): string[] {
  const tags: Record<NotificationEvent, string[]> = {
    taskComplete: ['white_check_mark'],
    longTask: ['hourglass', 'white_check_mark'],
    backgroundAgent: ['robot', 'white_check_mark'],
    error: ['warning', 'x'],
    security: ['rotating_light', 'lock']
  };
  return tags[event];
}
