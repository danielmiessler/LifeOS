#!/usr/bin/env bun
/**
 * ============================================================================
 * PAI ACTIONS v2 - Shareable Action Types
 * ============================================================================
 *
 * Actions are portable, self-contained units that:
 * - Use JSON Schema (universal) not Zod (TypeScript-specific)
 * - Declare capabilities needed, don't import implementations
 * - Can be packaged, shared, downloaded, run anywhere
 *
 * Package structure:
 *   action.json  - Metadata, JSON schemas, capability requirements
 *   action.ts    - Implementation (receives capabilities via context)
 *
 * ============================================================================
 */

import type { JSONSchema7 } from "json-schema";

/**
 * Capabilities that actions can request.
 * Runtime provides implementations - actions don't import them.
 */
export interface ActionCapabilities {
  /** LLM inference - prompt in, response out */
  llm?: (prompt: string, options?: LLMOptions) => Promise<LLMResponse>;

  /** HTTP fetch */
  fetch?: typeof fetch;

  /** Shell command execution */
  shell?: (cmd: string) => Promise<{ stdout: string; stderr: string; code: number }>;

  /** File read (sandboxed) */
  readFile?: (path: string) => Promise<string>;

  /** File write (sandboxed) */
  writeFile?: (path: string, content: string) => Promise<void>;

  /** Key-value storage */
  kv?: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, ttl?: number) => Promise<void>;
  };
}

export interface LLMOptions {
  /** Model tier: fast (haiku), standard (sonnet), smart (opus) */
  tier?: "fast" | "standard" | "smart";
  /** System prompt */
  system?: string;
  /** Expect JSON response */
  json?: boolean;
  /** Max tokens */
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  json?: unknown;
  usage?: { input: number; output: number };
}

/**
 * Execution context passed to every action
 */
export interface ActionContext {
  /** Injected capabilities based on action's requirements */
  capabilities: ActionCapabilities;

  /** Execution environment */
  env: {
    mode: "local" | "cloud";
    /** Secrets available (names only, values via capabilities) */
    secrets?: string[];
  };

  /** Trace for observability */
  trace?: {
    traceId: string;
    spanId: string;
  };

  /** Pipeline context when running in a pipeline */
  pipeline?: {
    name: string;
    stepId: string;
  };
}

/**
 * Action manifest - the action.json file
 */
export interface ActionManifest {
  /** Unique name: category/name */
  name: string;

  /** Semantic version */
  version: string;

  /** Human description */
  description: string;

  /** Input schema (JSON Schema draft-07) */
  input: JSONSchema7;

  /** Output schema (JSON Schema draft-07) */
  output: JSONSchema7;

  /** Capabilities this action requires */
  requires?: Array<"llm" | "fetch" | "shell" | "readFile" | "writeFile" | "kv">;

  /** Tags for categorization */
  tags?: string[];

  /** Author info */
  author?: {
    name: string;
    url?: string;
  };

  /** License */
  license?: string;

  /** Deployment hints */
  deployment?: {
    timeout?: number;
    memory?: number;
    secrets?: string[];
  };
}

/**
 * The action implementation interface
 */
export interface ActionImplementation<TInput = unknown, TOutput = unknown> {
  /** Execute the action */
  execute: (input: TInput, ctx: ActionContext) => Promise<TOutput>;
}

/**
 * Result wrapper
 */
export interface ActionResult<T = unknown> {
  success: boolean;
  output?: T;
  error?: string;
  metadata?: {
    durationMs: number;
    action: string;
    version: string;
  };
}

/**
 * Helper to validate input/output against JSON Schema
 */
export async function validateSchema(
  data: unknown,
  schema: JSONSchema7
): Promise<{ valid: boolean; errors?: string[] }> {
  // Use Ajv for validation
  const Ajv = (await import("ajv")).default;
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (!valid && validate.errors) {
    return {
      valid: false,
      errors: validate.errors.map(e => `${e.instancePath} ${e.message}`),
    };
  }

  return { valid: true };
}
