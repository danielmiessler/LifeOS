#!/usr/bin/env bun
/**
 * Projects-based Event Streaming (In-Memory Only)
 * Watches Claude Code's native projects/ directory for session transcripts
 * NO DATABASE - streams directly to WebSocket clients
 * Fresh start each time - no persistence
 *
 * Replaces RAW-based ingestion - reads from native Claude Code storage
 */

import { watch, existsSync, readdirSync, statSync } from 'fs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { HookEvent } from './types';

// In-memory event store (last N events only)
const MAX_EVENTS = 1000;
const events: HookEvent[] = [];

// Track the last read position for each file
const filePositions = new Map<string, number>();

// Track which files we're currently watching
const watchedFiles = new Set<string>();

// Callback for when new events arrive (for WebSocket broadcasting)
let onEventsReceived: ((events: HookEvent[]) => void) | null = null;

// Agent session mapping (session_id -> agent_name)
const agentSessions = new Map<string, string>();

// Todo tracking per session (session_id -> current todos)
const sessionTodos = new Map<string, any[]>();

// Projects directory path - dynamically constructed from username
const PROJECTS_DIR = join(homedir(), '.claude', 'projects', `-Users-${process.env.USER || 'user'}--claude`);

/**
 * Get the most recently modified JSONL files in projects/
 */
function getRecentSessionFiles(limit: number = 50): string[] {
  if (!existsSync(PROJECTS_DIR)) {
    console.log('⚠️  Projects directory not found:', PROJECTS_DIR);
    return [];
  }

  const files = readdirSync(PROJECTS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      path: join(PROJECTS_DIR, f),
      mtime: statSync(join(PROJECTS_DIR, f)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  return files.map(f => f.path);
}

/**
 * Parse a Claude Code projects JSONL entry and convert to HookEvent format
 */
function parseProjectsEntry(entry: any): HookEvent | null {
  // Skip queue operations
  if (entry.type === 'queue-operation') {
    return null;
  }

  // Skip summary entries
  if (entry.type === 'summary') {
    return null;
  }

  const rawTimestamp = entry.timestamp || new Date().toISOString();
  const sessionId = entry.sessionId || 'unknown';

  // Convert timestamp to numeric (ms since epoch) for client chart compatibility
  const timestamp = typeof rawTimestamp === 'string'
    ? new Date(rawTimestamp).getTime()
    : rawTimestamp;

  // Base event structure
  const baseEvent: Partial<HookEvent> = {
    source_app: 'claude-code',
    session_id: sessionId,
    timestamp: timestamp,
    timestamp_pst: new Date(timestamp).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
  };

  // User message -> UserPromptSubmit
  if (entry.type === 'user' && entry.message?.role === 'user') {
    const content = entry.message.content;
    let userText = '';

    if (typeof content === 'string') {
      userText = content;
    } else if (Array.isArray(content)) {
      // Check if it's a tool result
      const toolResult = content.find((c: any) => c.type === 'tool_result');
      if (toolResult) {
        return {
          ...baseEvent,
          hook_event_type: 'PostToolUse',
          payload: {
            tool_use_id: toolResult.tool_use_id,
            tool_result: typeof toolResult.content === 'string'
              ? toolResult.content.slice(0, 500)
              : JSON.stringify(toolResult.content).slice(0, 500)
          },
          summary: `Tool result received`
        } as HookEvent;
      }

      // Regular text content
      userText = content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join(' ');
    }

    return {
      ...baseEvent,
      hook_event_type: 'UserPromptSubmit',
      payload: {
        prompt: userText.slice(0, 500)
      },
      summary: userText.slice(0, 100)
    } as HookEvent;
  }

  // Assistant message -> Stop or PreToolUse
  if (entry.type === 'assistant' && entry.message?.role === 'assistant') {
    const content = entry.message.content;

    if (Array.isArray(content)) {
      // Check for tool_use
      const toolUse = content.find((c: any) => c.type === 'tool_use');
      if (toolUse) {
        return {
          ...baseEvent,
          hook_event_type: 'PreToolUse',
          payload: {
            tool_name: toolUse.name,
            tool_input: toolUse.input
          },
          summary: `${toolUse.name}: ${JSON.stringify(toolUse.input).slice(0, 100)}`
        } as HookEvent;
      }

      // Text response -> Stop event
      const textContent = content.find((c: any) => c.type === 'text');
      if (textContent) {
        return {
          ...baseEvent,
          hook_event_type: 'Stop',
          payload: {
            response: textContent.text?.slice(0, 500)
          },
          summary: textContent.text?.slice(0, 100)
        } as HookEvent;
      }
    }
  }

  return null;
}

/**
 * Read new events from a JSONL file starting from a given position
 */
function readNewEvents(filePath: string): HookEvent[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const lastPosition = filePositions.get(filePath) || 0;

  try {
    const content = readFileSync(filePath, 'utf-8');
    const newContent = content.slice(lastPosition);

    // Update position to end of file
    filePositions.set(filePath, content.length);

    if (!newContent.trim()) {
      return [];
    }

    // Parse JSONL - one JSON object per line
    const lines = newContent.trim().split('\n');
    const newEvents: HookEvent[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line);
        const event = parseProjectsEntry(entry);

        if (event) {
          // Add auto-incrementing ID for UI
          event.id = events.length + newEvents.length + 1;
          // Enrich with agent name
          const enrichedEvent = enrichEventWithAgentName(event);
          // Process todo events (returns array of events)
          const processedEvents = processTodoEvent(enrichedEvent);
          // Reassign IDs for any synthetic events
          for (let i = 0; i < processedEvents.length; i++) {
            processedEvents[i].id = events.length + newEvents.length + i + 1;
          }
          newEvents.push(...processedEvents);
        }
      } catch (error) {
        // Skip malformed lines silently
      }
    }

    return newEvents;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
}

/**
 * Add events to in-memory store (keeping last MAX_EVENTS only)
 */
function storeEvents(newEvents: HookEvent[]): void {
  if (newEvents.length === 0) return;

  // Add to in-memory array
  events.push(...newEvents);

  // Keep only last MAX_EVENTS
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }

  console.log(`✅ Received ${newEvents.length} event(s) (${events.length} in memory)`);

  // Notify subscribers (WebSocket clients)
  if (onEventsReceived) {
    onEventsReceived(newEvents);
  }
}

