/**
 * PAI Installer v4.0 — Type Definitions
 * Shared types for engine, CLI, and web frontends.
 */

// ─── System Detection ────────────────────────────────────────────

export interface DetectionResult {
  os: {
    platform: "darwin" | "linux";
    arch: string;
    version: string;
    name: string; // e.g., "macOS 15.2" or "Ubuntu 24.04"
  };
  shell: {
    name: string;
    version: string;
    path: string;
  };
  tools: {
    bun: { installed: boolean; version?: string; path?: string };
    git: { installed: boolean; version?: string; path?: string };
    claude: { installed: boolean; version?: string; path?: string };
    node: { installed: boolean; version?: string; path?: string };
    brew: { installed: boolean; path?: string }; // macOS only
  };
  existing: {
    paiInstalled: boolean;
    paiVersion?: string;
    settingsPath?: string;
    hasApiKeys: boolean;
    elevenLabsKeyFound: boolean;
    backupPaths: string[];
  };
  timezone: string;
  homeDir: string;
  paiDir: string; // resolved ~/.claude
  configDir: string; // resolved ~/.config/PAI
}

// ─── Install Steps ───────────────────────────────────────────────

export type StepId =
  | "system-detect"
  | "prerequisites"
  | "api-keys"
  | "identity"
  | "repository"
  | "configuration"
  | "voice"
  | "validation";

export interface StepDefinition {
  id: StepId;
  name: string;
  description: string;
  number: number; // 1-8
  required: boolean;
  dependsOn: StepId[];
  condition?: (state: InstallState) => boolean; // skip if false
}

export type StepStatus = "pending" | "active" | "completed" | "skipped" | "failed";

// ─── Install State ───────────────────────────────────────────────

export interface InstallState {
  version: string;
  startedAt: string;
  updatedAt: string;
  currentStep: StepId;
  completedSteps: StepId[];
  skippedSteps: StepId[];
  mode: "cli" | "web";

  // Detection cache
  detection: DetectionResult | null;

  // Collected data
  collected: {
    elevenLabsKey?: string;
    principalName?: string;
    timezone?: string;
    aiName?: string;
    catchphrase?: string;
    projectsDir?: string;
    voiceType?: "female" | "male" | "custom";
    customVoiceId?: string;
  };

  // Results
  installType: "fresh" | "upgrade" | null;
  errors: StepError[];
}

export interface StepError {
  step: StepId;
  message: string;
  timestamp: string;
  recoverable: boolean;
}

// ─── Configuration ───────────────────────────────────────────────

export interface PAIConfig {
  principalName: string;
  timezone: string;
  aiName: string;
  catchphrase: string;
  projectsDir?: string;
  voiceType?: string;
  voiceId?: string;
  paiDir: string;
  configDir: string;
}

// ─── WebSocket Protocol ──────────────────────────────────────────

// Server → Client messages
export type ServerMessage =
  | { type: "connected"; port: number }
  | { type: "step_update"; step: StepId; status: StepStatus; detail?: string }
  | { type: "detection_result"; data: DetectionResult }
  | { type: "message"; role: "assistant" | "system"; content: string; speak?: boolean }
  | { type: "input_request"; id: string; prompt: string; inputType: "text" | "password" | "key"; placeholder?: string }
  | { type: "choice_request"; id: string; prompt: string; choices: { label: string; value: string; description?: string }[] }
  | { type: "progress"; step: StepId; percent: number; detail: string }
  | { type: "voice_enabled"; enabled: boolean; mode: "elevenlabs" | "browser" | "none" }
  | { type: "install_complete"; success: boolean; summary: InstallSummary }
  | { type: "validation_result"; checks: ValidationCheck[] }
  | { type: "error"; message: string; step?: StepId };

// Client → Server messages
export type ClientMessage =
  | { type: "client_ready" }
  | { type: "user_input"; requestId: string; value: string }
  | { type: "user_choice"; requestId: string; value: string }
  | { type: "mode_select"; mode: "cli" | "web" }
  | { type: "start_install"; config?: Partial<InstallState["collected"]> }
  | { type: "go_to_step"; step: StepId }
  | { type: "voice_toggle"; enabled: boolean };

// ─── Validation ──────────────────────────────────────────────────

export interface ValidationCheck {
  name: string;
  passed: boolean;
  detail: string;
  critical: boolean;
}

export interface InstallSummary {
  paiVersion: string;
  principalName: string;
  aiName: string;
  timezone: string;
  voiceEnabled: boolean;
  voiceMode: string;
  catchphrase: string;
  installType: "fresh" | "upgrade";
  completedSteps: number;
  totalSteps: number;
}

// ─── Engine Events ───────────────────────────────────────────────

export type EngineEvent =
  | { event: "step_start"; step: StepId }
  | { event: "step_complete"; step: StepId }
  | { event: "step_error"; step: StepId; error: string }
  | { event: "step_skip"; step: StepId; reason: string }
  | { event: "progress"; step: StepId; percent: number; detail: string }
  | { event: "message"; content: string; speak?: boolean }
  | { event: "input_needed"; id: string; prompt: string; type: "text" | "password" | "key"; placeholder?: string }
  | { event: "choice_needed"; id: string; prompt: string; choices: { label: string; value: string; description?: string }[] }
  | { event: "complete"; summary: InstallSummary }
  | { event: "error"; message: string };

export type EngineEventHandler = (event: EngineEvent) => void | Promise<void>;

// ─── Voice ───────────────────────────────────────────────────────

export const DEFAULT_VOICES = {
  male: "pNInz6obpgDQGcFmaJgB", // Adam
  female: "21m00Tcm4TlvDq8ikWAM", // Rachel
} as const;
