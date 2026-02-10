/**
 * Core type definitions for PAI Voice Input system.
 *
 * Defines the contracts for speech-to-text providers, wake word detection,
 * hotkey activation, and the voice input pipeline configuration.
 */

// --- STT Provider ---

/** Result of a speech-to-text transcription. */
export interface TranscriptionResult {
  /** The transcribed text. */
  text: string;
  /** Confidence score from the STT engine (0.0 - 1.0). */
  confidence: number;
  /** Duration of the audio that was transcribed, in milliseconds. */
  durationMs: number;
  /** Which provider produced this result. */
  provider: string;
  /** Whether the transcription is final or interim (streaming). */
  isFinal: boolean;
}

/** Lifecycle and capability contract for any STT engine. */
export interface STTProvider {
  /** Human-readable provider name (e.g. "whisper-local", "elevenlabs-stt"). */
  readonly name: string;

  /** Initialize the provider (load models, authenticate, etc.). */
  initialize(): Promise<void>;

  /** Begin listening and capturing audio from the microphone. */
  startListening(): Promise<void>;

  /** Stop listening and return the final transcription. */
  stopListening(): Promise<TranscriptionResult>;

  /** Transcribe a raw audio buffer (offline/batch mode). */
  transcribe(audio: Buffer): Promise<TranscriptionResult>;

  /** Clean up resources (unload models, close connections). */
  dispose(): Promise<void>;
}

// --- Activation ---

/** Callback invoked when the wake word is detected. */
export type WakeWordCallback = () => void;

/** Contract for wake word detection engines. */
export interface WakeWordDetector {
  /** The wake phrase this detector is listening for. */
  readonly phrase: string;

  /** Start listening for the wake word on the default audio input. */
  start(): Promise<void>;

  /** Stop listening for the wake word. */
  stop(): Promise<void>;

  /** Register a callback that fires when the wake word is detected. */
  onDetected(callback: WakeWordCallback): void;
}

/** Callback invoked when the hotkey combination is pressed. */
export type HotkeyCallback = () => void;

/** Contract for global hotkey listeners. */
export interface HotkeyTrigger {
  /** The key combination (e.g. "Fn+V", "Cmd+Shift+Space"). */
  readonly combo: string;

  /** Register the global hotkey listener. */
  register(): Promise<void>;

  /** Unregister the global hotkey listener. */
  unregister(): Promise<void>;

  /** Register a callback that fires when the hotkey is pressed. */
  onTriggered(callback: HotkeyCallback): void;
}

// --- Configuration ---

export interface AudioSettings {
  /** Sample rate in Hz (default: 16000 — required by most STT models). */
  sampleRate: number;
  /** Number of audio channels (1 = mono, 2 = stereo). */
  channels: number;
  /** Audio encoding format. */
  encoding: "pcm_s16le" | "pcm_f32le" | "opus";
}

export interface WakeWordConfig {
  enabled: boolean;
  /** The phrase to listen for (e.g. "Hey JAM"). */
  phrase: string;
  /** Detection engine to use. */
  engine: "porcupine" | "whisper-vad" | "custom";
}

export interface HotkeyConfig {
  enabled: boolean;
  /** Key combination string (e.g. "Fn+V", "Cmd+Shift+Space"). */
  combo: string;
}

/** Top-level configuration for the voice input system. */
export interface VoiceInputConfig {
  /** Which STT provider to use. */
  provider: "whisper" | "elevenlabs" | "macos-dictation";
  /** Wake word activation settings. */
  wakeWord: WakeWordConfig;
  /** Hotkey activation settings. */
  hotkey: HotkeyConfig;
  /** Audio capture settings. */
  audio: AudioSettings;
  /** HTTP server port for the voice input API. */
  port: number;
  /** Whether to auto-submit transcription to Claude Code. */
  autoSubmit: boolean;
}
