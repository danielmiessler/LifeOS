/**
 * Evals Type System
 * Based on Anthropic's "Demystifying Evals for AI Agents" (Jan 2026)
 */

// =============================================================================
// TASK DEFINITION
// =============================================================================

export type EvalDomain = 'coding' | 'conversational' | 'research' | 'computer_use' | 'general';
export type EvalType = 'capability' | 'regression';
export type TaskStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error';

export interface Task {
  id: string;
  description: string;
  type: EvalType;
  domain: EvalDomain;

  // Environment setup
  setup?: {
    sandbox?: boolean;
    git_repo?: string;
    checkout?: string;
    working_dir?: string;
    env_vars?: Record<string, string>;
    timeout_ms?: number;
  };

  // Grader configuration
  graders: GraderConfig[];

  // Tracked metrics
  tracked_metrics?: MetricConfig[];

  // Trial configuration
  trials?: number;  // Default: 1
  pass_threshold?: number;  // Default: 0.75

  // Reference solution (proves solvability)
  reference_solution?: string;

  // Tags for filtering
  tags?: string[];

  // Metadata
  created_at?: string;
  updated_at?: string;
  source?: 'manual' | 'failure_log' | 'generated';
}

// =============================================================================
// GRADER CONFIGURATION
// =============================================================================

export type GraderType =
  // Code-based (fast, deterministic)
  | 'string_match'
  | 'regex_match'
  | 'binary_tests'
  | 'static_analysis'
  | 'state_check'
  | 'tool_calls'
  | 'json_schema'
  | 'outcome_verification'
  // Model-based (flexible, nuanced)
  | 'llm_rubric'
  | 'natural_language_assert'
  | 'pairwise_comparison'
  | 'reference_comparison'
  // Human (gold standard)
  | 'human_review'
  | 'spot_check';

export interface GraderConfig {
  type: GraderType;
  weight?: number;  // Default: 1.0
  required?: boolean;  // If true, task fails if this grader fails

  // Type-specific params
  params?: Record<string, unknown>;
}

// Code-based grader params
export interface StringMatchParams {
  patterns: string[];
  mode: 'all' | 'any';
  case_sensitive?: boolean;
}

export interface RegexMatchParams {
  patterns: string[];
  mode: 'all' | 'any';
  flags?: string;
}

export interface BinaryTestsParams {
  test_files: string[];
  test_command?: string;  // Default: appropriate for language
  timeout_ms?: number;
}

export interface StaticAnalysisParams {
  commands: string[];  // e.g., ['ruff', 'mypy', 'bandit']
  fail_on_warning?: boolean;
}

export interface StateCheckParams {
  expect: Record<string, unknown>;
  check_files?: { path: string; contains?: string[]; not_contains?: string[] }[];
  check_env?: Record<string, string>;
}

export interface ToolCallsParams {
  required?: { tool: string; params?: Record<string, unknown> }[];
  forbidden?: string[];
  sequence?: string[];  // Tools must be called in this order
  max_calls?: number;
}

// Model-based grader params
export interface LLMRubricParams {
  rubric: string;  // Path to rubric file or inline content
  assertions?: string[];
  judge_model?: string;
  reasoning_first?: boolean;
  scale?: '1-5' | '1-10' | 'pass-fail';
}

export interface NaturalLanguageAssertParams {
  assertions: string[];
  judge_model?: string;
  require_all?: boolean;
}

export interface PairwiseComparisonParams {
  reference: string;  // Path to reference output
  judge_model?: string;
  position_swap?: boolean;
  criteria?: string[];
}

// =============================================================================
// TRANSCRIPT / TRAJECTORY
// =============================================================================

export interface Transcript {
  task_id: string;
  trial_id: string;
  started_at: string;
  completed_at?: string;

  // Full conversation
  turns: Turn[];

  // Tool usage
  tool_calls: ToolCall[];

  // Reasoning traces (if agent exposes thinking)
  reasoning_traces?: string[];

  // Final state
  final_outcome?: unknown;

