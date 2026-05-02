/**
 * PAI Installer v5.0 — Type Definitions
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
    /** DA name recovered from a prior install or backup (DA_IDENTITY.md / settings.json). */
    daName?: string;
    /** API key VALUES recovered from shell rc files / .env / prior install — not just presence flags. */
    apiKeys: {
      elevenLabs?: string;
      anthropic?: string;
      openai?: string;
      google?: string;
      xai?: string;
      perplexity?: string;
    };
  };
  existingUserContent?: ExistingUserContentDetection;
  /** Principal identity scanned from the local machine (git config, macOS dscl, $USER). */
  principal: {
    /** Full name: prefers `git config user.name`, falls back to macOS RealName, then $USER. */
    name?: string;
    /** Email from `git config user.email`. */
    email?: string;
    /** OS login name; always populated. */
    username: string;
  };
  /** Voice preferences detected from the OS. */
  voice?: {
    /** macOS default speech voice (`defaults read com.apple.speech.synthesis.general.prefs SelectedVoiceName`). */
    systemDefault?: string;
  };
  timezone: string;
  homeDir: string;
  /** Claude Code config root: $CLAUDE_CONFIG_DIR or ~/.claude (resolved). */
  claudeConfigDir: string;
  /** PAI data root: $PAI_DIR or ${claudeConfigDir}/PAI (resolved). */
  paiDir: string;
  /** Third-domain credentials store: $PAI_CONFIG_DIR or ~/.config/PAI (resolved). */
  configDir: string;
}

export interface ExistingUserContentDetection {
  telos: {
    mission: boolean;
    goals: boolean;
    goalsCount: number;
    activeProblems: boolean;
    strategy: boolean;
    principles: boolean;
    areas: boolean;
    now: boolean;
  };
  identity: {
    principalIdentity: boolean;
    daIdentity: boolean;
    daIdentityYaml: boolean;
    workingStyle: boolean;
    rhetoricalStyle: boolean;
    aiWritingPatterns: boolean;
    feed: boolean;
    resume: boolean;
    ourStory: boolean;
    definitions: boolean;
    coreContent: boolean;
    beliefs: boolean;
  };
  contacts: {
    contacts: boolean;
    count: number;
  };
  opinions: {
    opinions: boolean;
  };
  projects: {
    projectsIndex: boolean;
    projectsDirectory: boolean;
    count: number;
  };
  business: {
    present: boolean;
  };
  finances: {
    present: boolean;
  };
  health: {
    present: boolean;
  };
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
  | "telegram"
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
  /** Backup of the existing claudeConfigDir (sibling, e.g. ~/.claude.backup-<ts>). */
  backupPath?: string;
  /**
   * Backup of the existing paiDir when cross-domain split is configured
   * (paiDir != ${claudeConfigDir}/PAI). Sibling of paiDir, e.g.
   * /a/PAI.backup-<ts>. Unset under default config — backupPath then
   * already covers PAI data via the claude-home backup.
   */
  paiBackupPath?: string;

  // Collected data
  collected: {
    elevenLabsKey?: string;
    scanConsent?: "yes-full" | "yes-id" | "no";
    principalName?: string;
    timezone?: string;
    aiName?: string;
    catchphrase?: string;
    projectsDir?: string;
    temperatureUnit?: "fahrenheit" | "celsius";
    voiceType?: "female" | "male" | "custom";
    customVoiceId?: string;
    telegramBotToken?: string;
    telegramAllowedUsers?: string;
    telegramBotUsername?: string;
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
  temperatureUnit?: "fahrenheit" | "celsius";
  voiceType?: string;
  voiceId?: string;
  paiDir: string;
  configDir: string;
}

// ─── WebSocket Protocol ──────────────────────────────────────────

// Server → Client messages
export type ServerMessage =
  | { type: "connected"; port: number }
  | { type: "section_header"; sectionId: string; title: string; subtitle?: string; stepNumber?: number }
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
  | { event: "section_header"; sectionId: string; title: string; subtitle?: string; stepNumber?: number }
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

// ─── Release Versions (single source of truth) ─────────────────
// Update these when cutting a new PAI release.
// The installer reads these constants — no other file should hardcode versions.

export const PAI_VERSION = "5.0.0";
// Fallback only — the live PAI/ALGORITHM/LATEST file is the single source
// of truth (v6.2.0+ doctrine). runConfiguration prefers LATEST and only
// uses this constant when the staged tree didn't ship a LATEST file.
export const ALGORITHM_VERSION = "6.2.0";
export const INSTALLER_VERSION = "5.0";

// ElevenLabs voice IDs for the install picker. Six built-in options across
// three gender presentations, two voices each, so a fresh user can pick
// without needing to know what an ElevenLabs voice ID is. Custom Voice ID
// and Skip Voice are surfaced alongside these in the picker UI.
//
// These IDs are public ElevenLabs voice identifiers — not API keys, not
// credentials. They identify which TTS voice to render with; the user's own
// ELEVENLABS_API_KEY is required separately to actually invoke synthesis.
export interface VoiceOption {
  /** Stable picker key, used in state.collected.voiceType. */
  id: string;
  /** Public ElevenLabs voice ID (no auth, just an identifier). */
  voiceId: string;
  /** Label shown in the picker. */
  label: string;
  /** Short description shown under the label. */
  description: string;
}

export const DEFAULT_VOICES: readonly VoiceOption[] = [
  { id: "female-1",  voiceId: "AyCt0WmAXUcPJR11zeeP", label: "Female 1",  description: "Voice ID AyCt0WmAXUcPJR11zeeP" },
  { id: "female-2",  voiceId: "VD1if7jDVYtAKs4P0FIY", label: "Female 2",  description: "Voice ID VD1if7jDVYtAKs4P0FIY" },
  { id: "male-1",    voiceId: "gUU37agQvEpxeWrZUIMk", label: "Male 1",    description: "Voice ID gUU37agQvEpxeWrZUIMk" },
  { id: "male-2",    voiceId: "77aEIu0qStu8Jwv1EdhX", label: "Male 2",    description: "Voice ID 77aEIu0qStu8Jwv1EdhX" },
  { id: "neutral-1", voiceId: "807MhexSYBuyUN7pI4wT", label: "Neutral 1", description: "Voice ID 807MhexSYBuyUN7pI4wT" },
  { id: "neutral-2", voiceId: "rk9BD4xwuG39syvDIBQy", label: "Neutral 2", description: "Voice ID rk9BD4xwuG39syvDIBQy" },
] as const;
