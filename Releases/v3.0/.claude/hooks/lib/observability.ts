/**
 * Observability Integration
 * Sends hook events to the Agent Visibility Dashboard at localhost:4000
 *
 * Dashboard: https://github.com/disler/claude-code-hooks-multi-agent-observability
 * Server runs at: localhost:4000
 * Client dashboard: localhost:5173
 */

export interface ObservabilityEvent {
  source_app: string;
  session_id: string;
  hook_event_type: 'PreToolUse' | 'PostToolUse' | 'UserPromptSubmit' | 'Notification' | 'Stop' | 'SubagentStop' | 'SessionStart' | 'SessionEnd' | 'PreCompact';
  timestamp: string;
  transcript_path?: string;
  summary?: string;
  tool_name?: string;
  tool_input?: any;
  tool_output?: any;
  agent_type?: string;
  model?: string;
  [key: string]: any;
}

/**
 * Send event to observability dashboard
 * Fails silently if dashboard is not running - doesn't block hook execution
 */
export async function sendEventToObservability(event: ObservabilityEvent): Promise<void> {
  try {
    const response = await fetch('http://localhost:4000/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PAI-Hook/1.0'
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      // Log error but don't throw - dashboard may be offline
      console.error(`Observability server returned status: ${response.status}`);
    }
  } catch (error) {
    // Fail silently - dashboard may not be running
    // This is intentional - hooks should never fail due to observability issues
    // Uncomment below for debugging:
    // console.error('Failed to send event to observability:', error);
  }
}

/**
 * Helper to get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Helper to get source app name from environment or default to 'PAI'
 */
export function getSourceApp(): string {
  return process.env.PAI_SOURCE_APP || 'PAI';
}