  // Computed metrics
  metrics: TranscriptMetrics;
}

export interface Turn {
  index: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call?: ToolCall;
  timestamp: string;
  tokens?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  params: Record<string, unknown>;
  result?: unknown;
  error?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
}

export interface TranscriptMetrics {
  n_turns: number;
  n_tool_calls: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  wall_time_ms: number;
  time_to_first_token_ms?: number;
  time_to_last_token_ms?: number;
  tokens_per_second?: number;
}

// =============================================================================
// TRIAL EXECUTION
// =============================================================================

export interface Trial {
  id: string;
  task_id: string;
  trial_number: number;

  status: TaskStatus;
  started_at: string;
  completed_at?: string;

  // Full transcript
  transcript: Transcript;

  // Grader results
  grader_results: GraderResult[];

  // Aggregate score
  score: number;
  passed: boolean;

  // Error info if failed
  error?: string;
}

export interface GraderResult {
  grader_type: GraderType;
  weight: number;

  score: number;  // 0-1
  passed: boolean;

  // Detailed output
  reasoning?: string;
  details?: Record<string, unknown>;

  // Timing
  duration_ms: number;
}

// =============================================================================
// EVALUATION RUN
// =============================================================================

export interface EvalRun {
  id: string;
  task_id: string;

  // Configuration
  model?: string;
  prompt_version?: string;

  // Trials
  trials: Trial[];
  n_trials: number;

  // Aggregate metrics
  pass_rate: number;
  mean_score: number;
  std_dev: number;

  // pass@k: P(at least 1 success in k trials) - measures capability
  pass_at_k: number;

  // pass^k: P(all k trials succeed) - measures consistency
  pass_to_k: number;

  // Timing
  started_at: string;
  completed_at?: string;
  total_duration_ms: number;

  // Metadata
  metadata?: Record<string, unknown>;
}

// =============================================================================
// METRIC CONFIGURATION
// =============================================================================

export interface MetricConfig {
  type: 'transcript' | 'latency' | 'custom';
  metrics: string[];
}

// =============================================================================
// EVAL SUITE
// =============================================================================

export interface EvalSuite {
  name: string;
  description: string;
  type: EvalType;
  domain?: EvalDomain;

  tasks: string[];  // Task IDs

  // Suite-level thresholds
  pass_threshold?: number;
  saturation_threshold?: number;  // When to graduate to regression

  // Metadata
  created_at: string;
  updated_at?: string;
}

// =============================================================================
// SATURATION MONITORING
// =============================================================================

export interface SaturationStatus {
  suite_id: string;
  pass_rate_history: { date: string; rate: number }[];
  saturated: boolean;
  consecutive_above_threshold: number;
  recommended_action: 'graduate_to_regression' | 'add_harder_cases' | 'keep';
}

// =============================================================================
// HUMAN REVIEW
// =============================================================================

export interface HumanReview {
  id: string;
  trial_id: string;
  task_id: string;

  status: 'pending' | 'in_progress' | 'completed';

  // Review content
  reviewer?: string;
  score?: number;
  passed?: boolean;
  notes?: string;

  // Calibration
  model_score?: number;  // What the model grader said
  agreement?: boolean;  // Did human agree with model?

  created_at: string;
  completed_at?: string;
}

// =============================================================================
// FAILURE LOG (for converting failures to tasks)
// =============================================================================

export interface FailureLog {
  id: string;
  timestamp: string;

  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';

  // Context
  task_context?: string;
  expected_behavior?: string;
  actual_behavior?: string;

  // Transcript if available
  transcript?: Transcript;

  // Conversion status
  converted_to_task?: string;  // Task ID if converted
}

// =============================================================================
// ALGORITHM INTEGRATION
// =============================================================================

export interface AlgorithmEvalRequest {
  isc_row: number;
  suite: string;
  verification_criteria?: string;
}

export interface AlgorithmEvalResult {
  isc_row: number;
  suite: string;
  passed: boolean;
  score: number;
  summary: string;
  run_id: string;
}