/**
 * Load agent sessions from agent-sessions.json
 */
function loadAgentSessions(): void {
  const sessionsFile = join(homedir(), '.claude', 'MEMORY', 'STATE', 'agent-sessions.json');

  if (!existsSync(sessionsFile)) {
    console.log('⚠️  agent-sessions.json not found, agent names will be "unknown"');
    return;
  }

  try {
    const content = readFileSync(sessionsFile, 'utf-8');
    const data = JSON.parse(content);

    agentSessions.clear();
    Object.entries(data).forEach(([sessionId, agentName]) => {
      agentSessions.set(sessionId, agentName as string);
    });

    console.log(`✅ Loaded ${agentSessions.size} agent sessions`);
  } catch (error) {
    console.error('❌ Error loading agent-sessions.json:', error);
  }
}

/**
 * Watch agent-sessions.json for changes
 */
function watchAgentSessions(): void {
  const sessionsFile = join(homedir(), '.claude', 'MEMORY', 'STATE', 'agent-sessions.json');

  if (!existsSync(sessionsFile)) {
    console.log('⚠️  agent-sessions.json not found, skipping watch');
    return;
  }

  console.log('👀 Watching agent-sessions.json for changes');

  const watcher = watch(sessionsFile, (eventType) => {
    if (eventType === 'change') {
      console.log('🔄 agent-sessions.json changed, reloading...');
      loadAgentSessions();
    }
  });

  watcher.on('error', (error) => {
    console.error('❌ Error watching agent-sessions.json:', error);
  });
}

/**
 * Enrich event with agent name from session mapping
 */
function enrichEventWithAgentName(event: HookEvent): HookEvent {
  // Special case: UserPromptSubmit events are from the user, not the agent
  if (event.hook_event_type === 'UserPromptSubmit') {
    return {
      ...event,
      agent_name: process.env.PRINCIPAL_NAME || 'User'
    };
  }

  // Default to DA name for main agent sessions (from settings.json env)
  const mainAgentName = process.env.DA || 'PAI';

  // If source_app is set to a sub-agent type (not the main agent), respect it
  const subAgentTypes = ['artist', 'intern', 'engineer', 'pentester', 'architect', 'designer', 'qatester', 'researcher'];
  if (event.source_app && subAgentTypes.includes(event.source_app.toLowerCase())) {
    const capitalizedName = event.source_app.charAt(0).toUpperCase() + event.source_app.slice(1);
    return {
      ...event,
      agent_name: capitalizedName
    };
  }

  const agentName = agentSessions.get(event.session_id) || mainAgentName;
  return {
    ...event,
    agent_name: agentName
  };
}

