#!/usr/bin/env bun
/**
 * ============================================================================
 * PAI ACTIONS - Core Type Definitions
 * ============================================================================
 *
 * Actions are atomic, composable units of work with typed inputs and outputs.
 * They follow Unix philosophy: do one thing well, communicate via JSON streams.
 *
 * KEY CONCEPTS:
 * - Actions have Zod schemas for input/output validation
 * - Actions can run locally or as Cloudflare Workers
 * - Pipelines chain actions, but ARE actions (same interface)
 * - Everything is JSON stdin → processing → JSON stdout
 *
 * ============================================================================
 */

import { z, type ZodType } from "zod";

/**
 * Execution context passed to every action
 */
export interface ActionContext {
  /** Where the action is running */
  mode: "local" | "cloud";

  /** Environment/secrets available to the action */
  env?: Record<string, string>;

  /** Trace context for observability */
  trace?: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
  };

  /** Pipeline context when running as part of a pipeline */
  pipeline?: {
    name: string;
    stepId: string;
    stepIndex: number;
  };
}

/**
 * Result wrapper for action execution
 */
export interface ActionResult<T> {
  success: boolean;
  output?: T;
  error?: string;
  metadata?: {
    durationMs: number;
    action: string;
    mode: "local" | "cloud";
  };
}

/**
 * Deployment hints for worker generation
 */
export interface DeploymentConfig {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Memory limit in MB for worker sizing */
  memory?: number;

  /** Environment variables/secrets required */
  secrets?: string[];

  /** CPU-intensive: use unbound worker */
  cpuIntensive?: boolean;
}

/**
 * The core Action specification
 *
 * Every action implements this interface. Pipelines also implement this
 * interface, making them composable at the same level as atomic actions.
 */
export interface ActionSpec<TInput = unknown, TOutput = unknown> {
  /** Unique identifier: category/name (e.g., "parse/topic") */
  name: string;

  /** Semantic version */
  version: string;

  /** Human-readable description */
  description: string;

  /** Zod schema for input validation */
  inputSchema: ZodType<TInput>;

  /** Zod schema for output validation */
  outputSchema: ZodType<TOutput>;

  /** The execution function */
  execute: (input: TInput, ctx: ActionContext) => Promise<TOutput>;

  /** Optional deployment configuration */
  deployment?: DeploymentConfig;

  /** Optional tags for categorization */
  tags?: string[];
}

/**
 * Registry entry with resolved metadata
 */
export interface ActionRegistryEntry {
  name: string;
  version: string;
  description: string;
  path: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  tags?: string[];
  deployment?: DeploymentConfig;
}

/**
 * The action registry format
 */
export interface ActionRegistry {
  version: string;
  generatedAt: string;
  actions: ActionRegistryEntry[];
}

/**
 * Helper to create a typed action
 */
export function defineAction<TInput, TOutput>(
  spec: ActionSpec<TInput, TOutput>
): ActionSpec<TInput, TOutput> {
  return spec;
}

/**
 * Common schema types for reuse across actions
 */
export const CommonSchemas = {
  /** Simple text input */
  TextInput: z.object({
    text: z.string().min(1),
  }),

  /** URL input */
  UrlInput: z.object({
    url: z.string().url(),
  }),

  /** Topic structure */
  Topic: z.object({
    name: z.string(),
    subtopics: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
  }),

  /** Search query */
  SearchQuery: z.object({
    query: z.string(),
    limit: z.number().int().positive().optional(),
  }),

  /** Search result */
  SearchResult: z.object({
    url: z.string(),
    title: z.string(),
    snippet: z.string(),
    relevance: z.number().min(0).max(1).optional(),
  }),

  /** Markdown output */
  MarkdownOutput: z.object({
    content: z.string(),
    wordCount: z.number().int().optional(),
  }),
};

// Export Zod for convenience
export { z };
