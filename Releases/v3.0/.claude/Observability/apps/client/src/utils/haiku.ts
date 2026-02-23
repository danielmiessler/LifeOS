/**
 * Haiku API Integration for Timeline Intelligence
 * Provides fast, cheap summarization for event clustering
 * Uses backend proxy to read API key from ~/.claude/.env
 */

import type { HookEvent } from '../types';

const BACKEND_PROXY = 'http://localhost:4000/api/haiku/summarize';

// Track API call statistics
let apiCallCount = 0;

export interface EventSummary {
  text: string;
  agentType: string;
  eventCount: number;
  timestamp: number;
}

/**
 * Get the total number of Haiku API calls made
 */
export function getHaikuCallCount(): number {
  return apiCallCount;
}

/**
 * Reset the Haiku API call counter
 */
export function resetHaikuCallCount(): void {
  apiCallCount = 0;
}

/**
 * Summarize a batch of events using Haiku
 * @param events Array of events to summarize
 * @returns Concise summary suitable for timeline display
 */
export async function summarizeEvents(events: HookEvent[]): Promise<EventSummary> {
  if (events.length === 0) {
    return {
      text: 'No activity',
      agentType: 'unknown',
      eventCount: 0,
      timestamp: Date.now()
    };
  }

  // Single event - no summarization needed
  if (events.length === 1) {
    const event = events[0];
    return {
      text: formatSingleEvent(event),
      agentType: event.source_app,
      eventCount: 1,
      timestamp: event.timestamp || Date.now()
    };
  }

  // Multiple events - use Haiku to summarize
  try {
    const eventDescriptions = events.map((e, i) =>
      `${i + 1}. ${e.source_app} (${e.hook_event_type})`
    ).join('\n');

    const prompt = `Summarize these ${events.length} agent events in 3-5 words using format "Verbing noun" or "N agent actions" (e.g., "Processing API requests", "27 intern actions", "Updating config files"). Output ONLY the summary text:

${eventDescriptions}`;

    const response = await fetch(BACKEND_PROXY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error(`Haiku proxy error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Summarization failed');
    }

    // Increment API call counter on successful call
    apiCallCount++;

    const summaryText = data.text?.trim() || `${events.length} events`;

    // Determine primary agent type (most frequent)
    const agentCounts = events.reduce((acc, e) => {
      acc[e.source_app] = (acc[e.source_app] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const primaryAgent = Object.entries(agentCounts).sort((a, b) => b[1] - a[1])[0][0];

    return {
      text: summaryText,
      agentType: primaryAgent,
      eventCount: events.length,
      timestamp: events[events.length - 1].timestamp || Date.now()
    };
  } catch (error) {
    console.error('Haiku summarization failed:', error);
    // Fallback to simple count
    return {
      text: `${events.length} ${events[0].source_app} actions`,
      agentType: events[0].source_app,
      eventCount: events.length,
      timestamp: events[events.length - 1].timestamp || Date.now()
    };
  }
}

/**
 * Format a single event for display
 */
function formatSingleEvent(event: HookEvent): string {
  const type = event.hook_event_type;
  const app = event.source_app;

  // Map event types to readable labels
  const typeMap: Record<string, string> = {
    'PreToolUse': 'tool call',
    'PostToolUse': 'tool result',
    'Stop': 'completed',
    'AgentStart': 'started',
    'AgentStop': 'finished',
    'PreCompact': 'compacting'
  };

  const label = typeMap[type] || type.toLowerCase();
  return `${app} ${label}`;
}

/**
 * Check if backend proxy is available (API key configured in ~/.claude/.env)
 */
export function isHaikuConfigured(): boolean {
  // Always return true - backend will handle API key check
  // If key is missing, backend returns error and we fall back gracefully
  return true;
}
