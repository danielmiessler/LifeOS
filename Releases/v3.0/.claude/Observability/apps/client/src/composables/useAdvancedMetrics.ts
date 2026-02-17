import { computed, ref, type Ref } from 'vue';
import type { HookEvent, ChartDataPoint, TimeRange } from '../types';

/**
 * Interface for token consumption metrics
 */
export interface TokenMetrics {
  input: number;
  output: number;
  total: number;
}

/**
 * Interface for tool usage tracking
 */
export interface ToolUsage {
  tool: string;
  count: number;
  skill?: string;
  successRate?: number;
  hasErrors?: boolean;
  isSlow?: boolean;
  healthIndicator?: string;
}

/**
 * Interface for skill/workflow usage tracking
 */
export interface SkillWorkflowUsage {
  name: string;
  type: 'skill' | 'workflow';
  count: number;
}

/**
 * Interface for agent activity tracking
 */
export interface AgentActivity {
  agent: string;
  count: number;
  percentage: number;
}

/**
 * Interface for event type distribution
 */
export interface EventTypeDistribution {
  type: string;
  count: number;
  percentage: number;
}

/**
 * Interface for delta calculations between time windows
 */
export interface DeltaMetrics {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
}

/**
 * Interface for the complete advanced metrics return value
 */
export interface AdvancedMetrics {
  eventsPerMinute: Ref<number>;
  totalTokens: Ref<TokenMetrics>;
  activeSessions: Ref<number>;
  successRate: Ref<number>;
  topTools: Ref<ToolUsage[]>;
  skillsAndWorkflows: Ref<SkillWorkflowUsage[]>;
  agentActivity: Ref<AgentActivity[]>;
  eventTypeBreakdown: Ref<EventTypeDistribution[]>;
  eventsPerMinuteDelta: Ref<DeltaMetrics>;
}

/**
 * Advanced metrics composable for agent observability dashboard
 *
 * Provides comprehensive analytics and calculations beyond basic chart data:
 * - Real-time throughput (events per minute)
 * - Token consumption tracking (input/output/total)
 * - Active session counting
 * - Success rate analysis
 * - Tool usage statistics
 * - Agent activity distribution
 * - Event type breakdown
 * - Delta calculations vs previous window
 *
 * @param allEvents - Ref containing all events in memory (from useChartData)
 * @param dataPoints - Ref containing aggregated chart data points
 * @param timeRange - Ref containing current time range setting
 * @param currentConfig - Ref containing current time range configuration
 * @returns Object with computed reactive metrics
 */
