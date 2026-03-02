#!/usr/bin/env bun
/**
 * Transcript Capture System
 * Captures full agent execution trajectories for evaluation
 */

import type { Transcript, Turn, ToolCall, TranscriptMetrics } from '../Types/index.ts';

export class TranscriptCapture {
  private taskId: string;
  private trialId: string;
  private turns: Turn[] = [];
  private toolCalls: ToolCall[] = [];
  private reasoningTraces: string[] = [];
  private startTime: number;
  private firstTokenTime?: number;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;

  constructor(taskId: string, trialId: string) {
    this.taskId = taskId;
    this.trialId = trialId;
    this.startTime = Date.now();
  }

  /**
   * Add a conversation turn
   */
  addTurn(role: 'user' | 'assistant' | 'system' | 'tool', content: string, tokens?: number): void {
    if (role === 'assistant' && !this.firstTokenTime) {
      this.firstTokenTime = Date.now();
    }

    if (tokens) {
      if (role === 'user' || role === 'system') {
        this.totalInputTokens += tokens;
      } else {
        this.totalOutputTokens += tokens;
      }
    }

    this.turns.push({
      index: this.turns.length,
      role,
      content,
      timestamp: new Date().toISOString(),
      tokens,
    });
  }

  /**
   * Record a tool call
   */
  startToolCall(name: string, params: Record<string, unknown>): string {
    const id = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.toolCalls.push({
      id,
      name,
      params,
      started_at: new Date().toISOString(),
    });
    return id;
  }

  /**
   * Complete a tool call
   */
  completeToolCall(id: string, result?: unknown, error?: string): void {
    const call = this.toolCalls.find(tc => tc.id === id);
    if (call) {
      call.result = result;
      call.error = error;
      call.completed_at = new Date().toISOString();
      call.duration_ms = new Date(call.completed_at).getTime() - new Date(call.started_at).getTime();
    }
  }

  /**
   * Add reasoning trace (for agents that expose thinking)
   */
  addReasoningTrace(trace: string): void {
    this.reasoningTraces.push(trace);
  }

  /**
   * Finalize and return the transcript
   */
  finalize(finalOutcome?: unknown): Transcript {
    const completedAt = new Date().toISOString();
    const wallTime = Date.now() - this.startTime;

    const metrics: TranscriptMetrics = {
      n_turns: this.turns.length,
      n_tool_calls: this.toolCalls.length,
      total_tokens: this.totalInputTokens + this.totalOutputTokens,
      input_tokens: this.totalInputTokens,
      output_tokens: this.totalOutputTokens,
      wall_time_ms: wallTime,
      time_to_first_token_ms: this.firstTokenTime ? this.firstTokenTime - this.startTime : undefined,
      time_to_last_token_ms: wallTime,
      tokens_per_second: wallTime > 0 ? (this.totalOutputTokens / (wallTime / 1000)) : undefined,
    };

    return {
      task_id: this.taskId,
      trial_id: this.trialId,
      started_at: new Date(this.startTime).toISOString(),
      completed_at: completedAt,
      turns: this.turns,
      tool_calls: this.toolCalls,
      reasoning_traces: this.reasoningTraces.length > 0 ? this.reasoningTraces : undefined,
      final_outcome: finalOutcome,
      metrics,
    };
  }

  /**
   * Get current metrics (for monitoring)
   */
  getCurrentMetrics(): Partial<TranscriptMetrics> {
    return {
      n_turns: this.turns.length,
      n_tool_calls: this.toolCalls.length,
      total_tokens: this.totalInputTokens + this.totalOutputTokens,
      wall_time_ms: Date.now() - this.startTime,
    };
  }
}

/**
 * Parse a Claude Code session transcript into our format
 */
export function parseClaudeCodeTranscript(
  sessionLog: string,
  taskId: string,
  trialId: string
): Transcript {
  const capture = new TranscriptCapture(taskId, trialId);

  // Parse JSONL format (Claude Code history format)
  const lines = sessionLog.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      // Handle different entry types
      if (entry.type === 'user') {
        capture.addTurn('user', entry.content, entry.tokens);
      } else if (entry.type === 'assistant') {
        capture.addTurn('assistant', entry.content, entry.tokens);

        // Extract tool calls from assistant messages
        if (entry.tool_calls) {
          for (const tc of entry.tool_calls) {
            const id = capture.startToolCall(tc.name, tc.params);
            if (tc.result !== undefined) {
              capture.completeToolCall(id, tc.result, tc.error);
            }
          }
        }
      } else if (entry.type === 'tool_result') {
        capture.addTurn('tool', entry.content);
      } else if (entry.type === 'thinking') {
        capture.addReasoningTrace(entry.content);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return capture.finalize();
}

/**
 * Create a transcript from structured data
 */
export function createTranscript(
  taskId: string,
  trialId: string,
  data: {
    turns: { role: 'user' | 'assistant' | 'system' | 'tool'; content: string }[];
    toolCalls?: { name: string; params: Record<string, unknown>; result?: unknown }[];
    finalOutcome?: unknown;
  }
): Transcript {
  const capture = new TranscriptCapture(taskId, trialId);

  for (const turn of data.turns) {
    capture.addTurn(turn.role, turn.content);
  }

  if (data.toolCalls) {
    for (const tc of data.toolCalls) {
      const id = capture.startToolCall(tc.name, tc.params);
      capture.completeToolCall(id, tc.result);
    }
  }

  return capture.finalize(data.finalOutcome);
}

// CLI for testing
if (import.meta.main) {
  const [command, ...args] = Bun.argv.slice(2);

  if (command === 'parse' && args[0]) {
    const file = Bun.file(args[0]);
    const content = await file.text();
    const transcript = parseClaudeCodeTranscript(content, 'test-task', 'trial-1');
    console.log(JSON.stringify(transcript, null, 2));
  } else {
    console.log('Usage: TranscriptCapture.ts parse <session-log-file>');
  }
}