/**
 * Process todo events and detect completions
 */
function processTodoEvent(event: HookEvent): HookEvent[] {
  // Only process TodoWrite tool events
  if (event.payload?.tool_name !== 'TodoWrite') {
    return [event];
  }

  const currentTodos = event.payload.tool_input?.todos || [];
  const previousTodos = sessionTodos.get(event.session_id) || [];

  // Find newly completed todos
  const completedTodos = [];

  for (const currentTodo of currentTodos) {
    if (currentTodo.status === 'completed') {
      const prevTodo = previousTodos.find((t: any) => t.content === currentTodo.content);
      if (!prevTodo || prevTodo.status !== 'completed') {
        completedTodos.push(currentTodo);
      }
    }
  }

  // Update session todos
  sessionTodos.set(event.session_id, currentTodos);

  // Create synthetic completion events
  const resultEvents: HookEvent[] = [event];

  for (const completedTodo of completedTodos) {
    const completionEvent: HookEvent = {
      ...event,
      id: event.id,
      hook_event_type: 'Completed',
      payload: {
        task: completedTodo.content
      },
      summary: undefined,
      timestamp: event.timestamp
    };
    resultEvents.push(completionEvent);
  }

  return resultEvents;
}

/**
 * Watch a file for changes and stream new events
 */
function watchFile(filePath: string): void {
  if (watchedFiles.has(filePath)) {
    return;
  }

  console.log(`👀 Watching: ${filePath.split('/').pop()}`);
  watchedFiles.add(filePath);

  // Set file position to END - only read NEW events from now on
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, 'utf-8');
    filePositions.set(filePath, content.length);
  }

  // Watch for changes
  const watcher = watch(filePath, (eventType) => {
    if (eventType === 'change') {
      const newEvents = readNewEvents(filePath);
      storeEvents(newEvents);
    }
  });

  watcher.on('error', (error) => {
    console.error(`Error watching ${filePath}:`, error);
    watchedFiles.delete(filePath);
  });
}

/**
 * Watch the projects directory for new session files
 */
function watchProjectsDirectory(): void {
  if (!existsSync(PROJECTS_DIR)) {
    console.log('⚠️  Projects directory not found, skipping watch');
    return;
  }

  console.log('👀 Watching projects directory for new sessions');

  const watcher = watch(PROJECTS_DIR, (eventType, filename) => {
    if (filename && filename.endsWith('.jsonl')) {
      const filePath = join(PROJECTS_DIR, filename);
      if (existsSync(filePath) && !watchedFiles.has(filePath)) {
        // New session file appeared, start watching it
        watchFile(filePath);
      }
    }
  });

  watcher.on('error', (error) => {
    console.error('❌ Error watching projects directory:', error);
  });
}

/**
 * Start watching for events
 * @param callback Optional callback to be notified when new events arrive
 */
export function startFileIngestion(callback?: (events: HookEvent[]) => void): void {
  console.log('🚀 Starting projects-based event streaming (in-memory only)');
  console.log(`📂 Reading from ${PROJECTS_DIR}/`);

  // Set the callback for event notifications
  if (callback) {
    onEventsReceived = callback;
  }

  // Load and watch agent sessions for name enrichment
  loadAgentSessions();
  watchAgentSessions();

  // Get recent session files and watch them
  const recentFiles = getRecentSessionFiles(20);
  console.log(`📁 Found ${recentFiles.length} recent session files`);

  for (const filePath of recentFiles) {
    watchFile(filePath);
  }

  // Watch for new session files
  watchProjectsDirectory();

  console.log('✅ Projects streaming started');
}

/**
 * Get all events currently in memory
 */
export function getRecentEvents(limit: number = 100): HookEvent[] {
  return events.slice(-limit).reverse();
}

/**
 * Get filter options from in-memory events
 */
export function getFilterOptions() {
  const sourceApps = new Set<string>();
  const sessionIds = new Set<string>();
  const hookEventTypes = new Set<string>();

  for (const event of events) {
    if (event.source_app) sourceApps.add(event.source_app);
    if (event.session_id) sessionIds.add(event.session_id);
    if (event.hook_event_type) hookEventTypes.add(event.hook_event_type);
  }

  return {
    source_apps: Array.from(sourceApps).sort(),
    session_ids: Array.from(sessionIds).slice(0, 100),
    hook_event_types: Array.from(hookEventTypes).sort()
  };
}

// For testing - can be run directly
if (import.meta.main) {
  startFileIngestion();

  console.log('Press Ctrl+C to stop');

  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
  });
}
