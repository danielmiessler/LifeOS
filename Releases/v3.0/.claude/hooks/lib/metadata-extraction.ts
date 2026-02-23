#!/usr/bin/env bun
/**
 * Metadata Extraction Library for UOCS Enhancement
 *
 * Extracts agent instance IDs, parent-child relationships, and session info
 * from Task tool calls and other tool inputs.
 *
 * Design Philosophy: Optional extraction with graceful fallbacks
 * - If instance IDs are present in descriptions/prompts, extract them
 * - If not present, fall back to agent type only
 * - Never fail - always return usable metadata
 */

export interface AgentInstanceMetadata {
  agent_instance_id?: string;      // "perplexity-researcher-1" (full ID)
  agent_type?: string;              // "perplexity-researcher" (base type)
  instance_number?: number;         // 1 (sequence number)
  parent_session_id?: string;       // Session that spawned this agent
  parent_task_id?: string;          // Task ID that spawned this agent
}

/**
 * Extract agent instance ID from Task tool input
 *
 * Looks for patterns in priority order:
 * 1. [agent-type-N] in description (e.g., "Research topic [perplexity-researcher-1]")
 * 2. [AGENT_INSTANCE: agent-type-N] in prompt
 * 3. subagent_type field (fallback to just type, no instance number)
 *
 * @param toolInput The tool input object from PreToolUse/PostToolUse hooks
 * @param description Optional description field from tool input
 * @returns Metadata object with extracted information
 */
export function extractAgentInstanceId(
  toolInput: any,
  description?: string
): AgentInstanceMetadata {
  const result: AgentInstanceMetadata = {};

  // Strategy 1: Extract from description [agent-type-N]
  // Example: "Research consumer complaints [perplexity-researcher-1]"
  if (description) {
    const descMatch = description.match(/\[([a-z-]+-researcher)-(\d+)\]/);
    if (descMatch) {
      result.agent_type = descMatch[1];
      result.instance_number = parseInt(descMatch[2], 10);
      result.agent_instance_id = `${result.agent_type}-${result.instance_number}`;
    }
  }

  // Strategy 2: Extract from prompt [AGENT_INSTANCE: ...]
  // Example: "[AGENT_INSTANCE: perplexity-researcher-1]"
  if (!result.agent_instance_id && toolInput?.prompt && typeof toolInput.prompt === 'string') {
    const promptMatch = toolInput.prompt.match(/\[AGENT_INSTANCE:\s*([^\]]+)\]/);
    if (promptMatch) {
      result.agent_instance_id = promptMatch[1].trim();

      // Parse agent type and instance number from ID
      const parts = result.agent_instance_id.match(/^([a-z-]+)-(\d+)$/);
      if (parts) {
        result.agent_type = parts[1];
        result.instance_number = parseInt(parts[2], 10);
      }
    }
  }

  // Strategy 3: Extract parent session from prompt
  // Example: "[PARENT_SESSION: b7062b5a-03d3-4168-9555-a748e0b2efa3]"
  if (toolInput?.prompt && typeof toolInput.prompt === 'string') {
    const parentSessionMatch = toolInput.prompt.match(/\[PARENT_SESSION:\s*([^\]]+)\]/);
    if (parentSessionMatch) {
      result.parent_session_id = parentSessionMatch[1].trim();
    }

    // Extract parent task from prompt
    // Example: "[PARENT_TASK: research_1731445892345]"
    const parentTaskMatch = toolInput.prompt.match(/\[PARENT_TASK:\s*([^\]]+)\]/);
    if (parentTaskMatch) {
      result.parent_task_id = parentTaskMatch[1].trim();
    }
  }

  // Strategy 4: Fallback to subagent_type if available (no instance number)
  // This ensures we at least capture the agent type even without instance IDs
  if (!result.agent_type && toolInput?.subagent_type) {
    result.agent_type = toolInput.subagent_type;
  }

  return result;
}

/**
 * Enrich event with agent metadata
 *
 * Takes a base event object and adds agent instance metadata to it.
 * Returns a new object with merged metadata.
 *
 * @param event Base event object (from PreToolUse/PostToolUse)
 * @param toolInput Tool input object
 * @param description Optional description field
 * @returns Enriched event with agent metadata
 */
export function enrichEventWithAgentMetadata(
  event: any,
  toolInput: any,
  description?: string
): any {
  const metadata = extractAgentInstanceId(toolInput, description);

  // Only add fields that have values (keep events clean)
  const enrichedEvent = { ...event };

  if (metadata.agent_instance_id) {
    enrichedEvent.agent_instance_id = metadata.agent_instance_id;
  }

  if (metadata.agent_type) {
    enrichedEvent.agent_type = metadata.agent_type;
  }

  if (metadata.instance_number !== undefined) {
    enrichedEvent.instance_number = metadata.instance_number;
  }

  if (metadata.parent_session_id) {
    enrichedEvent.parent_session_id = metadata.parent_session_id;
  }

  if (metadata.parent_task_id) {
    enrichedEvent.parent_task_id = metadata.parent_task_id;
  }

  return enrichedEvent;
}

/**
 * Check if a tool call is spawning a subagent
 *
 * @param toolName Name of the tool being called
 * @param toolInput Tool input object
 * @returns true if this is a Task tool call spawning an agent
 */
export function isAgentSpawningCall(toolName: string, toolInput: any): boolean {
  return toolName === 'Task' && toolInput?.subagent_type !== undefined;
}