export function useAdvancedMetrics(
  allEvents: Ref<HookEvent[]>,
  dataPoints: Ref<ChartDataPoint[]>,
  timeRange: Ref<TimeRange>,
  currentConfig: Ref<{ duration: number; bucketSize: number; maxPoints: number }>
): AdvancedMetrics {

  /**
   * Calculate events per minute based on current time window
   * Uses total events in dataPoints divided by time range duration
   */
  const eventsPerMinute = computed<number>(() => {
    const totalEvents = dataPoints.value.reduce((sum, dp) => sum + dp.count, 0);
    const durationMinutes = currentConfig.value.duration / (60 * 1000);

    // Debug logging for event counting
    if (totalEvents > 0) {
      console.log(`[useAdvancedMetrics] Events/min calculation:`, {
        totalEvents,
        durationMinutes: durationMinutes.toFixed(2),
        eventsPerMinute: (totalEvents / durationMinutes).toFixed(2),
        dataPointsCount: dataPoints.value.length
      });
    }

    if (durationMinutes === 0) return 0;
    return Number((totalEvents / durationMinutes).toFixed(2));
  });

  /**
   * Estimate token consumption based on event types
   * Since Claude Code hooks don't expose actual token usage data,
   * we estimate based on typical token consumption per event type
   */
  const totalTokens = computed<TokenMetrics>(() => {
    const now = Date.now();
    const cutoffTime = now - currentConfig.value.duration;

    // Filter events in current time window
    const windowEvents = allEvents.value.filter(
      event => event.timestamp && event.timestamp >= cutoffTime
    );

    // Token estimation heuristics (rough averages)
    const TOKEN_ESTIMATES = {
      'PostToolUse': 2000,        // Tool responses are typically verbose
      'PostAgentMessage': 1500,   // Agent messages/responses
      'UserPromptSubmit': 500,    // User prompts are typically shorter
      'PreToolUse': 300,          // Tool setup/preparation
      'SessionStart': 1000,       // Session initialization with context
      'SessionEnd': 200,          // Session cleanup
      'default': 100              // Fallback for unknown events
    };

    // Estimate tokens based on event types
    let estimatedInput = 0;
    let estimatedOutput = 0;

    windowEvents.forEach(event => {
      const eventType = event.hook_event_type || 'default';
      const estimate = TOKEN_ESTIMATES[eventType] || TOKEN_ESTIMATES['default'];

      // Distribute estimate across input/output (typical 40/60 split)
      estimatedInput += Math.floor(estimate * 0.4);
      estimatedOutput += Math.floor(estimate * 0.6);
    });

    return {
      input: estimatedInput,
      output: estimatedOutput,
      total: estimatedInput + estimatedOutput
    };
  });

  /**
   * Count unique active sessions in current time window
   * Tracks distinct session IDs from events
   */
  const activeSessions = computed<number>(() => {
    const now = Date.now();
    const cutoffTime = now - currentConfig.value.duration;

    const uniqueSessions = new Set<string>();

    allEvents.value.forEach(event => {
      if (event.timestamp && event.timestamp >= cutoffTime) {
        uniqueSessions.add(event.session_id);
      }
    });

    return uniqueSessions.size;
  });

  /**
   * Calculate success rate as percentage of successful events
   * Successful events: PostToolUse with no errors
   * Failed events: Events with error in type or payload
   * Returns percentage 0-100
   */
  const successRate = computed<number>(() => {
    const now = Date.now();
    const cutoffTime = now - currentConfig.value.duration;

    const windowEvents = allEvents.value.filter(
      event => event.timestamp && event.timestamp >= cutoffTime
    );

    if (windowEvents.length === 0) return 100; // Default to 100% if no events

    let successCount = 0;
    let totalCount = 0;

    windowEvents.forEach(event => {
      totalCount++;

      // Consider an event successful if:
      // - Not an error event type
      // - No error in payload
      const isError =
        event.hook_event_type.toLowerCase().includes('error') ||
        event.payload?.error ||
        event.payload?.status === 'error';

      if (!isError) {
        successCount++;
      }
    });

    if (totalCount === 0) return 100;
    return Number(((successCount / totalCount) * 100).toFixed(2));
  });

  /**
   * Track all frequently used tools with performance metrics
   * Analyzes PostToolUse and PreToolUse events to extract tool names and health status
   */
  const topTools = computed<ToolUsage[]>(() => {
    const now = Date.now();
    const cutoffTime = now - currentConfig.value.duration;

    const toolData = new Map<string, {
      count: number;
      skill?: string;
      errors: number;
      totalDuration: number;
      callCount: number;
    }>();

    allEvents.value.forEach(event => {
      if (event.timestamp && event.timestamp >= cutoffTime) {
        // Check for tool usage events
        if (
          event.hook_event_type === 'PostToolUse' ||
          event.hook_event_type === 'PreToolUse'
        ) {
          // Extract tool name from payload
          const toolName =
            event.payload?.tool_name ||
            event.payload?.tool ||
            event.payload?.name ||
            'unknown';

          // Extract skill information if available
          const skillName = event.payload?.skill;

          if (!toolData.has(toolName)) {
            toolData.set(toolName, {
              count: 0,
              skill: skillName,
              errors: 0,
              totalDuration: 0,
              callCount: 0
            });
          }

          const data = toolData.get(toolName)!;
          data.count++;

          // Track errors
          if (
            event.hook_event_type?.toLowerCase().includes('error') ||
            event.payload?.error ||
            event.payload?.status === 'error'
          ) {
            data.errors++;
          }

          // Track duration for performance (if available)
          if (event.payload?.duration) {
            data.totalDuration += event.payload.duration;
            data.callCount++;
          }

          // Update skill if we didn't have it before
          if (!data.skill && skillName) {
            data.skill = skillName;
          }
        }
      }
    });

    // Convert to array with health indicators
    return Array.from(toolData.entries())
      .map(([tool, data]) => {
        const successRate = data.count > 0
          ? Number(((data.count - data.errors) / data.count * 100).toFixed(1))
          : 100;

        const avgDuration = data.callCount > 0
          ? data.totalDuration / data.callCount
          : 0;

        const hasErrors = data.errors > 0;
        const isSlow = avgDuration > 2000; // Consider slow if avg > 2 seconds

        // Determine health indicator
        let healthIndicator = '✅';
        if (hasErrors && successRate < 90) {
          healthIndicator = '⚠️';
        } else if (isSlow) {
          healthIndicator = '🐌';
        } else if (hasErrors) {
          healthIndicator = '⚠️';
        }

        return {
          tool,
          count: data.count,
          skill: data.skill,
          successRate,
          hasErrors,
          isSlow,
          healthIndicator
        };
      })
      .sort((a, b) => b.count - a.count);
  });

  /**
   * Track skills and workflows invoked in the current time window
   * Detects Skill tool calls and workflow executions from events
   */
  const skillsAndWorkflows = computed<SkillWorkflowUsage[]>(() => {
    const now = Date.now();
    const cutoffTime = now - currentConfig.value.duration;

    const usageMap = new Map<string, { type: 'skill' | 'workflow'; count: number }>();

    allEvents.value.forEach(event => {
      if (event.timestamp && event.timestamp >= cutoffTime) {
        // Check for Skill tool invocations
        // Payload structure: { tool_name: "Skill", tool_input: { skill: "SkillName" } }
        const toolName = event.payload?.tool_name;
        if (
          (event.hook_event_type === 'PostToolUse' || event.hook_event_type === 'PreToolUse') &&
          toolName === 'Skill'
        ) {
          const skillName = event.payload?.tool_input?.skill || 'unknown';
          if (skillName !== 'unknown') {
            const key = `skill:${skillName}`;
            if (!usageMap.has(key)) {
              usageMap.set(key, { type: 'skill', count: 0 });
            }
            usageMap.get(key)!.count++;
          }
        }

        // Check for workflow executions (from SkillWorkflowNotification script)
        // Payload structure: { tool_name: "Bash", tool_input: { command: "~/.claude/Tools/SkillWorkflowNotification WORKFLOWNAME SKILLNAME" } }
        if (event.hook_event_type === 'PostToolUse' && event.payload?.tool_name === 'Bash') {
          const command = event.payload?.tool_input?.command || '';
          // Match SkillWorkflowNotification calls: ~/.claude/Tools/SkillWorkflowNotification WORKFLOWNAME SKILLNAME
          const wfMatch = command.match(/\/SkillWorkflowNotification\s+(\w+)\s+(\w+)/);
          if (wfMatch) {
            const workflowName = wfMatch[1];
            const skillName = wfMatch[2];

            // Add the workflow
            const workflowKey = `workflow:${workflowName}`;
            if (!usageMap.has(workflowKey)) {
              usageMap.set(workflowKey, { type: 'workflow', count: 0 });
            }
            usageMap.get(workflowKey)!.count++;

            // Also add the skill that contains this workflow
            const skillKey = `skill:${skillName}`;
            if (!usageMap.has(skillKey)) {
              usageMap.set(skillKey, { type: 'skill', count: 0 });
            }
            usageMap.get(skillKey)!.count++;
          }
        }

        // Also detect SlashCommand invocations as potential workflows
        // Payload structure: { tool_name: "SlashCommand", tool_input: { command: "/commandName args..." } }
        if (
          (event.hook_event_type === 'PostToolUse' || event.hook_event_type === 'PreToolUse') &&
          event.payload?.tool_name === 'SlashCommand'
        ) {
          const fullCommand = event.payload?.tool_input?.command || '';
          // Extract just the command name (first word after the slash)
          const commandMatch = fullCommand.match(/^\/(\w+)/);
          const commandName = commandMatch ? commandMatch[1] : null;
          if (commandName) {
            const key = `workflow:${commandName}`;
            if (!usageMap.has(key)) {
              usageMap.set(key, { type: 'workflow', count: 0 });
            }
            usageMap.get(key)!.count++;
          }
        }
      }
    });

    // Convert to array
    return Array.from(usageMap.entries())
      .map(([key, data]) => {
        const [type, name] = key.split(':');
        return {
          name,
          type: type as 'skill' | 'workflow',
          count: data.count
        };
      })
      .sort((a, b) => b.count - a.count);
  });

  /**
   * Calculate agent activity distribution
   * Shows event count and percentage for each agent in time window
   */
  const agentActivity = computed<AgentActivity[]>(() => {
    const now = Date.now();
    const cutoffTime = now - currentConfig.value.duration;

    const agentCounts = new Map<string, number>();
    let totalEvents = 0;

    allEvents.value.forEach(event => {
      if (event.timestamp && event.timestamp >= cutoffTime) {
        // Use agent_name if available, fallback to source_app
        const agentKey = event.agent_name || event.source_app || 'unknown';
        agentCounts.set(agentKey, (agentCounts.get(agentKey) || 0) + 1);
        totalEvents++;
      }
    });

    // Convert to array with percentages
    return Array.from(agentCounts.entries())
      .map(([agent, count]) => ({
        agent,
        count,
        percentage: totalEvents > 0 ? Number(((count / totalEvents) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => b.count - a.count);
  });

  /**
   * Calculate event type distribution
   * Shows breakdown of all event types with counts and percentages
   */
  const eventTypeBreakdown = computed<EventTypeDistribution[]>(() => {
    const now = Date.now();
    const cutoffTime = now - currentConfig.value.duration;

    const typeCounts = new Map<string, number>();
    let totalEvents = 0;

    allEvents.value.forEach(event => {
      if (event.timestamp && event.timestamp >= cutoffTime) {
        typeCounts.set(
          event.hook_event_type,
          (typeCounts.get(event.hook_event_type) || 0) + 1
        );
        totalEvents++;
      }
    });

    // Convert to array with percentages
    return Array.from(typeCounts.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalEvents > 0 ? Number(((count / totalEvents) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => b.count - a.count);
  });

  /**
   * Calculate delta metrics for events per minute
   * Compares current window to previous window of same duration
   */
  const eventsPerMinuteDelta = computed<DeltaMetrics>(() => {
    const now = Date.now();
    const duration = currentConfig.value.duration;

    // Current window
    const currentCutoff = now - duration;
    const currentEvents = allEvents.value.filter(
      event => event.timestamp && event.timestamp >= currentCutoff
    ).length;

    // Previous window (same duration, immediately before current)
    const previousStart = currentCutoff - duration;
    const previousEnd = currentCutoff;
    const previousEvents = allEvents.value.filter(
      event =>
        event.timestamp &&
        event.timestamp >= previousStart &&
        event.timestamp < previousEnd
    ).length;

    const durationMinutes = duration / (60 * 1000);
    const current = durationMinutes > 0 ? Number((currentEvents / durationMinutes).toFixed(2)) : 0;
    const previous = durationMinutes > 0 ? Number((previousEvents / durationMinutes).toFixed(2)) : 0;
    const delta = Number((current - previous).toFixed(2));
    const deltaPercent = previous > 0 ? Number(((delta / previous) * 100).toFixed(2)) : 0;

    return {
      current,
      previous,
      delta,
      deltaPercent
    };
  });

  return {
    eventsPerMinute,
    totalTokens,
    activeSessions,
    successRate,
    topTools,
    skillsAndWorkflows,
    agentActivity,
    eventTypeBreakdown,
    eventsPerMinuteDelta
  };
}
