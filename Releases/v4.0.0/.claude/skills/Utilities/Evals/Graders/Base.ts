/**
 * Base Grader Interface
 * All graders implement this interface for consistent execution
 */

import type { GraderConfig, GraderResult, Transcript, GraderType } from '../Types/index.ts';

export interface GraderContext {
  task_id: string;
  trial_id: string;
  transcript: Transcript;
  output: string;  // Final output text
  working_dir?: string;
  reference?: string;  // Reference/golden output if available
}

export abstract class BaseGrader {
  abstract type: GraderType;
  abstract category: 'code_based' | 'model_based' | 'human';

  protected config: GraderConfig;

  constructor(config: GraderConfig) {
    this.config = config;
  }

  /**
   * Execute the grader and return results
   */
  abstract grade(context: GraderContext): Promise<GraderResult>;

  /**
   * Get the weight for this grader
   */
  getWeight(): number {
    return this.config.weight ?? 1.0;
  }

  /**
   * Check if this grader is required (task fails if grader fails)
   */
  isRequired(): boolean {
    return this.config.required ?? false;
  }

  /**
   * Create a result object
   */
  protected createResult(
    score: number,
    passed: boolean,
    duration_ms: number,
    options?: {
      reasoning?: string;
      details?: Record<string, unknown>;
    }
  ): GraderResult {
    return {
      grader_type: this.type,
      weight: this.getWeight(),
      score,
      passed,
      duration_ms,
      reasoning: options?.reasoning,
      details: options?.details,
    };
  }
}

/**
 * Grader registry for dynamic instantiation
 */
const graderRegistry = new Map<GraderType, new (config: GraderConfig) => BaseGrader>();

export function registerGrader(type: GraderType, graderClass: new (config: GraderConfig) => BaseGrader): void {
  graderRegistry.set(type, graderClass);
}

export function createGrader(config: GraderConfig): BaseGrader {
  const GraderClass = graderRegistry.get(config.type);
  if (!GraderClass) {
    throw new Error(`Unknown grader type: ${config.type}`);
  }
  return new GraderClass(config);
}

export function listGraders(): GraderType[] {
  return Array.from(graderRegistry.keys());
}

/**
 * Run multiple graders and aggregate results
 */
export async function runGraders(
  graders: BaseGrader[],
  context: GraderContext
): Promise<{ results: GraderResult[]; aggregate_score: number; passed: boolean }> {
  const results: GraderResult[] = [];
  let totalWeight = 0;
  let weightedSum = 0;
  let allRequiredPassed = true;

  for (const grader of graders) {
    const result = await grader.grade(context);
    results.push(result);

    // Aggregate
    const weight = grader.getWeight();
    totalWeight += weight;
    weightedSum += result.score * weight;

    // Check required
    if (grader.isRequired() && !result.passed) {
      allRequiredPassed = false;
    }
  }

  const aggregate_score = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const passed = allRequiredPassed && aggregate_score >= 0.5;  // Default threshold

  return { results, aggregate_score, passed };
}
